import { afterEach, describe, expect, it, vi } from "vitest";
import { PROFILE_COLORS, createEmptyScope } from "@/lib/constants";
import {
  createMockRuleFromEntry,
  createProfile,
  createTrafficRule,
  createTrafficRuleAction,
  createUserScript,
} from "@/lib/factories";
import type { NetworkEntry } from "@/types";

const entryWith = (overrides: Partial<NetworkEntry>): NetworkEntry => ({
  id: "entry-1",
  tabId: 1,
  url: "https://api.example.com/v1/items?page=1",
  method: "POST",
  resourceType: "xmlhttprequest",
  phase: "complete",
  statusCode: 201,
  statusLine: "HTTP/1.1 201 Created",
  fromCache: false,
  startedAt: 0,
  finishedAt: 10,
  error: null,
  requestHeaders: [],
  responseHeaders: [],
  matchedRuleIds: [],
  matchedRuleLabels: [],
  source: "network",
  requestBody: null,
  responseBody: null,
  bodyTruncated: false,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createProfile", () => {
  it("numbers the profile and cycles through the palette", () => {
    const profile = createProfile(PROFILE_COLORS.length + 1);

    expect(profile.name).toBe(`Perfil ${PROFILE_COLORS.length + 2}`);
    expect(profile.color).toBe(PROFILE_COLORS[1]);
    expect(profile.requestHeaders).toHaveLength(1);
    expect(profile.responseHeaders).toEqual([]);
  });

  it("applies overrides", () => {
    expect(createProfile(0, { name: "Prod", enabled: false })).toMatchObject({
      name: "Prod",
      enabled: false,
    });
  });
});

describe("createTrafficRuleAction", () => {
  it("creates a block action", () => {
    expect(createTrafficRuleAction("block")).toEqual({ kind: "block" });
  });

  it("creates an empty literal redirect", () => {
    expect(createTrafficRuleAction("redirect")).toEqual({ kind: "redirect", target: "", useRegex: false });
  });

  it("creates a json mock that answers ok", () => {
    expect(createTrafficRuleAction("mock")).toEqual({
      kind: "mock",
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: '{\n  "ok": true\n}',
      delayMs: 0,
      headers: [],
    });
  });

  it("creates a chaos action that only delays", () => {
    expect(createTrafficRuleAction("chaos")).toEqual({
      kind: "chaos",
      delayMs: 1000,
      failRate: 0,
      failStatus: 500,
    });
  });
});

describe("createTrafficRule", () => {
  it("numbers the rule with an empty scope", () => {
    expect(createTrafficRule("block", 2)).toMatchObject({
      name: "Regla 3",
      enabled: true,
      scope: createEmptyScope(),
      action: { kind: "block" },
    });
  });
});

describe("createMockRuleFromEntry", () => {
  it("keeps the default status and content type when the entry has none", () => {
    const rule = createMockRuleFromEntry(entryWith({ statusCode: null, method: "PATCH" }), 0);

    expect(rule.scope.requestMethods).toEqual(["patch"]);
    expect(rule.action).toMatchObject({
      kind: "mock",
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: "",
    });
  });

  it("reads the content type header case insensitively", () => {
    const rule = createMockRuleFromEntry(
      entryWith({ responseHeaders: [{ name: "Content-Type", value: "text/csv" }], responseBody: "a,b" }),
      0,
    );

    expect(rule.name).toBe("Mock /v1/items?page=1");
    expect(rule.action).toMatchObject({ status: 201, contentType: "text/csv", body: "a,b" });
  });
});

describe("createUserScript", () => {
  it("names javascript scripts and stamps the update time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);

    expect(createUserScript("javascript", 0)).toMatchObject({
      name: "Script 1",
      language: "javascript",
      runAt: "document_idle",
      world: "MAIN",
      updatedAt: 5000,
    });
  });

  it("names css scripts as styles and applies overrides", () => {
    expect(createUserScript("css", 3, { allFrames: true })).toMatchObject({
      name: "Estilo 4",
      language: "css",
      allFrames: true,
    });
  });
});
