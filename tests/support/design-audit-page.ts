import { auditPageSheets, readVisibleElementStyles } from "@/lib/design-audit";
import type { ElementStyle, PageStyleSample } from "@/lib/design-summary";
import type { ColorRole, ColorUsage, DesignAudit, FontUsage, ValueUsage } from "@/types";

const HEX_RADIX = 16;
const HEX_PAIR = /[0-9a-f]{2}/g;
const MAX_CHANNEL = 255;
const BORDER_WIDTH = "1px";
const COLOR_PROPERTY_BY_ROLE: Record<ColorRole, string> = {
  text: "color",
  background: "background-color",
  border: "border-top-color",
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toComputedColor = (hex: string): string => {
  const [red, green, blue, alpha] = (hex.slice(1).match(HEX_PAIR) ?? []).map((pair) =>
    Number.parseInt(pair, HEX_RADIX),
  );
  const channels = `${String(red)}, ${String(green)}, ${String(blue)}`;
  return alpha === undefined ? `rgb(${channels})` : `rgba(${channels}, ${String(alpha / MAX_CHANNEL)})`;
};

const repeated = (times: number, element: ElementStyle): ElementStyle[] =>
  Array.from({ length: times }, () => ({ ...element, styles: { ...element.styles } }));

const colorElement = (hex: string, role: ColorRole): ElementStyle => ({
  hasOwnText: role === "text",
  styles: {
    [COLOR_PROPERTY_BY_ROLE[role]]: toComputedColor(hex),
    ...(role === "border" ? { "border-top-width": BORDER_WIDTH } : {}),
  },
});

const colorElements = ({ hex, count, roles }: ColorUsage): ElementStyle[] => {
  const [firstRole, ...otherRoles] = roles;
  if (firstRole === undefined) return [];
  return [
    ...repeated(count - otherRoles.length, colorElement(hex, firstRole)),
    ...otherRoles.map((role) => colorElement(hex, role)),
  ];
};

const fontElements = ({ family, count, sizes, weights }: FontUsage): ElementStyle[] =>
  Array.from({ length: count }, (_, index) => ({
    hasOwnText: false,
    styles: {
      "font-family": family,
      "font-size": `${String(sizes[index % sizes.length])}px`,
      "font-weight": String(weights[index % weights.length]),
    },
  }));

const valueElements = (property: string, { value, count }: ValueUsage): ElementStyle[] =>
  repeated(count, { hasOwnText: false, styles: { [property]: value } });

/** Estilos de elementos que, resumidos, dan exactamente la auditoría pedida. */
export const styleSampleFor = (audit: DesignAudit): PageStyleSample => ({
  elementCount: audit.elementCount,
  visibleElements: [
    ...audit.colors.flatMap(colorElements),
    ...audit.fonts.flatMap(fontElements),
    ...audit.spacings.flatMap((usage) => valueElements("padding-top", usage)),
    ...audit.radii.flatMap((usage) => valueElements("border-top-left-radius", usage)),
    ...audit.shadows.flatMap((usage) => valueElements("box-shadow", usage)),
  ],
});

/** Lo que devuelve la pestaña a cada auditoría inyectada cuando la página tiene `audit`. */
export const auditInjectionResult = (injection: unknown, audit: DesignAudit): unknown => {
  const func = isRecord(injection) ? injection["func"] : undefined;
  if (func === readVisibleElementStyles) return styleSampleFor(audit);
  if (func === auditPageSheets) return { rootFontSize: audit.rootFontSize, variables: audit.variables };
  return audit;
};
