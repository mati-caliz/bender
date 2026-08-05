import { escapeForRegExp } from '@/lib/regexp';

const MATCH_PATTERN =/^(\*|https?|file):\/\/(\*|(?:\*\.)?[^/*]+)?(\/.*)$/;
const ALL_URLS = '<all_urls>';

export const isValidMatchPattern = (pattern: string): boolean =>
  pattern === ALL_URLS || MATCH_PATTERN.test(pattern.trim());

export const sanitizeMatchPatterns = (patterns: string[]): string[] =>
  Array.from(new Set(patterns.map((pattern) => pattern.trim()).filter(isValidMatchPattern)));

export const parseMatchPatterns = (input: string): string[] =>
  input
    .split(/[\s,]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);

export const matchPatternToRegExp = (pattern: string): RegExp | null => {
  if (pattern === ALL_URLS) return /^(https?|file):\/\/.*$/;

  const parts = MATCH_PATTERN.exec(pattern.trim());
  if (!parts) return null;

  const [, scheme, host = '*', path] = parts;
  const schemeSource = scheme === '*' ? 'https?' : escapeForRegExp(scheme ?? '');
  const hostSource =
    host === '*'
      ? '[^/]+'
      : host.startsWith('*.')
        ? `(?:[^/]+\\.)?${escapeForRegExp(host.slice(2))}`
        : escapeForRegExp(host);
  const pathSource = escapeForRegExp(path ?? '/').replace(/\*/g, '.*');

  return new RegExp(`^${schemeSource}://${hostSource}${pathSource}$`);
};

export const urlMatchesPatterns = (url: string, patterns: string[], excludePatterns: string[] = []): boolean => {
  const matches = patterns.some((pattern) => matchPatternToRegExp(pattern)?.test(url) ?? false);
  if (!matches) return false;
  return !excludePatterns.some((pattern) => matchPatternToRegExp(pattern)?.test(url) ?? false);
};
