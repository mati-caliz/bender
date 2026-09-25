import { vi } from "vitest";

export const OVERLAY_HOST_ID = "bender-design-overlay";

export const stubRect = (element: Element, rect: DOMRect): void => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);
};

export const addElement = <TTag extends keyof HTMLElementTagNameMap>(
  tag: TTag,
  style = "",
  parent: Element = document.body,
): HTMLElementTagNameMap[TTag] => {
  const element = document.createElement(tag);
  element.setAttribute("style", style);
  parent.append(element);
  return element;
};

export const overlayRoot = (): ShadowRoot => {
  const root = document.getElementById(OVERLAY_HOST_ID)?.shadowRoot;
  if (!root) throw new Error("el overlay no está montado");
  return root;
};

export const shadowOf = (host: Element): ShadowRoot => {
  if (!host.shadowRoot) throw new Error("el host no tiene shadow root");
  return host.shadowRoot;
};

const panelOf = (root: ShadowRoot): HTMLElement => {
  const panel = root.querySelector<HTMLElement>(".panel");
  if (!panel) throw new Error("no hay panel en el overlay");
  return panel;
};

export const panelTitle = (root: ShadowRoot = overlayRoot()): string =>
  panelOf(root).querySelector(".panel-title")?.textContent ?? "";

export const panelVisible = (root: ShadowRoot = overlayRoot()): boolean =>
  panelOf(root).style.display === "block";

export const panelRows = (root: ShadowRoot = overlayRoot()): Record<string, string> =>
  Object.fromEntries(
    Array.from(panelOf(root).querySelectorAll(".panel-row"), (row) => [
      row.querySelector(".panel-key")?.textContent ?? "",
      row.querySelector(".panel-value")?.textContent ?? "",
    ]),
  );

export const layerNodes = (root: ShadowRoot = overlayRoot()): HTMLElement[] =>
  Array.from(root.querySelector(".layer > div:first-child")?.children ?? []).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

export const tagTexts = (root: ShadowRoot = overlayRoot()): string[] =>
  layerNodes(root)
    .filter((node) => node.classList.contains("tag"))
    .map((node) => node.textContent);

export const installClipboard = (): ReturnType<typeof vi.fn<(text: string) => Promise<void>>> => {
  const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
};

export const loadDesignOverlay = async (): Promise<void> => {
  vi.resetModules();
  await import("@/content/design-overlay");
};

export const pressKey = (key: string): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  document.dispatchEvent(event);
  return event;
};

export const closeOverlay = (): void => {
  if (document.getElementById(OVERLAY_HOST_ID) !== null) pressKey("Escape");
};

export const mouse = (type: string, target: EventTarget, clientX = 0, clientY = 0): MouseEvent => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX, clientY });
  target.dispatchEvent(event);
  return event;
};

export const hudButton = (label: string): HTMLButtonElement => {
  const button = Array.from(overlayRoot().querySelectorAll("button")).find(
    (node) => node.textContent === label,
  );
  if (!button) throw new Error(`no hay botón ${label} en el HUD`);
  return button;
};

export const activeTools = (): string[] =>
  Array.from(
    overlayRoot().querySelectorAll<HTMLButtonElement>("button[data-active='true']"),
    (button) => button.textContent,
  );
