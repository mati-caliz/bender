// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createUserScript } from "@/lib/factories";
import {
  NAV_ENTRIES,
  groupNavEntries,
  isViewId,
  readPendingImportView,
  readSurface,
  type NavEntry,
  type ViewId,
} from "@/ui/components/app-navigation";
import { hasRenderableNode, hasText, joinClassNames, minHeightStyle } from "@/ui/components/render-guards";
import { header, profileWith, stateWith, trafficRuleWith } from "./support/dnr-fixtures";

const navigateTo = (search: string): void => {
  window.history.replaceState({}, "", `/index.html${search}`);
};

const entryFor = (id: ViewId): NavEntry => {
  const entry = NAV_ENTRIES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`Falta la entrada ${id}`);
  return entry;
};

const countFor = (id: ViewId, state: ReturnType<typeof stateWith>): number | undefined =>
  entryFor(id).count?.(state);

afterEach(() => {
  navigateTo("");
});

describe("isViewId", () => {
  it("accepts every known view including settings", () => {
    expect(isViewId("headers")).toBe(true);
    expect(isViewId("settings")).toBe(true);
  });

  it("rejects unknown values and null", () => {
    expect(isViewId("admin")).toBe(false);
    expect(isViewId(null)).toBe(false);
    expect(isViewId("")).toBe(false);
  });
});

describe("readSurface", () => {
  it("reads popup and panel from the query string", () => {
    navigateTo("?surface=popup");
    expect(readSurface()).toBe("popup");

    navigateTo("?surface=panel");
    expect(readSurface()).toBe("panel");
  });

  it("falls back to tab when the surface is missing or unknown", () => {
    expect(readSurface()).toBe("tab");

    navigateTo("?surface=window");
    expect(readSurface()).toBe("tab");
  });
});

describe("readPendingImportView", () => {
  it("returns the view that asked for an import", () => {
    navigateTo("?surface=tab&import=rules");

    expect(readPendingImportView()).toBe("rules");
  });

  it("ignores a missing or unknown import target", () => {
    expect(readPendingImportView()).toBeNull();

    navigateTo("?import=nowhere");
    expect(readPendingImportView()).toBeNull();
  });
});

describe("groupNavEntries", () => {
  it("keeps the declaration order of groups and entries", () => {
    const groups = groupNavEntries();

    expect(groups.map(([group]) => group)).toEqual(["General", "Red", "Sitio", "Diseño"]);
    expect(groups[1]?.[1].map((entry) => entry.id)).toEqual([
      "headers",
      "rules",
      "cors",
      "useragent",
      "network",
    ]);
  });
});

describe("NAV_ENTRIES counters", () => {
  it("counts enabled named headers of enabled profiles only", () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [
            header("X-One", "1"),
            header("  ", "blank"),
            header("X-Off", "0", { enabled: false }),
          ],
          responseHeaders: [header("X-Resp", "r")],
        }),
        profileWith({ id: "profile-2", enabled: false, requestHeaders: [header("X-Hidden", "h")] }),
      ],
    });

    expect(countFor("headers", state)).toBe(2);
  });

  it("counts enabled traffic rules and user scripts", () => {
    const state = stateWith({
      trafficRules: [
        trafficRuleWith({ kind: "block" }),
        trafficRuleWith({ kind: "block" }, { id: "rule-2", enabled: false }),
      ],
      userScripts: [createUserScript("javascript", 0), createUserScript("css", 1, { enabled: false })],
    });

    expect(countFor("rules", state)).toBe(1);
    expect(countFor("scripts", state)).toBe(1);
  });

  it("has no counter for views without a badge", () => {
    expect(entryFor("overview").count).toBeUndefined();
  });
});

describe("render guards", () => {
  it("hasText only accepts non-empty strings", () => {
    expect(hasText("hola")).toBe(true);
    expect(hasText("")).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
  });

  it("hasRenderableNode treats falsy nodes as empty", () => {
    expect(hasRenderableNode("texto")).toBe(true);
    expect(hasRenderableNode(null)).toBe(false);
    expect(hasRenderableNode(false)).toBe(false);
  });

  it("joinClassNames drops the false entries", () => {
    expect(joinClassNames("btn", false, "small")).toBe("btn small");
    expect(joinClassNames("btn", false)).toBe("btn");
  });

  it("minHeightStyle skips empty or invalid heights", () => {
    expect(minHeightStyle(120)).toEqual({ minHeight: 120 });
    expect(minHeightStyle(undefined)).toBeUndefined();
    expect(minHeightStyle(0)).toBeUndefined();
    expect(minHeightStyle(Number.NaN)).toBeUndefined();
  });
});
