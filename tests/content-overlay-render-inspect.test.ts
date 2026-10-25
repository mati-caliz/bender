// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { host } from "@/content/overlay-dom";
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

const PLAIN_STYLE = [
  "position: static",
  "display: block",
  "border-top-width: 0px",
  "border-top-left-radius: 0px",
  "border-top-right-radius: 0px",
  "border-bottom-right-radius: 0px",
  "border-bottom-left-radius: 0px",
  "box-shadow: none",
].join("; ");

const RICH_STYLE = [
  "position: absolute",
  "display: flex",
  "color: rgb(255, 0, 0)",
  "background-color: rgb(0, 0, 255)",
  "font-family: 'Inter', sans-serif",
  "font-weight: 600",
  "font-size: 14px",
  "line-height: 20px",
  "padding: 4px 8px",
  "margin: 10px",
  "border-top-width: 2px",
  "border-top-style: solid",
  "border-top-color: rgb(0, 0, 0)",
  "border-top-left-radius: 6px",
  "border-top-right-radius: 6px",
  "border-bottom-right-radius: 6px",
  "border-bottom-left-radius: 6px",
  "box-shadow: rgb(0, 0, 0) 0px 1px 2px",
  "row-gap: 3px",
  "column-gap: 5px",
].join("; ");

const nodeBox = (node: HTMLElement | undefined): string[] =>
  node ? [node.style.left, node.style.top, node.style.width, node.style.height] : [];

const nodeWithClass = (className: string): HTMLElement | undefined =>
  layerNodes(root).find((node) => node.className === className);

beforeEach(() => {
  Object.assign(overlayState, {
    activeTool: "inspect",
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
});

describe("overlay-render: inspect", () => {
  it("clears the layer and hides the panel with nothing under the pointer", () => {
    render();

    expect(layerNodes(root)).toHaveLength(0);
    expect(panelVisible(root)).toBe(false);
  });

  it("draws the box model of the hovered element and lists its styles", () => {
    const card = addElement("div", RICH_STYLE);
    card.className = "card";
    stubRect(card, new DOMRect(10, 50, 200, 100));
    overlayState.hoveredElement = card;

    render();

    expect(nodeBox(nodeWithClass("box box-margin"))).toEqual(["0px", "40px", "220px", "120px"]);
    expect(nodeBox(nodeWithClass("box box-border"))).toEqual(["10px", "50px", "200px", "100px"]);
    expect(nodeBox(nodeWithClass("box box-padding"))).toEqual(["10px", "52px", "200px", "98px"]);
    expect(nodeBox(nodeWithClass("box box-content"))).toEqual(["18px", "56px", "184px", "90px"]);
    expect(tagTexts(root)).toEqual(["div.card  200 × 100"]);
    expect(nodeWithClass("tag accent")?.style.top).toBe("28px");

    expect(panelTitle(root)).toBe("body > div.card");
    expect(panelRows(root)).toMatchObject({
      Tamaño: "200 × 100",
      Display: "flex · absolute",
      Texto: "#ff0000",
      Fondo: "#0000ff",
      Fuente: "Inter 600",
      "Tamaño fuente": "14px / 20px",
      Padding: "4px 8px",
      Margin: "10px",
      Radio: "6px",
      Borde: "2px solid",
      Sombra: "rgb(0, 0, 0) 0px 1px 2px",
    });
    expect(Object.keys(panelRows(root))).toContain("Gap");
  });

  it("leaves out optional rows for a plain element and puts the label below when there is no room above", () => {
    const plain = addElement("p", PLAIN_STYLE);
    stubRect(plain, new DOMRect(0, 5, 50, 20));
    overlayState.hoveredElement = plain;

    render();

    const keys = Object.keys(panelRows(root));
    expect(keys).not.toContain("Radio");
    expect(keys).not.toContain("Borde");
    expect(keys).not.toContain("Sombra");
    expect(keys).not.toContain("Gap");
    expect(panelRows(root)["Display"]).toBe("block");
    expect(nodeWithClass("tag accent")?.style.top).toBe("29px");
  });

  it("shows the natural size of images", () => {
    const image = addElement("img", PLAIN_STYLE);
    overlayState.hoveredElement = image;

    render();

    expect(panelRows(root)["Natural"]).toBe("0 × 0");
  });

  it("keeps inspecting the pinned element while frozen", () => {
    const pinned = addElement("section", PLAIN_STYLE);
    const hovered = addElement("aside", PLAIN_STYLE);
    Object.assign(overlayState, { frozen: true, pinnedElement: pinned, hoveredElement: hovered });

    render();
    expect(panelTitle(root)).toBe("body > section");

    overlayState.frozen = false;
    render();
    expect(panelTitle(root)).toBe("body > aside");
  });
});

describe("overlay-render: ruler", () => {
  it("draws crosshair guides and the pointer coordinates without a measurement", () => {
    overlayState.activeTool = "ruler";
    overlayState.pointer = { x: 40.25, y: 80 };

    render();

    expect(layerNodes(root).filter((node) => node.className === "guide")).toHaveLength(2);
    expect(tagTexts(root)).toEqual(["40.3 , 80"]);
    expect(panelVisible(root)).toBe(false);
  });

  it("draws the measured box with its size and details", () => {
    overlayState.activeTool = "ruler";
    overlayState.measureBox = { left: 10, top: 20, width: 30, height: 40 };

    render();

    expect(nodeBox(nodeWithClass("measure-rect"))).toEqual(["10px", "20px", "30px", "40px"]);
    expect(tagTexts(root)).toEqual(["30px", "40px"]);
    expect(panelTitle(root)).toBe("Medición");
    expect(panelRows(root)).toEqual({
      Ancho: "30px · 1.9rem",
      Alto: "40px · 2.5rem",
      Diagonal: "50px",
      Origen: "10 , 20",
      Relación: "0.8 : 1",
    });
  });

  it("shows no ratio for a flat measurement", () => {
    overlayState.activeTool = "ruler";
    overlayState.measureBox = { left: 0, top: 0, width: 30, height: 0 };

    render();

    expect(panelRows(root)["Relación"]).toBe("—");
  });
});
