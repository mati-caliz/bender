// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESIGN_PICKS_KEY } from "@/lib/constants";
import type { DesignPick } from "@/types";
import { type FakeChrome, flushPromises, installFakeChrome } from "./support/fake-chrome";
import {
  addElement,
  closeOverlay,
  hudButton,
  installClipboard,
  loadDesignOverlay,
  mouse,
  panelRows,
  panelTitle,
  panelVisible,
  pressKey,
  stubRect,
} from "./support/content-overlay";

let fakeChrome: FakeChrome;
let writeText: ReturnType<typeof installClipboard>;

const savedPicks = (): unknown => fakeChrome.storage.local.data.get(DESIGN_PICKS_KEY);

const expectSavedPick = async (pick: Partial<DesignPick>): Promise<void> => {
  await vi.waitFor(() => {
    expect(savedPicks()).toEqual([expect.objectContaining({ origin: window.location.origin, ...pick })]);
  });
};

const installEyeDropper = (open: () => Promise<{ sRGBHex: string }>): void => {
  Object.defineProperty(window, "EyeDropper", {
    value: class {
      open = open;
    },
    configurable: true,
  });
};

const card = (): HTMLDivElement => {
  const element = addElement("div", "color: rgb(255, 0, 0); background-color: rgb(0, 0, 255)");
  element.className = "card";
  stubRect(element, new DOMRect(0, 0, 200, 100));
  return element;
};

beforeEach(async () => {
  fakeChrome = installFakeChrome();
  writeText = installClipboard();
  await loadDesignOverlay();
});

afterEach(() => {
  closeOverlay();
  Reflect.deleteProperty(window, "EyeDropper");
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("design overlay: eyedropper", () => {
  it("explains when the browser has no EyeDropper", () => {
    hudButton("Cuentagotas").click();

    expect(panelTitle()).toBe("Cuentagotas");
    expect(panelRows()).toEqual({ Error: "Este navegador no expone EyeDropper" });
  });

  it("saves the picked color, copies it and shows it", async () => {
    installEyeDropper(() => Promise.resolve({ sRGBHex: "#FFFFFF" }));

    hudButton("Cuentagotas").click();

    await expectSavedPick({ kind: "color", label: "#ffffff", color: "#ffffff" });
    expect(savedPicks()).toEqual([
      expect.objectContaining({ detail: `Cuentagotas en ${window.location.hostname}` }),
    ]);
    expect(panelTitle()).toBe("Color guardado");
    expect(panelRows()).toEqual({ Hex: "#ffffff", Luminancia: "clara" });
    expect(writeText).toHaveBeenCalledWith("#ffffff");
  });

  it("keeps an unparseable color as is and tolerates a clipboard failure", async () => {
    writeText.mockRejectedValue(new Error("sin permiso"));
    installEyeDropper(() => Promise.resolve({ sRGBHex: "display-p3" }));

    hudButton("Cuentagotas").click();

    await expectSavedPick({ kind: "color", label: "display-p3", color: "display-p3" });
    expect(panelRows()["Luminancia"]).toBe("oscura");
  });

  it("does nothing when the user cancels the picker", async () => {
    installEyeDropper(() => Promise.reject(new Error("cancelado")));

    hudButton("Cuentagotas").click();
    await flushPromises();

    expect(savedPicks()).toBeUndefined();
    expect(panelVisible()).toBe(false);
  });
});

describe("design overlay: saving", () => {
  it("saves the hovered element with its size and colors", async () => {
    mouse("mousemove", card());

    hudButton("Guardar").click();

    await expectSavedPick({
      kind: "element",
      label: "body > div.card",
      detail: "200 × 100 · texto #ff0000 · fondo #0000ff",
      color: "#0000ff",
    });
  });

  it("saves a transparent background as a fully translucent color", async () => {
    mouse("mousemove", addElement("span", "background-color: transparent"));

    hudButton("Guardar").click();

    await expectSavedPick({ kind: "element", label: "body > span", color: "#00000000" });
  });

  it("saves no color when the background is not in a parseable format", async () => {
    mouse("mousemove", addElement("span", "background-color: oklch(0.7 0.1 200)"));

    hudButton("Guardar").click();

    await expectSavedPick({ kind: "element", label: "body > span", color: null });
  });

  it("saves nothing when there is no element under the pointer", async () => {
    hudButton("Guardar").click();
    await flushPromises();

    expect(savedPicks()).toBeUndefined();
  });

  it("saves the pinned element while the inspector is frozen", async () => {
    const pinned = card();
    mouse("click", pinned);
    mouse("mousemove", addElement("aside"));

    hudButton("Guardar").click();

    await expectSavedPick({ label: "body > div.card" });
  });

  it("saves nothing when the inspector is frozen on empty space", async () => {
    mouse("click", document);
    mouse("mousemove", card());

    hudButton("Guardar").click();
    await flushPromises();

    expect(savedPicks()).toBeUndefined();
  });

  it("saves the pinned base in spacing mode, or the hovered element without one", async () => {
    pressKey("3");
    const base = card();
    mouse("mousemove", base);
    hudButton("Guardar").click();
    await expectSavedPick({ label: "body > div.card" });

    mouse("click", base);
    mouse("mousemove", addElement("aside"));
    hudButton("Guardar").click();
    await vi.waitFor(() => {
      expect(savedPicks()).toEqual([
        expect.objectContaining({ label: "body > div.card" }),
        expect.objectContaining({ label: "body > div.card" }),
      ]);
    });
  });

  it("saves the current measurement with the ruler", async () => {
    pressKey("2");
    mouse("mousedown", document.body, 10, 10);
    mouse("mousemove", document.body, 40, 50);
    mouse("mouseup", document.body, 40, 50);

    hudButton("Guardar").click();

    await expectSavedPick({
      kind: "measure",
      label: "30 × 40 px",
      detail: `Medición en ${window.location.pathname}`,
    });
  });

  it("saves the hovered element with the ruler when nothing was measured", async () => {
    pressKey("2");
    mouse("mousemove", card());

    hudButton("Guardar").click();

    await expectSavedPick({ kind: "element", label: "body > div.card" });
  });
});
