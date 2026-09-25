import { describe, expect, it } from "vitest";
import { MAX_FAIL_RATE } from "@/lib/chaos";
import { createEmptyScope } from "@/lib/constants";
import {
  coerceCookieSnapshot,
  coerceCookieSnapshotSet,
  coerceEnvironment,
  coerceHeaderEntry,
  coerceList,
  coerceProfile,
  coerceScope,
  coerceTrafficRule,
  coerceUserScript,
  isCookieSnapshot,
  isStoredItem,
} from "@/lib/sanitize";

describe("coerceScope", () => {
  it("returns an empty scope for non objects", () => {
    expect(coerceScope("roto")).toEqual(createEmptyScope());
    expect(coerceScope([1, 2])).toEqual(createEmptyScope());
  });

  it("keeps only known resource types and lowercases known methods", () => {
    const scope = coerceScope({
      activeTabOnly: true,
      includeDomains: ["example.com", 7],
      excludeDomains: "not-a-list",
      initiatorDomains: ["app.example.com"],
      excludedInitiatorDomains: [],
      urlFilter: "/api/",
      resourceTypes: ["script", "teleport", 3],
      requestMethods: ["GET", "Post", "FLY"],
    });

    expect(scope).toEqual({
      activeTabOnly: true,
      includeDomains: ["example.com"],
      excludeDomains: [],
      initiatorDomains: ["app.example.com"],
      excludedInitiatorDomains: [],
      urlFilter: "/api/",
      resourceTypes: ["script"],
      requestMethods: ["get", "post"],
    });
  });

  it("falls back to defaults for fields with the wrong type", () => {
    expect(coerceScope({ activeTabOnly: "yes", urlFilter: 12 })).toEqual(createEmptyScope());
  });
});

describe("coerceHeaderEntry", () => {
  it("rejects non objects", () => {
    expect(coerceHeaderEntry(null)).toBeNull();
  });

  it("fills defaults and generates an id when it is blank", () => {
    const entry = coerceHeaderEntry({ id: "   ", name: "X-Test", operation: "explode", enabled: "no" });

    expect(entry).toMatchObject({
      name: "X-Test",
      value: "",
      variants: [],
      operation: "set",
      enabled: true,
      comment: "",
    });
    expect(entry?.id).toMatch(/\S/);
    expect(entry?.id).not.toBe("   ");
  });

  it("keeps valid values and trims the id", () => {
    const entry = coerceHeaderEntry({
      id: " header-1 ",
      name: "Authorization",
      value: "Bearer x",
      variants: ["Bearer y", false],
      operation: "remove",
      enabled: false,
      comment: "token",
    });

    expect(entry).toEqual({
      id: "header-1",
      name: "Authorization",
      value: "Bearer x",
      variants: ["Bearer y"],
      operation: "remove",
      enabled: false,
      comment: "token",
    });
  });
});

describe("coerceProfile", () => {
  it("rejects non objects", () => {
    expect(coerceProfile(5)).toBeNull();
  });

  it("uses the default name and color and drops broken headers", () => {
    const profile = coerceProfile({
      id: "profile-1",
      requestHeaders: [{ name: "A" }, "roto"],
      responseHeaders: "roto",
    });

    expect(profile).toMatchObject({
      id: "profile-1",
      name: "Perfil",
      color: "#6366f1",
      enabled: true,
      scope: createEmptyScope(),
      responseHeaders: [],
    });
    expect(profile?.requestHeaders.map((entry) => entry.name)).toEqual(["A"]);
  });
});

describe("coerceTrafficRule", () => {
  it("rejects non objects and rules without a valid action", () => {
    expect(coerceTrafficRule("roto")).toBeNull();
    expect(coerceTrafficRule({ id: "rule-1" })).toBeNull();
    expect(coerceTrafficRule({ id: "rule-1", action: { kind: "teleport" } })).toBeNull();
  });

  it("builds a block rule with defaults", () => {
    expect(coerceTrafficRule({ id: "rule-1", action: { kind: "block" } })).toEqual({
      id: "rule-1",
      name: "Regla",
      enabled: true,
      scope: createEmptyScope(),
      action: { kind: "block" },
    });
  });

  it("builds a redirect rule defaulting to a literal target", () => {
    const rule = coerceTrafficRule({ id: "rule-1", action: { kind: "redirect", target: "https://x.dev" } });

    expect(rule?.action).toEqual({ kind: "redirect", target: "https://x.dev", useRegex: false });
  });

  it("builds a mock rule with default status, content type and delay", () => {
    const rule = coerceTrafficRule({
      id: "rule-1",
      action: { kind: "mock", status: Number.NaN, body: "{}", headers: [{ name: "X-Mock", value: "1" }] },
    });

    expect(rule?.action).toMatchObject({
      kind: "mock",
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: "{}",
      delayMs: 0,
      headers: [{ name: "X-Mock", value: "1", operation: "set" }],
    });
  });

  it("clamps chaos values into their valid ranges", () => {
    const rule = coerceTrafficRule({
      id: "rule-1",
      action: { kind: "chaos", delayMs: -50, failRate: 250, failStatus: -1 },
    });

    expect(rule?.action).toEqual({ kind: "chaos", delayMs: 0, failRate: MAX_FAIL_RATE, failStatus: 0 });
  });

  it("uses zero for missing chaos values", () => {
    const rule = coerceTrafficRule({ id: "rule-1", action: { kind: "chaos" } });

    expect(rule?.action).toEqual({ kind: "chaos", delayMs: 0, failRate: 0, failStatus: 0 });
  });
});

describe("coerceUserScript", () => {
  it("rejects non objects", () => {
    expect(coerceUserScript(undefined)).toBeNull();
  });

  it("fills defaults for missing or unknown values", () => {
    expect(coerceUserScript({ id: "script-1", language: "ruby", runAt: "later", world: "ISOLATED" })).toEqual(
      {
        id: "script-1",
        name: "Script",
        description: "",
        enabled: true,
        language: "javascript",
        matches: [],
        excludeMatches: [],
        runAt: "document_idle",
        world: "MAIN",
        allFrames: false,
        code: "",
        updatedAt: 0,
      },
    );
  });

  it("keeps valid values", () => {
    const script = coerceUserScript({
      id: "script-1",
      name: "Oscuro",
      language: "css",
      matches: ["https://*/*"],
      excludeMatches: ["https://bank.com/*"],
      runAt: "document_start",
      world: "USER_SCRIPT",
      allFrames: true,
      code: "body{}",
      updatedAt: 1234,
    });

    expect(script).toMatchObject({
      name: "Oscuro",
      language: "css",
      runAt: "document_start",
      world: "USER_SCRIPT",
      allFrames: true,
      updatedAt: 1234,
    });
  });
});

describe("coerceEnvironment", () => {
  it("rejects non objects and blank names", () => {
    expect(coerceEnvironment(1)).toBeNull();
    expect(coerceEnvironment({ name: "   " })).toBeNull();
  });

  it("trims the name and keeps only string ids", () => {
    expect(
      coerceEnvironment({ id: "env-1", name: " Staging ", profileIds: ["p1", 2], ruleIds: "x" }),
    ).toEqual({
      id: "env-1",
      name: "Staging",
      profileIds: ["p1"],
      ruleIds: [],
    });
  });
});

describe("coerceCookieSnapshot", () => {
  it("rejects non objects and cookies without a name", () => {
    expect(coerceCookieSnapshot(null)).toBeNull();
    expect(coerceCookieSnapshot({ value: "x" })).toBeNull();
  });

  it("fills defaults and falls back to the root path", () => {
    expect(coerceCookieSnapshot({ name: "sid", path: "", sameSite: "weird" })).toEqual({
      name: "sid",
      value: "",
      domain: "",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "unspecified",
      hostOnly: true,
      expirationDate: null,
    });
  });

  it("keeps the expiration date and valid flags", () => {
    expect(
      coerceCookieSnapshot({
        name: "sid",
        value: "abc",
        domain: ".example.com",
        path: "/app",
        secure: true,
        httpOnly: true,
        sameSite: "strict",
        hostOnly: false,
        expirationDate: 1_800_000_000,
      }),
    ).toMatchObject({ path: "/app", sameSite: "strict", hostOnly: false, expirationDate: 1_800_000_000 });
  });
});

describe("coerceCookieSnapshotSet", () => {
  it("rejects non objects and blank names", () => {
    expect(coerceCookieSnapshotSet([])).toBeNull();
    expect(coerceCookieSnapshotSet({ name: "" })).toBeNull();
  });

  it("drops broken cookies and defaults the creation time", () => {
    const set = coerceCookieSnapshotSet({
      id: "set-1",
      name: "Login",
      cookies: [{ name: "sid" }, { value: 1 }],
    });

    expect(set?.createdAt).toBe(0);
    expect(set?.cookies.map((cookie) => cookie.name)).toEqual(["sid"]);
  });

  it("uses an empty list when cookies is not an array", () => {
    expect(coerceCookieSnapshotSet({ name: "Login", createdAt: 99, cookies: "x" })).toMatchObject({
      createdAt: 99,
      cookies: [],
    });
  });
});

describe("type guards", () => {
  it("recognizes stored items only with string key and value", () => {
    expect(isStoredItem({ key: "token", value: "abc" })).toBe(true);
    expect(isStoredItem({ key: "token", value: 1 })).toBe(false);
    expect(isStoredItem("token")).toBe(false);
  });

  it("recognizes cookie snapshots by name, domain and path", () => {
    expect(isCookieSnapshot({ name: "sid", domain: "x.com", path: "/" })).toBe(true);
    expect(isCookieSnapshot({ name: "sid", domain: "x.com" })).toBe(false);
    expect(isCookieSnapshot({ name: "sid", path: "/" })).toBe(false);
    expect(isCookieSnapshot({ domain: "x.com", path: "/" })).toBe(false);
    expect(isCookieSnapshot(null)).toBe(false);
  });
});

describe("coerceList", () => {
  it("returns nothing dropped for non arrays", () => {
    expect(coerceList("x", coerceEnvironment)).toEqual({ items: [], dropped: 0 });
  });

  it("counts the items the coercer rejected", () => {
    const result = coerceList([{ name: "A" }, { name: "" }, 3], coerceEnvironment);

    expect(result.items.map((environment) => environment.name)).toEqual(["A"]);
    expect(result.dropped).toBe(2);
  });
});
