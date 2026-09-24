import { compileRegExp, escapeForRegExp } from "@/lib/regexp";

const MATCH_PATTERN_PARTS = /^(\*|https?|file):\/\/([^/]*)(\/.*)$/;
const ALL_URLS = "<all_urls>";
const ANY_HOST = "*";
const SUBDOMAIN_WILDCARD = "*.";

interface MatchPatternParts {
  scheme: string;
  host: string;
  path: string;
}

const isValidHost = (host: string): boolean => {
  if (host === "" || host === ANY_HOST) return true;
  const hostname = host.startsWith(SUBDOMAIN_WILDCARD) ? host.slice(SUBDOMAIN_WILDCARD.length) : host;
  return hostname !== "" && !hostname.includes("*");
};

const parseMatchPattern = (pattern: string): MatchPatternParts | null => {
  const parts = MATCH_PATTERN_PARTS.exec(pattern);
  if (!parts) return null;
  const [, scheme = "", host = "", path = "/"] = parts;
  if (!isValidHost(host)) return null;
  return { scheme, host: host === "" ? ANY_HOST : host, path };
};

export const isValidMatchPattern = (pattern: string): boolean =>
  pattern === ALL_URLS || parseMatchPattern(pattern.trim()) !== null;

export const sanitizeMatchPatterns = (patterns: string[]): string[] =>
  Array.from(new Set(patterns.map((pattern) => pattern.trim()).filter(isValidMatchPattern)));

export const parseMatchPatterns = (input: string): string[] =>
  input
    .split(/[\s,]+/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);

const hostSourceOf = (host: string): string => {
  if (host === ANY_HOST) return "[^/]+";
  if (host.startsWith(SUBDOMAIN_WILDCARD)) {
    return `(?:[^/]+\\.)?${escapeForRegExp(host.slice(SUBDOMAIN_WILDCARD.length))}`;
  }
  return escapeForRegExp(host);
};

export const matchPatternToRegExp = (pattern: string): RegExp | null => {
  if (pattern === ALL_URLS) return /^(https?|file):\/\/.*$/;

  const parts = parseMatchPattern(pattern.trim());
  if (!parts) return null;

  const schemeSource = parts.scheme === "*" ? "https?" : escapeForRegExp(parts.scheme);
  const pathSource = escapeForRegExp(parts.path).replace(/\*/g, ".*");

  return compileRegExp(`^${schemeSource}://${hostSourceOf(parts.host)}${pathSource}$`);
};

export const urlMatchesPatterns = (
  url: string,
  patterns: string[],
  excludePatterns: string[] = [],
): boolean => {
  const matches = patterns.some((pattern) => matchPatternToRegExp(pattern)?.test(url) ?? false);
  if (!matches) return false;
  return !excludePatterns.some((pattern) => matchPatternToRegExp(pattern)?.test(url) ?? false);
};
