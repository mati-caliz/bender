// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { auditPageDesign } from "@/lib/design-audit";

const MAX_ELEMENTS = 100;
const MAX_RESULTS = 10;

const render = (markup: string): void => {
  document.head.innerHTML =
    "<style>:root { --brand: #ff0000; --gap: 8px; } .card { color: rgb(0, 0, 0); }</style>";
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  document.body.replaceChildren(...Array.from(parsed.body.childNodes));
};

describe("auditPageDesign", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("counts text colors only on elements with their own text", () => {
    render(
      '<p style="color: rgb(255, 0, 0)">hola</p><div style="color: rgb(0, 0, 255)"><span style="color: rgb(0, 0, 255)"></span></div>',
    );
    const audit = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS);

    expect(audit.colors).toContainEqual({ hex: "#ff0000", count: 1, roles: ["text"] });
    expect(audit.colors.find((color) => color.hex === "#0000ff")).toBeUndefined();
  });

  it("reads background colors with alpha and skips fully transparent ones", () => {
    render(
      '<div style="background-color: rgba(0, 128, 0, 0.5)"></div><div style="background-color: rgba(1, 2, 3, 0)"></div>',
    );
    const audit = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS);

    expect(audit.colors).toContainEqual({ hex: "#00800080", count: 1, roles: ["background"] });
    expect(audit.colors.find((color) => color.hex.startsWith("#010203"))).toBeUndefined();
  });

  it("tallies spacing, radius and shadow values while skipping zeros", () => {
    render(
      [
        '<div style="padding-top: 8px; margin-left: 0px; border-top-left-radius: 4px; box-shadow: 0 1px 2px black"></div>',
        '<div style="padding-top: 8px; border-top-left-radius: 4px"></div>',
      ].join(""),
    );
    const audit = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS);

    expect(audit.spacings).toContainEqual({ value: "8px", count: 2 });
    expect(audit.spacings.find((usage) => usage.value === "0px")).toBeUndefined();
    expect(audit.radii).toContainEqual({ value: "4px", count: 2 });
    expect(audit.shadows).toHaveLength(1);
  });

  it("groups fonts by family with sorted sizes and weights", () => {
    render(
      [
        '<p style="font-family: Inter; font-size: 16px; font-weight: 700">a</p>',
        '<p style="font-family: Inter; font-size: 12px; font-weight: 400">b</p>',
      ].join(""),
    );
    const inter = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS).fonts.find((font) => font.family === "Inter");

    expect(inter).toEqual({ family: "Inter", count: 2, sizes: [12, 16], weights: [400, 700] });
  });

  it("ignores hidden elements", () => {
    render(
      '<p style="display: none; color: rgb(9, 9, 9)">x</p><p style="visibility: hidden; color: rgb(9, 9, 9)">y</p>',
    );

    expect(
      auditPageDesign(MAX_ELEMENTS, MAX_RESULTS).colors.find((color) => color.hex === "#090909"),
    ).toBeUndefined();
  });

  it("collects root custom properties once each", () => {
    render("<div></div>");
    const audit = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS);

    expect(audit.variables).toEqual([
      { name: "--brand", value: "#ff0000" },
      { name: "--gap", value: "8px" },
    ]);
  });

  it("caps audited elements and results", () => {
    render(
      '<p style="color: rgb(1, 1, 1)">a</p><p style="color: rgb(2, 2, 2)">b</p><p style="color: rgb(3, 3, 3)">c</p>',
    );
    const audit = auditPageDesign(2, 1);

    expect(audit.elementCount).toBe(2);
    expect(audit.colors).toHaveLength(1);
    expect(audit.variables).toHaveLength(1);
  });

  it("orders results by how often they appear", () => {
    render(
      '<p style="color: rgb(1, 1, 1)">a</p><p style="color: rgb(2, 2, 2)">b</p><p style="color: rgb(2, 2, 2)">c</p>',
    );
    const textColors = auditPageDesign(MAX_ELEMENTS, MAX_RESULTS).colors.filter((color) =>
      color.roles.includes("text"),
    );

    expect(textColors[0]?.hex).toBe("#020202");
  });

  it("falls back to the default root font size when none is computed", () => {
    render("<div></div>");
    expect(auditPageDesign(MAX_ELEMENTS, MAX_RESULTS).rootFontSize).toBeGreaterThan(0);
  });
});
