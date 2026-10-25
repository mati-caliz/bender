import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TAB_ID,
  errorDetails,
  redirectDetails,
  requestDetails,
  responseDetails,
  ruleMatch,
  sendHeadersDetails,
} from "./support/background-requests";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";

const loadNetworkLog = () => import("@/background/network-log");

let fakeChrome: FakeChrome;
let networkLog: Awaited<ReturnType<typeof loadNetworkLog>>;

const ENABLED = { enabled: true, maxEntries: 500, onlyModified: false };

const webRequestListenerCounts = (): number[] => [
  fakeChrome.webRequest.onBeforeRequest.listenerCount(),
  fakeChrome.webRequest.onSendHeaders.listenerCount(),
  fakeChrome.webRequest.onHeadersReceived.listenerCount(),
  fakeChrome.webRequest.onBeforeRedirect.listenerCount(),
  fakeChrome.webRequest.onCompleted.listenerCount(),
  fakeChrome.webRequest.onErrorOccurred.listenerCount(),
];

const firstEntry = () => {
  const [entry] = networkLog.listNetworkEntries();
  if (entry === undefined) throw new Error("se esperaba al menos una entrada en el log");
  return entry;
};

beforeEach(async () => {
  vi.resetModules();
  fakeChrome = installFakeChrome();
  networkLog = await loadNetworkLog();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("network log listeners", () => {
  it("attaches every listener once while enabled and detaches them when disabled", () => {
    networkLog.configureNetworkLog(ENABLED);
    networkLog.configureNetworkLog(ENABLED);

    expect(webRequestListenerCounts()).toEqual([1, 1, 1, 1, 1, 1]);
    expect(fakeChrome.declarativeNetRequest.onRuleMatchedDebug.listenerCount()).toBe(1);

    networkLog.configureNetworkLog({ ...ENABLED, enabled: false });
    networkLog.configureNetworkLog({ ...ENABLED, enabled: false });

    expect(webRequestListenerCounts()).toEqual([0, 0, 0, 0, 0, 0]);
    expect(fakeChrome.declarativeNetRequest.onRuleMatchedDebug.listenerCount()).toBe(0);
  });

  it("works without onRuleMatchedDebug, which only exists for unpacked extensions", () => {
    const { onRuleMatchedDebug, ...declarativeNetRequest } = fakeChrome.declarativeNetRequest;
    vi.stubGlobal("chrome", { ...fakeChrome, declarativeNetRequest });

    networkLog.configureNetworkLog(ENABLED);
    expect(webRequestListenerCounts()).toEqual([1, 1, 1, 1, 1, 1]);

    networkLog.configureNetworkLog({ ...ENABLED, enabled: false });
    expect(webRequestListenerCounts()).toEqual([0, 0, 0, 0, 0, 0]);
    expect(onRuleMatchedDebug.listenerCount()).toBe(0);
  });
});

describe("network log request lifecycle", () => {
  beforeEach(() => {
    networkLog.configureNetworkLog(ENABLED);
  });

  it("builds an entry from the request events of a completed request", () => {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1", { method: "POST" }));
    expect(firstEntry()).toMatchObject({ id: "req-1", phase: "pending", method: "POST", tabId: TAB_ID });

    fakeChrome.webRequest.onSendHeaders.emit(
      sendHeadersDetails("req-1", [{ name: "Accept", value: "application/json" }, { name: "X-Empty" }]),
    );
    fakeChrome.webRequest.onHeadersReceived.emit({
      ...responseDetails("req-1", { statusCode: 201, statusLine: "HTTP/1.1 201 Created" }),
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    });
    fakeChrome.webRequest.onCompleted.emit(
      responseDetails("req-1", { statusCode: 201, fromCache: true, timeStamp: 1200 }),
    );

    expect(firstEntry()).toMatchObject({
      phase: "complete",
      statusCode: 201,
      statusLine: "HTTP/1.1 201 Created",
      fromCache: true,
      finishedAt: 1200,
      requestHeaders: [
        { name: "Accept", value: "application/json" },
        { name: "X-Empty", value: "" },
      ],
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    });
  });

  it("treats missing header lists as empty", () => {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1"));
    fakeChrome.webRequest.onHeadersReceived.emit(responseDetails("req-1"));

    expect(firstEntry().responseHeaders).toEqual([]);
  });

  it("marks redirects, blocked requests and network errors", () => {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("redirected"));
    fakeChrome.webRequest.onBeforeRedirect.emit(redirectDetails("redirected"));
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("blocked"));
    fakeChrome.webRequest.onErrorOccurred.emit(errorDetails("blocked", "net::ERR_BLOCKED_BY_CLIENT"));
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("failed"));
    fakeChrome.webRequest.onErrorOccurred.emit(errorDetails("failed", "net::ERR_CONNECTION_REFUSED"));

    const byId = new Map(networkLog.listNetworkEntries().map((entry) => [entry.id, entry]));
    expect(byId.get("redirected")).toMatchObject({ phase: "redirected", statusCode: 302 });
    expect(byId.get("blocked")).toMatchObject({
      phase: "blocked",
      error: "net::ERR_BLOCKED_BY_CLIENT",
      finishedAt: 1500,
    });
    expect(byId.get("failed")).toMatchObject({ phase: "error", error: "net::ERR_CONNECTION_REFUSED" });
  });

  it("ignores follow-up events for requests it never saw", () => {
    fakeChrome.webRequest.onSendHeaders.emit(sendHeadersDetails("ghost", []));
    fakeChrome.webRequest.onHeadersReceived.emit(responseDetails("ghost"));
    fakeChrome.webRequest.onBeforeRedirect.emit(redirectDetails("ghost"));
    fakeChrome.webRequest.onCompleted.emit(responseDetails("ghost"));
    fakeChrome.webRequest.onErrorOccurred.emit(errorDetails("ghost", "net::ERR_FAILED"));

    expect(networkLog.listNetworkEntries()).toEqual([]);
  });

  it("lists the newest entries first and replaces a repeated request id", () => {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("first"));
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("second"));
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("first", { url: "https://api.local/retry" }));

    const entries = networkLog.listNetworkEntries();
    expect(entries.map((entry) => entry.id)).toEqual(["second", "first"]);
    expect(entries[1]?.url).toBe("https://api.local/retry");
  });

  it("stops recording once the log is disabled", () => {
    networkLog.configureNetworkLog({ ...ENABLED, enabled: false });

    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1"));

    expect(networkLog.listNetworkEntries()).toEqual([]);
  });
});

describe("network log rule matches", () => {
  beforeEach(() => {
    networkLog.configureNetworkLog(ENABLED);
  });

  it("labels matched rules with their compiled names and falls back to the rule id", () => {
    networkLog.setRuleLabels({ 3: "Perfil · Local" });
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("req-1"));

    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("req-1", 3));
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("req-1", 9));
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("req-1", 3));

    expect(firstEntry()).toMatchObject({
      matchedRuleIds: [3, 9],
      matchedRuleLabels: ["Perfil · Local", "Regla #9"],
    });
  });

  it("does not attribute rule matches that arrive before the request is logged", () => {
    vi.useFakeTimers({ now: 0 });
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("early", 4));
    vi.setSystemTime(20_000);
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("late", 5));
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("late", 6));

    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("late"));

    expect(firstEntry().matchedRuleIds).toEqual([]);
  });

  it("shows only entries touched by a rule when onlyModified is on", () => {
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("plain"));
    fakeChrome.webRequest.onBeforeRequest.emit(requestDetails("modified"));
    fakeChrome.declarativeNetRequest.onRuleMatchedDebug.emit(ruleMatch("modified", 1));

    networkLog.configureNetworkLog({ ...ENABLED, onlyModified: true });

    expect(networkLog.listNetworkEntries().map((entry) => entry.id)).toEqual(["modified"]);
  });
});
