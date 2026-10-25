import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatTime,
  hostnameOf,
  prettyJson,
  shortUrl,
  truncate,
} from "@/lib/format";

const localTimestamp = new Date(2026, 0, 2, 14, 5, 9).getTime();

describe("formatBytes", () => {
  it("keeps plain bytes without decimals", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("shows one decimal for small values in larger units", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("rounds values of ten or more in larger units", () => {
    expect(formatBytes(20 * 1024 + 700)).toBe("21 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("stops at gigabytes even for huge values", () => {
    expect(formatBytes(2048 * 1024 ** 3)).toBe("2048 GB");
  });
});

describe("formatDuration", () => {
  it("uses rounded milliseconds under a second", () => {
    expect(formatDuration(12.6)).toBe("13 ms");
    expect(formatDuration(999)).toBe("999 ms");
  });

  it("switches to seconds with two decimals from one second", () => {
    expect(formatDuration(1000)).toBe("1.00 s");
    expect(formatDuration(2345)).toBe("2.35 s");
  });
});

describe("formatTime and formatDateTime", () => {
  it("renders a 24 hour clock", () => {
    expect(formatTime(localTimestamp)).toBe("14:05:09");
  });

  it("includes the date and the 24 hour clock", () => {
    const formatted = formatDateTime(localTimestamp);

    expect(formatted).toContain("2026");
    expect(formatted).toContain("14:05:09");
  });
});

describe("truncate", () => {
  it("returns the value untouched when it fits", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });

  it("cuts and appends an ellipsis keeping the max length", () => {
    const truncated = truncate("abcdef", 4);

    expect(truncated).toBe("abc…");
    expect(truncated).toHaveLength(4);
  });
});

describe("shortUrl", () => {
  it("keeps path and query string", () => {
    expect(shortUrl("https://api.example.com/v1/users?page=2")).toBe("/v1/users?page=2");
  });

  it("returns a bare slash for the root path", () => {
    expect(shortUrl("https://example.com")).toBe("/");
  });

  it("falls back to the hostname when the url has no path", () => {
    expect(shortUrl("custom://example.com")).toBe("example.com");
  });

  it("returns the input when it is not a url", () => {
    expect(shortUrl("no es una url")).toBe("no es una url");
  });
});

describe("hostnameOf", () => {
  it("extracts the hostname", () => {
    expect(hostnameOf("https://sub.example.com:8080/path")).toBe("sub.example.com");
  });

  it("returns an empty string for invalid urls", () => {
    expect(hostnameOf("::::")).toBe("");
  });
});

describe("prettyJson", () => {
  it("indents valid json with two spaces", () => {
    expect(prettyJson('{"ok":true,"list":[1]}')).toBe('{\n  "ok": true,\n  "list": [\n    1\n  ]\n}');
  });

  it("returns the original text when it is not json", () => {
    expect(prettyJson("<html>")).toBe("<html>");
  });
});
