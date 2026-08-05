import { COOKIE_SNAPSHOTS_KEY } from '@/lib/constants';
import { createId } from '@/lib/ids';
import { coerceCookieSnapshotSet } from '@/lib/sanitize';
import { loadScopedMap, saveScopedMap, withoutKey } from '@/lib/toggleable';
import type { CookieSnapshot, CookieSnapshotSet } from '@/types';

const byNewestFirst = (left: CookieSnapshotSet, right: CookieSnapshotSet): number => right.createdAt - left.createdAt;

const readSets = async (domain: string): Promise<Record<string, CookieSnapshotSet>> => {
  const stored = await loadScopedMap<unknown>(COOKIE_SNAPSHOTS_KEY, domain);
  const sets: Record<string, CookieSnapshotSet> = {};
  for (const [id, candidate] of Object.entries(stored)) {
    const set = coerceCookieSnapshotSet(candidate);
    if (set) sets[id] = { ...set, id };
  }
  return sets;
};

export const listCookieSnapshotSets = async (domain: string): Promise<CookieSnapshotSet[]> =>
  Object.values(await readSets(domain)).sort(byNewestFirst);

export const saveCookieSnapshotSet = async (
  domain: string,
  name: string,
  cookies: CookieSnapshot[]
): Promise<CookieSnapshotSet[]> => {
  const sets = await readSets(domain);
  const existing = Object.values(sets).find((set) => set.name === name);
  const id = existing?.id ?? createId();
  const next = { ...sets, [id]: { id, name, createdAt: Date.now(), cookies } };

  await saveScopedMap(COOKIE_SNAPSHOTS_KEY, domain, next);
  return Object.values(next).sort(byNewestFirst);
};

export const deleteCookieSnapshotSet = async (domain: string, id: string): Promise<CookieSnapshotSet[]> => {
  const next = withoutKey(await readSets(domain), id);
  await saveScopedMap(COOKIE_SNAPSHOTS_KEY, domain, next);
  return Object.values(next).sort(byNewestFirst);
};
