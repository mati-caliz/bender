import { vi } from "vitest";
import { ENGINE_STATUS_KEY, STORAGE_KEY } from "@/lib/constants";
import type { EngineStatus } from "@/types";
import { type FakeChrome, flushPromises, installFakeChrome } from "./fake-chrome";

type CssInjectionMock = ReturnType<typeof vi.fn<(injection: chrome.scripting.CSSInjection) => Promise<void>>>;

export interface BootedServiceWorker {
  fakeChrome: FakeChrome;
  insertCSS: CssInjectionMock;
  removeCSS: CssInjectionMock;
}

export interface BootOptions {
  storedState?: unknown;
  prepare?: (fakeChrome: FakeChrome) => void;
}

export const settle = async (): Promise<void> => {
  await flushPromises();
  await flushPromises();
};

export const bootServiceWorker = async (options: BootOptions = {}): Promise<BootedServiceWorker> => {
  vi.resetModules();
  const fakeChrome = installFakeChrome();
  const insertCSS: CssInjectionMock = vi.fn(() => Promise.resolve());
  const removeCSS: CssInjectionMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("chrome", { ...fakeChrome, scripting: { ...fakeChrome.scripting, insertCSS, removeCSS } });
  if (options.storedState !== undefined) fakeChrome.storage.local.data.set(STORAGE_KEY, options.storedState);
  options.prepare?.(fakeChrome);
  await import("@/background/service-worker");
  await settle();
  return { fakeChrome, insertCSS, removeCSS };
};

const isEngineStatus = (value: unknown): value is EngineStatus =>
  typeof value === "object" && value !== null && "appliedRuleCount" in value && "diagnostics" in value;

export const storedEngineStatus = (fakeChrome: FakeChrome): EngineStatus => {
  const stored: unknown = fakeChrome.storage.session.data.get(ENGINE_STATUS_KEY);
  if (!isEngineStatus(stored)) throw new Error("el motor no publico su estado en storage.session");
  return stored;
};

export const diagnosticMessages = (fakeChrome: FakeChrome): string[] =>
  storedEngineStatus(fakeChrome).diagnostics.map((diagnostic) => diagnostic.message);

export const lastBadgeText = (fakeChrome: FakeChrome): string | undefined =>
  fakeChrome.action.setBadgeText.mock.lastCall?.[0].text;

export const lastBadgeColor = (
  fakeChrome: FakeChrome,
): chrome.action.BadgeColorDetails["color"] | undefined =>
  fakeChrome.action.setBadgeBackgroundColor.mock.lastCall?.[0].color;

export const sendToWorker = async (
  fakeChrome: FakeChrome,
  message: unknown,
  sender: chrome.runtime.MessageSender = {},
): Promise<{ keepsChannelOpen: unknown; response: unknown; responded: boolean }> => {
  const sendResponse = vi.fn<(response?: unknown) => void>();
  const [keepsChannelOpen] = fakeChrome.runtime.onMessage.emit(message, sender, sendResponse);
  await settle();
  return {
    keepsChannelOpen,
    response: sendResponse.mock.lastCall?.[0],
    responded: sendResponse.mock.calls.length > 0,
  };
};

export const browserTab = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => ({
  id: 7,
  index: 0,
  url: "https://app.local/home",
  pinned: false,
  highlighted: true,
  windowId: 1,
  active: true,
  incognito: false,
  selected: true,
  discarded: false,
  autoDiscardable: true,
  groupId: -1,
  ...overrides,
});
