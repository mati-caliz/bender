import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, createDefaultState } from "@/lib/constants";
import { createUserScript } from "@/lib/factories";
import { readState } from "@/lib/state";
import type { ToolkitState } from "@/types";
import {
  bootServiceWorker,
  browserTab,
  settle,
  storedEngineStatus,
} from "./support/background-service-worker";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";
import type { FakeChrome } from "./support/fake-chrome";

const INSTALLED_REASONS: ReadonlySet<string> = new Set([
  "install",
  "update",
  "chrome_update",
  "shared_module_update",
]);

const isInstalledReason = (reason: string): reason is chrome.runtime.OnInstalledReason =>
  INSTALLED_REASONS.has(reason);

const installedDetails = (reason: string): chrome.runtime.InstalledDetails => {
  if (!isInstalledReason(reason)) throw new Error(`motivo de instalacion desconocido: ${reason}`);
  return { reason };
};
const ACTIVE_TAB = browserTab({ id: 7, url: "https://app.local/home" });
const STYLED_URL = "https://app.local/home";

const tabOriginState = (): ToolkitState =>
  stateWith({ profiles: [profileWith({ requestHeaders: [header("X-Origin", "{{tabOrigin}}")] })] });

const styledState = (): ToolkitState =>
  stateWith({
    userScripts: [
      createUserScript("css", 0, { id: "style", code: "body{}", matches: ["https://app.local/*"] }),
    ],
  });

const serveTabs = (
  fakeChrome: FakeChrome,
  activeTabs: chrome.tabs.Tab[],
  allTabs: chrome.tabs.Tab[],
): void => {
  fakeChrome.tabs.query.mockImplementation((query) =>
    Promise.resolve(query.active === true ? activeTabs : allTabs),
  );
};

const compiledHeaderValues = (fakeChrome: FakeChrome): (string | undefined)[] =>
  (fakeChrome.declarativeNetRequest.updateSessionRules.mock.lastCall?.[0].addRules ?? []).flatMap((rule) =>
    (rule.action.requestHeaders ?? []).map((modification) => modification.value),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service worker install", () => {
  it("seeds a Local profile on first install and applies it", async () => {
    const { fakeChrome } = await bootServiceWorker();

    fakeChrome.runtime.onInstalled.emit(installedDetails("install"));
    await settle();

    const state = await readState();
    expect(state.profiles.map((profile) => profile.name)).toEqual(["Local"]);
    expect(state.selectedProfileId).toBe(state.profiles[0]?.id);
    expect(storedEngineStatus(fakeChrome).activeProfileCount).toBe(1);
  });

  it("keeps the existing profiles on update", async () => {
    const { fakeChrome } = await bootServiceWorker({
      storedState: stateWith({ profiles: [profileWith({ name: "Mio" })] }),
    });

    fakeChrome.runtime.onInstalled.emit(installedDetails("update"));
    await settle();

    expect((await readState()).profiles.map((profile) => profile.name)).toEqual(["Mio"]);
  });
});

describe("service worker tab tracking", () => {
  it("resolves tab placeholders against the active http tab", async () => {
    const { fakeChrome } = await bootServiceWorker({
      storedState: tabOriginState(),
      prepare: (chromeDouble) => {
        serveTabs(
          chromeDouble,
          [ACTIVE_TAB],
          [
            ACTIVE_TAB,
            browserTab({ id: 8, url: "chrome://extensions" }),
            browserTab({ id: 9, url: "https://" }),
            browserTab({ id: undefined }),
            browserTab({ id: 10, url: undefined }),
          ],
        );
      },
    });

    expect(compiledHeaderValues(fakeChrome)).toEqual(["https://app.local"]);
  });

  it("reapplies on tab activation only when a rule depends on the tabs", async () => {
    const { fakeChrome } = await bootServiceWorker();
    fakeChrome.declarativeNetRequest.updateSessionRules.mockClear();

    fakeChrome.tabs.onActivated.emit({ tabId: 7, windowId: 1 });
    await settle();
    expect(fakeChrome.declarativeNetRequest.updateSessionRules).not.toHaveBeenCalled();

    fakeChrome.storage.local.data.set(STORAGE_KEY, tabOriginState());
    serveTabs(fakeChrome, [ACTIVE_TAB], [ACTIVE_TAB]);
    fakeChrome.tabs.onActivated.emit({ tabId: 7, windowId: 1 });
    await settle();
    expect(compiledHeaderValues(fakeChrome)).toEqual(["https://app.local"]);
  });

  it("reapplies when a tab navigates to another url", async () => {
    const cors = { ...createDefaultState().cors, enabled: true };
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWith({ cors }) });
    fakeChrome.declarativeNetRequest.updateSessionRules.mockClear();

    fakeChrome.tabs.onUpdated.emit(7, { url: "" }, ACTIVE_TAB);
    await settle();
    expect(fakeChrome.declarativeNetRequest.updateSessionRules).not.toHaveBeenCalled();

    fakeChrome.tabs.onUpdated.emit(7, { url: "https://app.local/next" }, ACTIVE_TAB);
    await settle();
    expect(fakeChrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalledTimes(1);
  });

  it("injects matching stylesheets while an http tab loads", async () => {
    const { fakeChrome, insertCSS } = await bootServiceWorker({ storedState: styledState() });

    fakeChrome.tabs.onUpdated.emit(7, { status: "loading" }, browserTab({ url: "chrome://newtab" }));
    fakeChrome.tabs.onUpdated.emit(7, { status: "loading" }, browserTab({ url: undefined }));
    fakeChrome.tabs.onUpdated.emit(7, { status: "complete" }, browserTab({ url: STYLED_URL }));
    await settle();
    expect(insertCSS).not.toHaveBeenCalled();

    fakeChrome.tabs.onUpdated.emit(7, { status: "loading" }, browserTab({ url: STYLED_URL }));
    await settle();
    expect(insertCSS).toHaveBeenCalledWith({ target: { tabId: 7, allFrames: false }, css: "body{}" });
  });

  it("forgets injected styles of closed tabs and after a browser restart", async () => {
    const { fakeChrome, removeCSS } = await bootServiceWorker({ storedState: styledState() });
    const loadTab = async (tabId: number, url: string): Promise<void> => {
      fakeChrome.tabs.onUpdated.emit(tabId, { status: "loading" }, browserTab({ id: tabId, url }));
      await settle();
    };
    await loadTab(7, STYLED_URL);
    await loadTab(8, STYLED_URL);

    fakeChrome.tabs.onRemoved.emit(7, { windowId: 1, isWindowClosing: false });
    fakeChrome.runtime.onStartup.emit();
    await loadTab(7, "https://other.local/");
    await loadTab(8, "https://other.local/");

    expect(removeCSS).not.toHaveBeenCalled();
  });
});

describe("service worker keyboard commands", () => {
  it("toggles the global switch", async () => {
    const { fakeChrome } = await bootServiceWorker();

    fakeChrome.commands.onCommand.emit("toggle-global", undefined);
    await settle();

    expect((await readState()).globalEnabled).toBe(false);
  });

  it("opens the side panel in the current window", async () => {
    const { fakeChrome } = await bootServiceWorker();

    fakeChrome.commands.onCommand.emit("open-panel", undefined);
    await settle();

    expect(fakeChrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
  });

  it("does not open the side panel without a window id", async () => {
    const { fakeChrome } = await bootServiceWorker({
      prepare: (chromeDouble) =>
        Object.assign(chromeDouble.windows, { getCurrent: () => Promise.resolve({}) }),
    });

    fakeChrome.commands.onCommand.emit("open-panel", undefined);
    await settle();

    expect(fakeChrome.sidePanel.open).not.toHaveBeenCalled();
  });

  it("ignores unknown commands", async () => {
    const { fakeChrome } = await bootServiceWorker();

    fakeChrome.commands.onCommand.emit("unknown", undefined);
    await settle();

    expect(fakeChrome.sidePanel.open).not.toHaveBeenCalled();
    expect((await readState()).globalEnabled).toBe(true);
  });
});
