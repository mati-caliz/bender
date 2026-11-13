import type { ColorRole, ColorUsage, DesignAudit, FontUsage, ValueUsage } from "@/types";

export interface ElementStyle {
  hasOwnText: boolean;
  styles: Record<string, string>;
}

export interface PageStyleSample {
  elementCount: number;
  visibleElements: ElementStyle[];
}

type ElementAudit = Pick<DesignAudit, "elementCount" | "colors" | "fonts" | "spacings" | "radii" | "shadows">;

interface ColorTally {
  count: number;
  roles: Set<ColorRole>;
}

interface FontTally {
  count: number;
  sizes: Set<number>;
  weights: Set<number>;
}

const HEX_RADIX = 16;
const DECIMAL_RADIX = 10;
const MAX_CHANNEL = 255;
const NUMBER_PATTERN = /[-+]?\d*\.?\d+/g;
const SKIPPED_VALUES = new Set(["", "0px", "normal", "none"]);
const SPACING_PROPERTIES = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "row-gap",
  "column-gap",
];
const RADIUS_PROPERTIES = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
];
const SHADOW_PROPERTIES = ["box-shadow"];
const BORDER_WIDTH_PROPERTIES = ["border-top-width", "border-left-width"];
const COLOR_PROPERTY_BY_ROLE: Record<ColorRole, string> = {
  text: "color",
  background: "background-color",
  border: "border-top-color",
};
const FONT_PROPERTIES = { family: "font-family", size: "font-size", weight: "font-weight" };

export const AUDITED_PROPERTIES = [
  ...Object.values(COLOR_PROPERTY_BY_ROLE),
  ...Object.values(FONT_PROPERTIES),
  ...BORDER_WIDTH_PROPERTIES,
  ...SPACING_PROPERTIES,
  ...RADIUS_PROPERTIES,
  ...SHADOW_PROPERTIES,
];

const styleOf = (element: ElementStyle, property: string): string => element.styles[property] ?? "";

const clampChannel = (channel: number): number => Math.max(0, Math.min(MAX_CHANNEL, Math.round(channel)));
const toHexDigits = (channel: number): string => clampChannel(channel).toString(HEX_RADIX).padStart(2, "0");
const channelsOf = (value: string): number[] =>
  value.startsWith("rgb") || value.startsWith("color(") ? (value.match(NUMBER_PATTERN) ?? []).map(Number) : [];

/** Un color computado (`rgb()`, `rgba()` o `color(srgb …)`) en hexadecimal; null si es transparente. */
export const toHexColor = (input: string): string | null => {
  const value = input.trim().toLowerCase();
  const [red, green, blue, alpha = 1] = channelsOf(value);
  if (red === undefined || green === undefined || blue === undefined || alpha === 0) return null;
  const scale = value.startsWith("color(") ? MAX_CHANNEL : 1;
  const base = `#${[red, green, blue].map((channel) => toHexDigits(channel * scale)).join("")}`;
  return alpha >= 1 ? base : `${base}${toHexDigits(alpha * MAX_CHANNEL)}`;
};

const hasBorder = (element: ElementStyle): boolean =>
  BORDER_WIDTH_PROPERTIES.some((property) => Number.parseFloat(styleOf(element, property)) > 0);

const rolesOf = (element: ElementStyle): ColorRole[] => [
  ...(element.hasOwnText ? (["text"] as const) : []),
  "background",
  ...(hasBorder(element) ? (["border"] as const) : []),
];

const topResults = <TEntry extends { count: number }>(entries: TEntry[], maxResults: number): TEntry[] =>
  [...entries].sort((left, right) => right.count - left.count).slice(0, maxResults);

const sortedNumbers = (values: Set<number>): number[] =>
  [...values].filter(Number.isFinite).sort((left, right) => left - right);

const summarizeColors = (elements: ElementStyle[], maxResults: number): ColorUsage[] => {
  const tallies = new Map<string, ColorTally>();
  for (const element of elements) {
    for (const role of rolesOf(element)) {
      const hex = toHexColor(styleOf(element, COLOR_PROPERTY_BY_ROLE[role]));
      if (hex === null) continue;
      const tally = tallies.get(hex) ?? { count: 0, roles: new Set<ColorRole>() };
      tally.count += 1;
      tally.roles.add(role);
      tallies.set(hex, tally);
    }
  }
  const colors = Array.from(tallies, ([hex, { count, roles }]) => ({ hex, count, roles: [...roles] }));
  return topResults(colors, maxResults);
};

const summarizeFonts = (elements: ElementStyle[], maxResults: number): FontUsage[] => {
  const tallies = new Map<string, FontTally>();
  for (const element of elements) {
    const family = styleOf(element, FONT_PROPERTIES.family);
    if (family === "") continue;
    const tally = tallies.get(family) ?? { count: 0, sizes: new Set<number>(), weights: new Set<number>() };
    tally.count += 1;
    tally.sizes.add(Math.round(Number.parseFloat(styleOf(element, FONT_PROPERTIES.size))));
    tally.weights.add(Number.parseInt(styleOf(element, FONT_PROPERTIES.weight), DECIMAL_RADIX));
    tallies.set(family, tally);
  }
  const fonts = Array.from(tallies, ([family, tally]) => ({
    family,
    count: tally.count,
    sizes: sortedNumbers(tally.sizes),
    weights: sortedNumbers(tally.weights),
  }));
  return topResults(fonts, maxResults);
};

const summarizeValues = (elements: ElementStyle[], properties: string[], maxResults: number): ValueUsage[] => {
  const counts = new Map<string, number>();
  for (const element of elements) {
    for (const property of properties) {
      const value = styleOf(element, property);
      if (!SKIPPED_VALUES.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return topResults(
    Array.from(counts, ([value, count]) => ({ value, count })),
    maxResults,
  );
};

/** Los colores, familias, espaciados, radios y sombras que más se repiten entre los elementos visibles. */
export const summarizeElementStyles = (sample: PageStyleSample, maxResults: number): ElementAudit => ({
  elementCount: sample.elementCount,
  colors: summarizeColors(sample.visibleElements, maxResults),
  fonts: summarizeFonts(sample.visibleElements, maxResults),
  spacings: summarizeValues(sample.visibleElements, SPACING_PROPERTIES, maxResults),
  radii: summarizeValues(sample.visibleElements, RADIUS_PROPERTIES, maxResults),
  shadows: summarizeValues(sample.visibleElements, SHADOW_PROPERTIES, maxResults),
});
