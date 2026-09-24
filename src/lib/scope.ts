import { ALL_REQUEST_METHODS, ALL_RESOURCE_TYPES } from "@/lib/constants";
import { compileRegExp, escapeForRegExp } from "@/lib/regexp";
import type { RequestMethod, ResourceType, Scope } from "@/types";

const DOMAIN_PATTERN = /^[a-z0-9.-]+$/;
const WILDCARD_PREFIX = "*.";

export const sanitizeDomain = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//, "");
  const withoutPath = withoutScheme.split("/")[0] ?? "";
  const withoutPort = withoutPath.split(":")[0] ?? "";
  const withoutWildcard = withoutPort.startsWith(WILDCARD_PREFIX)
    ? withoutPort.slice(WILDCARD_PREFIX.length)
    : withoutPort;
  const normalized = withoutWildcard.replace(/^\./, "");
  return normalized && DOMAIN_PATTERN.test(normalized) ? normalized : null;
};

export const sanitizeDomainList = (domains: string[]): string[] => {
  const sanitized = domains.map(sanitizeDomain).filter((domain): domain is string => domain !== null);
  return Array.from(new Set(sanitized));
};

export const parseDomainList = (input: string): string[] =>
  sanitizeDomainList(input.split(/[\s,;]+/).filter(Boolean));

export const resolveResourceTypes = (scope: Scope): ResourceType[] =>
  scope.resourceTypes.length > 0 ? scope.resourceTypes : ALL_RESOURCE_TYPES;

const isRequestMethod = (value: string): value is RequestMethod =>
  ALL_REQUEST_METHODS.some((method) => method === value);

export const toRequestMethod = (method: string): RequestMethod => {
  const normalized = method.trim().toLowerCase();
  return isRequestMethod(normalized) ? normalized : "other";
};

export interface CompiledCondition {
  urlFilter?: string;
  regexFilter?: string;
  requestDomains?: string[];
  excludedRequestDomains?: string[];
  initiatorDomains?: string[];
  excludedInitiatorDomains?: string[];
  requestMethods?: RequestMethod[];
  resourceTypes: ResourceType[];
  tabIds?: number[];
}

export interface ConditionContext {
  activeTabId: number | null;
}

type DomainConditionKey =
  "requestDomains" | "excludedRequestDomains" | "initiatorDomains" | "excludedInitiatorDomains";

const domainConditions = (scope: Scope): Pick<CompiledCondition, DomainConditionKey> => {
  const sources: [DomainConditionKey, string[]][] = [
    ["requestDomains", scope.includeDomains],
    ["excludedRequestDomains", scope.excludeDomains],
    ["initiatorDomains", scope.initiatorDomains],
    ["excludedInitiatorDomains", scope.excludedInitiatorDomains],
  ];
  const conditions: Pick<CompiledCondition, DomainConditionKey> = {};
  for (const [key, domains] of sources) {
    const sanitized = sanitizeDomainList(domains);
    if (sanitized.length > 0) conditions[key] = sanitized;
  }
  return conditions;
};

export const scopeToCondition = (scope: Scope, context: ConditionContext): CompiledCondition | null => {
  if (scope.activeTabOnly && context.activeTabId === null) return null;

  const condition: CompiledCondition = {
    resourceTypes: resolveResourceTypes(scope),
  };

  const urlFilter = scope.urlFilter.trim();
  if (urlFilter) condition.urlFilter = urlFilter;

  Object.assign(condition, domainConditions(scope));

  if (scope.requestMethods.length > 0) condition.requestMethods = scope.requestMethods;

  if (scope.activeTabOnly && context.activeTabId !== null) condition.tabIds = [context.activeTabId];

  return condition;
};

const describeList = (prefix: string, values: string[]): string[] =>
  values.length > 0 ? [`${prefix}${values.join(", ")}`] : [];

export const describeScope = (scope: Scope): string => {
  const urlFilter = scope.urlFilter.trim();
  const parts = [
    ...(scope.activeTabOnly ? ["solo pestaña activa"] : []),
    ...(scope.requestMethods.length > 0
      ? [scope.requestMethods.map((method) => method.toUpperCase()).join("/")]
      : []),
    ...describeList("", scope.includeDomains),
    ...describeList("excepto ", scope.excludeDomains),
    ...describeList("desde ", scope.initiatorDomains),
    ...describeList("no desde ", scope.excludedInitiatorDomains),
    ...(urlFilter ? [`url ~ ${urlFilter}`] : []),
    ...(scope.resourceTypes.length > 0 ? [`${scope.resourceTypes.length} tipo(s)`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "todas las requests";
};

export const isScopeRestricted = (scope: Scope): boolean =>
  scope.activeTabOnly ||
  scope.includeDomains.length > 0 ||
  scope.excludeDomains.length > 0 ||
  scope.initiatorDomains.length > 0 ||
  scope.excludedInitiatorDomains.length > 0 ||
  scope.urlFilter.trim().length > 0 ||
  scope.resourceTypes.length > 0 ||
  scope.requestMethods.length > 0;

const URL_FILTER_WILDCARD = "*";
const URL_FILTER_SEPARATOR = "^";
const SEPARATOR_SOURCE = "(?:[^a-zA-Z0-9._%\\-]|$)";

const urlFilterBodyToSource = (body: string): string =>
  body
    .split(/([*^])/)
    .map((part) => {
      if (part === URL_FILTER_WILDCARD) return ".*";
      if (part === URL_FILTER_SEPARATOR) return SEPARATOR_SOURCE;
      return escapeForRegExp(part);
    })
    .join("");

export const urlFilterToRegExp = (urlFilter: string): RegExp => {
  let pattern = urlFilter;
  let anchoredStart = false;
  let anchoredEnd = false;

  if (pattern.startsWith("||")) {
    pattern = pattern.slice(2);
    anchoredStart = true;
  } else if (pattern.startsWith("|")) {
    pattern = pattern.slice(1);
    anchoredStart = true;
  }
  if (pattern.endsWith("|")) {
    pattern = pattern.slice(0, -1);
    anchoredEnd = true;
  }

  const body = urlFilterBodyToSource(pattern);
  return compileRegExp(`${anchoredStart ? "^.*?" : ""}${body}${anchoredEnd ? "$" : ""}`);
};

export const matchesDomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export const urlMatchesScope = (scope: Scope, url: string): boolean => {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  const includeDomains = sanitizeDomainList(scope.includeDomains);
  if (includeDomains.length > 0 && !includeDomains.some((domain) => matchesDomain(hostname, domain)))
    return false;

  const excludeDomains = sanitizeDomainList(scope.excludeDomains);
  if (excludeDomains.some((domain) => matchesDomain(hostname, domain))) return false;

  const urlFilter = scope.urlFilter.trim();
  if (urlFilter && !urlFilterToRegExp(urlFilter).test(url)) return false;

  return true;
};

export interface ScopeRequest {
  url: string;
  method: string;
  initiatorHostname: string;
}

export const requestMatchesScope = (scope: Scope, request: ScopeRequest): boolean => {
  if (!urlMatchesScope(scope, request.url)) return false;

  if (scope.requestMethods.length > 0 && !scope.requestMethods.includes(toRequestMethod(request.method)))
    return false;

  const initiatorHostname = request.initiatorHostname.toLowerCase();
  const initiatorDomains = sanitizeDomainList(scope.initiatorDomains);
  if (
    initiatorDomains.length > 0 &&
    !initiatorDomains.some((domain) => matchesDomain(initiatorHostname, domain))
  ) {
    return false;
  }

  const excludedInitiatorDomains = sanitizeDomainList(scope.excludedInitiatorDomains);
  return !excludedInitiatorDomains.some((domain) => matchesDomain(initiatorHostname, domain));
};
