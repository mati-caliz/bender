import type { DesignAudit } from '@/types';

export const MAX_AUDITED_ELEMENTS = 4000;
export const MAX_AUDIT_RESULTS = 60;

export const auditPageDesign = (maxElements: number, maxResults: number): DesignAudit => {
  const HEX_RADIX = 16;
  const MAX_CHANNEL = 255;
  const DEFAULT_ROOT_FONT_SIZE = 16;
  const NUMBER_PATTERN = /[-+]?\d*\.?\d+/g;
  const SPACING_PROPERTIES = [
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'rowGap',
    'columnGap',
  ] as const;
  const RADIUS_PROPERTIES = [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ] as const;

  const toHexDigits = (channel: number): string =>
    Math.max(0, Math.min(MAX_CHANNEL, Math.round(channel))).toString(HEX_RADIX).padStart(2, '0');

  const toHex = (input: string): string | null => {
    const value = input.trim().toLowerCase();
    if (!value.startsWith('rgb') && !value.startsWith('color(')) return null;
    const [red, green, blue, parsedAlpha] = value.match(NUMBER_PATTERN)?.map(Number) ?? [];
    if (red === undefined || green === undefined || blue === undefined) return null;
    const alpha = parsedAlpha ?? 1;
    if (alpha === 0) return null;
    const scale = value.startsWith('color(') ? MAX_CHANNEL : 1;
    const base = `#${toHexDigits(red * scale)}${toHexDigits(green * scale)}${toHexDigits(blue * scale)}`;
    return alpha >= 1 ? base : `${base}${toHexDigits(alpha * MAX_CHANNEL)}`;
  };

  const colorCounts = new Map<string, { count: number; roles: Set<string> }>();
  const fontCounts = new Map<string, { count: number; sizes: Set<number>; weights: Set<number> }>();
  const spacingCounts = new Map<string, number>();
  const radiusCounts = new Map<string, number>();
  const shadowCounts = new Map<string, number>();

  const countColor = (rawValue: string, role: string): void => {
    const hex = toHex(rawValue);
    if (!hex) return;
    const entry = colorCounts.get(hex) ?? { count: 0, roles: new Set<string>() };
    entry.count += 1;
    entry.roles.add(role);
    colorCounts.set(hex, entry);
  };

  const countValue = (map: Map<string, number>, value: string): void => {
    map.set(value, (map.get(value) ?? 0) + 1);
  };

  const scanRoot = document.body ?? document.documentElement;
  const elements = Array.from(scanRoot.querySelectorAll('*')).slice(0, maxElements);

  for (const element of elements) {
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden') continue;

    const hasText = Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0
    );
    if (hasText) countColor(styles.color, 'text');
    countColor(styles.backgroundColor, 'background');
    if (styles.borderTopWidth !== '0px' || styles.borderLeftWidth !== '0px') countColor(styles.borderTopColor, 'border');

    const family = styles.fontFamily;
    if (family) {
      const entry = fontCounts.get(family) ?? { count: 0, sizes: new Set<number>(), weights: new Set<number>() };
      entry.count += 1;
      entry.sizes.add(Math.round(Number.parseFloat(styles.fontSize)));
      entry.weights.add(Number.parseInt(styles.fontWeight, 10));
      fontCounts.set(family, entry);
    }

    for (const property of SPACING_PROPERTIES) {
      const value = styles[property];
      if (value && value !== '0px' && value !== 'normal') countValue(spacingCounts, value);
    }

    for (const property of RADIUS_PROPERTIES) {
      const value = styles[property];
      if (value && value !== '0px') countValue(radiusCounts, value);
    }

    if (styles.boxShadow && styles.boxShadow !== 'none') countValue(shadowCounts, styles.boxShadow);
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const rootFontSize = Number.parseFloat(rootStyles.fontSize) || DEFAULT_ROOT_FONT_SIZE;

  const variables: Array<{ name: string; value: string }> = [];
  for (const sheet of Array.from(document.styleSheets)) {
    // Una hoja de otro origen tira SecurityError al leer cssRules.
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes(':root')) continue;
      for (const property of Array.from(rule.style)) {
        if (!property.startsWith('--')) continue;
        variables.push({ name: property, value: rule.style.getPropertyValue(property).trim() });
      }
    }
  }

  const byCount = <TEntry extends { count: number }>(left: TEntry, right: TEntry): number => right.count - left.count;
  const sortedNumbers = (values: Set<number>): number[] =>
    Array.from(values)
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
  const toValueUsages = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort(byCount)
      .slice(0, maxResults);

  return {
    elementCount: elements.length,
    rootFontSize,
    colors: Array.from(colorCounts.entries())
      .map(([hex, entry]) => ({
        hex,
        count: entry.count,
        roles: Array.from(entry.roles) as DesignAudit['colors'][number]['roles'],
      }))
      .sort(byCount)
      .slice(0, maxResults),
    fonts: Array.from(fontCounts.entries())
      .map(([family, entry]) => ({
        family,
        count: entry.count,
        sizes: sortedNumbers(entry.sizes),
        weights: sortedNumbers(entry.weights),
      }))
      .sort(byCount)
      .slice(0, maxResults),
    spacings: toValueUsages(spacingCounts),
    radii: toValueUsages(radiusCounts),
    shadows: toValueUsages(shadowCounts),
    variables: Array.from(new Map(variables.map((variable) => [variable.name, variable])).values()).slice(0, maxResults),
  };
};
