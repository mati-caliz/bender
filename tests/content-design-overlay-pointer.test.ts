// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeChrome } from "./support/fake-chrome";
import {
  OVERLAY_HOST_ID,
  addElement,
  closeOverlay,
  installClipboard,
  layerNodes,
  loadDesignOverlay,
  mouse,
  panelRows,
  panelTitle,
  panelVisible,
  pressKey,
  stubRect,
  tagTexts,
} from "./support/content-overlay";

let writeText: ReturnType<typeof installClipboard>;

const overlayHost = (): HTMLElement => {
  const host = document.getElementById(OVERLAY_HOST_ID);
  if (!host) throw new Error("el overlay no está montado");
  return host;
};

const namedElement = (tag: "div" | "section" | "aside", left = 0, top = 0): HTMLElement => {
  const element = addElement(tag);
  stubRect(element, new DOMRect(left, top, 100, 50));
  return element;
};

beforeEach(async () => {
  installFakeChrome();
  writeText = installClipboard();
  await loadDesignOverlay();
});

afterEach(() => {
  closeOverlay();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("design overlay: inspector pointer", () => {
  it("inspects the element under the pointer and hides the panel over the overlay itself", () => {
    mouse("mousemove", namedElement("section"));
    expect(panelTitle()).toBe("body > section");

    mouse("mousemove", overlayHost());
    expect(panelVisible()).toBe(false);
  });

  it("freezes on click, copies the selector and releases on a second click", () => {
    const section = namedElement("section");
    const aside = namedElement("aside");
    mouse("mousemove", section);

    const pin = mouse("click", section);
    expect(pin.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith("body > section");

    mouse("mousemove", aside);
    expect(panelTitle()).toBe("body > section");

    mouse("click", section);
    mouse("mousemove", aside);
    expect(panelTitle()).toBe("body > aside");
  });

  it("does not copy anything when freezing on empty space", () => {
    mouse("click", document);

    expect(writeText).not.toHaveBeenCalled();
    expect(panelVisible()).toBe(false);
  });

  it("lets clicks on the overlay through", () => {
    const click = mouse("click", overlayHost());

    expect(click.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("redraws the inspected box when the page scrolls or resizes", () => {
    const section = namedElement("section");
    mouse("mousemove", section);

    stubRect(section, new DOMRect(0, 0, 300, 50));
    window.dispatchEvent(new Event("resize"));
    expect(panelRows()["Tamaño"]).toBe("300 × 50");

    stubRect(section, new DOMRect(0, 0, 400, 50));
    window.dispatchEvent(new Event("scroll"));
    expect(panelRows()["Tamaño"]).toBe("400 × 50");
  });
});

describe("design overlay: ruler pointer", () => {
  beforeEach(() => {
    pressKey("2");
  });

  it("follows the pointer even inside the same element", () => {
    const section = namedElement("section");
    mouse("mousemove", section, 10, 10);
    mouse("mousemove", section, 20, 30);

    expect(tagTexts()).toEqual(["20 , 30"]);
  });

  it("measures a drag in any direction", () => {
    const down = mouse("mousedown", document.body, 50, 60);
    expect(down.defaultPrevented).toBe(true);

    mouse("mousemove", document.body, 20, 20);
    const up = mouse("mouseup", document.body, 20, 20);

    expect(up.defaultPrevented).toBe(true);
    expect(panelTitle()).toBe("Medición");
    expect(panelRows()["Ancho"]).toBe("30px · 1.9rem");
    expect(panelRows()["Origen"]).toBe("20 , 20");

    window.dispatchEvent(new Event("scroll"));
    expect(panelTitle()).toBe("Medición");
  });

  it("discards a drag too small to measure", () => {
    mouse("mousedown", document.body, 10, 10);
    mouse("mousemove", document.body, 11, 40);
    mouse("mouseup", document.body, 11, 40);

    expect(panelVisible()).toBe(false);
    expect(tagTexts()).toEqual(["11 , 40"]);
  });

  it("ignores presses on the overlay and releases without a drag", () => {
    expect(mouse("mousedown", overlayHost(), 5, 5).defaultPrevented).toBe(false);
    expect(mouse("mouseup", document.body, 5, 5).defaultPrevented).toBe(false);

    window.dispatchEvent(new Event("resize"));
    expect(layerNodes().filter((node) => node.className === "guide")).toHaveLength(2);
  });

  it("does not start a drag with other tools", () => {
    pressKey("1");

    expect(mouse("mousedown", document.body, 5, 5).defaultPrevented).toBe(false);
  });

  it("does not pin anything on click", () => {
    mouse("click", namedElement("section"));
    pressKey("1");

    mouse("mousemove", namedElement("aside"));
    expect(panelTitle()).toBe("body > aside");
  });
});

describe("design overlay: spacing pointer", () => {
  beforeEach(() => {
    pressKey("3");
  });

  it("pins a base on click and measures against the hovered element", () => {
    const base = namedElement("section");
    const target = namedElement("aside", 130, 0);
    mouse("mousemove", base);
    mouse("click", base);

    mouse("mousemove", target);

    expect(panelRows()).toMatchObject({ Base: "body > section", Destino: "body > aside" });
  });

  it("releases the base when clicking it again", () => {
    const base = namedElement("section");
    mouse("click", base);
    mouse("click", base);

    mouse("mousemove", base);

    expect(panelRows()["Base"]).toBe("sin fijar");
  });
});
