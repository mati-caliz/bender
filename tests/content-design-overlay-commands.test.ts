// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesignOverlayState } from "@/types";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";
import {
  OVERLAY_HOST_ID,
  activeTools,
  closeOverlay,
  hudButton,
  loadDesignOverlay,
  overlayRoot,
  panelVisible,
  pressKey,
  tagTexts,
} from "./support/content-overlay";

let fakeChrome: FakeChrome;

const sendCommand = (message: unknown): { results: unknown[]; respond: ReturnType<typeof vi.fn> } => {
  const respond = vi.fn<(response?: unknown) => void>();
  const results = fakeChrome.runtime.onMessage.emit(message, {}, respond);
  return { results, respond };
};

const overlayMounted = (): boolean => document.getElementById(OVERLAY_HOST_ID) !== null;
const cursorStyleMounted = (): boolean => document.getElementById("bender-design-cursor") !== null;

beforeEach(async () => {
  fakeChrome = installFakeChrome();
  await loadDesignOverlay();
});

afterEach(() => {
  closeOverlay();
  vi.unstubAllGlobals();
});

describe("design overlay: installation", () => {
  it("mounts the overlay, the crosshair cursor and the hud with the inspector active", () => {
    expect(overlayMounted()).toBe(true);
    expect(cursorStyleMounted()).toBe(true);
    expect(overlayRoot().querySelector(".hud-brand")?.textContent).toBe("Bender");
    expect(overlayRoot().querySelector(".hud-hint")?.textContent).toBe("Esc cierra");
    expect(Array.from(overlayRoot().querySelectorAll(".hud button"), (button) => button.textContent)).toEqual(
      ["Inspector", "Regla", "Espaciado", "Cuentagotas", "Guardar", "✕"],
    );
    expect(activeTools()).toEqual(["Inspector"]);
    expect(fakeChrome.runtime.onMessage.listenerCount()).toBe(1);
  });

  it("does not install a second overlay when injected again", async () => {
    await loadDesignOverlay();

    expect(document.querySelectorAll(`#${OVERLAY_HOST_ID}`)).toHaveLength(1);
    expect(fakeChrome.runtime.onMessage.listenerCount()).toBe(1);
  });
});

describe("design overlay: tool switching", () => {
  it("switches tools from the hud", () => {
    hudButton("Regla").click();
    expect(activeTools()).toEqual(["Regla"]);
    expect(tagTexts()).toEqual(["0 , 0"]);

    hudButton("Espaciado").click();
    expect(activeTools()).toEqual(["Espaciado"]);
    expect(panelVisible()).toBe(false);
  });

  it("switches tools with the number keys", () => {
    const ruler = pressKey("2");
    expect(ruler.defaultPrevented).toBe(true);
    expect(activeTools()).toEqual(["Regla"]);

    pressKey("3");
    expect(activeTools()).toEqual(["Espaciado"]);

    pressKey("1");
    expect(activeTools()).toEqual(["Inspector"]);
  });

  it("ignores keys that are not shortcuts", () => {
    pressKey("2");

    expect(pressKey("9").defaultPrevented).toBe(false);
    expect(pressKey("a").defaultPrevented).toBe(false);
    expect(activeTools()).toEqual(["Regla"]);
  });
});

describe("design overlay: closing", () => {
  it("closes with Escape and removes every trace", () => {
    const escape = pressKey("Escape");

    expect(escape.defaultPrevented).toBe(true);
    expect(overlayMounted()).toBe(false);
    expect(cursorStyleMounted()).toBe(false);
    expect(fakeChrome.runtime.onMessage.listenerCount()).toBe(0);
    expect(pressKey("2").defaultPrevented).toBe(false);
  });

  it("closes with the hud button and can be installed again afterwards", async () => {
    hudButton("✕").click();
    expect(overlayMounted()).toBe(false);

    await loadDesignOverlay();
    expect(overlayMounted()).toBe(true);
  });
});

describe("design overlay: extension commands", () => {
  it("ignores messages from other channels", () => {
    const { results, respond } = sendCommand({ channel: "bender", type: "set-tool", tool: "ruler" });
    sendCommand(null);
    sendCommand("close");

    expect(results).toEqual([undefined]);
    expect(respond).not.toHaveBeenCalled();
    expect(activeTools()).toEqual(["Inspector"]);
  });

  it("changes tool on request and reports the new state", () => {
    const { results, respond } = sendCommand({ channel: "bender-design", type: "set-tool", tool: "ruler" });

    expect(results).toEqual([true]);
    expect(respond).toHaveBeenCalledWith({ active: true, tool: "ruler" } satisfies DesignOverlayState);
    expect(activeTools()).toEqual(["Regla"]);
  });

  it("keeps the current tool for unknown tools and status requests", () => {
    const unknownTool = sendCommand({ channel: "bender-design", type: "set-tool", tool: "lupa" });
    const status = sendCommand({ channel: "bender-design", type: "status", tool: "spacing" });

    expect(unknownTool.respond).toHaveBeenCalledWith({ active: true, tool: "inspect" });
    expect(status.respond).toHaveBeenCalledWith({ active: true, tool: "inspect" });
    expect(activeTools()).toEqual(["Inspector"]);
  });

  it("closes on request and reports it is no longer active", () => {
    pressKey("3");
    const { results, respond } = sendCommand({ channel: "bender-design", type: "close" });

    expect(results).toEqual([true]);
    expect(respond).toHaveBeenCalledWith({ active: false, tool: "spacing" });
    expect(overlayMounted()).toBe(false);
  });
});
