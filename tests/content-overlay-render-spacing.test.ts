// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { host, hud } from "@/content/overlay-dom";
import { render } from "@/content/overlay-render";
import { overlayState } from "@/content/overlay-state";
import {
  addElement,
  layerNodes,
  panelRows,
  panelTitle,
  panelVisible,
  shadowOf,
  stubRect,
  tagTexts,
} from "./support/content-overlay";

const root = shadowOf(host);

const gapGuide = (): HTMLElement | undefined => layerNodes(root).find((node) => node.className === "gap");

const elementAt = (tag: "div" | "span", rect: DOMRect): HTMLElement => {
  const element = addElement(tag);
  stubRect(element, rect);
  return element;
};

beforeEach(() => {
  Object.assign(overlayState, {
    activeTool: "spacing",
    hoveredElement: null,
    pinnedElement: null,
    frozen: false,
    pointer: { x: 0, y: 0 },
    dragOrigin: null,
    measureBox: null,
  });
});

afterEach(() => {
  document.body.replaceChildren();
  hud.replaceChildren();
});

describe("overlay-render: spacing without a base", () => {
  it("clears everything when nothing is hovered", () => {
    render();

    expect(layerNodes(root)).toHaveLength(0);
    expect(panelVisible(root)).toBe(false);
  });

  it("outlines the hovered element and explains how to pin it", () => {
    overlayState.hoveredElement = elementAt("div", new DOMRect(5, 60, 10, 10));

    render();

    expect(layerNodes(root).map((node) => node.className)).toEqual(["outline", "tag accent"]);
    expect(tagTexts(root)).toEqual(["Click para fijar el elemento base"]);
    expect(panelTitle(root)).toBe("Espaciado");
    expect(panelRows(root)).toEqual({ Base: "sin fijar", Ayuda: "Click fija · click de nuevo libera" });
  });
});

describe("overlay-render: spacing with a pinned base", () => {
  it("asks to hover another element while only the base is known", () => {
    const base = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.pinnedElement = base;
    overlayState.hoveredElement = base;

    render();

    expect(layerNodes(root).map((node) => node.className)).toEqual(["outline pinned"]);
    expect(panelTitle(root)).toBe("body > div");
    expect(panelRows(root)).toEqual({ Base: "100 × 50", Ayuda: "Pasá el mouse por otro elemento" });

    overlayState.hoveredElement = null;
    render();
    expect(panelRows(root)["Base"]).toBe("100 × 50");
  });

  it("measures a horizontal gap to an element on the right", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt("span", new DOMRect(130, 10, 20, 20));

    render();

    const guide = gapGuide();
    expect([guide?.style.left, guide?.style.top, guide?.style.width]).toEqual(["100px", "20px", "30px"]);
    expect(tagTexts(root)).toEqual(["30px"]);
    expect(panelRows(root)).toEqual({
      Base: "body > div",
      Destino: "body > span",
      "Gap horizontal": "30px · 1.9rem",
      "Gap vertical": "se solapan",
      "Δ izquierda": "130px",
      "Δ arriba": "10px",
    });
  });

  it("measures a horizontal gap to an element on the left", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt("span", new DOMRect(-50, 0, 20, 50));

    render();

    expect(gapGuide()?.style.left).toBe("-30px");
    expect(panelRows(root)["Δ izquierda"]).toBe("-50px");
  });

  it("measures a vertical gap to an element below", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt("span", new DOMRect(10, 80, 50, 10));

    render();

    const guide = gapGuide();
    expect([guide?.style.left, guide?.style.top, guide?.style.height]).toEqual(["35px", "50px", "30px"]);
    expect(panelRows(root)["Gap vertical"]).toBe("30px · 1.9rem");
    expect(panelRows(root)["Gap horizontal"]).toBe("se solapan");
  });

  it("measures a vertical gap to an element above", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt("span", new DOMRect(0, -40, 100, 10));

    render();

    expect(gapGuide()?.style.top).toBe("-30px");
  });

  it("draws both gaps for a diagonal element", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt("span", new DOMRect(120, 70, 10, 10));

    render();

    expect(layerNodes(root).filter((node) => node.className === "gap")).toHaveLength(2);
    expect(tagTexts(root)).toEqual(["20px", "20px"]);
  });

  it("falls back to the base center when the overlap cannot be computed", () => {
    overlayState.pinnedElement = elementAt("div", new DOMRect(0, 0, 100, 50));
    overlayState.hoveredElement = elementAt(
      "span",
      new DOMRect(Number.NEGATIVE_INFINITY, 80, Number.POSITIVE_INFINITY, 10),
    );

    render();

    expect(gapGuide()?.style.left).toBe("50px");
  });
});

describe("overlay-render: hud sync", () => {
  it("marks only the button of the active tool", () => {
    const toolButton = (tool?: string): HTMLButtonElement => {
      const button = document.createElement("button");
      if (tool !== undefined) button.dataset["tool"] = tool;
      return button;
    };
    const inspect = toolButton("inspect");
    const spacing = toolButton("spacing");
    const plain = toolButton();
    hud.append(inspect, spacing, plain);

    render();

    expect(inspect.dataset["active"]).toBe("false");
    expect(spacing.dataset["active"]).toBe("true");
    expect(plain.dataset["active"]).toBeUndefined();
  });
});
