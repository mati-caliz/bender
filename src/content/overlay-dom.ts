import {
  type Box,
  GUIDE_THICKNESS,
  PANEL_FLIP_THRESHOLD,
  PANEL_MARGIN,
  type Point,
  hasText,
} from "@/content/overlay-layout";
import { overlayState } from "@/content/overlay-state";
import { OVERLAY_STYLES } from "@/content/overlay-styles";

export interface PanelRow {
  key: string;
  value: string;
  color?: string;
}

const HOST_ID = "bender-design-overlay";
const MIN_TAG_POSITION = 2;

export const createNode = (className: string, text?: string): HTMLDivElement => {
  const node = document.createElement("div");
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const host = document.createElement("div");
host.id = HOST_ID;
const shadow = host.attachShadow({ mode: "open" });
const styleSheet = document.createElement("style");
styleSheet.textContent = OVERLAY_STYLES;
const layer = createNode("layer");
export const dynamicLayer = document.createElement("div");
const panel = createNode("panel");
panel.style.display = "none";
export const hud = createNode("hud");
layer.append(dynamicLayer, panel, hud);
shadow.append(styleSheet, layer);

export const createBoxNode = (className: string, box: Box): HTMLDivElement => {
  const node = createNode(className);
  node.style.left = `${box.left}px`;
  node.style.top = `${box.top}px`;
  node.style.width = `${box.width}px`;
  node.style.height = `${box.height}px`;
  return node;
};

export const createTag = (text: string, position: Point, variant = ""): HTMLDivElement => {
  const node = createNode(`tag ${variant}`.trim(), text);
  node.style.left = `${Math.max(MIN_TAG_POSITION, Math.min(position.x, window.innerWidth - PANEL_MARGIN))}px`;
  node.style.top = `${Math.max(MIN_TAG_POSITION, position.y)}px`;
  return node;
};

export const createGuide = (box: Box, className = "guide"): HTMLDivElement => createBoxNode(className, box);

export const horizontalGuide = (top: number): HTMLDivElement =>
  createGuide({ left: 0, top, width: window.innerWidth, height: GUIDE_THICKNESS });

export const verticalGuide = (left: number): HTMLDivElement =>
  createGuide({ left, top: 0, width: GUIDE_THICKNESS, height: window.innerHeight });

const createSwatch = (color: string): HTMLDivElement => {
  const swatch = createNode("swatch");
  swatch.style.background = color;
  return swatch;
};

const createPanelRow = (row: PanelRow): HTMLDivElement => {
  const rowNode = createNode("panel-row");
  const value = createNode("panel-value");
  if (hasText(row.color)) value.append(createSwatch(row.color));
  value.append(document.createTextNode(row.value));
  rowNode.append(createNode("panel-key", row.key), value);
  return rowNode;
};

export const renderPanel = (title: string, rows: PanelRow[], accentColor?: string): void => {
  const heading = createNode("panel-title");
  if (hasText(accentColor)) heading.append(createSwatch(accentColor));
  heading.append(document.createTextNode(title));

  panel.replaceChildren(heading, ...rows.map(createPanelRow));
  panel.style.display = "block";
  const flip = overlayState.pointer.x > window.innerWidth - PANEL_FLIP_THRESHOLD;
  panel.style.left = flip ? `${PANEL_MARGIN}px` : "";
  panel.style.right = flip ? "" : `${PANEL_MARGIN}px`;
  panel.style.top = `${PANEL_MARGIN}px`;
};

export const hidePanel = (): void => {
  panel.style.display = "none";
  panel.replaceChildren();
};
