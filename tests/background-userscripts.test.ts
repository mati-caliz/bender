import { beforeEach, describe, expect, it, vi } from "vitest";
import { NAVIGATOR_SPOOF_SCRIPT_ID } from "@/lib/navigator-spoof";
import { createUserScript } from "@/lib/factories";
import type { ToolkitState, UserScript } from "@/types";
import { stateWith } from "./support/dnr-fixtures";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";

const loadUserScripts = () => import("@/background/userscripts");

type CssInjection = chrome.scripting.CSSInjection;

let fakeChrome: FakeChrome;
let userScripts: Awaited<ReturnType<typeof loadUserScripts>>;
let insertCSS: ReturnType<typeof vi.fn<(injection: CssInjection) => Promise<void>>>;
let removeCSS: ReturnType<typeof vi.fn<(injection: CssInjection) => Promise<void>>>;

const TAB_ID = 3;
const APP_URL = "https://app.local/home";
const OTHER_URL = "https://other.local/";

const javascript = (id: string, overrides: Partial<UserScript> = {}): UserScript =>
  createUserScript("javascript", 0, {
    id,
    code: "console.log(1)",
    matches: ["https://app.local/*"],
    ...overrides,
  });

const stylesheet = (id: string, overrides: Partial<UserScript> = {}): UserScript =>
  createUserScript("css", 0, {
    id,
    code: "body { color: red }",
    matches: ["https://app.local/*"],
    ...overrides,
  });

const withScripts = (scripts: UserScript[], overrides: Partial<ToolkitState> = {}): ToolkitState =>
  stateWith({ userScripts: scripts, ...overrides });

const registeredIds = (): string[] =>
  (fakeChrome.userScripts.register.mock.calls[0]?.[0] ?? []).map((script) => script.id);

beforeEach(async () => {
  vi.resetModules();
  fakeChrome = installFakeChrome();
  insertCSS = vi.fn<(injection: CssInjection) => Promise<void>>(() => Promise.resolve());
  removeCSS = vi.fn<(injection: CssInjection) => Promise<void>>(() => Promise.resolve());
  vi.stubGlobal("chrome", { ...fakeChrome, scripting: { ...fakeChrome.scripting, insertCSS, removeCSS } });
  userScripts = await loadUserScripts();
});

describe("syncUserScripts", () => {
  it("explains how to enable the API when chrome.userScripts is missing", async () => {
    const withoutUserScripts: Partial<FakeChrome> = { ...fakeChrome };
    delete withoutUserScripts.userScripts;
    vi.stubGlobal("chrome", withoutUserScripts);

    const status = await userScripts.syncUserScripts(withScripts([javascript("a")]));

    expect(status).toEqual({
      supported: false,
      registeredCount: 0,
      error: "Este Chrome no expone chrome.userScripts. Activa el modo desarrollador en chrome://extensions.",
    });
  });

  it("replaces the registered scripts with the runnable javascript ones", async () => {
    fakeChrome.userScripts.getScripts.mockResolvedValue([
      { id: "bender-stale", matches: ["*://*/*"], js: [] },
    ]);
    const state = withScripts([
      javascript("runs", {
        matches: ["https://app.local/*", "not a pattern"],
        excludeMatches: ["https://app.local/admin"],
      }),
      javascript("disabled", { enabled: false }),
      javascript("blank", { code: "   " }),
      javascript("no-matches", { matches: [] }),
      javascript("invalid-matches", { matches: ["nope"] }),
      stylesheet("style"),
    ]);

    const status = await userScripts.syncUserScripts(state);

    expect(status).toEqual({ supported: true, registeredCount: 1, error: null });
    expect(fakeChrome.userScripts.configureWorld).toHaveBeenCalledWith({
      messaging: true,
      csp: "script-src 'self' 'unsafe-eval'; object-src 'self'",
    });
    expect(fakeChrome.userScripts.unregister).toHaveBeenCalledWith({ ids: ["bender-stale"] });
    expect(fakeChrome.userScripts.register).toHaveBeenCalledWith([
      {
        id: "bender-runs",
        matches: ["https://app.local/*"],
        excludeMatches: ["https://app.local/admin"],
        js: [{ code: "console.log(1)\n//# sourceURL=bender-script-runs.js" }],
        runAt: "document_idle",
        world: "MAIN",
        allFrames: false,
      },
    ]);
  });

  it("skips unregister and register when there is nothing to swap", async () => {
    const status = await userScripts.syncUserScripts(
      withScripts([javascript("a")], { globalEnabled: false }),
    );

    expect(status).toEqual({ supported: true, registeredCount: 0, error: null });
    expect(fakeChrome.userScripts.unregister).not.toHaveBeenCalled();
    expect(fakeChrome.userScripts.register).not.toHaveBeenCalled();
  });

  it("registers the navigator spoof first without counting it as a user script", async () => {
    const state = withScripts([javascript("a")]);
    const spoofing = { ...state, userAgent: { ...state.userAgent, enabled: true, spoofNavigator: true } };

    const status = await userScripts.syncUserScripts(spoofing);

    expect(status.registeredCount).toBe(1);
    expect(registeredIds()).toEqual([NAVIGATOR_SPOOF_SCRIPT_ID, "bender-a"]);
    expect(fakeChrome.userScripts.register.mock.calls[0]?.[0][0]).toMatchObject({
      matches: ["*://*/*"],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true,
    });
  });

  it("reports the failure message when the API rejects", async () => {
    fakeChrome.userScripts.register.mockRejectedValue(new Error("Invalid match pattern"));

    const status = await userScripts.syncUserScripts(withScripts([javascript("a")]));

    expect(status).toEqual({ supported: true, registeredCount: 0, error: "Invalid match pattern" });
  });

  it("falls back to a generic message for non-Error rejections", async () => {
    fakeChrome.userScripts.configureWorld.mockRejectedValue("nope");

    const status = await userScripts.syncUserScripts(withScripts([]));

    expect(status.error).toBe("No se pudieron registrar los userscripts.");
  });
});

describe("applyUserStyles", () => {
  it("injects the enabled stylesheets that match the tab url", async () => {
    const state = withScripts([
      stylesheet("match", { allFrames: true }),
      stylesheet("excluded", { excludeMatches: ["https://app.local/home"] }),
      stylesheet("elsewhere", { matches: ["https://other.local/*"] }),
      javascript("script"),
    ]);

    await userScripts.applyUserStyles(state, TAB_ID, APP_URL);

    expect(insertCSS).toHaveBeenCalledTimes(1);
    expect(insertCSS).toHaveBeenCalledWith({
      target: { tabId: TAB_ID, allFrames: true },
      css: "body { color: red }",
    });
    expect(removeCSS).not.toHaveBeenCalled();
  });

  it("removes stylesheets that stop matching after a navigation", async () => {
    const state = withScripts([stylesheet("style"), stylesheet("global", { matches: ["*://*/*"] })]);
    await userScripts.applyUserStyles(state, TAB_ID, APP_URL);
    insertCSS.mockClear();

    await userScripts.applyUserStyles(state, TAB_ID, OTHER_URL);

    expect(removeCSS).toHaveBeenCalledTimes(1);
    expect(removeCSS).toHaveBeenCalledWith({
      target: { tabId: TAB_ID, allFrames: false },
      css: "body { color: red }",
    });
    expect(insertCSS).toHaveBeenCalledTimes(1);
  });

  it("keeps going when the tab refuses the injection or the removal", async () => {
    insertCSS.mockRejectedValue(new Error("Cannot access a chrome:// URL"));
    removeCSS.mockRejectedValue(new Error("No tab with id"));
    const state = withScripts([stylesheet("first"), stylesheet("second")]);

    await userScripts.applyUserStyles(state, TAB_ID, APP_URL);
    await userScripts.applyUserStyles(state, TAB_ID, OTHER_URL);

    expect(insertCSS).toHaveBeenCalledTimes(2);
    expect(removeCSS).toHaveBeenCalledTimes(2);
  });

  it("forgets what was injected in a closed tab", async () => {
    const state = withScripts([stylesheet("style")]);
    await userScripts.applyUserStyles(state, TAB_ID, APP_URL);

    userScripts.forgetTabStyles(TAB_ID);
    await userScripts.applyUserStyles(state, TAB_ID, OTHER_URL);

    expect(removeCSS).not.toHaveBeenCalled();
  });

  it("forgets every tab when the browser restarts", async () => {
    const state = withScripts([stylesheet("style")]);
    await userScripts.applyUserStyles(state, TAB_ID, APP_URL);
    await userScripts.applyUserStyles(state, TAB_ID + 1, APP_URL);

    userScripts.resetTabStyles();
    await userScripts.applyUserStyles(state, TAB_ID, OTHER_URL);
    await userScripts.applyUserStyles(state, TAB_ID + 1, OTHER_URL);

    expect(removeCSS).not.toHaveBeenCalled();
  });

  it("injects nothing while the extension is globally disabled", async () => {
    await userScripts.applyUserStyles(
      withScripts([stylesheet("style")], { globalEnabled: false }),
      TAB_ID,
      APP_URL,
    );

    expect(insertCSS).not.toHaveBeenCalled();
  });
});
