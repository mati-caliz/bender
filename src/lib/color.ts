export interface RgbColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3,8})$/i;
const NUMBER_PATTERN = /[-+]?\d*\.?\d+%?/g;
const HEX_RADIX = 16;
const MAX_CHANNEL = 255;
const DEGREES_IN_CIRCLE = 360;
const PERCENT = 100;
const SRGB_THRESHOLD = 0.03928;
const SRGB_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_EXPONENT = 2.4;
const LUMINANCE_RED = 0.2126;
const LUMINANCE_GREEN = 0.7152;
const LUMINANCE_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;
const READABLE_ON_DARK_THRESHOLD = 0.45;

const expandShorthand = (digits: string): string =>
  digits
    .split('')
    .map((digit) => `${digit}${digit}`)
    .join('');

const channelFromHex = (digits: string, index: number): number =>
  Number.parseInt(digits.slice(index * 2, index * 2 + 2), HEX_RADIX);

const parseHexColor = (digits: string): RgbColor | null => {
  const normalized = digits.length === 3 || digits.length === 4 ? expandShorthand(digits) : digits;
  if (normalized.length !== 6 && normalized.length !== 8) return null;
  return {
    red: channelFromHex(normalized, 0),
    green: channelFromHex(normalized, 1),
    blue: channelFromHex(normalized, 2),
    alpha: normalized.length === 8 ? channelFromHex(normalized, 3) / MAX_CHANNEL : 1,
  };
};

const toAlpha = (token: string): number =>
  token.endsWith('%') ? Number.parseFloat(token) / PERCENT : Number(token);

export const parseCssColor = (input: string): RgbColor | null => {
  const value = input.trim().toLowerCase();
  if (!value || value === 'transparent' || value === 'none') return null;

  const hexDigits = HEX_PATTERN.exec(value)?.[1];
  if (hexDigits) return parseHexColor(hexDigits);

  if (!value.startsWith('rgb') && !value.startsWith('color(')) return null;
  const [red, green, blue, alpha] = value.match(NUMBER_PATTERN) ?? [];
  if (red === undefined || green === undefined || blue === undefined) return null;

  const channelScale = value.startsWith('color(') ? MAX_CHANNEL : 1;
  const toChannel = (token: string): number =>
    Math.round(token.endsWith('%') ? (Number.parseFloat(token) / PERCENT) * MAX_CHANNEL : Number(token) * channelScale);

  return {
    red: toChannel(red),
    green: toChannel(green),
    blue: toChannel(blue),
    alpha: alpha === undefined ? 1 : toAlpha(alpha),
  };
};

const toHexDigits = (channel: number): string =>
  Math.max(0, Math.min(MAX_CHANNEL, Math.round(channel))).toString(HEX_RADIX).padStart(2, '0');

export const toHex = (color: RgbColor): string => {
  const base = `#${toHexDigits(color.red)}${toHexDigits(color.green)}${toHexDigits(color.blue)}`;
  return color.alpha >= 1 ? base : `${base}${toHexDigits(color.alpha * MAX_CHANNEL)}`;
};

export const toRgbString = (color: RgbColor): string =>
  color.alpha >= 1
    ? `rgb(${color.red}, ${color.green}, ${color.blue})`
    : `rgba(${color.red}, ${color.green}, ${color.blue}, ${Number(color.alpha.toFixed(2))})`;

export const toHslString = (color: RgbColor): string => {
  const red = color.red / MAX_CHANNEL;
  const green = color.green / MAX_CHANNEL;
  const blue = color.blue / MAX_CHANNEL;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * (DEGREES_IN_CIRCLE / 6) + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const values = `${Math.round(hue)}, ${Math.round(saturation * PERCENT)}%, ${Math.round(lightness * PERCENT)}%`;
  return color.alpha >= 1 ? `hsl(${values})` : `hsla(${values}, ${Number(color.alpha.toFixed(2))})`;
};

const linearizeChannel = (channel: number): number => {
  const normalized = channel / MAX_CHANNEL;
  return normalized <= SRGB_THRESHOLD
    ? normalized / SRGB_DIVISOR
    : ((normalized + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT;
};

export const relativeLuminance = (color: RgbColor): number =>
  LUMINANCE_RED * linearizeChannel(color.red) +
  LUMINANCE_GREEN * linearizeChannel(color.green) +
  LUMINANCE_BLUE * linearizeChannel(color.blue);

export const contrastRatio = (foreground: RgbColor, background: RgbColor): number => {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
};

export const isLightColor = (color: RgbColor): boolean => relativeLuminance(color) > READABLE_ON_DARK_THRESHOLD;

export const normalizeCssColor = (input: string): string | null => {
  const parsed = parseCssColor(input);
  return parsed && parsed.alpha > 0 ? toHex(parsed) : null;
};
