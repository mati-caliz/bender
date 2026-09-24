import { parseCssColor, toHex } from "@/lib/color";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type Side = keyof Edges;

export const PANEL_WIDTH = 268;
export const PANEL_MARGIN = 14;
export const PANEL_FLIP_THRESHOLD = PANEL_WIDTH + PANEL_MARGIN * 3;
export const LABEL_OFFSET = 22;
export const LABEL_BELOW_GAP = 4;
export const POINTER_TAG_OFFSET = 10;
export const SIDE_TAG_GAP = 6;
export const GUIDE_THICKNESS = 1;
export const MIN_DRAG_SIZE = 2;

const MAX_SELECTOR_DEPTH = 4;
const MAX_SELECTOR_CLASSES = 2;
const DECIMALS = 1;
const DEFAULT_ROOT_FONT_SIZE = 16;
const OWN_CLASS_PREFIX = "bender-";
const SELECTOR_SEPARATOR = " > ";

export const hasText = (text: string | null | undefined): text is string =>
  text !== null && text !== undefined && text !== "";

const numberOrFallback = (value: number, fallback: number): number =>
  Number.isNaN(value) || value === 0 ? fallback : value;

export const round = (value: number): string => {
  const rounded = Number(value.toFixed(DECIMALS));
  return `${rounded}`;
};

export const formatPx = (value: number): string => `${round(value)}px`;

const rootFontSize = (): number =>
  numberOrFallback(
    Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize),
    DEFAULT_ROOT_FONT_SIZE,
  );

export const formatWithRem = (value: number): string =>
  `${round(value)}px · ${round(value / rootFontSize())}rem`;

export const formatSize = (width: number, height: number): string => `${round(width)} × ${round(height)}`;

export const collapseShorthand = (values: [string, string, string, string]): string => {
  const [top, right, bottom, left] = values;
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  return values.join(" ");
};

const selectorPart = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList)
    .filter((name) => !name.startsWith(OWN_CLASS_PREFIX))
    .slice(0, MAX_SELECTOR_CLASSES)
    .map((name) => `.${name}`)
    .join("");
  return `${tag}${classes}`;
};

export const describeSelector = (element: Element): string => {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement && parts.length < MAX_SELECTOR_DEPTH) {
    if (current.id !== "") {
      parts.unshift(`${current.tagName.toLowerCase()}#${current.id}`);
      break;
    }
    parts.unshift(selectorPart(current));
    current = current.parentElement;
  }

  return parts.join(SELECTOR_SEPARATOR);
};

export const lastSelectorPart = (element: Element): string =>
  describeSelector(element).split(SELECTOR_SEPARATOR).pop() ?? "";

export const readableColor = (input: string): string => {
  const parsed = parseCssColor(input);
  return parsed ? toHex(parsed) : input;
};

export const boxFromRect = (rect: DOMRect): Box => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

export const expandBox = (box: Box, edges: Edges): Box => ({
  left: box.left - edges.left,
  top: box.top - edges.top,
  width: box.width + edges.left + edges.right,
  height: box.height + edges.top + edges.bottom,
});

export const shrinkBox = (box: Box, edges: Edges): Box => ({
  left: box.left + edges.left,
  top: box.top + edges.top,
  width: Math.max(0, box.width - edges.left - edges.right),
  height: Math.max(0, box.height - edges.top - edges.bottom),
});

const edgeStyle = (styles: CSSStyleDeclaration, property: string): number =>
  numberOrFallback(Number.parseFloat(styles.getPropertyValue(property)), 0);

export const readEdges = (styles: CSSStyleDeclaration, propertyOf: (side: Side) => string): Edges => ({
  top: edgeStyle(styles, propertyOf("top")),
  right: edgeStyle(styles, propertyOf("right")),
  bottom: edgeStyle(styles, propertyOf("bottom")),
  left: edgeStyle(styles, propertyOf("left")),
});

export const gapBetween = (first: Box, second: Box): { horizontal: number; vertical: number } => ({
  horizontal: Math.max(
    0,
    Math.max(first.left - (second.left + second.width), second.left - (first.left + first.width)),
  ),
  vertical: Math.max(
    0,
    Math.max(first.top - (second.top + second.height), second.top - (first.top + first.height)),
  ),
});
