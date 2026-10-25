import { vi } from "vitest";
import type { CookieSnapshot, DesignAudit, EngineStatus } from "@/types";

export const tabWith = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => ({
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

export const liveCookieWith = (overrides: Partial<chrome.cookies.Cookie> = {}): chrome.cookies.Cookie => ({
  name: "sid",
  value: "abc",
  domain: "app.local",
  path: "/",
  storeId: "0",
  session: false,
  hostOnly: true,
  httpOnly: false,
  secure: true,
  sameSite: "lax",
  expirationDate: 2_000_000_000,
  ...overrides,
});

export const snapshotWith = (overrides: Partial<CookieSnapshot> = {}): CookieSnapshot => ({
  name: "sid",
  value: "abc",
  domain: "app.local",
  path: "/",
  secure: true,
  httpOnly: false,
  sameSite: "lax",
  hostOnly: true,
  expirationDate: null,
  ...overrides,
});

export const engineStatusWith = (overrides: Partial<EngineStatus> = {}): EngineStatus => ({
  appliedRuleCount: 3,
  activeProfileCount: 1,
  activeHeaderCount: 2,
  diagnostics: [],
  updatedAt: 1_700_000_000_000,
  ...overrides,
});

export const EMPTY_DESIGN_AUDIT: DesignAudit = {
  elementCount: 12,
  rootFontSize: 16,
  colors: [],
  fonts: [],
  spacings: [],
  radii: [],
  shadows: [],
  variables: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const injectedArgs = (injection: unknown): unknown[] => {
  if (!isRecord(injection)) return [];
  const args = injection["args"];
  return Array.isArray(args) ? args : [];
};

export const injectsFiles = (injection: unknown): boolean => isRecord(injection) && "files" in injection;

export const runInjectedFunction = (injection: unknown): Promise<{ result?: unknown }[]> => {
  if (!isRecord(injection)) return Promise.resolve([]);
  const func = injection["func"];
  if (typeof func !== "function") return Promise.resolve([]);
  const result: unknown = Reflect.apply(func, undefined, injectedArgs(injection));
  return Promise.resolve([{ result }]);
};

export class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  readonly media: string;
  onchange = null;
  readonly addListener = vi.fn();
  readonly removeListener = vi.fn();

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

export interface FakeMatchMedia {
  lists: Map<string, FakeMediaQueryList>;
  listFor: (media: string) => FakeMediaQueryList | undefined;
}

export const installFakeMatchMedia = (matchesFor: (media: string) => boolean): FakeMatchMedia => {
  const lists = new Map<string, FakeMediaQueryList>();
  vi.stubGlobal("matchMedia", (media: string): MediaQueryList => {
    const list = lists.get(media) ?? new FakeMediaQueryList(media, matchesFor(media));
    lists.set(media, list);
    return list;
  });
  return { lists, listFor: (media) => lists.get(media) };
};

export interface Deferred<TValue> {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
}

export const deferred = <TValue>(): Deferred<TValue> => {
  const resolvers: ((value: TValue) => void)[] = [];
  const promise = new Promise<TValue>((resolve) => {
    resolvers.push(resolve);
  });
  return {
    promise,
    resolve: (value) => {
      for (const resolver of resolvers) resolver(value);
    },
  };
};
