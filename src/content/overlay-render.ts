import {
  type PanelRow,
  createBoxNode,
  createGuide,
  createTag,
  dynamicLayer,
  hidePanel,
  horizontalGuide,
  hud,
  renderPanel,
  verticalGuide,
} from "@/content/overlay-dom";
import {
  type Box,
  GUIDE_THICKNESS,
  LABEL_BELOW_GAP,
  LABEL_OFFSET,
  POINTER_TAG_OFFSET,
  SIDE_TAG_GAP,
  boxFromRect,
  collapseShorthand,
  describeSelector,
  expandBox,
  formatPx,
  formatSize,
  formatWithRem,
  gapBetween,
  lastSelectorPart,
  readEdges,
  readableColor,
  round,
  shrinkBox,
} from "@/content/overlay-layout";
import { overlayState } from "@/content/overlay-state";

const HALF = 2;
const ZERO_PX = "0px";

const displayValue = (styles: CSSStyleDeclaration): string => {
  const position = styles.position === "static" ? "" : ` · ${styles.position}`;
  return `${styles.display}${position}`;
};

const baseInspectRows = (styles: CSSStyleDeclaration, rect: DOMRect): PanelRow[] => {
  const fontFamily = (styles.fontFamily.split(",")[0] ?? styles.fontFamily).replace(/["']/g, "");
  return [
    { key: "Tamaño", value: formatSize(rect.width, rect.height) },
    { key: "Display", value: displayValue(styles) },
    { key: "Texto", value: readableColor(styles.color), color: styles.color },
    { key: "Fondo", value: readableColor(styles.backgroundColor), color: styles.backgroundColor },
    { key: "Fuente", value: `${fontFamily} ${styles.fontWeight}` },
    { key: "Tamaño fuente", value: `${styles.fontSize} / ${styles.lineHeight}` },
    {
      key: "Padding",
      value: collapseShorthand([
        styles.paddingTop,
        styles.paddingRight,
        styles.paddingBottom,
        styles.paddingLeft,
      ]),
    },
    {
      key: "Margin",
      value: collapseShorthand([
        styles.marginTop,
        styles.marginRight,
        styles.marginBottom,
        styles.marginLeft,
      ]),
    },
  ];
};

const optionalInspectRows = (element: Element, styles: CSSStyleDeclaration): PanelRow[] => {
  const rows: PanelRow[] = [];
  const radius = collapseShorthand([
    styles.borderTopLeftRadius,
    styles.borderTopRightRadius,
    styles.borderBottomRightRadius,
    styles.borderBottomLeftRadius,
  ]);
  if (radius !== ZERO_PX) rows.push({ key: "Radio", value: radius });
  if (styles.borderTopWidth !== ZERO_PX) {
    rows.push({
      key: "Borde",
      value: `${styles.borderTopWidth} ${styles.borderTopStyle}`,
      color: styles.borderTopColor,
    });
  }
  if (styles.boxShadow !== "none") rows.push({ key: "Sombra", value: styles.boxShadow });
  if (element instanceof HTMLImageElement) {
    rows.push({ key: "Natural", value: `${element.naturalWidth} × ${element.naturalHeight}` });
  }
  if (styles.display.includes("flex") || styles.display.includes("grid")) {
    rows.push({ key: "Gap", value: `${styles.rowGap} / ${styles.columnGap}` });
  }
  return rows;
};

const inspectedElement = (): Element | null =>
  overlayState.frozen && overlayState.pinnedElement
    ? overlayState.pinnedElement
    : overlayState.hoveredElement;

const renderInspect = (): void => {
  const element = inspectedElement();
  if (!element) {
    dynamicLayer.replaceChildren();
    hidePanel();
    return;
  }

  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  const borderBox = boxFromRect(rect);
  const marginBox = expandBox(
    borderBox,
    readEdges(styles, (side) => `margin-${side}`),
  );
  const paddingBox = shrinkBox(
    borderBox,
    readEdges(styles, (side) => `border-${side}-width`),
  );
  const contentBox = shrinkBox(
    paddingBox,
    readEdges(styles, (side) => `padding-${side}`),
  );

  const label = `${lastSelectorPart(element)}  ${formatSize(rect.width, rect.height)}`;
  const labelY = rect.top > LABEL_OFFSET ? rect.top - LABEL_OFFSET : rect.bottom + LABEL_BELOW_GAP;

  dynamicLayer.replaceChildren(
    createBoxNode("box box-margin", marginBox),
    createBoxNode("box box-border", borderBox),
    createBoxNode("box box-padding", paddingBox),
    createBoxNode("box box-content", contentBox),
    createTag(label, { x: rect.left, y: labelY }, "accent"),
  );

  renderPanel(
    describeSelector(element),
    [...baseInspectRows(styles, rect), ...optionalInspectRows(element, styles)],
    styles.backgroundColor,
  );
};

const renderPointerGuides = (): void => {
  const { pointer } = overlayState;
  dynamicLayer.replaceChildren(
    horizontalGuide(pointer.y),
    verticalGuide(pointer.x),
    createTag(`${round(pointer.x)} , ${round(pointer.y)}`, {
      x: pointer.x + POINTER_TAG_OFFSET,
      y: pointer.y + POINTER_TAG_OFFSET,
    }),
  );
  hidePanel();
};

const renderMeasurement = (box: Box): void => {
  dynamicLayer.replaceChildren(
    horizontalGuide(box.top),
    horizontalGuide(box.top + box.height),
    verticalGuide(box.left),
    verticalGuide(box.left + box.width),
    createBoxNode("measure-rect", box),
    createTag(
      formatPx(box.width),
      { x: box.left + box.width / HALF - LABEL_OFFSET, y: box.top - LABEL_OFFSET },
      "accent",
    ),
    createTag(
      formatPx(box.height),
      { x: box.left + box.width + SIDE_TAG_GAP, y: box.top + box.height / HALF },
      "accent",
    ),
  );

  renderPanel("Medición", [
    { key: "Ancho", value: formatWithRem(box.width) },
    { key: "Alto", value: formatWithRem(box.height) },
    { key: "Diagonal", value: formatPx(Math.hypot(box.width, box.height)) },
    { key: "Origen", value: `${round(box.left)} , ${round(box.top)}` },
    { key: "Relación", value: box.height !== 0 ? `${round(box.width / box.height)} : 1` : "—" },
  ]);
};

const renderRuler = (): void => {
  if (overlayState.measureBox) renderMeasurement(overlayState.measureBox);
  else renderPointerGuides();
};

const renderSpacingWithoutBase = (hovered: Element | null): void => {
  if (!hovered) {
    dynamicLayer.replaceChildren();
    hidePanel();
    return;
  }
  const rect = boxFromRect(hovered.getBoundingClientRect());
  dynamicLayer.replaceChildren(
    createBoxNode("outline", rect),
    createTag("Click para fijar el elemento base", { x: rect.left, y: rect.top - LABEL_OFFSET }, "accent"),
  );
  renderPanel("Espaciado", [
    { key: "Base", value: "sin fijar" },
    { key: "Ayuda", value: "Click fija · click de nuevo libera" },
  ]);
};

const overlapCenter = (
  firstStart: number,
  firstSize: number,
  secondStart: number,
  secondSize: number,
): number => {
  const center =
    (Math.max(firstStart, secondStart) + Math.min(firstStart + firstSize, secondStart + secondSize)) / HALF;
  return Number.isFinite(center) ? center : firstStart + firstSize / HALF;
};

const horizontalGapNodes = (baseBox: Box, targetBox: Box, gap: number): HTMLDivElement[] => {
  const leftEdge =
    baseBox.left < targetBox.left ? baseBox.left + baseBox.width : targetBox.left + targetBox.width;
  const guideY = overlapCenter(baseBox.top, baseBox.height, targetBox.top, targetBox.height);
  return [
    createGuide({ left: leftEdge, top: guideY, width: gap, height: GUIDE_THICKNESS }, "gap"),
    createTag(formatPx(gap), { x: leftEdge + gap / HALF - LABEL_OFFSET, y: guideY - LABEL_OFFSET }, "pink"),
  ];
};

const verticalGapNodes = (baseBox: Box, targetBox: Box, gap: number): HTMLDivElement[] => {
  const topEdge =
    baseBox.top < targetBox.top ? baseBox.top + baseBox.height : targetBox.top + targetBox.height;
  const guideX = overlapCenter(baseBox.left, baseBox.width, targetBox.left, targetBox.width);
  return [
    createGuide({ left: guideX, top: topEdge, width: GUIDE_THICKNESS, height: gap }, "gap"),
    createTag(formatPx(gap), { x: guideX + SIDE_TAG_GAP, y: topEdge + gap / HALF }, "pink"),
  ];
};

const gapValue = (gap: number): string => (gap > 0 ? formatWithRem(gap) : "se solapan");

const renderSpacingBetween = (pinned: Element, hovered: Element, baseBox: Box): void => {
  const targetBox = boxFromRect(hovered.getBoundingClientRect());
  const gaps = gapBetween(baseBox, targetBox);
  dynamicLayer.replaceChildren(
    createBoxNode("outline pinned", baseBox),
    createBoxNode("outline", targetBox),
    ...(gaps.horizontal > 0 ? horizontalGapNodes(baseBox, targetBox, gaps.horizontal) : []),
    ...(gaps.vertical > 0 ? verticalGapNodes(baseBox, targetBox, gaps.vertical) : []),
  );
  renderPanel("Espaciado", [
    { key: "Base", value: describeSelector(pinned) },
    { key: "Destino", value: describeSelector(hovered) },
    { key: "Gap horizontal", value: gapValue(gaps.horizontal) },
    { key: "Gap vertical", value: gapValue(gaps.vertical) },
    { key: "Δ izquierda", value: formatPx(targetBox.left - baseBox.left) },
    { key: "Δ arriba", value: formatPx(targetBox.top - baseBox.top) },
  ]);
};

const renderSpacing = (): void => {
  const { pinnedElement, hoveredElement } = overlayState;
  if (!pinnedElement) {
    renderSpacingWithoutBase(hoveredElement);
    return;
  }

  const baseBox = boxFromRect(pinnedElement.getBoundingClientRect());
  if (!hoveredElement || hoveredElement === pinnedElement) {
    dynamicLayer.replaceChildren(createBoxNode("outline pinned", baseBox));
    renderPanel(describeSelector(pinnedElement), [
      { key: "Base", value: formatSize(baseBox.width, baseBox.height) },
      { key: "Ayuda", value: "Pasá el mouse por otro elemento" },
    ]);
    return;
  }

  renderSpacingBetween(pinnedElement, hoveredElement, baseBox);
};

const syncHud = (): void => {
  for (const button of Array.from(hud.querySelectorAll("button"))) {
    const tool = button.dataset["tool"];
    if (tool !== undefined) button.dataset["active"] = String(tool === overlayState.activeTool);
  }
};

export const render = (): void => {
  if (overlayState.activeTool === "inspect") renderInspect();
  else if (overlayState.activeTool === "ruler") renderRuler();
  else renderSpacing();
  syncHud();
};
