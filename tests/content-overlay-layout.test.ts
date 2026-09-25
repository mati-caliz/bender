// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  PANEL_FLIP_THRESHOLD,
  PANEL_MARGIN,
  PANEL_WIDTH,
  boxFromRect,
  collapseShorthand,
  describeSelector,
  expandBox,
  formatPx,
  formatSize,
  formatWithRem,
  gapBetween,
  hasText,
  lastSelectorPart,
  readEdges,
  readableColor,
  round,
  shrinkBox,
} from "@/content/overlay-layout";
import { OVERLAY_STYLES } from "@/content/overlay-styles";
import { addElement } from "./support/content-overlay";

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
});

describe("overlay-layout: formatting", () => {
  it("rounds to one decimal and drops trailing zeros", () => {
    expect(round(12.345)).toBe("12.3");
    expect(round(12)).toBe("12");
    expect(round(-0.04)).toBe("0");
  });

  it("formats pixels and sizes", () => {
    expect(formatPx(10.26)).toBe("10.3px");
    expect(formatSize(100, 40.56)).toBe("100 × 40.6");
  });

  it("converts to rem with the default root font size when none is set", () => {
    expect(formatWithRem(32)).toBe("32px · 2rem");
  });

  it("converts to rem using the page root font size", () => {
    document.documentElement.style.fontSize = "20px";

    expect(formatWithRem(30)).toBe("30px · 1.5rem");
  });

  it("falls back to the default when the root font size is zero", () => {
    document.documentElement.style.fontSize = "0px";

    expect(formatWithRem(8)).toBe("8px · 0.5rem");
  });

  it("detects text presence", () => {
    expect(hasText("a")).toBe(true);
    expect(hasText("")).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText(undefined)).toBe(false);
  });
});

describe("overlay-layout: collapseShorthand", () => {
  it("collapses four equal values into one", () => {
    expect(collapseShorthand(["4px", "4px", "4px", "4px"])).toBe("4px");
  });

  it("collapses matching axes into two values", () => {
    expect(collapseShorthand(["4px", "8px", "4px", "8px"])).toBe("4px 8px");
  });

  it("keeps the four values when the axes differ", () => {
    expect(collapseShorthand(["1px", "2px", "3px", "4px"])).toBe("1px 2px 3px 4px");
    expect(collapseShorthand(["1px", "2px", "1px", "3px"])).toBe("1px 2px 1px 3px");
  });
});

describe("overlay-layout: selectors", () => {
  it("builds a path of tags and at most two foreign classes", () => {
    const section = addElement("section");
    section.className = "hero bender-own wide extra";
    const title = addElement("h1", "", section);

    expect(describeSelector(title)).toBe("body > section.hero.wide > h1");
    expect(lastSelectorPart(title)).toBe("h1");
  });

  it("stops at the first ancestor with an id", () => {
    const wrapper = addElement("div");
    wrapper.id = "app";
    const button = addElement("button", "", wrapper);
    button.className = "primary";

    expect(describeSelector(button)).toBe("div#app > button.primary");
  });

  it("uses the id of the element itself", () => {
    const anchor = addElement("a");
    anchor.id = "home";

    expect(describeSelector(anchor)).toBe("a#home");
  });

  it("limits the depth to four levels", () => {
    let parent: Element = document.body;
    for (let i = 0; i < 6; i += 1) parent = addElement("div", "", parent);

    expect(describeSelector(parent).split(" > ")).toHaveLength(4);
  });

  it("returns an empty selector for the document element", () => {
    expect(describeSelector(document.documentElement)).toBe("");
    expect(lastSelectorPart(document.documentElement)).toBe("");
  });
});

describe("overlay-layout: colors", () => {
  it("turns parseable colors into hex", () => {
    expect(readableColor("rgb(255, 0, 0)")).toBe("#ff0000");
  });

  it("returns the input when the color cannot be parsed", () => {
    expect(readableColor("transparent")).toBe("transparent");
  });
});

describe("overlay-layout: boxes", () => {
  const box = { left: 10, top: 20, width: 100, height: 50 };
  const edges = { top: 1, right: 2, bottom: 3, left: 4 };

  it("copies a DOMRect into a box", () => {
    expect(boxFromRect(new DOMRect(1, 2, 3, 4))).toEqual({ left: 1, top: 2, width: 3, height: 4 });
  });

  it("expands a box by its edges", () => {
    expect(expandBox(box, edges)).toEqual({ left: 6, top: 19, width: 106, height: 54 });
  });

  it("shrinks a box by its edges without going negative", () => {
    expect(shrinkBox(box, edges)).toEqual({ left: 14, top: 21, width: 94, height: 46 });
    expect(shrinkBox({ left: 0, top: 0, width: 2, height: 2 }, edges)).toEqual({
      left: 4,
      top: 1,
      width: 0,
      height: 0,
    });
  });

  it("reads edges from styles and treats missing values as zero", () => {
    const element = addElement("div", "margin-top: 5px; margin-left: 7.5px");
    const styles = window.getComputedStyle(element);

    expect(readEdges(styles, (side) => `margin-${side}`)).toEqual({ top: 5, right: 0, bottom: 0, left: 7.5 });
  });
});

describe("overlay-layout: gapBetween", () => {
  const base = { left: 0, top: 0, width: 100, height: 50 };

  it("measures the horizontal gap in both directions", () => {
    const right = { left: 130, top: 0, width: 20, height: 50 };

    expect(gapBetween(base, right)).toEqual({ horizontal: 30, vertical: 0 });
    expect(gapBetween(right, base)).toEqual({ horizontal: 30, vertical: 0 });
  });

  it("measures the vertical gap in both directions", () => {
    const below = { left: 0, top: 70, width: 100, height: 10 };

    expect(gapBetween(base, below)).toEqual({ horizontal: 0, vertical: 20 });
    expect(gapBetween(below, base)).toEqual({ horizontal: 0, vertical: 20 });
  });

  it("reports zero for overlapping boxes", () => {
    expect(gapBetween(base, { left: 50, top: 25, width: 100, height: 100 })).toEqual({
      horizontal: 0,
      vertical: 0,
    });
  });
});

describe("overlay-styles", () => {
  it("sizes the panel with the layout width and flips it with room for margins", () => {
    expect(OVERLAY_STYLES).toContain(`width: ${PANEL_WIDTH}px`);
    expect(PANEL_FLIP_THRESHOLD).toBe(PANEL_WIDTH + PANEL_MARGIN * 3);
  });
});
