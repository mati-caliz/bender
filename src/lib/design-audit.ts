import type { ColorRole, CssVariable, DesignAudit, FontUsage, ValueUsage } from "@/types";

export const MAX_AUDITED_ELEMENTS = 4000;
export const MAX_AUDIT_RESULTS = 60;

interface ColorTally {
  count: number;
  roles: Set<ColorRole>;
}

interface FontTally {
  count: number;
  sizes: Set<number>;
  weights: Set<number>;
}

// Se inyecta con chrome.scripting.executeScript({ func }): se serializa sola, así que todo lo que
// usa en tiempo de ejecución tiene que estar declarado adentro (los tipos no cuentan).
export const auditPageDesign = (maxElements: number, maxResults: number): DesignAudit => {
  const HEX_RADIX = 16;
  const MAX_CHANNEL = 255;
  const DEFAULT_ROOT_FONT_SIZE = 16;
  const DECIMAL_RADIX = 10;
  const NUMBER_PATTERN = /[-+]?\d*\.?\d+/g;
  const SKIPPED_VALUES = new Set(["", "0px", "normal", "none"]);
  const SPACING_PROPERTIES =
    "padding-top padding-right padding-bottom padding-left margin-top margin-right margin-bottom margin-left row-gap column-gap";
  const RADIUS_PROPERTIES =
    "border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius";

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
  const fontCounts = new Map<string, FontTally>();
  const spacingCounts = new Map<string, number>();
  const radiusCounts = new Map<string, number>();
  const shadowCounts = new Map<string, number>();

  const countColor = (rawValue: string, role: ColorRole): void => {
    const hex = toHex(rawValue);
    if (hex === null) return;
    const entry: ColorTally = colorCounts.get(hex) ?? { count: 0, roles: new Set() };
    entry.count += 1;
    entry.roles.add(role);
    colorCounts.set(hex, entry);
  };

  const countValues = (map: Map<string, number>, styles: CSSStyleDeclaration, properties: string): void => {
    for (const property of properties.split(" ")) {
      const value = styles.getPropertyValue(property);
      if (!SKIPPED_VALUES.has(value)) map.set(value, (map.get(value) ?? 0) + 1);
    }
  };

  const hasOwnText = (element: Element): boolean =>
    Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
    );

  const hasWidth = (width: string): boolean => Number.parseFloat(width) > 0;

  const countColors = (element: Element, styles: CSSStyleDeclaration): void => {
    if (hasOwnText(element)) countColor(styles.color, "text");
    countColor(styles.backgroundColor, "background");
    if (hasWidth(styles.borderTopWidth) || hasWidth(styles.borderLeftWidth)) {
      countColor(styles.borderTopColor, "border");
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

  const auditElement = (element: Element): void => {
    const styles = window.getComputedStyle(element);
    if (styles.display === "none" || styles.visibility === "hidden") return;
    countColors(element, styles);
    countFont(styles);
    countValues(spacingCounts, styles, SPACING_PROPERTIES);
    countValues(radiusCounts, styles, RADIUS_PROPERTIES);
    countValues(shadowCounts, styles, "box-shadow");
  };

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

  // lib.dom tipa document.body como no nulo, pero es null mientras el documento no tiene <body>.
  const bodyOrNull = (): HTMLElement | null => document.body;

  const topResults = <TEntry extends { count: number }>(entries: TEntry[]): TEntry[] =>
    [...entries].sort((left, right) => right.count - left.count).slice(0, maxResults);
  const sortedNumbers = (values: Set<number>): number[] =>
    [...values].filter(isFinite).sort((left, right) => left - right);
  const toValueUsages = (map: Map<string, number>): ValueUsage[] =>
    topResults(Array.from(map.entries(), ([value, count]) => ({ value, count })));
  const toFontUsage = ([family, entry]: [string, FontTally]): FontUsage => ({
    family,
    count: entry.count,
    sizes: sortedNumbers(entry.sizes),
    weights: sortedNumbers(entry.weights),
  });

  const scanRoot = bodyOrNull() ?? document.documentElement;
  const elements = Array.from(scanRoot.querySelectorAll("*")).slice(0, maxElements);
  elements.forEach(auditElement);
  const variables = Array.from(document.styleSheets, readSheetRules).flat().flatMap(rootVariablesOf);
  const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));

  return {
    elementCount: elements.length,
    rootFontSize: Number.isNaN(rootFontSize) || rootFontSize === 0 ? DEFAULT_ROOT_FONT_SIZE : rootFontSize,
    colors: topResults(
      Array.from(colorCounts, ([hex, { count, roles }]) => ({ hex, count, roles: [...roles] })),
    ),
    fonts: topResults(Array.from(fontCounts.entries(), toFontUsage)),
    spacings: toValueUsages(spacingCounts),
    radii: toValueUsages(radiusCounts),
    shadows: toValueUsages(shadowCounts),
    variables: Array.from(variablesByName.values()).slice(0, maxResults),
  };
};
