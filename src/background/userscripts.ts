import { sanitizeMatchPatterns, urlMatchesPatterns } from '@/lib/match-patterns';
import type { ToolkitState, UserScript, UserScriptsStatus } from '@/types';

const REGISTERED_ID_PREFIX = 'bender-';
const USER_SCRIPT_WORLD_CSP = "script-src 'self' 'unsafe-eval'; object-src 'self'";

let injectedStyleTabs = new Map<number, string[]>();

const isSupported = (): boolean => typeof chrome.userScripts !== 'undefined';

const runnableScripts = (state: ToolkitState, language: UserScript['language']): UserScript[] =>
  state.globalEnabled
    ? state.userScripts.filter(
        (script) => script.enabled && script.language === language && script.code.trim() && script.matches.length > 0
      )
    : [];

const toRegistered = (script: UserScript): chrome.userScripts.RegisteredUserScript => ({
  id: `${REGISTERED_ID_PREFIX}${script.id}`,
  matches: sanitizeMatchPatterns(script.matches),
  excludeMatches: sanitizeMatchPatterns(script.excludeMatches),
  js: [{ code: script.code }],
  runAt: script.runAt,
  world: script.world,
  allFrames: script.allFrames,
});

export const syncUserScripts = async (state: ToolkitState): Promise<UserScriptsStatus> => {
  if (!isSupported()) {
    return {
      supported: false,
      registeredCount: 0,
      error: 'Este Chrome no expone chrome.userScripts. Activa el modo desarrollador en chrome://extensions.',
    };
  }

  try {
    await chrome.userScripts.configureWorld({ messaging: true, csp: USER_SCRIPT_WORLD_CSP });
    const existing = await chrome.userScripts.getScripts();
    if (existing.length) {
      await chrome.userScripts.unregister({ ids: existing.map((script) => script.id) });
    }

    const scripts = runnableScripts(state, 'javascript')
      .map(toRegistered)
      .filter((script) => (script.matches ?? []).length > 0);

    if (scripts.length) await chrome.userScripts.register(scripts);
    return { supported: true, registeredCount: scripts.length, error: null };
  } catch (error) {
    return {
      supported: true,
      registeredCount: 0,
      error: error instanceof Error ? error.message : 'No se pudieron registrar los userscripts.',
    };
  }
};

export const applyUserStyles = async (state: ToolkitState, tabId: number, url: string): Promise<void> => {
  const previous = injectedStyleTabs.get(tabId) ?? [];
  const matching = runnableScripts(state, 'css').filter((script) =>
    urlMatchesPatterns(url, sanitizeMatchPatterns(script.matches), sanitizeMatchPatterns(script.excludeMatches))
  );

  for (const script of state.userScripts) {
    if (script.language !== 'css' || !previous.includes(script.id)) continue;
    if (matching.some((candidate) => candidate.id === script.id)) continue;
    await chrome.scripting
      .removeCSS({ target: { tabId, allFrames: script.allFrames }, css: script.code })
      .catch(() => undefined);
  }

  for (const script of matching) {
    await chrome.scripting
      .insertCSS({ target: { tabId, allFrames: script.allFrames }, css: script.code })
      .catch(() => undefined);
  }

  injectedStyleTabs.set(
    tabId,
    matching.map((script) => script.id)
  );
};

export const forgetTabStyles = (tabId: number): void => {
  injectedStyleTabs.delete(tabId);
};

export const resetTabStyles = (): void => {
  injectedStyleTabs = new Map();
};
