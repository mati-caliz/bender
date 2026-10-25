// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBoxNode,
  createNode,
  createTag,
  hidePanel,
  horizontalGuide,
  host,
  renderPanel,
  verticalGuide,
} from "@/content/overlay-dom";
import { GUIDE_THICKNESS, PANEL_FLIP_THRESHOLD, PANEL_MARGIN } from "@/content/overlay-layout";
import { overlayState } from "@/content/overlay-state";
import { panelRows, panelTitle, panelVisible, shadowOf } from "./support/content-overlay";

const root = shadowOf(host);

const panel = (): HTMLElement => {
  const node = root.querySelector<HTMLElement>(".panel");
  if (!node) throw new Error("no hay panel");
  return node;
};

beforeEach(() => {
  overlayState.pointer = { x: 0, y: 0 };
  hidePanel();
});

describe("overlay-dom: structure", () => {
  it("mounts the overlay inside an open shadow root with its styles, a hidden panel and the hud", () => {
    expect(host.id).toBe("bender-design-overlay");
    expect(root.querySelector("style")?.textContent).toContain(".panel");
    expect(root.querySelector(".layer .hud")).not.toBeNull();
    expect(panelVisible(root)).toBe(false);
  });

  it("creates nodes with and without text", () => {
    expect(createNode("x", "hola").textContent).toBe("hola");
    const empty = createNode("vacío");
    expect(empty.className).toBe("vacío");
    expect(empty.textContent).toBe("");
  });

  it("positions box nodes in pixels", () => {
    const node = createBoxNode("box", { left: 1, top: 2, width: 3, height: 4 });

    expect([node.style.left, node.style.top, node.style.width, node.style.height]).toEqual([
      "1px",
      "2px",
      "3px",
      "4px",
    ]);
  });
});

describe("overlay-dom: tags and guides", () => {
  it("clamps tags inside the viewport", () => {
    const farRight = createTag("a", { x: window.innerWidth + 500, y: -40 }, "accent");

    expect(farRight.className).toBe("tag accent");
    expect(farRight.style.left).toBe(`${window.innerWidth - PANEL_MARGIN}px`);
    expect(farRight.style.top).toBe("2px");

    const farLeft = createTag("b", { x: -10, y: 30 });
    expect(farLeft.className).toBe("tag");
    expect(farLeft.style.left).toBe("2px");
    expect(farLeft.style.top).toBe("30px");
  });

  it("draws full-width and full-height guides", () => {
    const horizontal = horizontalGuide(40);
    const vertical = verticalGuide(60);

    expect(horizontal.className).toBe("guide");
    expect(horizontal.style.width).toBe(`${window.innerWidth}px`);
    expect(horizontal.style.height).toBe(`${GUIDE_THICKNESS}px`);
    expect(vertical.style.left).toBe("60px");
    expect(vertical.style.height).toBe(`${window.innerHeight}px`);
  });
});

describe("overlay-dom: panel", () => {
  it("renders title, rows and swatches only where there is a color", () => {
    renderPanel(
      "div.card",
      [
        { key: "Texto", value: "#fff", color: "#fff" },
        { key: "Display", value: "block" },
        { key: "Fondo", value: "transparent", color: "" },
      ],
      "#000",
    );

    expect(panelVisible(root)).toBe(true);
    expect(panelTitle(root)).toBe("div.card");
    expect(panelRows(root)).toEqual({ Texto: "#fff", Display: "block", Fondo: "transparent" });
    expect(panel().querySelectorAll(".swatch")).toHaveLength(2);
  });

  it("omits the title swatch without accent color", () => {
    renderPanel("Medición", []);

    expect(panel().querySelector(".panel-title .swatch")).toBeNull();
  });

  it("sits on the right unless the pointer is near the right edge", () => {
    renderPanel("a", []);
    expect(panel().style.right).toBe(`${PANEL_MARGIN}px`);
    expect(panel().style.left).toBe("");

    overlayState.pointer = { x: window.innerWidth - PANEL_FLIP_THRESHOLD + 1, y: 0 };
    renderPanel("b", []);
    expect(panel().style.left).toBe(`${PANEL_MARGIN}px`);
    expect(panel().style.right).toBe("");
    expect(panel().style.top).toBe(`${PANEL_MARGIN}px`);
  });

  it("hides and empties the panel", () => {
    renderPanel("a", [{ key: "k", value: "v" }]);
    hidePanel();

    expect(panelVisible(root)).toBe(false);
    expect(panel().childElementCount).toBe(0);
  });
});
