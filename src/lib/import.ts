import { PROFILE_COLORS, createEmptyScope } from '@/lib/constants';
import { createHeaderEntry } from '@/lib/factories';
import { createId } from '@/lib/ids';
import { isRecord } from '@/lib/records';
import { sanitizeDomainList } from '@/lib/scope';
import type { CookieSnapshot, HeaderEntry, HeaderOperation, Profile, StoredItem } from '@/types';

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const readOperation = (entry: Record<string, unknown>): HeaderOperation => {
  const explicit = asString(entry.operation).toLowerCase();
  if (explicit === 'append' || explicit === 'remove' || explicit === 'set') return explicit;
  if (entry.appendMode === true || asString(entry.appendMode).toLowerCase() === 'append') return 'append';
  return 'set';
};

const readHeaderList = (value: unknown): HeaderEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) =>
      createHeaderEntry({
        name: asString(entry.name).trim(),
        value: asString(entry.value),
        operation: readOperation(entry),
        enabled: entry.enabled !== false,
        comment: asString(entry.comment),
      })
    )
    .filter((entry) => entry.name.length > 0);
};

const readUrlFilter = (value: unknown): string => {
  if (!Array.isArray(value)) return '';
  const candidates = value.filter(isRecord).filter((entry) => entry.enabled !== false);
  const withPattern = candidates.find((entry) => asString(entry.urlRegex ?? entry.urlFilter ?? entry.url).trim());
  return withPattern ? asString(withPattern.urlRegex ?? withPattern.urlFilter ?? withPattern.url).trim() : '';
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

/**
 * Suma los importados a los que ya estan sin tocar el resto: los que traen un id
 * conocido pisan a ese perfil y los demas se agregan al final.
 *
 * Importa que sea por id y no por concatenacion: dos perfiles con el mismo id
 * rompen las referencias que los apuntan (selectedProfileId, entornos).
 */
export const mergeProfiles = (current: Profile[], imported: Profile[]): Profile[] => {
  const merged = [...current];
  const indexById = new Map(merged.map((profile, index) => [profile.id, index]));

  for (const profile of imported) {
    const existing = indexById.get(profile.id);
    if (existing === undefined) {
      indexById.set(profile.id, merged.length);
      merged.push(profile);
    } else {
      merged[existing] = profile;
    }
  }

  return merged;
};

export type ImportedCookie = Omit<CookieSnapshot, 'partitionKey'>;

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
