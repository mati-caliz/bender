import { ENGINE_STATUS_KEY, STORAGE_KEY } from "@/lib/constants";
import { compileRules, dependsOnTabs, type TabOrigin } from "@/lib/dnr";
import { errorMessage } from "@/lib/errors";
import { createProfile } from "@/lib/factories";
import type { ExtensionMessage } from "@/lib/messages";
import { publishPageConfig } from "@/lib/mocks";
import type { ScriptError } from "@/lib/script-errors";
import { readState, readStateDetailed, updateState, type DroppedItems } from "@/lib/state";
import {
  clearNetworkLog,
  configureNetworkLog,
  listNetworkEntries,
  networkLogDiagnostics,
  recordCapturedBodies,
  recordMockHit,
  restoreNetworkLog,
  setRuleLabels,
} from "@/background/network-log";
import { applyUserStyles, forgetTabStyles, resetTabStyles, syncUserScripts } from "@/background/userscripts";
import type { EngineStatus, ToolkitState, UserScriptsStatus } from "@/types";

const BADGE_OFF_TEXT = "off";
const BADGE_OFF_COLOR = "#64748b";
const BADGE_ERROR_COLOR = "#ef4444";
const HTTP_URL_PATTERN = /^https?:/;

let lastStatus: EngineStatus = {
  appliedRuleCount: 0,
  activeProfileCount: 0,
  activeHeaderCount: 0,
  diagnostics: [],
  updatedAt: 0,
};
let lastUserScriptsStatus: UserScriptsStatus = { supported: true, registeredCount: 0, error: null };

const collectTabOrigins = async (): Promise<TabOrigin[]> => {
  const tabs = await chrome.tabs.query({});
  const origins: TabOrigin[] = [];
  for (const tab of tabs) {
    if (typeof tab.id !== "number" || tab.url === undefined || !HTTP_URL_PATTERN.test(tab.url)) continue;
    try {
      origins.push({ id: tab.id, origin: new URL(tab.url).origin, url: tab.url });
    } catch {
      continue;
    }
  }
  return origins;
};

const activeTabId = async (): Promise<number | null> => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return typeof tab?.id === "number" ? tab.id : null;
};

const updateBadge = (state: ToolkitState, status: EngineStatus): void => {
  if (!state.globalEnabled) {
    void chrome.action.setBadgeText({ text: BADGE_OFF_TEXT });
    void chrome.action.setBadgeBackgroundColor({ color: BADGE_OFF_COLOR });
    return;
  }

  const hasErrors = status.diagnostics.some((diagnostic) => diagnostic.level === "error");
  void chrome.action.setBadgeText({
    text: status.activeHeaderCount > 0 ? String(status.activeHeaderCount) : "",
  });
  void chrome.action.setBadgeBackgroundColor({ color: hasErrors ? BADGE_ERROR_COLOR : state.ui.accent });
};

const DROPPED_ITEM_LABELS: readonly (readonly [keyof DroppedItems, string])[] = [
  ["profiles", "perfil(es)"],
  ["trafficRules", "regla(s)"],
  ["userScripts", "script(s)"],
  ["environments", "entorno(s)"],
];

const droppedItemsDiagnostics = (dropped: DroppedItems): EngineStatus["diagnostics"] => {
  const descriptions = DROPPED_ITEM_LABELS.filter(([kind]) => dropped[kind] > 0).map(
    ([kind, label]) => `${dropped[kind]} ${label}`,
  );
  if (descriptions.length === 0) return [];

  return [
    {
      level: "warning",
      message: `Se descartaron ${descriptions.join(", ")} porque estaban guardados con un formato invalido.`,
    },
  ];
};

const applyEngine = async (): Promise<EngineStatus> => {
  const { state, dropped } = await readStateDetailed();
  const [tabs, tabId] = await Promise.all([collectTabOrigins(), activeTabId()]);
  const compiled = compileRules(state, { activeTabId: tabId, tabs });

  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const diagnostics = [...compiled.diagnostics, ...droppedItemsDiagnostics(dropped)];

  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: compiled.rules,
    });
  } catch (error) {
    diagnostics.push({
      level: "error",
      message: `No se pudieron aplicar las reglas: ${errorMessage(error, "error desconocido")}`,
    });
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: existing.map((rule) => rule.id) });
  }

  setRuleLabels(compiled.labels);
  configureNetworkLog({
    enabled: state.network.enabled,
    maxEntries: state.network.maxEntries,
    onlyModified: state.network.onlyModified,
  });
  await publishPageConfig(state);
  lastUserScriptsStatus = await syncUserScripts(state);
  const userScriptsError = lastUserScriptsStatus.error;
  if (userScriptsError !== null && userScriptsError !== "") {
    diagnostics.push({ level: "warning", message: `Userscripts: ${userScriptsError}` });
  }
  diagnostics.push(...networkLogDiagnostics());

  lastStatus = {
    appliedRuleCount: compiled.rules.length,
    activeProfileCount: compiled.activeProfileCount,
    activeHeaderCount: compiled.activeHeaderCount,
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
      console.error("Bender: fallo al aplicar reglas", error);
      return lastStatus;
    });
  return applyQueue;
};

const seedDefaultProfile = async (): Promise<void> => {
  await updateState((state) => {
    if (state.profiles.length > 0) return state;
    const profile = createProfile(0, { name: "Local" });
    return { ...state, profiles: [profile], selectedProfileId: profile.id };
  });
};

chrome.runtime.onInstalled.addListener(() => {
  void seedDefaultProfile().then(scheduleApply);
});

chrome.runtime.onStartup.addListener(() => {
  resetTabStyles();
});

const applyIfTabsMatter = (): void => {
  void readState().then((state) => {
    if (dependsOnTabs(state)) void scheduleApply();
  });
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) void scheduleApply();
});

chrome.tabs.onActivated.addListener(() => {
  applyIfTabsMatter();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTabStyles(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url !== undefined && HTTP_URL_PATTERN.test(tab.url)) {
    void readState().then((state) => applyUserStyles(state, tabId, tab.url ?? ""));
  }
  if (changeInfo.url !== undefined && changeInfo.url !== "") applyIfTabsMatter();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-global") {
    void updateState((state) => ({ ...state, globalEnabled: !state.globalEnabled }));
    return;
  }
  if (command === "open-panel") {
    void chrome.windows.getCurrent().then((window) => {
      if (typeof window.id === "number") void chrome.sidePanel.open({ windowId: window.id });
    });
  }
});

/**
 * Los errores de userscript viven en memoria del service worker: son ayuda para
 * depurar la sesion, no algo que valga la pena persistir. Se guarda el ultimo de
 * cada script para que un script roto en un loop no tape a los demas.
 */
const MAX_SCRIPT_ERRORS = 50;
let scriptErrors = new Map<string, ScriptError>();

const recordScriptError = (error: ScriptError): void => {
  scriptErrors.delete(error.scriptId);
  scriptErrors.set(error.scriptId, error);
  if (scriptErrors.size > MAX_SCRIPT_ERRORS) {
    const oldest = scriptErrors.keys().next();
    if (!oldest.done) scriptErrors.delete(oldest.value);
  }
};

const listScriptErrors = (): ScriptError[] => Array.from(scriptErrors.values());

const clearScriptErrors = (): void => {
  scriptErrors = new Map();
};

type ImmediateReply = { value: unknown } | null;

type ImmediateMessage = Exclude<ExtensionMessage, { type: "engine/refresh" | "userscripts/sync" }>;

const immediateReplyFor = (message: ImmediateMessage, senderTabId: number): ImmediateReply => {
  switch (message.type) {
    case "engine/status":
      return { value: lastStatus };
    case "network/list":
      return { value: listNetworkEntries() };
    case "network/clear":
      clearNetworkLog();
      return { value: null };
    case "network/hit":
      recordMockHit(message.payload, senderTabId);
      return { value: null };
    case "network/bodies":
      recordCapturedBodies(message.payload, senderTabId);
      return { value: null };
    case "scripts/error":
      recordScriptError(message.payload);
      return { value: null };
    case "scripts/errors":
      return { value: listScriptErrors() };
    case "scripts/errors-clear":
      clearScriptErrors();
      return { value: null };
    default:
      return null;
  }
};

const syncUserScriptsAndReply = (sendResponse: (response: UserScriptsStatus) => void): void => {
  void readState()
    .then(syncUserScripts)
    .then((status) => {
      lastUserScriptsStatus = status;
      sendResponse(status);
    });
};

const UNKNOWN_SENDER_TAB_ID = -1;

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === "engine/refresh") {
    void scheduleApply().then(sendResponse);
    return true;
  }
  if (message.type === "userscripts/sync") {
    syncUserScriptsAndReply(sendResponse);
    return true;
  }
  const reply = immediateReplyFor(message, sender.tab?.id ?? UNKNOWN_SENDER_TAB_ID);
  if (reply !== null) sendResponse(reply.value);
  return false;
});

void restoreNetworkLog().then(scheduleApply);
