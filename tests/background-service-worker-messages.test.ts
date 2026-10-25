import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockHitPayload } from "@/lib/messages";
import type { ScriptError } from "@/lib/script-errors";
import { createUserScript } from "@/lib/factories";
import { createDefaultState } from "@/lib/constants";
import type { CapturedBodies, NetworkEntry } from "@/types";
import { REQUEST_URL, requestDetails } from "./support/background-requests";
import {
  bootServiceWorker,
  browserTab,
  sendToWorker,
  storedEngineStatus,
} from "./support/background-service-worker";
import { stateWith } from "./support/dnr-fixtures";
import type { FakeChrome } from "./support/fake-chrome";

const MAX_SCRIPT_ERRORS = 50;
const SENDER: chrome.runtime.MessageSender = { tab: browserTab({ id: 7 }) };

const MOCK_HIT: MockHitPayload = {
  url: "https://api.local/mocked",
  method: "GET",
  status: 200,
  ruleName: "Usuarios",
  tabUrl: "https://app.local",
};

const BODIES: CapturedBodies = {
  url: REQUEST_URL,
  method: "GET",
  requestBody: null,
  responseBody: "[]",
  truncated: false,
};

const scriptError = (scriptId: string, message = "boom"): ScriptError => ({
  scriptId,
  message,
  line: 1,
  tabUrl: "https://app.local",
  at: 1,
});

const isNetworkEntryList = (value: unknown): value is NetworkEntry[] => Array.isArray(value);

const listEntries = async (fakeChrome: FakeChrome): Promise<NetworkEntry[]> => {
  const { response } = await sendToWorker(fakeChrome, { type: "network/list" });
  if (!isNetworkEntryList(response)) throw new Error("network/list deberia responder una lista");
  return response;
};

const isScriptErrorList = (value: unknown): value is ScriptError[] => Array.isArray(value);

const listScriptErrors = async (fakeChrome: FakeChrome): Promise<ScriptError[]> => {
  const { response } = await sendToWorker(fakeChrome, { type: "scripts/errors" });
  if (!isScriptErrorList(response)) throw new Error("scripts/errors deberia responder una lista");
  return response;
};

const bootWithNetworkLog = () =>
  bootServiceWorker({
    storedState: stateWith({ network: { ...createDefaultState().network, enabled: true } }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service worker engine messages", () => {
  it("answers engine/status synchronously with the last applied status", async () => {
    const { fakeChrome } = await bootServiceWorker();

    const { keepsChannelOpen, response } = await sendToWorker(fakeChrome, { type: "engine/status" });

    expect(keepsChannelOpen).toBe(false);
    expect(response).toEqual(storedEngineStatus(fakeChrome));
  });

  it("does not answer unknown messages", async () => {
    const { fakeChrome } = await bootServiceWorker();

    const { keepsChannelOpen, responded } = await sendToWorker(fakeChrome, { type: "unknown/message" });

    expect(keepsChannelOpen).toBe(false);
    expect(responded).toBe(false);
  });

  it("syncs userscripts on demand and answers with their status", async () => {
    const script = createUserScript("javascript", 0, {
      id: "a",
      code: "run()",
      matches: ["https://app.local/*"],
    });
    const { fakeChrome } = await bootServiceWorker({ storedState: stateWith({ userScripts: [script] }) });
    fakeChrome.userScripts.register.mockClear();

    const { keepsChannelOpen, response } = await sendToWorker(fakeChrome, { type: "userscripts/sync" });

    expect(keepsChannelOpen).toBe(true);
    expect(response).toEqual({ supported: true, registeredCount: 1, error: null });
    expect(fakeChrome.userScripts.register).toHaveBeenCalledTimes(1);
  });
});

describe("service worker network messages", () => {
  it("lists and clears the captured traffic", async () => {
    const { fakeChrome } = await bootWithNetworkLog();
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1"));

    expect((await listEntries(fakeChrome)).map((entry) => entry.id)).toEqual(["req-1"]);

    const cleared = await sendToWorker(fakeChrome, { type: "network/clear" });
    expect(cleared).toMatchObject({ keepsChannelOpen: false, response: null, responded: true });
    expect(await listEntries(fakeChrome)).toEqual([]);
  });

  it("records mock hits against the sender tab", async () => {
    const { fakeChrome } = await bootServiceWorker();

    await sendToWorker(fakeChrome, { type: "network/hit", payload: MOCK_HIT }, SENDER);
    await sendToWorker(fakeChrome, { type: "network/hit", payload: MOCK_HIT });

    expect((await listEntries(fakeChrome)).map((entry) => [entry.tabId, entry.source])).toEqual([
      [-1, "mock"],
      [7, "mock"],
    ]);
  });

  it("attaches captured bodies to the request of the sender tab", async () => {
    const { fakeChrome } = await bootWithNetworkLog();
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1", { tabId: 7 }));

    const { response } = await sendToWorker(fakeChrome, { type: "network/bodies", payload: BODIES }, SENDER);

    expect(response).toBeNull();
    expect((await listEntries(fakeChrome))[0]?.responseBody).toBe("[]");
  });
});

describe("service worker script error messages", () => {
  it("keeps the latest error of each script and clears them on demand", async () => {
    const { fakeChrome } = await bootServiceWorker();

    await sendToWorker(fakeChrome, { type: "scripts/error", payload: scriptError("a", "primero") });
    await sendToWorker(fakeChrome, { type: "scripts/error", payload: scriptError("b") });
    await sendToWorker(fakeChrome, { type: "scripts/error", payload: scriptError("a", "segundo") });

    expect(await listScriptErrors(fakeChrome)).toEqual([scriptError("b"), scriptError("a", "segundo")]);

    await sendToWorker(fakeChrome, { type: "scripts/errors-clear" });
    expect(await listScriptErrors(fakeChrome)).toEqual([]);
  });

  it("drops the oldest script once the error list is full", async () => {
    const { fakeChrome } = await bootServiceWorker();

    for (let index = 0; index <= MAX_SCRIPT_ERRORS; index += 1) {
      await sendToWorker(fakeChrome, { type: "scripts/error", payload: scriptError(`script-${index}`) });
    }

    const errors = await listScriptErrors(fakeChrome);
    expect(errors).toHaveLength(MAX_SCRIPT_ERRORS);
    expect(errors[0]?.scriptId).toBe("script-1");
    expect(errors.at(-1)?.scriptId).toBe(`script-${MAX_SCRIPT_ERRORS}`);
  });
});
