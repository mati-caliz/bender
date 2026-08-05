import { isLightColor, parseCssColor, toHex } from '@/lib/color';
import { appendDesignPick } from '@/lib/design-picks';
import { createId } from '@/lib/ids';
import type { DesignCommand, DesignOverlayState, DesignPickKind, DesignTool } from '@/types';

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

interface Point {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PanelRow {
  key: string;
  value: string;
  color?: string;
}

const HOST_ID = 'bender-design-overlay';
const CURSOR_STYLE_ID = 'bender-design-cursor';
const PANEL_WIDTH = 268;
const PANEL_MARGIN = 14;
const PANEL_FLIP_THRESHOLD = PANEL_WIDTH + PANEL_MARGIN * 3;
const LABEL_OFFSET = 22;
const GUIDE_THICKNESS = 1;
const MAX_SELECTOR_DEPTH = 4;
const MAX_SELECTOR_CLASSES = 2;
const DECIMALS = 1;
const DEFAULT_ROOT_FONT_SIZE = 16;
const MIN_DRAG_SIZE = 2;

const OVERLAY_STYLES = `
  .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    font: 500 11px/1.45 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .box { position: fixed; box-sizing: border-box; }
  .box-margin { background: rgba(246, 178, 107, 0.28); }
  .box-border { background: rgba(255, 229, 153, 0.35); }
  .box-padding { background: rgba(147, 196, 125, 0.38); }
  .box-content { background: rgba(111, 168, 220, 0.45); }
  .outline { position: fixed; box-sizing: border-box; border: 1px solid #6366f1;
    background: rgba(99, 102, 241, 0.1); }
  .outline.pinned { border-style: dashed; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
  .measure-rect { position: fixed; box-sizing: border-box; border: 1px dashed #6366f1;
    background: rgba(99, 102, 241, 0.14); }
  .guide { position: fixed; background: rgba(99, 102, 241, 0.55); }
  .gap { position: fixed; background: rgba(236, 72, 153, 0.9); }
  .tag { position: fixed; padding: 2px 6px; border-radius: 4px; white-space: nowrap; color: #f9fafb;
    background: #111827; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); font-variant-numeric: tabular-nums; }
  .tag.accent { background: #6366f1; }
  .tag.pink { background: #ec4899; }
  .panel { position: fixed; width: ${PANEL_WIDTH}px; max-height: 62vh; overflow: auto; padding: 9px 11px;
    border-radius: 9px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(15, 20, 32, 0.97);
    color: #e5e7eb; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); pointer-events: auto; }
  .panel-title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #fff;
    margin-bottom: 6px; word-break: break-all; }
  .panel-row { display: flex; gap: 10px; justify-content: space-between; padding: 2px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06); }
  .panel-row:first-of-type { border-top: 0; }
  .panel-key { color: #9ca3af; white-space: nowrap; }
  .panel-value { font-family: ui-monospace, 'SF Mono', Menlo, monospace; text-align: right;
    word-break: break-all; color: #f3f4f6; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px;
    vertical-align: -1px; border: 1px solid rgba(255, 255, 255, 0.4); }
  .hud { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 3px;
    align-items: center; padding: 5px; border-radius: 11px; border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(15, 20, 32, 0.97); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); pointer-events: auto;
    font: 500 11px/1 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .hud button { all: unset; cursor: pointer; padding: 6px 9px; border-radius: 7px; color: #d1d5db; }
  .hud button:hover { background: rgba(255, 255, 255, 0.09); color: #fff; }
  .hud button[data-active='true'] { background: #6366f1; color: #fff; }
  .hud-brand { padding: 0 7px 0 5px; font-weight: 700; color: #818cf8; letter-spacing: 0.02em; }
  .hud-separator { width: 1px; height: 18px; margin: 0 3px; background: rgba(255, 255, 255, 0.12); }
  .hud-hint { padding: 0 6px; color: #6b7280; }
`;

const TOOL_LABELS: Record<DesignTool, string> = {
  inspect: 'Inspector',
  ruler: 'Regla',
  spacing: 'Espaciado',
};

const TOOL_ORDER: DesignTool[] = ['inspect', 'ruler', 'spacing'];

const overlayWindow = window as OverlayWindow;

const round = (value: number): string => {
  const rounded = Number(value.toFixed(DECIMALS));
  return `${rounded}`;
};

const formatPx = (value: number): string => `${round(value)}px`;

const rootFontSize = (): number =>
  Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || DEFAULT_ROOT_FONT_SIZE;

const formatWithRem = (value: number): string => `${round(value)}px · ${round(value / rootFontSize())}rem`;

const collapseShorthand = (values: [string, string, string, string]): string => {
  const [top, right, bottom, left] = values;
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  return values.join(' ');
};

const describeSelector = (element: Element): string => {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement && parts.length < MAX_SELECTOR_DEPTH) {
    const tag = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`${tag}#${current.id}`);
      break;
    }
    const classes = Array.from(current.classList)
      .filter((name) => !name.startsWith('bender-'))
      .slice(0, MAX_SELECTOR_CLASSES)
      .map((name) => `.${name}`)
      .join('');
    parts.unshift(`${tag}${classes}`);
    current = current.parentElement;
  }

  return parts.join(' > ');
};

const readableColor = (input: string): string => {
  const parsed = parseCssColor(input);
  return parsed ? toHex(parsed) : input;
};

const boxFromRect = (rect: DOMRect): Box => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

const expandBox = (box: Box, top: number, right: number, bottom: number, left: number): Box => ({
  left: box.left - left,
  top: box.top - top,
  width: box.width + left + right,
  height: box.height + top + bottom,
});

const shrinkBox = (box: Box, top: number, right: number, bottom: number, left: number): Box => ({
  left: box.left + left,
  top: box.top + top,
  width: Math.max(0, box.width - left - right),
  height: Math.max(0, box.height - top - bottom),
});

const edgeStyle = (styles: CSSStyleDeclaration, property: string): number =>
  Number.parseFloat(styles.getPropertyValue(property)) || 0;

const host = document.createElement('div');
host.id = HOST_ID;
const shadow = host.attachShadow({ mode: 'open' });
const styleSheet = document.createElement('style');
styleSheet.textContent = OVERLAY_STYLES;
const layer = document.createElement('div');
layer.className = 'layer';
const dynamicLayer = document.createElement('div');
const panel = document.createElement('div');
panel.className = 'panel';
panel.style.display = 'none';
const hud = document.createElement('div');
hud.className = 'hud';
layer.append(dynamicLayer, panel, hud);
shadow.append(styleSheet, layer);

let activeTool: DesignTool = 'inspect';
let hoveredElement: Element | null = null;
let pinnedElement: Element | null = null;
let frozen = false;
let pointer: Point = { x: 0, y: 0 };
let dragOrigin: Point | null = null;
let measureBox: Box | null = null;

const createNode = (className: string, text?: string): HTMLDivElement => {
  const node = document.createElement('div');
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const positionNode = (node: HTMLDivElement, box: Box): HTMLDivElement => {
  node.style.left = `${box.left}px`;
  node.style.top = `${box.top}px`;
  node.style.width = `${box.width}px`;
  node.style.height = `${box.height}px`;
  return node;
};

const createTag = (text: string, position: Point, variant = ''): HTMLDivElement => {
  const node = createNode(`tag ${variant}`.trim(), text);
  node.style.left = `${Math.max(2, Math.min(position.x, window.innerWidth - PANEL_MARGIN))}px`;
  node.style.top = `${Math.max(2, position.y)}px`;
  return node;
};

const createGuide = (box: Box, className = 'guide'): HTMLDivElement => positionNode(createNode(className), box);

const renderPanel = (title: string, rows: PanelRow[], accentColor?: string): void => {
  const heading = createNode('panel-title');
  if (accentColor) {
    const swatch = createNode('swatch');
    swatch.style.background = accentColor;
    heading.append(swatch);
  }
  heading.append(document.createTextNode(title));

  const rowNodes = rows.map((row) => {
    const rowNode = createNode('panel-row');
    const value = createNode('panel-value');
    if (row.color) {
      const swatch = createNode('swatch');
      swatch.style.background = row.color;
      value.append(swatch);
    }
    value.append(document.createTextNode(row.value));
    rowNode.append(createNode('panel-key', row.key), value);
    return rowNode;
  });

  panel.replaceChildren(heading, ...rowNodes);
  panel.style.display = 'block';
  const flip = pointer.x > window.innerWidth - PANEL_FLIP_THRESHOLD;
  panel.style.left = flip ? `${PANEL_MARGIN}px` : '';
  panel.style.right = flip ? '' : `${PANEL_MARGIN}px`;
  panel.style.top = `${PANEL_MARGIN}px`;
};

const hidePanel = (): void => {
  panel.style.display = 'none';
  panel.replaceChildren();
};

const inspectRows = (element: Element, styles: CSSStyleDeclaration, rect: DOMRect): PanelRow[] => {
  const padding = collapseShorthand([
    styles.paddingTop,
    styles.paddingRight,
    styles.paddingBottom,
    styles.paddingLeft,
  ]);
  const margin = collapseShorthand([styles.marginTop, styles.marginRight, styles.marginBottom, styles.marginLeft]);
  const radius = collapseShorthand([
    styles.borderTopLeftRadius,
    styles.borderTopRightRadius,
    styles.borderBottomRightRadius,
    styles.borderBottomLeftRadius,
  ]);
  const fontFamily = (styles.fontFamily.split(',')[0] ?? styles.fontFamily).replace(/["']/g, '');
  const textColor = readableColor(styles.color);
  const backgroundColor = readableColor(styles.backgroundColor);

  const rows: PanelRow[] = [
    { key: 'Tamaño', value: `${round(rect.width)} × ${round(rect.height)}` },
    { key: 'Display', value: `${styles.display}${styles.position === 'static' ? '' : ` · ${styles.position}`}` },
    { key: 'Texto', value: textColor, color: styles.color },
    { key: 'Fondo', value: backgroundColor, color: styles.backgroundColor },
    { key: 'Fuente', value: `${fontFamily} ${styles.fontWeight}` },
    { key: 'Tamaño fuente', value: `${styles.fontSize} / ${styles.lineHeight}` },
    { key: 'Padding', value: padding },
    { key: 'Margin', value: margin },
  ];

  if (radius !== '0px') rows.push({ key: 'Radio', value: radius });
  if (styles.borderTopWidth !== '0px') {
    rows.push({ key: 'Borde', value: `${styles.borderTopWidth} ${styles.borderTopStyle}`, color: styles.borderTopColor });
  }
  if (styles.boxShadow !== 'none') rows.push({ key: 'Sombra', value: styles.boxShadow });
  if (element instanceof HTMLImageElement) {
    rows.push({ key: 'Natural', value: `${element.naturalWidth} × ${element.naturalHeight}` });
  }
  if (styles.display.includes('flex') || styles.display.includes('grid')) {
    rows.push({ key: 'Gap', value: `${styles.rowGap} / ${styles.columnGap}` });
  }

  return rows;
};

const renderInspect = (): void => {
  const element = frozen && pinnedElement ? pinnedElement : hoveredElement;
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
    edgeStyle(styles, 'margin-top'),
    edgeStyle(styles, 'margin-right'),
    edgeStyle(styles, 'margin-bottom'),
    edgeStyle(styles, 'margin-left')
  );
  const paddingBox = shrinkBox(
    borderBox,
    edgeStyle(styles, 'border-top-width'),
    edgeStyle(styles, 'border-right-width'),
    edgeStyle(styles, 'border-bottom-width'),
    edgeStyle(styles, 'border-left-width')
  );
  const contentBox = shrinkBox(
    paddingBox,
    edgeStyle(styles, 'padding-top'),
    edgeStyle(styles, 'padding-right'),
    edgeStyle(styles, 'padding-bottom'),
    edgeStyle(styles, 'padding-left')
  );

  const label = `${describeSelector(element).split(' > ').pop() ?? ''}  ${round(rect.width)} × ${round(rect.height)}`;
  const labelAbove = rect.top > LABEL_OFFSET;

  dynamicLayer.replaceChildren(
    positionNode(createNode('box box-margin'), marginBox),
    positionNode(createNode('box box-border'), borderBox),
    positionNode(createNode('box box-padding'), paddingBox),
    positionNode(createNode('box box-content'), contentBox),
    createTag(label, { x: rect.left, y: labelAbove ? rect.top - LABEL_OFFSET : rect.bottom + 4 }, 'accent')
  );

  renderPanel(describeSelector(element), inspectRows(element, styles, rect), styles.backgroundColor);
};

const renderRuler = (): void => {
  if (!measureBox) {
    dynamicLayer.replaceChildren(
      createGuide({ left: 0, top: pointer.y, width: window.innerWidth, height: GUIDE_THICKNESS }),
      createGuide({ left: pointer.x, top: 0, width: GUIDE_THICKNESS, height: window.innerHeight }),
      createTag(`${round(pointer.x)} , ${round(pointer.y)}`, { x: pointer.x + 10, y: pointer.y + 10 })
    );
    hidePanel();
    return;
  }

  const box = measureBox;
  const diagonal = Math.hypot(box.width, box.height);

  dynamicLayer.replaceChildren(
    createGuide({ left: 0, top: box.top, width: window.innerWidth, height: GUIDE_THICKNESS }),
    createGuide({ left: 0, top: box.top + box.height, width: window.innerWidth, height: GUIDE_THICKNESS }),
    createGuide({ left: box.left, top: 0, width: GUIDE_THICKNESS, height: window.innerHeight }),
    createGuide({ left: box.left + box.width, top: 0, width: GUIDE_THICKNESS, height: window.innerHeight }),
    positionNode(createNode('measure-rect'), box),
    createTag(formatPx(box.width), { x: box.left + box.width / 2 - LABEL_OFFSET, y: box.top - LABEL_OFFSET }, 'accent'),
    createTag(formatPx(box.height), { x: box.left + box.width + 6, y: box.top + box.height / 2 }, 'accent')
  );

  renderPanel('Medición', [
    { key: 'Ancho', value: formatWithRem(box.width) },
    { key: 'Alto', value: formatWithRem(box.height) },
    { key: 'Diagonal', value: formatPx(diagonal) },
    { key: 'Origen', value: `${round(box.left)} , ${round(box.top)}` },
    { key: 'Relación', value: box.height ? `${round(box.width / box.height)} : 1` : '—' },
  ]);
};

const gapBetween = (first: Box, second: Box): { horizontal: number; vertical: number } => ({
  horizontal: Math.max(0, Math.max(first.left - (second.left + second.width), second.left - (first.left + first.width))),
  vertical: Math.max(0, Math.max(first.top - (second.top + second.height), second.top - (first.top + first.height))),
});

const renderSpacing = (): void => {
  if (!pinnedElement) {
    if (!hoveredElement) {
      dynamicLayer.replaceChildren();
      hidePanel();
      return;
    }
    const rect = boxFromRect(hoveredElement.getBoundingClientRect());
    dynamicLayer.replaceChildren(
      positionNode(createNode('outline'), rect),
      createTag('Click para fijar el elemento base', { x: rect.left, y: rect.top - LABEL_OFFSET }, 'accent')
    );
    renderPanel('Espaciado', [
      { key: 'Base', value: 'sin fijar' },
      { key: 'Ayuda', value: 'Click fija · click de nuevo libera' },
    ]);
    return;
  }

  const baseBox = boxFromRect(pinnedElement.getBoundingClientRect());
  const nodes: HTMLDivElement[] = [positionNode(createNode('outline pinned'), baseBox)];

  if (!hoveredElement || hoveredElement === pinnedElement) {
    dynamicLayer.replaceChildren(...nodes);
    renderPanel(describeSelector(pinnedElement), [
      { key: 'Base', value: `${round(baseBox.width)} × ${round(baseBox.height)}` },
      { key: 'Ayuda', value: 'Pasá el mouse por otro elemento' },
    ]);
    return;
  }

  const targetBox = boxFromRect(hoveredElement.getBoundingClientRect());
  const gaps = gapBetween(baseBox, targetBox);
  nodes.push(positionNode(createNode('outline'), targetBox));

  if (gaps.horizontal > 0) {
    const leftEdge = baseBox.left < targetBox.left ? baseBox.left + baseBox.width : targetBox.left + targetBox.width;
    const centerY = (Math.max(baseBox.top, targetBox.top) + Math.min(baseBox.top + baseBox.height, targetBox.top + targetBox.height)) / 2;
    const guideY = Number.isFinite(centerY) ? centerY : baseBox.top + baseBox.height / 2;
    nodes.push(
      createGuide({ left: leftEdge, top: guideY, width: gaps.horizontal, height: GUIDE_THICKNESS }, 'gap'),
      createTag(formatPx(gaps.horizontal), { x: leftEdge + gaps.horizontal / 2 - LABEL_OFFSET, y: guideY - LABEL_OFFSET }, 'pink')
    );
  }

  if (gaps.vertical > 0) {
    const topEdge = baseBox.top < targetBox.top ? baseBox.top + baseBox.height : targetBox.top + targetBox.height;
    const centerX = (Math.max(baseBox.left, targetBox.left) + Math.min(baseBox.left + baseBox.width, targetBox.left + targetBox.width)) / 2;
    const guideX = Number.isFinite(centerX) ? centerX : baseBox.left + baseBox.width / 2;
    nodes.push(
      createGuide({ left: guideX, top: topEdge, width: GUIDE_THICKNESS, height: gaps.vertical }, 'gap'),
      createTag(formatPx(gaps.vertical), { x: guideX + 6, y: topEdge + gaps.vertical / 2 }, 'pink')
    );
  }

  dynamicLayer.replaceChildren(...nodes);
  renderPanel('Espaciado', [
    { key: 'Base', value: describeSelector(pinnedElement) },
    { key: 'Destino', value: describeSelector(hoveredElement) },
    { key: 'Gap horizontal', value: gaps.horizontal ? formatWithRem(gaps.horizontal) : 'se solapan' },
    { key: 'Gap vertical', value: gaps.vertical ? formatWithRem(gaps.vertical) : 'se solapan' },
    { key: 'Δ izquierda', value: formatPx(targetBox.left - baseBox.left) },
    { key: 'Δ arriba', value: formatPx(targetBox.top - baseBox.top) },
  ]);
};

const render = (): void => {
  if (activeTool === 'inspect') renderInspect();
  else if (activeTool === 'ruler') renderRuler();
  else renderSpacing();
  syncHud();
};

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

const saveCurrent = (): void => {
  if (activeTool === 'ruler' && measureBox) {
    savePick(
      'measure',
      `${round(measureBox.width)} × ${round(measureBox.height)} px`,
      `Medición en ${window.location.pathname}`,
      null
    );
    return;
  }

  const element = activeTool === 'spacing' ? (pinnedElement ?? hoveredElement) : (frozen ? pinnedElement : hoveredElement);
  if (!element) return;

  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  savePick(
    'element',
    describeSelector(element),
    `${round(rect.width)} × ${round(rect.height)} · texto ${readableColor(styles.color)} · fondo ${readableColor(styles.backgroundColor)}`,
    parseCssColor(styles.backgroundColor) ? readableColor(styles.backgroundColor) : null
  );
};

const pickColorFromScreen = (): void => {
  const eyeDropperWindow = window as EyeDropperWindow;
  const EyeDropperConstructor = eyeDropperWindow.EyeDropper;
  if (!EyeDropperConstructor) {
    renderPanel('Cuentagotas', [{ key: 'Error', value: 'Este navegador no expone EyeDropper' }]);
    return;
  }

  void new EyeDropperConstructor()
    .open()
    .then((result) => {
      const parsed = parseCssColor(result.sRGBHex);
      const hex = parsed ? toHex(parsed) : result.sRGBHex;
      savePick('color', hex, `Cuentagotas en ${window.location.hostname}`, hex);
      renderPanel(
        'Color guardado',
        [
          { key: 'Hex', value: hex, color: hex },
          { key: 'Luminancia', value: parsed && isLightColor(parsed) ? 'clara' : 'oscura' },
        ],
        hex
      );
      void navigator.clipboard.writeText(hex).catch(() => undefined);
    })
    .catch(() => undefined);
};

const createHudButton = (label: string, onClick: () => void, tool?: DesignTool): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (tool) button.dataset.tool = tool;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
};

const buildHud = (): void => {
  const separator = () => createNode('hud-separator');
  hud.replaceChildren(
    createNode('hud-brand', 'Bender'),
    ...TOOL_ORDER.map((tool) => createHudButton(TOOL_LABELS[tool], () => setTool(tool), tool)),
    separator(),
    createHudButton('Cuentagotas', pickColorFromScreen),
    createHudButton('Guardar', saveCurrent),
    separator(),
    createNode('hud-hint', 'Esc cierra'),
    createHudButton('✕', destroyOverlay)
  );
};

const syncHud = (): void => {
  for (const button of Array.from(hud.querySelectorAll('button'))) {
    if (button.dataset.tool) button.dataset.active = String(button.dataset.tool === activeTool);
  }
};

const setTool = (tool: DesignTool): void => {
  activeTool = tool;
  frozen = false;
  measureBox = null;
  dragOrigin = null;
  if (tool !== 'spacing') pinnedElement = null;
  render();
};

const elementFromEvent = (event: Event): Element | null => {
  const target = event.target;
  if (!(target instanceof Element) || target === host) return null;
  return target;
};

const handlePointerMove = (event: MouseEvent): void => {
  pointer = { x: event.clientX, y: event.clientY };

  if (dragOrigin) {
    measureBox = {
      left: Math.min(dragOrigin.x, pointer.x),
      top: Math.min(dragOrigin.y, pointer.y),
      width: Math.abs(pointer.x - dragOrigin.x),
      height: Math.abs(pointer.y - dragOrigin.y),
    };
    render();
    return;
  }

  if (frozen) return;
  const element = elementFromEvent(event);
  if (element === hoveredElement) {
    if (activeTool === 'ruler') render();
    return;
  }
  hoveredElement = element;
  render();
};

const handleMouseDown = (event: MouseEvent): void => {
  if (event.target === host) return;
  if (activeTool !== 'ruler') return;
  event.preventDefault();
  event.stopPropagation();
  dragOrigin = { x: event.clientX, y: event.clientY };
  measureBox = null;
};

const handleMouseUp = (event: MouseEvent): void => {
  if (!dragOrigin) return;
  event.preventDefault();
  event.stopPropagation();
  dragOrigin = null;
  if (measureBox && (measureBox.width < MIN_DRAG_SIZE || measureBox.height < MIN_DRAG_SIZE)) measureBox = null;
  render();
};

const handleClick = (event: MouseEvent): void => {
  if (event.target === host) return;
  event.preventDefault();
  event.stopPropagation();

  const element = elementFromEvent(event);
  if (activeTool === 'inspect') {
    frozen = !frozen;
    pinnedElement = frozen ? element : null;
    if (frozen && element) void navigator.clipboard.writeText(describeSelector(element)).catch(() => undefined);
  } else if (activeTool === 'spacing') {
    pinnedElement = pinnedElement === element ? null : element;
  }
  render();
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault();
    destroyOverlay();
    return;
  }
  const shortcutIndex = Number.parseInt(event.key, 10) - 1;
  const tool = TOOL_ORDER[shortcutIndex];
  if (tool) {
    event.preventDefault();
    setTool(tool);
  }
};

const handleViewportChange = (): void => {
  if (activeTool === 'ruler' && !measureBox) return;
  render();
};

const cursorStyle = document.createElement('style');
cursorStyle.id = CURSOR_STYLE_ID;
cursorStyle.textContent = `*, *::before, *::after { cursor: crosshair !important; }`;

function destroyOverlay(): void {
  document.removeEventListener('mousemove', handlePointerMove, true);
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('scroll', handleViewportChange, true);
  window.removeEventListener('resize', handleViewportChange);
  chrome.runtime.onMessage.removeListener(handleCommand);
  host.remove();
  cursorStyle.remove();
  overlayWindow.benderDesignOverlayInstalled = false;
}

function handleCommand(message: unknown, _sender: chrome.runtime.MessageSender, respond: (response: DesignOverlayState) => void): boolean | undefined {
  const command = message as Partial<DesignCommand> | null;
  if (!command || command.channel !== 'bender-design') return undefined;

  if (command.type === 'set-tool' && command.tool) setTool(command.tool);
  if (command.type === 'close') {
    respond({ active: false, tool: activeTool });
    destroyOverlay();
    return true;
  }

  respond({ active: true, tool: activeTool });
  return true;
}

const installOverlay = (): void => {
  document.documentElement.append(host, cursorStyle);
  buildHud();
  document.addEventListener('mousemove', handlePointerMove, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange);
  chrome.runtime.onMessage.addListener(handleCommand);
  overlayWindow.benderDesignOverlayInstalled = true;
  render();
};

if (!overlayWindow.benderDesignOverlayInstalled) installOverlay();
