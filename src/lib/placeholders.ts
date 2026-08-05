import { createId } from '@/lib/ids';

export interface PlaceholderContext {
  tabUrl: string | null;
  now: number;
}

export interface PlaceholderInfo {
  name: string;
  description: string;
}

export interface ResolvedValue {
  value: string;
  unknownNames: string[];
  unavailableNames: string[];
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;
const RANDOM_INT_CEILING = 1_000_000;

export const PLACEHOLDERS: PlaceholderInfo[] = [
  { name: 'uuid', description: 'UUID nuevo en cada aplicacion del motor' },
  { name: 'timestamp', description: 'Milisegundos desde epoch' },
  { name: 'unix', description: 'Segundos desde epoch' },
  { name: 'isoDate', description: 'Fecha y hora ISO 8601' },
  { name: 'random', description: `Entero al azar entre 0 y ${RANDOM_INT_CEILING - 1}` },
  { name: 'tabUrl', description: 'URL completa de la pestaña activa' },
  { name: 'tabOrigin', description: 'Origen de la pestaña activa' },
  { name: 'tabHostname', description: 'Hostname de la pestaña activa' },
];

const TAB_PLACEHOLDER_NAMES = new Set(['tabUrl', 'tabOrigin', 'tabHostname']);

const fromTabUrl = (name: string, tabUrl: string): string | null => {
  if (name === 'tabUrl') return tabUrl;
  try {
    const parsed = new URL(tabUrl);
    return name === 'tabOrigin' ? parsed.origin : parsed.hostname;
  } catch {
    return null;
  }
};

const resolveName = (name: string, context: PlaceholderContext): string | null => {
  switch (name) {
    case 'uuid':
      return createId();
    case 'timestamp':
      return String(context.now);
    case 'unix':
      return String(Math.floor(context.now / 1000));
    case 'isoDate':
      return new Date(context.now).toISOString();
    case 'random':
      return String(Math.floor(Math.random() * RANDOM_INT_CEILING));
    default:
      return context.tabUrl ? fromTabUrl(name, context.tabUrl) : null;
  }
};

const placeholderNamesIn = (value: string): string[] => {
  PLACEHOLDER_PATTERN.lastIndex = 0;
  return Array.from(value.matchAll(PLACEHOLDER_PATTERN), (match) => match[1] ?? '');
};

export const hasPlaceholders = (value: string): boolean => placeholderNamesIn(value).length > 0;

export const hasTabPlaceholders = (value: string): boolean =>
  placeholderNamesIn(value).some((name) => TAB_PLACEHOLDER_NAMES.has(name));

export const resolvePlaceholders = (value: string, context: PlaceholderContext): ResolvedValue => {
  const unknownNames: string[] = [];
  const unavailableNames: string[] = [];

  const resolved = value.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const isTabPlaceholder = TAB_PLACEHOLDER_NAMES.has(name);
    if (!isTabPlaceholder && !PLACEHOLDERS.some((placeholder) => placeholder.name === name)) {
      if (!unknownNames.includes(name)) unknownNames.push(name);
      return match;
    }

    const replacement = resolveName(name, context);
    if (replacement === null) {
      if (!unavailableNames.includes(name)) unavailableNames.push(name);
      return '';
    }
    return replacement;
  });

  return { value: resolved, unknownNames, unavailableNames };
};
