import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPlaceholders, hasTabPlaceholders, resolvePlaceholders } from "@/lib/placeholders";

const NOW = Date.UTC(2026, 8, 25, 12, 30, 15, 250);
const TAB_URL = "https://app.example.com:8443/panel?x=1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hasPlaceholders", () => {
  it("detects placeholders with or without inner spaces", () => {
    expect(hasPlaceholders("Bearer {{ uuid }}")).toBe(true);
    expect(hasPlaceholders("{{timestamp}}")).toBe(true);
    expect(hasPlaceholders("sin nada {uuid}")).toBe(false);
  });

  it("gives the same answer on repeated calls with the global pattern", () => {
    expect(hasPlaceholders("{{uuid}}")).toBe(true);
    expect(hasPlaceholders("{{uuid}}")).toBe(true);
  });
});

describe("hasTabPlaceholders", () => {
  it("only reacts to placeholders that need the active tab", () => {
    expect(hasTabPlaceholders("{{tabOrigin}}/api")).toBe(true);
    expect(hasTabPlaceholders("{{uuid}} {{unix}}")).toBe(false);
  });
});

describe("resolvePlaceholders", () => {
  it("resolves the time based placeholders from the context clock", () => {
    const resolved = resolvePlaceholders("{{timestamp}}|{{unix}}|{{isoDate}}", { tabUrl: null, now: NOW });

    expect(resolved).toEqual({
      value: `${NOW}|${Math.floor(NOW / 1000)}|2026-09-25T12:30:15.250Z`,
      unknownNames: [],
      unavailableNames: [],
    });
  });

  it("resolves random below one million using crypto", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint32Array) => {
        array.fill(1_000_042);
        return array;
      },
    });

    expect(resolvePlaceholders("{{random}}", { tabUrl: null, now: NOW }).value).toBe("42");
  });

  it("resolves uuid with a fresh id", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-from-crypto" });

    expect(resolvePlaceholders("id={{ uuid }}", { tabUrl: null, now: NOW }).value).toBe(
      "id=uuid-from-crypto",
    );
  });

  it("resolves the tab placeholders from the active tab url", () => {
    const resolved = resolvePlaceholders("{{tabUrl}} {{tabOrigin}} {{tabHostname}}", {
      tabUrl: TAB_URL,
      now: NOW,
    });

    expect(resolved.value).toBe(`${TAB_URL} https://app.example.com:8443 app.example.com`);
  });

  it("empties tab placeholders without a tab and reports each name once", () => {
    const resolved = resolvePlaceholders("a{{tabOrigin}}b{{tabOrigin}}c", { tabUrl: null, now: NOW });

    expect(resolved).toEqual({ value: "abc", unknownNames: [], unavailableNames: ["tabOrigin"] });
  });

  it("marks origin and hostname unavailable when the tab url cannot be parsed", () => {
    const resolved = resolvePlaceholders("{{tabUrl}}|{{tabHostname}}", { tabUrl: "about blank", now: NOW });

    expect(resolved).toEqual({ value: "about blank|", unknownNames: [], unavailableNames: ["tabHostname"] });
  });

  it("leaves unknown placeholders untouched and reports each name once", () => {
    const resolved = resolvePlaceholders("{{nope}}-{{nope}}-{{other}}", { tabUrl: null, now: NOW });

    expect(resolved).toEqual({
      value: "{{nope}}-{{nope}}-{{other}}",
      unknownNames: ["nope", "other"],
      unavailableNames: [],
    });
  });
});
