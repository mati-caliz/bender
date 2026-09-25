import { afterEach, describe, expect, it, vi } from "vitest";
import { toRuleCondition } from "@/lib/dnr-session";
import { loadScopedMap, saveScopedMap } from "@/lib/toggleable";
import { installFakeChrome } from "./support/fake-chrome";

const STORAGE_KEY = "benderDisabledItems";

const isString = (value: unknown): value is string => typeof value === "string";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadScopedMap", () => {
  it("returns an empty map without a scope and without reading storage", async () => {
    const fake = installFakeChrome();
    fake.storage.local.data.set(STORAGE_KEY, { "": { token: "x" } });

    await expect(loadScopedMap(STORAGE_KEY, "", isString)).resolves.toEqual({});
  });

  it("returns an empty map when the stored value or the scope entry is not an object", async () => {
    const fake = installFakeChrome();
    fake.storage.local.data.set(STORAGE_KEY, "roto");

    await expect(loadScopedMap(STORAGE_KEY, "example.com", isString)).resolves.toEqual({});

    fake.storage.local.data.set(STORAGE_KEY, { "example.com": 3 });

    await expect(loadScopedMap(STORAGE_KEY, "example.com", isString)).resolves.toEqual({});
  });

  it("keeps only the entries that pass the guard", async () => {
    const fake = installFakeChrome();
    fake.storage.local.data.set(STORAGE_KEY, { "example.com": { token: "abc", broken: 1 } });

    await expect(loadScopedMap(STORAGE_KEY, "example.com", isString)).resolves.toEqual({ token: "abc" });
  });
});

describe("saveScopedMap", () => {
  it("does nothing without a scope", async () => {
    const fake = installFakeChrome();

    await saveScopedMap(STORAGE_KEY, "", { token: "abc" });

    expect(fake.storage.local.data.has(STORAGE_KEY)).toBe(false);
  });

  it("replaces a broken stored value with a fresh map", async () => {
    const fake = installFakeChrome();
    fake.storage.local.data.set(STORAGE_KEY, "roto");

    await saveScopedMap(STORAGE_KEY, "example.com", { token: "abc" });

    expect(fake.storage.local.data.get(STORAGE_KEY)).toEqual({ "example.com": { token: "abc" } });
  });

  it("removes the scope entry when the map is empty and keeps the others", async () => {
    const fake = installFakeChrome();
    fake.storage.local.data.set(STORAGE_KEY, { "example.com": { token: "abc" }, "other.com": { sid: "1" } });

    await saveScopedMap(STORAGE_KEY, "example.com", {});

    expect(fake.storage.local.data.get(STORAGE_KEY)).toEqual({ "other.com": { sid: "1" } });
  });
});

describe("toRuleCondition", () => {
  it("copies every optional field that is present", () => {
    expect(
      toRuleCondition({
        resourceTypes: ["script"],
        urlFilter: "/api",
        regexFilter: "^https://",
        requestDomains: ["a.com"],
        excludedRequestDomains: ["b.com"],
        initiatorDomains: ["c.com"],
        excludedInitiatorDomains: ["d.com"],
        requestMethods: ["get", "other"],
        tabIds: [7],
      }),
    ).toEqual({
      resourceTypes: ["script"],
      urlFilter: "/api",
      regexFilter: "^https://",
      requestDomains: ["a.com"],
      excludedRequestDomains: ["b.com"],
      initiatorDomains: ["c.com"],
      excludedInitiatorDomains: ["d.com"],
      requestMethods: ["get"],
      tabIds: [7],
    });
  });

  it("leaves out empty filters", () => {
    expect(toRuleCondition({ resourceTypes: ["image"], urlFilter: "", regexFilter: "" })).toEqual({
      resourceTypes: ["image"],
    });
  });
});
