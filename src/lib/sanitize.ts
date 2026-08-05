import { ALL_REQUEST_METHODS, ALL_RESOURCE_TYPES, createEmptyScope } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { isRecord } from '@/lib/records';
import type {
  CookieSnapshot,
  CookieSnapshotSet,
  HeaderEntry,
  HeaderOperation,
  Profile,
  RequestMethod,
  ResourceType,
  Scope,
  TrafficRule,
  TrafficRuleAction,
  UserScript,
  UserScriptLanguage,
  UserScriptRunAt,
  UserScriptWorld,
} from '@/types';

const HEADER_OPERATIONS: HeaderOperation[] = ['set', 'append', 'remove'];
const SCRIPT_LANGUAGES: UserScriptLanguage[] = ['javascript', 'css'];
const SCRIPT_RUN_AT_VALUES: UserScriptRunAt[] = ['document_start', 'document_end', 'document_idle'];
const SCRIPT_WORLDS: UserScriptWorld[] = ['MAIN', 'USER_SCRIPT'];
const SAME_SITE_VALUES: chrome.cookies.SameSiteStatus[] = ['lax', 'strict', 'no_restriction', 'unspecified'];
const DEFAULT_MOCK_STATUS = 200;
const DEFAULT_MOCK_CONTENT_TYPE = 'application/json; charset=utf-8';

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asOneOf = <TValue extends string>(value: unknown, allowed: TValue[], fallback: TValue): TValue =>
  allowed.includes(value as TValue) ? (value as TValue) : fallback;

const asIdentifier = (value: unknown): string => {
  const identifier = asString(value).trim();
  return identifier || createId();
};

export const coerceScope = (value: unknown): Scope => {
  const empty = createEmptyScope();
  if (!isRecord(value)) return empty;

  const resourceTypes = asStringList(value.resourceTypes).filter((resourceType): resourceType is ResourceType =>
    ALL_RESOURCE_TYPES.includes(resourceType as ResourceType)
  );
  const requestMethods = asStringList(value.requestMethods)
    .map((requestMethod) => requestMethod.toLowerCase())
    .filter((requestMethod): requestMethod is RequestMethod =>
      ALL_REQUEST_METHODS.includes(requestMethod as RequestMethod)
    );

  return {
    activeTabOnly: asBoolean(value.activeTabOnly, empty.activeTabOnly),
    includeDomains: asStringList(value.includeDomains),
    excludeDomains: asStringList(value.excludeDomains),
    initiatorDomains: asStringList(value.initiatorDomains),
    excludedInitiatorDomains: asStringList(value.excludedInitiatorDomains),
    urlFilter: asString(value.urlFilter),
    resourceTypes,
    requestMethods,
  };
};

export const coerceHeaderEntry = (value: unknown): HeaderEntry | null => {
  if (!isRecord(value)) return null;
  return {
    id: asIdentifier(value.id),
    name: asString(value.name),
    value: asString(value.value),
    operation: asOneOf(value.operation, HEADER_OPERATIONS, 'set'),
    enabled: asBoolean(value.enabled, true),
    comment: asString(value.comment),
  };
};

const coerceHeaderEntries = (value: unknown): HeaderEntry[] =>
  Array.isArray(value)
    ? value.map(coerceHeaderEntry).filter((entry): entry is HeaderEntry => entry !== null)
    : [];

export const coerceProfile = (value: unknown): Profile | null => {
  if (!isRecord(value)) return null;
  return {
    id: asIdentifier(value.id),
    name: asString(value.name, 'Perfil'),
    color: asString(value.color, '#6366f1'),
    enabled: asBoolean(value.enabled, true),
    scope: coerceScope(value.scope),
    requestHeaders: coerceHeaderEntries(value.requestHeaders),
    responseHeaders: coerceHeaderEntries(value.responseHeaders),
  };
};

const coerceTrafficRuleAction = (value: unknown): TrafficRuleAction | null => {
  if (!isRecord(value)) return null;

  switch (value.kind) {
    case 'block':
      return { kind: 'block' };
    case 'redirect':
      return { kind: 'redirect', target: asString(value.target), useRegex: asBoolean(value.useRegex, false) };
    case 'mock':
      return {
        kind: 'mock',
        status: asNumber(value.status, DEFAULT_MOCK_STATUS),
        contentType: asString(value.contentType, DEFAULT_MOCK_CONTENT_TYPE),
        body: asString(value.body),
        delayMs: asNumber(value.delayMs, 0),
        headers: coerceHeaderEntries(value.headers),
      };
    default:
      return null;
  }
};

export const coerceTrafficRule = (value: unknown): TrafficRule | null => {
  if (!isRecord(value)) return null;
  const action = coerceTrafficRuleAction(value.action);
  if (!action) return null;

  return {
    id: asIdentifier(value.id),
    name: asString(value.name, 'Regla'),
    enabled: asBoolean(value.enabled, true),
    scope: coerceScope(value.scope),
    action,
  };
};

export const coerceUserScript = (value: unknown): UserScript | null => {
  if (!isRecord(value)) return null;
  return {
    id: asIdentifier(value.id),
    name: asString(value.name, 'Script'),
    description: asString(value.description),
    enabled: asBoolean(value.enabled, true),
    language: asOneOf(value.language, SCRIPT_LANGUAGES, 'javascript'),
    matches: asStringList(value.matches),
    excludeMatches: asStringList(value.excludeMatches),
    runAt: asOneOf(value.runAt, SCRIPT_RUN_AT_VALUES, 'document_idle'),
    world: asOneOf(value.world, SCRIPT_WORLDS, 'MAIN'),
    allFrames: asBoolean(value.allFrames, false),
    code: asString(value.code),
    updatedAt: asNumber(value.updatedAt, 0),
  };
};

export const coerceCookieSnapshot = (value: unknown): CookieSnapshot | null => {
  if (!isRecord(value)) return null;
  const name = asString(value.name);
  if (!name) return null;

  return {
    name,
    value: asString(value.value),
    domain: asString(value.domain),
    path: asString(value.path, '/') || '/',
    secure: asBoolean(value.secure, false),
    httpOnly: asBoolean(value.httpOnly, false),
    sameSite: asOneOf(value.sameSite, SAME_SITE_VALUES, 'unspecified'),
    hostOnly: asBoolean(value.hostOnly, true),
    expirationDate: typeof value.expirationDate === 'number' ? value.expirationDate : null,
  };
};

export const coerceCookieSnapshotSet = (value: unknown): CookieSnapshotSet | null => {
  if (!isRecord(value)) return null;
  const name = asString(value.name).trim();
  if (!name) return null;

  return {
    id: asIdentifier(value.id),
    name,
    createdAt: asNumber(value.createdAt, 0),
    cookies: Array.isArray(value.cookies)
      ? value.cookies.map(coerceCookieSnapshot).filter((cookie): cookie is CookieSnapshot => cookie !== null)
      : [],
  };
};

export interface CoercedList<TItem> {
  items: TItem[];
  dropped: number;
}

export const coerceList = <TItem>(value: unknown, coerce: (item: unknown) => TItem | null): CoercedList<TItem> => {
  if (!Array.isArray(value)) return { items: [], dropped: 0 };

  const items: TItem[] = [];
  for (const candidate of value) {
    const item = coerce(candidate);
    if (item) items.push(item);
  }
  return { items, dropped: value.length - items.length };
};
