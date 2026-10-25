import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format";
import { isValidMatchPattern, matchPatternToRegExp } from "@/lib/match-patterns";
import { isValidRegExp } from "@/lib/regexp";
import { parseUserScriptHeader } from "@/lib/userscript-header";

describe("isValidMatchPattern host rules", () => {
  it("accepts an empty host only for file urls and any scheme", () => {
    expect(isValidMatchPattern("file:///tmp/*")).toBe(true);
    expect(isValidMatchPattern("https:///path")).toBe(true);
  });

  it("rejects wildcards that are not a leading subdomain wildcard", () => {
    expect(isValidMatchPattern("https://*foo.com/*")).toBe(false);
    expect(isValidMatchPattern("https://foo.*.com/*")).toBe(false);
    expect(isValidMatchPattern("https://*./*")).toBe(false);
    expect(isValidMatchPattern("https://*.*.com/*")).toBe(false);
  });

  it("accepts a bare wildcard host and a subdomain wildcard", () => {
    expect(isValidMatchPattern("https://*/*")).toBe(true);
    expect(isValidMatchPattern("https://*.example.com/*")).toBe(true);
  });

  it("requires a path after the host", () => {
    expect(isValidMatchPattern("https://example.com")).toBe(false);
  });

  it("treats a missing host as any host", () => {
    expect(matchPatternToRegExp("https:///*")?.test("https://anything.com/x")).toBe(true);
  });
});

describe("isValidRegExp", () => {
  it("tells valid sources from broken ones", () => {
    expect(isValidRegExp("^https://(.*)$")).toBe(true);
    expect(isValidRegExp("(unclosed")).toBe(false);
  });
});

describe("slugify edge dashes", () => {
  it("drops a single leading and trailing separator run", () => {
    expect(slugify("  --¡Hola, mundo!--  ")).toBe("hola-mundo");
  });
});

describe("parseUserScriptHeader block boundaries", () => {
  it("reads the block when the start marker follows other text on its line", () => {
    const code = ["const x = 1; // ==UserScript==", "// @name Inline", "// ==/UserScript=="].join("\n");
    expect(parseUserScriptHeader(code).name).toBe("Inline");
  });

  it("ignores a start marker followed by more text", () => {
    const code = ["// ==UserScript== extra", "// @name Nope", "// ==/UserScript=="].join("\n");
    expect(parseUserScriptHeader(code).name).toBeNull();
  });

  it("accepts an indented end marker with text after it", () => {
    const code = ["// ==UserScript==", "// @name Indented", "   //  ==/UserScript== fin"].join("\n");
    expect(parseUserScriptHeader(code).name).toBe("Indented");
  });

  it("skips header lines that carry a carriage return inside the value", () => {
    const code = [
      "// ==UserScript==\r",
      "// @name Windows\r",
      "// @match https://a.com/*",
      "// ==/UserScript==",
    ].join("\n");
    const header = parseUserScriptHeader(code);
    expect(header.name).toBeNull();
    expect(header.matches).toEqual(["https://a.com/*"]);
  });

  it("ignores comment lines that are not tags", () => {
    const code = ["// ==UserScript==", "// just a note", "//@", "// @name Real", "// ==/UserScript=="].join(
      "\n",
    );
    expect(parseUserScriptHeader(code).name).toBe("Real");
  });
});
