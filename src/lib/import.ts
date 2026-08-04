import { PROFILE_COLORS, createEmptyScope } from '@/lib/constants';
import { createHeaderEntry } from '@/lib/factories';
import { createId } from '@/lib/ids';
import { sanitizeDomainList } from '@/lib/scope';
import type { HeaderEntry, Profile, StoredItem } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const readHeaderList = (value: unknown): HeaderEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) =>
      createHeaderEntry({
        name: asString(entry.name).trim(),
        value: asString(entry.value),
        enabled: entry.enabled !== false,
        comment: asString(entry.comment),
      })
    )
    .filter((entry) => entry.name.length > 0);
};

const readUrlFilter = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  const first = value.find(isRecord);
  return first ? asString(first.urlRegex ?? first.urlFilter ?? first.url) : '';
};

export const parseProfiles = (text: string): Profile[] => {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.profiles) ? parsed.profiles : null;
  if (!list) throw new Error('El JSON tiene que ser un array de perfiles.');

  const profiles = list.filter(isRecord).map((raw, index): Profile => {
    const scope = createEmptyScope();
    const urlFilter = readUrlFilter(raw.urlFilters);
    if (urlFilter) scope.urlFilter = urlFilter;
    if (isRecord(raw.scope)) {
      const rawScope = raw.scope;
      scope.activeTabOnly = rawScope.activeTabOnly === true;
      scope.urlFilter = asString(rawScope.urlFilter, scope.urlFilter);
      if (Array.isArray(rawScope.includeDomains)) {
        scope.includeDomains = sanitizeDomainList(rawScope.includeDomains.map((domain) => asString(domain)));
      }
      if (Array.isArray(rawScope.excludeDomains)) {
        scope.excludeDomains = sanitizeDomainList(rawScope.excludeDomains.map((domain) => asString(domain)));
      }
    }

    return {
      id: asString(raw.id) || createId(),
      name: asString(raw.name) || asString(raw.title) || asString(raw.profile) || `Perfil ${index + 1}`,
      color:
        asString(raw.color) ||
        asString(raw.backgroundColor) ||
        PROFILE_COLORS[index % PROFILE_COLORS.length] ||
        '#6366f1',
      enabled: raw.enabled !== false,
      scope,
      requestHeaders: readHeaderList(raw.requestHeaders ?? raw.headers),
      responseHeaders: readHeaderList(raw.responseHeaders ?? raw.respHeaders),
    };
  });

  if (!profiles.length) throw new Error('No se encontro ningun perfil para importar.');
  return profiles;
};

export interface ImportedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: chrome.cookies.SameSiteStatus;
  hostOnly: boolean;
  expirationDate: number | null;
}

const readSameSite = (value: unknown): chrome.cookies.SameSiteStatus => {
  const raw = asString(value).toLowerCase();
  if (raw === 'no_restriction' || raw === 'none') return 'no_restriction';
  if (raw === 'strict') return 'strict';
  if (raw === 'lax') return 'lax';
  return 'unspecified';
};

export const parseCookies = (text: string, fallbackDomain: string): ImportedCookie[] => {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.cookies) ? parsed.cookies : null;
  if (!list) throw new Error('El JSON tiene que ser un array de cookies.');

  const cookies = list.filter(isRecord).map((raw): ImportedCookie => {
    const domain = asString(raw.domain) || fallbackDomain;
    return {
      name: asString(raw.name),
      value: asString(raw.value),
      domain,
      path: asString(raw.path) || '/',
      secure: raw.secure === true,
      httpOnly: raw.httpOnly === true,
      sameSite: readSameSite(raw.sameSite),
      hostOnly: raw.hostOnly === true || !domain.startsWith('.'),
      expirationDate: typeof raw.expirationDate === 'number' ? raw.expirationDate : null,
    };
  });

  const valid = cookies.filter((cookie) => cookie.name);
  if (!valid.length) throw new Error('No se encontro ninguna cookie para importar.');
  return valid;
};

export const parseStorageItems = (text: string): StoredItem[] => {
  const parsed: unknown = JSON.parse(text);

  if (Array.isArray(parsed)) {
    const items = parsed
      .filter(isRecord)
      .map((raw) => ({ key: asString(raw.key), value: asString(raw.value) }))
      .filter((item) => item.key);
    if (!items.length) throw new Error('No se encontro ningun item para importar.');
    return items;
  }

  if (isRecord(parsed)) {
    const items = Object.entries(parsed).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
    if (!items.length) throw new Error('No se encontro ningun item para importar.');
    return items;
  }

  throw new Error('El JSON tiene que ser un objeto { key: valor } o un array de items.');
};
