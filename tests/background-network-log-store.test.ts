import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NETWORK_LOG_KEY } from "@/lib/constants";
import type { MockHitPayload } from "@/lib/messages";
import type { CapturedBodies } from "@/types";
import { REQUEST_URL, TAB_ID, requestDetails, sendHeadersDetails } from "./support/background-requests";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";

const loadNetworkLog = () => import("@/background/network-log");

let fakeChrome: FakeChrome;
let networkLog: Awaited<ReturnType<typeof loadNetworkLog>>;

const FLUSH_DELAY_MS = 400;
const PERSISTED_ENTRY_LIMIT = 200;
const ENABLED = { enabled: true, maxEntries: 500, onlyModified: false };

const MOCK_HIT: MockHitPayload = {
  url: "https://api.local/mocked",
  method: "GET",
  status: 418,
  ruleName: "Tetera",
  tabUrl: "https://app.local",
};

const bodies = (overrides: Partial<CapturedBodies> = {}): CapturedBodies => ({
  url: REQUEST_URL,
  method: "GET",
  requestBody: "{}",
  responseBody: '{"ok":true}',
  truncated: false,
  ...overrides,
});

const hasStringId = (value: unknown): value is { id: string } =>
  typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";

const persistedIds = (): string[] => {
  const stored: unknown = fakeChrome.storage.session.data.get(NETWORK_LOG_KEY);
  if (!Array.isArray(stored)) return [];
  const persisted: unknown[] = stored;
  return persisted.filter(hasStringId).map((entry) => entry.id);
};

const emitRequests = (count: number): void => {
  for (let index = 0; index < count; index += 1) {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails(`req-${index}`));
  }
};

beforeEach(async () => {
  vi.resetModules();
  fakeChrome = installFakeChrome();
  networkLog = await loadNetworkLog();
  networkLog.configureNetworkLog(ENABLED);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("network log capacity", () => {
  it("keeps only the newest maxEntries entries", () => {
    networkLog.configureNetworkLog({ ...ENABLED, maxEntries: 2 });

    emitRequests(3);

    expect(networkLog.listNetworkEntries().map((entry) => entry.id)).toEqual(["req-2", "req-1"]);
  });

  it("trims existing entries when the limit is lowered", () => {
    emitRequests(4);

    networkLog.configureNetworkLog({ ...ENABLED, maxEntries: 1 });
    fakeChrome.webRequest.onSendHeaders.emit(sendHeadersDetails("req-0", [{ name: "X", value: "1" }]));

    expect(networkLog.listNetworkEntries().map((entry) => entry.id)).toEqual(["req-3"]);
  });
});

describe("network log persistence", () => {
  it("batches writes to the session storage after a short delay", async () => {
    vi.useFakeTimers();
    emitRequests(2);

    expect(fakeChrome.storage.session.data.has(NETWORK_LOG_KEY)).toBe(false);

    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    expect(persistedIds()).toEqual(["req-0", "req-1"]);
  });

  it("persists only the most recent entries", async () => {
    vi.useFakeTimers();
    emitRequests(PERSISTED_ENTRY_LIMIT + 5);

    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    const ids = persistedIds();
    expect(ids).toHaveLength(PERSISTED_ENTRY_LIMIT);
    expect(ids[0]).toBe("req-5");
  });

  it("reports a warning while the session storage rejects writes", async () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(fakeChrome.storage.session, "set");
    setSpy.mockRejectedValueOnce(new Error("QUOTA_BYTES excedido"));
    emitRequests(1);
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    expect(networkLog.networkLogDiagnostics()).toEqual([
      {
        level: "warning",
        message: "El log de trafico no se pudo guardar en la sesion: QUOTA_BYTES excedido",
      },
    ]);

    emitRequests(2);
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    expect(networkLog.networkLogDiagnostics()).toEqual([]);
  });

  it("uses a generic reason when the rejection is not an Error", async () => {
    vi.useFakeTimers();
    vi.spyOn(fakeChrome.storage.session, "set").mockRejectedValueOnce("boom");
    emitRequests(1);
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    expect(networkLog.networkLogDiagnostics()[0]?.message).toContain("error desconocido");
  });

  it("restores the persisted log and keeps updating restored entries", async () => {
    emitRequests(1);
    const [entry] = networkLog.listNetworkEntries();
    vi.resetModules();
    const restarted = await loadNetworkLog();
    await fakeChrome.storage.session.set({ [NETWORK_LOG_KEY]: [entry] });

    await restarted.restoreNetworkLog();
    restarted.configureNetworkLog(ENABLED);
    fakeChrome.webRequest.onSendHeaders.emit(sendHeadersDetails("req-0", [{ name: "X-Trace", value: "1" }]));

    expect(restarted.listNetworkEntries()).toEqual([
      expect.objectContaining({ id: "req-0", requestHeaders: [{ name: "X-Trace", value: "1" }] }),
    ]);
  });

  it("ignores a corrupted persisted log", async () => {
    emitRequests(1);
    await fakeChrome.storage.session.set({ [NETWORK_LOG_KEY]: "corrupted" });

    await networkLog.restoreNetworkLog();

    expect(networkLog.listNetworkEntries().map((entry) => entry.id)).toEqual(["req-0"]);
  });

  it("clears the log in memory and in the session right away", async () => {
    emitRequests(2);

    networkLog.clearNetworkLog();
    await Promise.resolve();

    expect(networkLog.listNetworkEntries()).toEqual([]);
    expect(fakeChrome.storage.session.data.get(NETWORK_LOG_KEY)).toEqual([]);
  });
});

describe("network log mock hits and bodies", () => {
  it("records a mock hit as a finished entry labelled with its rule", () => {
    networkLog.recordMockHit(MOCK_HIT, TAB_ID);

    expect(networkLog.listNetworkEntries()).toEqual([
      expect.objectContaining({
        tabId: TAB_ID,
        url: MOCK_HIT.url,
        phase: "mocked",
        source: "mock",
        statusCode: 418,
        statusLine: "HTTP/1.1 418",
        matchedRuleLabels: ["Mock · Tetera"],
      }),
    ]);
  });

  it("attaches captured bodies to the latest matching request without a body", () => {
    emitRequests(2);

    networkLog.recordCapturedBodies(bodies({ responseBody: "second" }), TAB_ID);
    networkLog.recordCapturedBodies(bodies({ responseBody: "first", truncated: true }), TAB_ID);

    expect(networkLog.listNetworkEntries()).toEqual([
      expect.objectContaining({
        id: "req-1",
        responseBody: "second",
        requestBody: "{}",
        bodyTruncated: false,
      }),
      expect.objectContaining({ id: "req-0", responseBody: "first", bodyTruncated: true }),
    ]);
  });

  it("does not attach bodies to mocks or to requests from another tab, url or method", () => {
    networkLog.recordMockHit({ ...MOCK_HIT, url: REQUEST_URL }, TAB_ID);
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("other-tab", { tabId: TAB_ID + 1 }));
    fakeChrome.webRequest.onBeforeRequest.emit(
      requestDetails("other-url", { url: "https://api.local/other" }),
    );
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("other-method", { method: "POST" }));

    networkLog.recordCapturedBodies(bodies(), TAB_ID);

    expect(networkLog.listNetworkEntries().every((entry) => entry.responseBody === null)).toBe(true);
  });
});
