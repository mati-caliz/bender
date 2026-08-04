import { ALL_RESOURCE_TYPES } from '@/lib/constants';
import type { ResourceType, Scope } from '@/types';

const DOMAIN_PATTERN = /^[a-z0-9.-]+$/;
const WILDCARD_PREFIX = '*.';

export const sanitizeDomain = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//, '');
  const withoutPath = withoutScheme.split('/')[0] ?? '';
  const withoutPort = withoutPath.split(':')[0] ?? '';
  const withoutWildcard = withoutPort.startsWith(WILDCARD_PREFIX)
    ? withoutPort.slice(WILDCARD_PREFIX.length)
    : withoutPort;
  const normalized = withoutWildcard.replace(/^\./, '');
  return normalized && DOMAIN_PATTERN.test(normalized) ? normalized : null;
};

export const sanitizeDomainList = (domains: string[]): string[] => {
  const sanitized = domains.map(sanitizeDomain).filter((domain): domain is string => domain !== null);
  return Array.from(new Set(sanitized));
};

export const parseDomainList = (input: string): string[] =>
  sanitizeDomainList(input.split(/[\s,;]+/).filter(Boolean));

export const resolveResourceTypes = (scope: Scope): ResourceType[] =>
  scope.resourceTypes.length ? scope.resourceTypes : ALL_RESOURCE_TYPES;

export interface CompiledCondition {
  urlFilter?: string;
  regexFilter?: string;
  requestDomains?: string[];
  excludedRequestDomains?: string[];
  resourceTypes: ResourceType[];
  tabIds?: number[];
}

export interface ConditionContext {
  activeTabId: number | null;
}

export const scopeToCondition = (scope: Scope, context: ConditionContext): CompiledCondition | null => {
  if (scope.activeTabOnly && context.activeTabId === null) return null;

  const condition: CompiledCondition = {
    resourceTypes: resolveResourceTypes(scope),
  };

  const urlFilter = scope.urlFilter.trim();
  if (urlFilter) condition.urlFilter = urlFilter;

  const includeDomains = sanitizeDomainList(scope.includeDomains);
  if (includeDomains.length) condition.requestDomains = includeDomains;

  const excludeDomains = sanitizeDomainList(scope.excludeDomains);
  if (excludeDomains.length) condition.excludedRequestDomains = excludeDomains;

  if (scope.activeTabOnly && context.activeTabId !== null) condition.tabIds = [context.activeTabId];

  return condition;
};

export const describeScope = (scope: Scope): string => {
  const parts: string[] = [];
  if (scope.activeTabOnly) parts.push('solo pestaña activa');
  if (scope.includeDomains.length) parts.push(scope.includeDomains.join(', '));
  if (scope.excludeDomains.length) parts.push(`excepto ${scope.excludeDomains.join(', ')}`);
  if (scope.urlFilter.trim()) parts.push(`url ~ ${scope.urlFilter.trim()}`);
  if (scope.resourceTypes.length) parts.push(`${scope.resourceTypes.length} tipo(s)`);
  return parts.length ? parts.join(' · ') : 'todas las requests';
};

export const isScopeRestricted = (scope: Scope): boolean =>
  scope.activeTabOnly ||
  scope.includeDomains.length > 0 ||
  scope.excludeDomains.length > 0 ||
  scope.urlFilter.trim().length > 0 ||
  scope.resourceTypes.length > 0;

const escapeForRegExp = (value: string): string => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export const urlFilterToRegExp = (urlFilter: string): RegExp => {
  let pattern = urlFilter;
  let anchoredStart = false;
  let anchoredEnd = false;

  if (pattern.startsWith('||')) {
    pattern = pattern.slice(2);
    anchoredStart = true;
  } else if (pattern.startsWith('|')) {
    pattern = pattern.slice(1);
    anchoredStart = true;
  }
  if (pattern.endsWith('|')) {
    pattern = pattern.slice(0, -1);
    anchoredEnd = true;
  }

  const body = escapeForRegExp(pattern).replace(/\*/g, '.*').replace(/\^/g, '[^a-zA-Z0-9._%-]');
  return new RegExp(`${anchoredStart ? '^.*?' : ''}${body}${anchoredEnd ? '$' : ''}`);
};

export const matchesDomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export const urlMatchesScope = (scope: Scope, url: string): boolean => {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  const includeDomains = sanitizeDomainList(scope.includeDomains);
  if (includeDomains.length && !includeDomains.some((domain) => matchesDomain(hostname, domain))) return false;

  const excludeDomains = sanitizeDomainList(scope.excludeDomains);
  if (excludeDomains.some((domain) => matchesDomain(hostname, domain))) return false;

  const urlFilter = scope.urlFilter.trim();
  if (urlFilter && !urlFilterToRegExp(urlFilter).test(url)) return false;

  return true;
};
