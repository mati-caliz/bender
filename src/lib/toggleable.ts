import type { ToggleRow } from "@/types";

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const withoutEntry = <TItem>(map: Record<string, TItem>, key: string): Record<string, TItem> =>
  Object.fromEntries(Object.entries(map).filter(([entryKey]) => entryKey !== key));

export const loadScopedMap = async <TItem>(
  storageKey: string,
  scope: string,
  isItem: (value: unknown) => value is TItem,
): Promise<Record<string, TItem>> => {
  if (!scope) return {};
  const stored = await chrome.storage.local.get(storageKey);
  const all: unknown = stored[storageKey];
  if (!isObjectLike(all)) return {};
  const scoped = all[scope];
  if (!isObjectLike(scoped)) return {};
  return Object.fromEntries(
    Object.entries(scoped).filter((entry): entry is [string, TItem] => isItem(entry[1])),
  );
};

export const saveScopedMap = async <TItem>(
  storageKey: string,
  scope: string,
  map: Record<string, TItem>,
): Promise<void> => {
  if (!scope) return;
  const stored = await chrome.storage.local.get(storageKey);
  const previous: unknown = stored[storageKey];
  const all: Record<string, unknown> = isObjectLike(previous) ? { ...previous } : {};
  const next = Object.keys(map).length > 0 ? { ...all, [scope]: map } : withoutEntry(all, scope);
  await chrome.storage.local.set({ [storageKey]: next });
};

export const withoutKey = <TItem>(map: Record<string, TItem>, key: string): Record<string, TItem> =>
  withoutEntry(map, key);

export const computeToggleRows = <TItem>(
  liveItems: TItem[],
  disabledMap: Record<string, TItem>,
  keyOf: (item: TItem) => string,
): ToggleRow<TItem>[] => {
  const liveKeys = new Set(liveItems.map(keyOf));
  const rows: ToggleRow<TItem>[] = liveItems.map((item) => {
    const key = keyOf(item);
    return { key, item, off: false, reappeared: Object.prototype.hasOwnProperty.call(disabledMap, key) };
  });

  for (const [key, snapshot] of Object.entries(disabledMap)) {
    if (!liveKeys.has(key)) rows.push({ key, item: snapshot, off: true, reappeared: false });
  }

  return rows;
};
