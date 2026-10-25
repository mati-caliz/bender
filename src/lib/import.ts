import { PROFILE_COLORS, createEmptyScope } from "@/lib/constants";
import { createHeaderEntry } from "@/lib/factories";
import { createId } from "@/lib/ids";
import { isRecord } from "@/lib/records";
import { sanitizeDomainList } from "@/lib/scope";
import type { CookieSnapshot, HeaderEntry, HeaderOperation, Profile, StoredItem } from "@/types";

const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const readOperation = (entry: Record<string, unknown>): HeaderOperation => {
  const explicit = asString(entry["operation"]).toLowerCase();
  if (explicit === "append" || explicit === "remove" || explicit === "set") return explicit;
  if (entry["appendMode"] === true || asString(entry["appendMode"]).toLowerCase() === "append")
    return "append";
  return "set";
};

const readVariants = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((variant): variant is string => typeof variant === "string") : [];

/**
 * ModHeader repite el mismo header una vez por cada valor que uno quiere tener a mano y deja
 * prendido el que esta usando. Eso se junta en una sola fila multi-valor, salvo que haya mas de
 * uno prendido (perderiamos el que gana) o que sean appends, que si se acumulan de verdad.
 */
const variantKeyOf = (entry: HeaderEntry): string => `${entry.name.toLowerCase()}:${entry.operation}`;

const mergeGroup = (group: HeaderEntry[], enabledEntries: HeaderEntry[]): HeaderEntry | null => {
  const active = enabledEntries[0] ?? group[0];
  if (!active) return null;
  const variants = group
    .filter((candidate) => candidate !== active)
    .map((candidate) => candidate.value)
    .filter(
      (value, index, all) => value.trim() !== "" && all.indexOf(value) === index && value !== active.value,
    );
  return {
    ...active,
    enabled: enabledEntries.length > 0,
    variants: [...active.variants, ...variants],
  };
};

const keepsEntriesSeparate = (
  group: HeaderEntry[],
  entry: HeaderEntry,
  enabledEntries: HeaderEntry[],
): boolean => group.length === 1 || entry.operation === "append" || enabledEntries.length > 1;

const collapseVariants = (entries: HeaderEntry[]): HeaderEntry[] => {
  const groups = new Map<string, HeaderEntry[]>();
  for (const entry of entries) {
    const key = variantKeyOf(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const collapsed: HeaderEntry[] = [];
  const emitted = new Set<string>();
  for (const entry of entries) {
    const key = variantKeyOf(entry);
    if (emitted.has(key)) continue;
    const group = groups.get(key) ?? [entry];
    const enabledEntries = group.filter((candidate) => candidate.enabled);

    if (keepsEntriesSeparate(group, entry, enabledEntries)) {
      collapsed.push(entry);
      if (group.length === 1) emitted.add(key);
      continue;
    }

    emitted.add(key);
    const merged = mergeGroup(group, enabledEntries);
    if (merged) collapsed.push(merged);
  }

  return collapsed;
};

const readHeaderList = (value: unknown): HeaderEntry[] => {
  if (!Array.isArray(value)) return [];
  const entries = value
    .filter(isRecord)
    .map((entry) =>
      createHeaderEntry({
        name: asString(entry["name"]).trim(),
        value: asString(entry["value"]),
        variants: readVariants(entry["variants"]),
        operation: readOperation(entry),
        enabled: entry["enabled"] !== false,
        comment: asString(entry["comment"]),
      }),
    )
    .filter((entry) => entry.name.length > 0);

  return collapseVariants(entries);
};

const readUrlFilter = (value: unknown): string => {
  if (!Array.isArray(value)) return "";
  const candidates = value.filter(isRecord).filter((entry) => entry["enabled"] !== false);
  const patternOf = (entry: Record<string, unknown>): string =>
    asString(entry["urlRegex"] ?? entry["urlFilter"] ?? entry["url"]).trim();
  const withPattern = candidates.find((entry) => patternOf(entry) !== "");
  return withPattern ? patternOf(withPattern) : "";
};

const FALLBACK_PROFILE_COLOR = "#6366f1";

const readListFrom = (parsed: unknown, wrapperKey: string): unknown[] | null => {
  if (Array.isArray(parsed)) {
    const list: unknown[] = parsed;
    return list;
  }
  if (!isRecord(parsed)) return null;
  const wrapped = parsed[wrapperKey];
  return Array.isArray(wrapped) ? wrapped : null;
};

const readDomainList = (value: unknown): string[] | null =>
  Array.isArray(value) ? sanitizeDomainList(value.map((domain) => asString(domain))) : null;

const readScope = (raw: Record<string, unknown>): Profile["scope"] => {
  const scope = createEmptyScope();
  const urlFilter = readUrlFilter(raw["urlFilters"]);
  if (urlFilter) scope.urlFilter = urlFilter;
  const rawScope = raw["scope"];
  if (!isRecord(rawScope)) return scope;

  scope.activeTabOnly = rawScope["activeTabOnly"] === true;
  scope.urlFilter = asString(rawScope["urlFilter"], scope.urlFilter);
  scope.includeDomains = readDomainList(rawScope["includeDomains"]) ?? scope.includeDomains;
  scope.excludeDomains = readDomainList(rawScope["excludeDomains"]) ?? scope.excludeDomains;
  return scope;
};

const readProfileName = (raw: Record<string, unknown>, index: number): string =>
  asString(raw["name"]) || asString(raw["title"]) || asString(raw["profile"]) || `Perfil ${index + 1}`;

const readProfileColor = (raw: Record<string, unknown>, index: number): string =>
  asString(raw["color"]) ||
  asString(raw["backgroundColor"]) ||
  (PROFILE_COLORS[index % PROFILE_COLORS.length] ?? FALLBACK_PROFILE_COLOR);

const readProfile = (raw: Record<string, unknown>, index: number): Profile => ({
  id: asString(raw["id"]) || createId(),
  name: readProfileName(raw, index),
  color: readProfileColor(raw, index),
  enabled: raw["enabled"] !== false,
  scope: readScope(raw),
  requestHeaders: readHeaderList(raw["requestHeaders"] ?? raw["headers"]),
  responseHeaders: readHeaderList(raw["responseHeaders"] ?? raw["respHeaders"]),
});

export const parseProfiles = (text: string): Profile[] => {
  const list = readListFrom(JSON.parse(text), "profiles");
  if (!list) throw new Error("El JSON tiene que ser un array de perfiles.");

  const profiles = list.filter(isRecord).map(readProfile);

  if (profiles.length === 0) throw new Error("No se encontro ningun perfil para importar.");
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

export type ImportedCookie = Omit<CookieSnapshot, "partitionKey">;

const readSameSite = (value: unknown): chrome.cookies.SameSiteStatus => {
  const raw = asString(value).toLowerCase();
  if (raw === "no_restriction" || raw === "none") return "no_restriction";
  if (raw === "strict") return "strict";
  if (raw === "lax") return "lax";
  return "unspecified";
};

export const parseCookies = (text: string, fallbackDomain: string): ImportedCookie[] => {
  const list = readListFrom(JSON.parse(text), "cookies");
  if (!list) throw new Error("El JSON tiene que ser un array de cookies.");

  const cookies = list.filter(isRecord).map((raw): ImportedCookie => {
    const domain = asString(raw["domain"]) || fallbackDomain;
    return {
      name: asString(raw["name"]),
      value: asString(raw["value"]),
      domain,
      path: asString(raw["path"]) || "/",
      secure: raw["secure"] === true,
      httpOnly: raw["httpOnly"] === true,
      sameSite: readSameSite(raw["sameSite"]),
      hostOnly: raw["hostOnly"] === true || !domain.startsWith("."),
      expirationDate: typeof raw["expirationDate"] === "number" ? raw["expirationDate"] : null,
    };
  });

  const valid = cookies.filter((cookie) => cookie.name);
  if (valid.length === 0) throw new Error("No se encontro ninguna cookie para importar.");
  return valid;
};

export const parseStorageItems = (text: string): StoredItem[] => {
  const parsed: unknown = JSON.parse(text);

  if (Array.isArray(parsed)) {
    const items = parsed
      .filter(isRecord)
      .map((raw) => ({ key: asString(raw["key"]), value: asString(raw["value"]) }))
      .filter((item) => item.key);
    if (items.length === 0) throw new Error("No se encontro ningun item para importar.");
    return items;
  }

  if (isRecord(parsed)) {
    const items = Object.entries(parsed).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
    if (items.length === 0) throw new Error("No se encontro ningun item para importar.");
    return items;
  }

  throw new Error("El JSON tiene que ser un objeto { key: valor } o un array de items.");
};
