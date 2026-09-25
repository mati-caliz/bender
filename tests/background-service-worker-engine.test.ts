import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, createDefaultState } from "@/lib/constants";
import { DNR_ACTION_BLOCK } from "@/lib/dnr-enums";
import type { ToolkitState } from "@/types";
import {
  bootServiceWorker,
  diagnosticMessages,
  lastBadgeColor,
  lastBadgeText,
  sendToWorker,
  settle,
  storedEngineStatus,
} from "./support/background-service-worker";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";

const stateWithHeader = (overrides: Partial<ToolkitState> = {}): ToolkitState =>
  stateWith({ profiles: [profileWith({ requestHeaders: [header("X-Env", "dev")] })], ...overrides });

const existingRule: chrome.declarativeNetRequest.Rule = {
  id: 99,
  action: { type: DNR_ACTION_BLOCK },
  condition: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service worker startup", () => {
  it("applies the stored state and publishes the engine status", async () => {
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWithHeader() });

    const [applied] = fakeChrome.declarativeNetRequest.updateSessionRules.mock.calls[0] ?? [];
    expect(applied?.removeRuleIds).toEqual([]);
    expect(applied?.addRules?.map((rule) => rule.action.type)).toEqual(["modifyHeaders"]);
    expect(storedEngineStatus(fakeChrome)).toMatchObject({
      appliedRuleCount: 1,
      activeProfileCount: 1,
      activeHeaderCount: 1,
      diagnostics: [],
    });
    expect(lastBadgeText(fakeChrome)).toBe("1");
    expect(lastBadgeColor(fakeChrome)).toBe(createDefaultState().ui.accent);
  });

  it("replaces the rules left over from a previous run", async () => {
    const { fakeChrome } = await bootServiceWorker({
      prepare: (chromeDouble) =>
        chromeDouble.declarativeNetRequest.getSessionRules.mockResolvedValue([existingRule]),
    });

    expect(fakeChrome.declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith({
      removeRuleIds: [99],
      addRules: [],
    });
    expect(lastBadgeText(fakeChrome)).toBe("");
  });

  it("shows an off badge while the extension is globally disabled", async () => {
    const { fakeChrome } = await bootServiceWorker({
      storedState: stateWithHeader({ globalEnabled: false }),
    });

    expect(lastBadgeText(fakeChrome)).toBe("off");
    expect(lastBadgeColor(fakeChrome)).toBe("#64748b");
    expect(storedEngineStatus(fakeChrome).appliedRuleCount).toBe(0);
  });

  it("paints the badge red when the compiled rules have errors", async () => {
    const broken = profileWith({ requestHeaders: [header("bad header", "x")] });
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWith({ profiles: [broken] }) });

    expect(lastBadgeColor(fakeChrome)).toBe("#ef4444");
    expect(diagnosticMessages(fakeChrome)).toContain(
      '"bad header" no es un nombre de header valido (perfil "Test"), se ignora.',
    );
  });

  it("warns about stored items dropped for having an invalid shape", async () => {
    const { fakeChrome } = await bootServiceWorker({
      storedState: { ...createDefaultState(), profiles: ["broken", 3], trafficRules: [null] },
    });

    expect(diagnosticMessages(fakeChrome)).toContain(
      "Se descartaron 2 perfil(es), 1 regla(s) porque estaban guardados con un formato invalido.",
    );
  });

  it("clears the rules and reports why when Chrome rejects them", async () => {
    const { fakeChrome } = await bootServiceWorker({
      storedState: stateWithHeader(),
      prepare: (chromeDouble) => {
        chromeDouble.declarativeNetRequest.getSessionRules.mockResolvedValue([existingRule]);
        chromeDouble.declarativeNetRequest.updateSessionRules.mockRejectedValueOnce(
          new Error("Rule limit exceeded"),
        );
      },
    });

    expect(fakeChrome.declarativeNetRequest.updateSessionRules).toHaveBeenLastCalledWith({
      removeRuleIds: [99],
    });
    expect(diagnosticMessages(fakeChrome)).toContain(
      "No se pudieron aplicar las reglas: Rule limit exceeded",
    );
    expect(lastBadgeColor(fakeChrome)).toBe("#ef4444");
  });

  it("uses a generic reason for non-Error rule rejections", async () => {
    const { fakeChrome } = await bootServiceWorker({
      prepare: (chromeDouble) =>
        chromeDouble.declarativeNetRequest.updateSessionRules.mockRejectedValueOnce("nope"),
    });

    expect(diagnosticMessages(fakeChrome)).toContain("No se pudieron aplicar las reglas: error desconocido");
  });

  it("reports userscript registration problems as a warning", async () => {
    const { fakeChrome } = await bootServiceWorker({
      prepare: (chromeDouble) =>
        chromeDouble.userScripts.configureWorld.mockRejectedValue(new Error("API apagada")),
    });

    expect(storedEngineStatus(fakeChrome).diagnostics).toContainEqual({
      level: "warning",
      message: "Userscripts: API apagada",
    });
  });

  it("configures the network log from the stored settings", async () => {
    const network = { ...createDefaultState().network, enabled: true };
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWith({ network }) });

    expect(fakeChrome.webRequest.onBeforeRequest.listenerCount()).toBe(1);
  });
});

describe("service worker reapplying rules", () => {
  it("reapplies when the stored state changes and ignores other keys", async () => {
    const { fakeChrome } = await bootServiceWorker();
    fakeChrome.declarativeNetRequest.updateSessionRules.mockClear();

    await fakeChrome.storage.local.set({ unrelated: true });
    await fakeChrome.storage.session.set({ [STORAGE_KEY]: stateWithHeader() });
    await settle();
    expect(fakeChrome.declarativeNetRequest.updateSessionRules).not.toHaveBeenCalled();

    await fakeChrome.storage.local.set({ [STORAGE_KEY]: stateWithHeader() });
    await settle();
    expect(storedEngineStatus(fakeChrome).activeHeaderCount).toBe(1);
  });

  it("answers engine/refresh with the fresh status once the rules are applied", async () => {
    const { fakeChrome } = await bootServiceWorker();
    fakeChrome.storage.local.data.set(STORAGE_KEY, stateWithHeader());

    const { keepsChannelOpen, response } = await sendToWorker(fakeChrome, { type: "engine/refresh" });

    expect(keepsChannelOpen).toBe(true);
    expect(response).toMatchObject({ appliedRuleCount: 1, activeHeaderCount: 1 });
  });

  it("logs a failed apply and keeps answering with the last good status", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWithHeader() });
    const failure = new Error("service worker suspendido");
    fakeChrome.declarativeNetRequest.getSessionRules.mockRejectedValueOnce(failure);

    const { response } = await sendToWorker(fakeChrome, { type: "engine/refresh" });

    expect(consoleError).toHaveBeenCalledWith("Bender: fallo al aplicar reglas", failure);
    expect(response).toMatchObject({ appliedRuleCount: 1 });

    const next = await sendToWorker(fakeChrome, { type: "engine/refresh" });
    expect(next.response).toMatchObject({ appliedRuleCount: 1 });
    consoleError.mockRestore();
  });
});
