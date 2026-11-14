import { describe, expect, it } from "vitest";

import { patternForHostname, uniqueAppend } from "@/ui/views/scripts/script-patterns";

describe("script patterns", () => {
  it("builds the match pattern of a hostname, or nothing without one", () => {
    expect(patternForHostname("example.com")).toBe("https://example.com/*");
    expect(patternForHostname("")).toBe("");
  });

  it("appends without repeating patterns", () => {
    expect(uniqueAppend(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});
