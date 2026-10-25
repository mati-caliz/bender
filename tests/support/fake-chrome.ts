import { vi } from "vitest";

type Listener<TArgs extends unknown[]> = (...args: TArgs) => unknown;

export interface FakeEvent<TArgs extends unknown[]> {
  addListener: (listener: Listener<TArgs>) => void;
  removeListener: (listener: Listener<TArgs>) => void;
  hasListener: (listener: Listener<TArgs>) => boolean;
  listenerCount: () => number;
  emit: (...args: TArgs) => unknown[];
}

export const createFakeEvent = <TArgs extends unknown[]>(): FakeEvent<TArgs> => {
  const listeners = new Set<Listener<TArgs>>();
  return {
    addListener: (listener) => {
      listeners.add(listener);
    },
    removeListener: (listener) => {
      listeners.delete(listener);
    },
    hasListener: (listener) => listeners.has(listener),
    listenerCount: () => listeners.size,
    emit: (...args) => [...listeners].map((listener) => listener(...args)),
  };
};

type AreaName = "local" | "session" | "sync";
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type StorageKeys = string | string[] | Record<string, unknown> | null | undefined;

export interface FakeStorageArea {
  data: Map<string, unknown>;
  get: (keys?: StorageKeys) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

const requestedKeys = (keys: StorageKeys, data: Map<string, unknown>): string[] => {
  if (keys === null || keys === undefined) return [...data.keys()];
  if (typeof keys === "string") return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
};

const createStorageArea = (
  areaName: AreaName,
  onChanged: FakeEvent<[StorageChanges, string]>,
): FakeStorageArea => {
  const data = new Map<string, unknown>();
  const emitChanges = (changes: StorageChanges): void => {
    if (Object.keys(changes).length > 0) onChanged.emit(changes, areaName);
  };
  return {
    data,
    get: (keys) => {
      const result: Record<string, unknown> = {};
      for (const key of requestedKeys(keys, data)) {
        if (data.has(key)) result[key] = structuredClone(data.get(key));
      }
      return Promise.resolve(result);
    },
    set: (items) => {
      const changes: StorageChanges = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data.get(key), newValue: structuredClone(value) };
        data.set(key, structuredClone(value));
      }
      emitChanges(changes);
      return Promise.resolve();
    },
    remove: (keys) => {
      const changes: StorageChanges = {};
      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (!data.has(key)) continue;
        changes[key] = { oldValue: data.get(key) };
        data.delete(key);
      }
      emitChanges(changes);
      return Promise.resolve();
    },
    clear: () => {
      data.clear();
      return Promise.resolve();
    },
  };
};

export const createFakeChrome = () => {
  const storageChanged = createFakeEvent<[StorageChanges, string]>();
  return {
    storage: {
      local: createStorageArea("local", storageChanged),
      session: createStorageArea("session", storageChanged),
      sync: createStorageArea("sync", storageChanged),
      onChanged: storageChanged,
    },
    runtime: {
      id: "bender-test",
      lastError: undefined,
      sendMessage: vi.fn<(message: unknown) => Promise<unknown>>(() => Promise.resolve(undefined)),
      getURL: vi.fn((path: string) => `chrome-extension://bender-test/${path}`),
      getManifest: vi.fn(() => ({ version: "1.1.0", name: "Bender", manifest_version: 3 })),
      onMessage: createFakeEvent<[unknown, chrome.runtime.MessageSender, (response?: unknown) => void]>(),
      onInstalled: createFakeEvent<[chrome.runtime.InstalledDetails]>(),
      onStartup: createFakeEvent<[]>(),
    },
    tabs: {
      query: vi.fn<(query: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>(() => Promise.resolve([])),
      create: vi.fn<(properties: chrome.tabs.CreateProperties) => Promise<unknown>>(() =>
        Promise.resolve({}),
      ),
      sendMessage: vi.fn<(tabId: number, message: unknown) => Promise<unknown>>(() =>
        Promise.resolve(undefined),
      ),
      onActivated: createFakeEvent<[chrome.tabs.TabActiveInfo]>(),
      onUpdated: createFakeEvent<[number, chrome.tabs.TabChangeInfo, chrome.tabs.Tab]>(),
      onRemoved: createFakeEvent<[number, chrome.tabs.TabRemoveInfo]>(),
    },
    windows: {
      getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
    },
    sidePanel: {
      open: vi.fn<(options: { windowId?: number; tabId?: number }) => Promise<void>>(() => Promise.resolve()),
    },
    action: {
      setBadgeText: vi.fn<(details: chrome.action.BadgeTextDetails) => Promise<void>>(() =>
        Promise.resolve(),
      ),
      setBadgeBackgroundColor: vi.fn<(details: chrome.action.BadgeColorDetails) => Promise<void>>(() =>
        Promise.resolve(),
      ),
    },
    commands: {
      onCommand: createFakeEvent<[string, chrome.tabs.Tab | undefined]>(),
    },
    cookies: {
      getAll: vi.fn<(details: chrome.cookies.GetAllDetails) => Promise<chrome.cookies.Cookie[]>>(() =>
        Promise.resolve([]),
      ),
      set: vi.fn<(details: chrome.cookies.SetDetails) => Promise<chrome.cookies.Cookie | null>>(() =>
        Promise.resolve(null),
      ),
      remove: vi.fn<(details: chrome.cookies.CookieDetails) => Promise<unknown>>(() => Promise.resolve(null)),
    },
    scripting: {
      executeScript: vi.fn<(injection: unknown) => Promise<{ result?: unknown }[]>>(() =>
        Promise.resolve([]),
      ),
    },
    declarativeNetRequest: {
      getSessionRules: vi.fn<() => Promise<chrome.declarativeNetRequest.Rule[]>>(() => Promise.resolve([])),
      updateSessionRules: vi.fn<(options: chrome.declarativeNetRequest.UpdateRuleOptions) => Promise<void>>(
        () => Promise.resolve(),
      ),
      onRuleMatchedDebug: createFakeEvent<[chrome.declarativeNetRequest.MatchedRuleInfoDebug]>(),
    },
    userScripts: {
      configureWorld: vi.fn<(properties: unknown) => Promise<void>>(() => Promise.resolve()),
      getScripts: vi.fn<() => Promise<chrome.userScripts.RegisteredUserScript[]>>(() => Promise.resolve([])),
      register: vi.fn<(scripts: chrome.userScripts.RegisteredUserScript[]) => Promise<void>>(() =>
        Promise.resolve(),
      ),
      unregister: vi.fn<(filter?: unknown) => Promise<void>>(() => Promise.resolve()),
    },
    webRequest: {
      onBeforeRequest: createFakeEvent<[chrome.webRequest.WebRequestBodyDetails]>(),
      onSendHeaders: createFakeEvent<[chrome.webRequest.WebRequestHeadersDetails]>(),
      onHeadersReceived: createFakeEvent<[chrome.webRequest.WebResponseHeadersDetails]>(),
      onBeforeRedirect: createFakeEvent<[chrome.webRequest.WebRedirectionResponseDetails]>(),
      onCompleted: createFakeEvent<[chrome.webRequest.WebResponseCacheDetails]>(),
      onErrorOccurred: createFakeEvent<[chrome.webRequest.WebResponseErrorDetails]>(),
    },
  };
};

export type FakeChrome = ReturnType<typeof createFakeChrome>;

export const installFakeChrome = (): FakeChrome => {
  const fake = createFakeChrome();
  vi.stubGlobal("chrome", fake);
  return fake;
};

export const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
