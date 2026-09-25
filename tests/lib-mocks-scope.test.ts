import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_RESOURCE_TYPES, createEmptyScope } from "@/lib/constants";
import { MOCKS_STORAGE_KEY, publishPageConfig, readPageConfig, toPageConfig } from "@/lib/mocks";
import {
  describeScope,
  isScopeRestricted,
  requestMatchesScope,
  resolveResourceTypes,
  urlFilterToRegExp,
} from "@/lib/scope";
import type { Scope } from "@/types";
import { stateWith, trafficRuleWith } from "./support/dnr-fixtures";
import { installFakeChrome } from "./support/fake-chrome";

const scopeWith = (overrides: Partial<Scope>): Scope => ({ ...createEmptyScope(), ...overrides });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toPageConfig", () => {
  it("returns an empty config for anything that is not an object", () => {
    expect(toPageConfig(undefined)).toEqual({ mocks: [], chaos: [], captureBodies: false });
  });

  it("replaces non list fields and only accepts a literal true for bodies", () => {
    expect(toPageConfig({ mocks: "x", chaos: 1, captureBodies: "true" })).toEqual({
      mocks: [],
      chaos: [],
      captureBodies: false,
    });
  });

  it("keeps stored lists and the body capture flag", () => {
    expect(toPageConfig({ mocks: [], chaos: [], captureBodies: true })).toEqual({
      mocks: [],
      chaos: [],
      captureBodies: true,
    });
  });
});

describe("publishPageConfig and readPageConfig", () => {
  it("round trips the page config through local storage", async () => {
    const fake = installFakeChrome();
    const state = stateWith({
      trafficRules: [
        trafficRuleWith({
          kind: "mock",
          status: 201,
          contentType: "text/plain",
          body: "hola",
          delayMs: 5,
          headers: [],
        }),
      ],
      network: { enabled: true, maxEntries: 10, captureBodies: true, onlyModified: false },
    });

    await publishPageConfig(state);
    const config = await readPageConfig();

    expect(fake.storage.local.data.has(MOCKS_STORAGE_KEY)).toBe(true);
    expect(config.captureBodies).toBe(true);
    expect(config.mocks).toMatchObject([{ id: "rule-1", status: 201, body: "hola" }]);
  });

  it("reads an empty config when nothing was published", async () => {
    installFakeChrome();

    await expect(readPageConfig()).resolves.toEqual({ mocks: [], chaos: [], captureBodies: false });
  });
});

describe("resolveResourceTypes", () => {
  it("expands an empty selection to every resource type", () => {
    expect(resolveResourceTypes(createEmptyScope())).toEqual(ALL_RESOURCE_TYPES);
  });

  it("keeps an explicit selection", () => {
    expect(resolveResourceTypes(scopeWith({ resourceTypes: ["script"] }))).toEqual(["script"]);
  });
});

describe("describeScope", () => {
  it("describes an empty scope as all requests", () => {
    expect(describeScope(createEmptyScope())).toBe("todas las requests");
  });

  it("joins every restriction in order", () => {
    const scope = scopeWith({
      activeTabOnly: true,
      requestMethods: ["get", "post"],
      includeDomains: ["a.com", "b.com"],
      excludeDomains: ["c.com"],
      initiatorDomains: ["d.com"],
      excludedInitiatorDomains: ["e.com"],
      urlFilter: "  /api/  ",
      resourceTypes: ["script", "image"],
    });

    expect(describeScope(scope)).toBe(
      "solo pestaña activa · GET/POST · a.com, b.com · excepto c.com · desde d.com · no desde e.com · url ~ /api/ · 2 tipo(s)",
    );
  });
});

describe("isScopeRestricted", () => {
  const restrictions: [string, Partial<Scope>][] = [
    ["active tab", { activeTabOnly: true }],
    ["included domains", { includeDomains: ["a.com"] }],
    ["excluded domains", { excludeDomains: ["a.com"] }],
    ["initiator domains", { initiatorDomains: ["a.com"] }],
    ["excluded initiators", { excludedInitiatorDomains: ["a.com"] }],
    ["url filter", { urlFilter: "/api" }],
    ["resource types", { resourceTypes: ["script"] }],
    ["request methods", { requestMethods: ["get"] }],
  ];

  it.each(restrictions)("is restricted by %s", (_label, overrides) => {
    expect(isScopeRestricted(scopeWith(overrides))).toBe(true);
  });

  it("is not restricted when empty or with a blank url filter", () => {
    expect(isScopeRestricted(scopeWith({ urlFilter: "   " }))).toBe(false);
  });
});

describe("urlFilterToRegExp anchors", () => {
  it("anchors the start with a double bar", () => {
    const pattern = urlFilterToRegExp("||example.com/api");

    expect(pattern.test("https://example.com/api/users")).toBe(true);
    expect(pattern.test("https://evil.dev/?next=example.com/api")).toBe(true);
    expect(pattern.source.startsWith("^")).toBe(true);
  });

  it("anchors the start and the end with single bars", () => {
    const pattern = urlFilterToRegExp("|https://example.com/exact|");

    expect(pattern.test("https://example.com/exact")).toBe(true);
    expect(pattern.test("https://example.com/exact/more")).toBe(false);
  });
});

describe("requestMatchesScope with initiators", () => {
  it("rejects requests whose initiator is outside the allowed domains", () => {
    const scope = scopeWith({ initiatorDomains: ["app.com"] });

    expect(
      requestMatchesScope(scope, { url: "https://api.com/x", method: "GET", initiatorHostname: "evil.com" }),
    ).toBe(false);
    expect(
      requestMatchesScope(scope, {
        url: "https://api.com/x",
        method: "GET",
        initiatorHostname: "WWW.APP.COM",
      }),
    ).toBe(true);
  });

  it("rejects requests that fail the url filter", () => {
    const scope = scopeWith({ urlFilter: "/graphql" });

    expect(
      requestMatchesScope(scope, { url: "https://api.com/rest", method: "GET", initiatorHostname: "" }),
    ).toBe(false);
  });
});
