import { ENGINE_STATUS_KEY, STORAGE_KEY } from '@/lib/constants';
import { compileRules, type TabOrigin } from '@/lib/dnr';
import { createProfile } from '@/lib/factories';
import type { ExtensionMessage } from '@/lib/messages';
import { publishMocks } from '@/lib/mocks';
import { readState, updateState } from '@/lib/state';
import {
  clearNetworkLog,
  configureNetworkLog,
  listNetworkEntries,
  recordMockHit,
  restoreNetworkLog,
  setRuleLabels,
} from '@/background/network-log';
import { applyUserStyles, forgetTabStyles, resetTabStyles, syncUserScripts } from '@/background/userscripts';
import type { EngineStatus, ToolkitState, UserScriptsStatus } from '@/types';

const BADGE_OFF_TEXT = 'off';
const BADGE_OFF_COLOR = '#64748b';
const BADGE_ERROR_COLOR = '#ef4444';
const HTTP_URL_PATTERN = /^https?:/;

let lastStatus: EngineStatus = { appliedRuleCount: 0, activeProfileCount: 0, diagnostics: [], updatedAt: 0 };
let lastUserScriptsStatus: UserScriptsStatus = { supported: true, registeredCount: 0, error: null };

const collectTabOrigins = async (): Promise<TabOrigin[]> => {
  const tabs = await chrome.tabs.query({});
  const origins: TabOrigin[] = [];
  for (const tab of tabs) {
    if (typeof tab.id !== 'number' || !tab.url || !HTTP_URL_PATTERN.test(tab.url)) continue;
    try {
      origins.push({ id: tab.id, origin: new URL(tab.url).origin });
    } catch {
      continue;
    }
  }
  return origins;
};

const activeTabId = async (): Promise<number | null> => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return typeof tab?.id === 'number' ? tab.id : null;
};

const updateBadge = (state: ToolkitState, status: EngineStatus): void => {
  if (!state.globalEnabled) {
    void chrome.action.setBadgeText({ text: BADGE_OFF_TEXT });
    void chrome.action.setBadgeBackgroundColor({ color: BADGE_OFF_COLOR });
    return;
  }

  const hasErrors = status.diagnostics.some((diagnostic) => diagnostic.level === 'error');
  void chrome.action.setBadgeText({ text: status.appliedRuleCount ? String(status.appliedRuleCount) : '' });
  void chrome.action.setBadgeBackgroundColor({ color: hasErrors ? BADGE_ERROR_COLOR : state.ui.accent });
};

const applyEngine = async (): Promise<EngineStatus> => {
  const state = await readState();
  const [tabs, tabId] = await Promise.all([collectTabOrigins(), activeTabId()]);
  const compiled = compileRules(state, { activeTabId: tabId, tabs });

  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const diagnostics = [...compiled.diagnostics];

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: compiled.rules,
    });
  } catch (error) {
    diagnostics.push({
      level: 'error',
      message: `No se pudieron aplicar las reglas: ${error instanceof Error ? error.message : 'error desconocido'}`,
    });
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: existing.map((rule) => rule.id) });
  }

  setRuleLabels(compiled.labels);
  configureNetworkLog({
    enabled: state.network.enabled,
    maxEntries: state.network.maxEntries,
    onlyModified: state.network.onlyModified,
  });
  await publishMocks(state);
  lastUserScriptsStatus = await syncUserScripts(state);
  if (lastUserScriptsStatus.error) {
    diagnostics.push({ level: 'warning', message: `Userscripts: ${lastUserScriptsStatus.error}` });
  }

  lastStatus = {
    appliedRuleCount: compiled.rules.length,
    activeProfileCount: compiled.activeProfileCount,
    diagnostics,
    updatedAt: Date.now(),
  };

  updateBadge(state, lastStatus);
  await chrome.storage.session.set({ [ENGINE_STATUS_KEY]: lastStatus });
  return lastStatus;
};

let applyQueue: Promise<EngineStatus> = Promise.resolve(lastStatus);

const scheduleApply = (): Promise<EngineStatus> => {
  applyQueue = applyQueue
    .catch(() => lastStatus)
    .then(() => applyEngine())
    .catch((error: unknown) => {
      console.error('Bender: fallo al aplicar reglas', error);
      return lastStatus;
    });
  return applyQueue;
};

const seedDefaultProfile = async (): Promise<void> => {
  await updateState((state) => {
    if (state.profiles.length) return state;
    const profile = createProfile(0, { name: 'Local' });
    return { ...state, profiles: [profile], selectedProfileId: profile.id };
  });
};

chrome.runtime.onInstalled.addListener(() => {
  void seedDefaultProfile().then(scheduleApply);
});

chrome.runtime.onStartup.addListener(() => {
  resetTabStyles();
  void restoreNetworkLog().then(scheduleApply);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) void scheduleApply();
});

chrome.tabs.onActivated.addListener(() => {
  void scheduleApply();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTabStyles(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && HTTP_URL_PATTERN.test(tab.url)) {
    void readState().then((state) => applyUserStyles(state, tabId, tab.url ?? ''));
  }
  if (changeInfo.url) void scheduleApply();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-global') {
    void updateState((state) => ({ ...state, globalEnabled: !state.globalEnabled }));
    return;
  }
  if (command === 'open-panel') {
    void chrome.windows.getCurrent().then((window) => {
      if (typeof window.id === 'number') void chrome.sidePanel.open({ windowId: window.id });
    });
  }
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'engine/refresh':
      void scheduleApply().then(sendResponse);
      return true;
    case 'engine/status':
      sendResponse(lastStatus);
      return false;
    case 'network/list':
      sendResponse(listNetworkEntries());
      return false;
    case 'network/clear':
      clearNetworkLog();
      sendResponse(null);
      return false;
    case 'network/hit':
      recordMockHit(message.payload, sender.tab?.id ?? -1);
      sendResponse(null);
      return false;
    case 'userscripts/sync':
      void readState()
        .then(syncUserScripts)
        .then((status) => {
          lastUserScriptsStatus = status;
          sendResponse(status);
        });
      return true;
    default:
      return false;
  }
});

void restoreNetworkLog().then(scheduleApply);
