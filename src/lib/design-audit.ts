import type { ColorRole, ColorUsage, CssVariable, DesignAudit, FontUsage, ValueUsage } from "@/types";

const MAX_AUDITED_ELEMENTS = 4000;
const MAX_AUDIT_RESULTS = 60;

interface ColorTally {
  count: number;
  roles: Set<ColorRole>;
}

interface FontTally {
  count: number;
  sizes: Set<number>;
  weights: Set<number>;
}

// Cada auditoría se inyecta con chrome.scripting.executeScript({ func }): se serializa sola, así
// que todo lo que usa en tiempo de ejecución tiene que estar declarado adentro (los tipos no
// cuentan). Por eso son tres funciones que se bastan solas y no una con helpers compartidos.

interface ColorAudit {
  elementCount: number;
  colors: ColorUsage[];
}

/** Los colores de texto, fondo y borde de los elementos visibles, en hexadecimal. */
export const auditPageColors = (maxElements: number, maxResults: number): ColorAudit => {
  const HEX_RADIX = 16;
  const MAX_CHANNEL = 255;
  const NUMBER_PATTERN = /[-+]?\d*\.?\d+/g;

  const clampChannel = (channel: number): number => Math.max(0, Math.min(MAX_CHANNEL, Math.round(channel)));
  const toHexDigits = (channel: number): string => clampChannel(channel).toString(HEX_RADIX).padStart(2, "0");
  const channelsOf = (value: string): number[] =>
    value.startsWith("rgb") || value.startsWith("color(")
      ? (value.match(NUMBER_PATTERN) ?? []).map(Number)
      : [];

  const toHex = (input: string): string | null => {
    const value = input.trim().toLowerCase();
    const [red, green, blue, alpha = 1] = channelsOf(value);
    if (red === undefined || green === undefined || blue === undefined || alpha === 0) return null;
    const scale = value.startsWith("color(") ? MAX_CHANNEL : 1;
    const base = `#${[red, green, blue].map((channel) => toHexDigits(channel * scale)).join("")}`;
    return alpha >= 1 ? base : `${base}${toHexDigits(alpha * MAX_CHANNEL)}`;
  };

  const colorCounts = new Map<string, ColorTally>();
  const countColor = (rawValue: string, role: ColorRole): void => {
    const hex = toHex(rawValue);
    if (hex === null) return;
    const entry: ColorTally = colorCounts.get(hex) ?? { count: 0, roles: new Set() };
    entry.count += 1;
    entry.roles.add(role);
    colorCounts.set(hex, entry);
  };

  const hasOwnText = (element: Element): boolean =>
    Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
    );
  const hasWidth = (width: string): boolean => Number.parseFloat(width) > 0;

  // lib.dom tipa document.body como no nulo, pero es null mientras el documento no tiene <body>.
  const bodyOrNull = (): HTMLElement | null => document.body;
  const elements = Array.from((bodyOrNull() ?? document.documentElement).querySelectorAll("*")).slice(0, maxElements);
  for (const element of elements) {
    const styles = window.getComputedStyle(element);
    if (styles.display === "none" || styles.visibility === "hidden") continue;
    if (hasOwnText(element)) countColor(styles.color, "text");
    countColor(styles.backgroundColor, "background");
    if (hasWidth(styles.borderTopWidth) || hasWidth(styles.borderLeftWidth)) countColor(styles.borderTopColor, "border");
  }

  const colors = Array.from(colorCounts, ([hex, { count, roles }]) => ({ hex, count, roles: [...roles] }));
  return {
    elementCount: elements.length,
    colors: colors.sort((left, right) => right.count - left.count).slice(0, maxResults),
  };
};

interface ShapeAudit {
  fonts: FontUsage[];
  spacings: ValueUsage[];
  radii: ValueUsage[];
  shadows: ValueUsage[];
}

/** Las familias con sus tamaños y pesos, y los espaciados, radios y sombras que se repiten. */
export const auditPageShapes = (maxElements: number, maxResults: number): ShapeAudit => {
  const DECIMAL_RADIX = 10;
  const SKIPPED_VALUES = new Set(["", "0px", "normal", "none"]);
  const SPACING_PROPERTIES =
    "padding-top padding-right padding-bottom padding-left margin-top margin-right margin-bottom margin-left row-gap column-gap";
  const RADIUS_PROPERTIES =
    "border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius";

  const fontCounts = new Map<string, FontTally>();
  const spacingCounts = new Map<string, number>();
  const radiusCounts = new Map<string, number>();
  const shadowCounts = new Map<string, number>();

  const countValues = (map: Map<string, number>, styles: CSSStyleDeclaration, properties: string): void => {
    for (const property of properties.split(" ")) {
      const value = styles.getPropertyValue(property);
      if (!SKIPPED_VALUES.has(value)) map.set(value, (map.get(value) ?? 0) + 1);
    }
  };

  const countFont = (styles: CSSStyleDeclaration): void => {
    const family = styles.fontFamily;
    if (family === "") return;
    const entry: FontTally = fontCounts.get(family) ?? { count: 0, sizes: new Set(), weights: new Set() };
    entry.count += 1;
    entry.sizes.add(Math.round(Number.parseFloat(styles.fontSize)));
    entry.weights.add(Number.parseInt(styles.fontWeight, DECIMAL_RADIX));
    fontCounts.set(family, entry);
  };

  // lib.dom tipa document.body como no nulo, pero es null mientras el documento no tiene <body>.
  const bodyOrNull = (): HTMLElement | null => document.body;
  const elements = Array.from((bodyOrNull() ?? document.documentElement).querySelectorAll("*")).slice(0, maxElements);
  for (const element of elements) {
    const styles = window.getComputedStyle(element);
    if (styles.display === "none" || styles.visibility === "hidden") continue;
    countFont(styles);
    countValues(spacingCounts, styles, SPACING_PROPERTIES);
    countValues(radiusCounts, styles, RADIUS_PROPERTIES);
    countValues(shadowCounts, styles, "box-shadow");
  }

  const topResults = <TEntry extends { count: number }>(entries: TEntry[]): TEntry[] =>
    [...entries].sort((left, right) => right.count - left.count).slice(0, maxResults);
  const sortedNumbers = (values: Set<number>): number[] =>
    [...values].filter(isFinite).sort((left, right) => left - right);
  const toValueUsages = (map: Map<string, number>): ValueUsage[] =>
    topResults(Array.from(map.entries(), ([value, count]) => ({ value, count })));

  return {
    fonts: topResults(
      Array.from(fontCounts.entries(), ([family, entry]) => ({
        family,
        count: entry.count,
        sizes: sortedNumbers(entry.sizes),
        weights: sortedNumbers(entry.weights),
      })),
    ),
    spacings: toValueUsages(spacingCounts),
    radii: toValueUsages(radiusCounts),
    shadows: toValueUsages(shadowCounts),
  };
};

interface SheetAudit {
  rootFontSize: number;
  variables: CssVariable[];
}

/** El tamaño de letra de la raíz y las variables CSS declaradas en `:root`. */
export const auditPageSheets = (maxResults: number): SheetAudit => {
  const DEFAULT_ROOT_FONT_SIZE = 16;

  const readSheetRules = (sheet: CSSStyleSheet): CSSRule[] => {
    try {
      return Array.from(sheet.cssRules);
    } catch {
      // Una hoja de otro origen tira SecurityError al leer cssRules.
      return [];
    }
  };

  const rootVariablesOf = (rule: CSSRule): CssVariable[] =>
    rule instanceof CSSStyleRule && rule.selectorText.includes(":root")
      ? Array.from(rule.style)
          .filter((property) => property.startsWith("--"))
          .map((property) => ({ name: property, value: rule.style.getPropertyValue(property).trim() }))
      : [];

  const variables = Array.from(document.styleSheets, readSheetRules).flat().flatMap(rootVariablesOf);
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));

  return {
    rootFontSize: Number.isNaN(rootFontSize) || rootFontSize === 0 ? DEFAULT_ROOT_FONT_SIZE : rootFontSize,
    variables: Array.from(variablesByName.values()).slice(0, maxResults),
  };
};

/** Corre las tres auditorías en la pestaña y las junta; null si alguna no devolvió nada. */
export const fetchDesignAudit = async (tabId: number): Promise<DesignAudit | null> => {
  const target = { tabId };
  const [colors, shapes, sheets] = await Promise.all([
    chrome.scripting.executeScript({ target, func: auditPageColors, args: [MAX_AUDITED_ELEMENTS, MAX_AUDIT_RESULTS] }),
    chrome.scripting.executeScript({ target, func: auditPageShapes, args: [MAX_AUDITED_ELEMENTS, MAX_AUDIT_RESULTS] }),
    chrome.scripting.executeScript({ target, func: auditPageSheets, args: [MAX_AUDIT_RESULTS] }),
  ]);
  const colorAudit = colors[0]?.result;
  const shapeAudit = shapes[0]?.result;
  const sheetAudit = sheets[0]?.result;
  if (colorAudit === undefined || shapeAudit === undefined || sheetAudit === undefined) return null;
  return { ...colorAudit, ...shapeAudit, ...sheetAudit };
};
