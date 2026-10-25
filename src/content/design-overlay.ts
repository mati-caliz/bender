import { createNode, host, hud, renderPanel } from "@/content/overlay-dom";
import { MIN_DRAG_SIZE, describeSelector, formatSize, readableColor, round } from "@/content/overlay-layout";
import { render } from "@/content/overlay-render";
import { overlayState } from "@/content/overlay-state";
import { isLightColor, parseCssColor, toHex } from "@/lib/color";
import { appendDesignPick } from "@/lib/design-picks";
import { createId } from "@/lib/ids";
import type { DesignOverlayState, DesignPickKind, DesignTool } from "@/types";

interface OverlayWindow extends Window {
  benderDesignOverlayInstalled?: boolean;
}

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}

interface EyeDropperWindow extends Window {
  EyeDropper?: new () => EyeDropperInstance;
}

interface DesignChannelMessage {
  channel: "bender-design";
  type?: unknown;
  tool?: unknown;
}

const CURSOR_STYLE_ID = "bender-design-cursor";
const DESIGN_CHANNEL = "bender-design";
const DECIMAL_RADIX = 10;

const TOOL_LABELS: Record<DesignTool, string> = {
  inspect: "Inspector",
  ruler: "Regla",
  spacing: "Espaciado",
};

const TOOL_ORDER: DesignTool[] = ["inspect", "ruler", "spacing"];

const overlayWindow: OverlayWindow = window;

const savePick = (kind: DesignPickKind, label: string, detail: string, color: string | null): void => {
  void appendDesignPick({
    id: createId(),
    kind,
    label,
    detail,
    color,
    origin: window.location.origin,
    createdAt: Date.now(),
  });
};

const elementToSave = (): Element | null => {
  const { activeTool, pinnedElement, hoveredElement, frozen } = overlayState;
  if (activeTool === "spacing") return pinnedElement ?? hoveredElement;
  return frozen ? pinnedElement : hoveredElement;
};

const saveElement = (element: Element): void => {
  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const textColor = readableColor(styles.color);
  const backgroundColor = readableColor(styles.backgroundColor);
  savePick(
    "element",
    describeSelector(element),
    `${formatSize(rect.width, rect.height)} · texto ${textColor} · fondo ${backgroundColor}`,
    parseCssColor(styles.backgroundColor) ? backgroundColor : null,
  );
};

const saveCurrent = (): void => {
  const { measureBox } = overlayState;
  if (overlayState.activeTool === "ruler" && measureBox) {
    savePick(
      "measure",
      `${round(measureBox.width)} × ${round(measureBox.height)} px`,
      `Medición en ${window.location.pathname}`,
      null,
    );
    return;
  }

  const element = elementToSave();
  if (element) saveElement(element);
};

const showSavedColor = (sRGBHex: string): void => {
  const parsed = parseCssColor(sRGBHex);
  const hex = parsed ? toHex(parsed) : sRGBHex;
  savePick("color", hex, `Cuentagotas en ${window.location.hostname}`, hex);
  renderPanel(
    "Color guardado",
    [
      { key: "Hex", value: hex, color: hex },
      { key: "Luminancia", value: parsed && isLightColor(parsed) ? "clara" : "oscura" },
    ],
    hex,
  );
  void navigator.clipboard.writeText(hex).catch(() => undefined);
};

const pickColorFromScreen = (): void => {
  const eyeDropperWindow: EyeDropperWindow = window;
  const EyeDropperConstructor = eyeDropperWindow.EyeDropper;
  if (!EyeDropperConstructor) {
    renderPanel("Cuentagotas", [{ key: "Error", value: "Este navegador no expone EyeDropper" }]);
    return;
  }

  void new EyeDropperConstructor()
    .open()
    .then((result) => {
      showSavedColor(result.sRGBHex);
    })
    .catch(() => undefined);
};

const createHudButton = (label: string, onClick: () => void, tool?: DesignTool): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (tool) button.dataset["tool"] = tool;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
};

const buildHud = (): void => {
  const separator = (): HTMLDivElement => createNode("hud-separator");
  hud.replaceChildren(
    createNode("hud-brand", "Bender"),
    ...TOOL_ORDER.map((tool) =>
      createHudButton(
        TOOL_LABELS[tool],
        () => {
          setTool(tool);
        },
        tool,
      ),
    ),
    separator(),
    createHudButton("Cuentagotas", pickColorFromScreen),
    createHudButton("Guardar", saveCurrent),
    separator(),
    createNode("hud-hint", "Esc cierra"),
    createHudButton("✕", destroyOverlay),
  );
};

const setTool = (tool: DesignTool): void => {
  overlayState.activeTool = tool;
  overlayState.frozen = false;
  overlayState.measureBox = null;
  overlayState.dragOrigin = null;
  if (tool !== "spacing") overlayState.pinnedElement = null;
  render();
};

const elementFromEvent = (event: Event): Element | null => {
  const target = event.target;
  if (!(target instanceof Element) || target === host) return null;
  return target;
};

const handleDrag = (dragOrigin: { x: number; y: number }): void => {
  const { pointer } = overlayState;
  overlayState.measureBox = {
    left: Math.min(dragOrigin.x, pointer.x),
    top: Math.min(dragOrigin.y, pointer.y),
    width: Math.abs(pointer.x - dragOrigin.x),
    height: Math.abs(pointer.y - dragOrigin.y),
  };
  render();
};

const handlePointerMove = (event: MouseEvent): void => {
  overlayState.pointer = { x: event.clientX, y: event.clientY };

  if (overlayState.dragOrigin) {
    handleDrag(overlayState.dragOrigin);
    return;
  }

  if (overlayState.frozen) return;
  const element = elementFromEvent(event);
  if (element === overlayState.hoveredElement) {
    if (overlayState.activeTool === "ruler") render();
    return;
  }
  overlayState.hoveredElement = element;
  render();
};

const handleMouseDown = (event: MouseEvent): void => {
  if (event.target === host) return;
  if (overlayState.activeTool !== "ruler") return;
  event.preventDefault();
  event.stopPropagation();
  overlayState.dragOrigin = { x: event.clientX, y: event.clientY };
  overlayState.measureBox = null;
};

const isTooSmallToMeasure = (box: { width: number; height: number }): boolean =>
  box.width < MIN_DRAG_SIZE || box.height < MIN_DRAG_SIZE;

const handleMouseUp = (event: MouseEvent): void => {
  if (!overlayState.dragOrigin) return;
  event.preventDefault();
  event.stopPropagation();
  overlayState.dragOrigin = null;
  if (overlayState.measureBox && isTooSmallToMeasure(overlayState.measureBox)) overlayState.measureBox = null;
  render();
};

const toggleInspectPin = (element: Element | null): void => {
  overlayState.frozen = !overlayState.frozen;
  overlayState.pinnedElement = overlayState.frozen ? element : null;
  if (overlayState.frozen && element) {
    void navigator.clipboard.writeText(describeSelector(element)).catch(() => undefined);
  }
};

const handleClick = (event: MouseEvent): void => {
  if (event.target === host) return;
  event.preventDefault();
  event.stopPropagation();

  const element = elementFromEvent(event);
  if (overlayState.activeTool === "inspect") {
    toggleInspectPin(element);
  } else if (overlayState.activeTool === "spacing") {
    overlayState.pinnedElement = overlayState.pinnedElement === element ? null : element;
  }
  render();
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    event.preventDefault();
    destroyOverlay();
    return;
  }
  const shortcutIndex = Number.parseInt(event.key, DECIMAL_RADIX) - 1;
  const tool = TOOL_ORDER[shortcutIndex];
  if (tool) {
    event.preventDefault();
    setTool(tool);
  }
};

const handleViewportChange = (): void => {
  if (overlayState.activeTool === "ruler" && !overlayState.measureBox) return;
  render();
};

const cursorStyle = document.createElement("style");
cursorStyle.id = CURSOR_STYLE_ID;
cursorStyle.textContent = `*, *::before, *::after { cursor: crosshair !important; }`;

function destroyOverlay(): void {
  document.removeEventListener("mousemove", handlePointerMove, true);
  document.removeEventListener("mousedown", handleMouseDown, true);
  document.removeEventListener("mouseup", handleMouseUp, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  window.removeEventListener("scroll", handleViewportChange, true);
  window.removeEventListener("resize", handleViewportChange);
  chrome.runtime.onMessage.removeListener(handleCommand);
  host.remove();
  cursorStyle.remove();
  overlayWindow.benderDesignOverlayInstalled = false;
}

const isDesignChannelMessage = (message: unknown): message is DesignChannelMessage =>
  typeof message === "object" &&
  message !== null &&
  "channel" in message &&
  message.channel === DESIGN_CHANNEL;

const requestedTool = (message: DesignChannelMessage): DesignTool | undefined =>
  message.type === "set-tool" ? TOOL_ORDER.find((tool) => tool === message.tool) : undefined;

function handleCommand(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  respond: (response: DesignOverlayState) => void,
): boolean | undefined {
  if (!isDesignChannelMessage(message)) return undefined;

  const tool = requestedTool(message);
  if (tool) setTool(tool);
  if (message.type === "close") {
    respond({ active: false, tool: overlayState.activeTool });
    destroyOverlay();
    return true;
  }

  respond({ active: true, tool: overlayState.activeTool });
  return true;
}

const installOverlay = (): void => {
  document.documentElement.append(host, cursorStyle);
  buildHud();
  document.addEventListener("mousemove", handlePointerMove, true);
  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange);
  chrome.runtime.onMessage.addListener(handleCommand);
  overlayWindow.benderDesignOverlayInstalled = true;
  render();
};

if (overlayWindow.benderDesignOverlayInstalled !== true) installOverlay();
