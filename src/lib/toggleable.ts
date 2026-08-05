import type { ToggleRow } from '@/types';

export const loadDisabledMap = async <TItem>(
  storageKey: string,
  scope: string
): Promise<Record<string, TItem>> => {
  if (!scope) return {};
  const stored = await chrome.storage.local.get(storageKey);
  const all = stored[storageKey];
  if (typeof all !== 'object' || all === null) return {};
  const scoped = (all as Record<string, unknown>)[scope];
  return typeof scoped === 'object' && scoped !== null ? (scoped as Record<string, TItem>) : {};
};

export const saveDisabledMap = async <TItem>(
  storageKey: string,
  scope: string,
  map: Record<string, TItem>
): Promise<void> => {
  if (!scope) return;
  const stored = await chrome.storage.local.get(storageKey);
  const all: Record<string, unknown> =
    typeof stored[storageKey] === 'object' && stored[storageKey] !== null
      ? { ...(stored[storageKey] as Record<string, unknown>) }
      : {};

  if (Object.keys(map).length) {
    all[scope] = map;
  } else {
    delete all[scope];
  }
  await chrome.storage.local.set({ [storageKey]: all });
};

export const withoutKey = <TItem>(map: Record<string, TItem>, key: string): Record<string, TItem> => {
  const next = { ...map };
  delete next[key];
  return next;
};

export const computeToggleRows = <TItem>(
  liveItems: TItem[],
  disabledMap: Record<string, TItem>,
  keyOf: (item: TItem) => string
): Array<ToggleRow<TItem>> => {
  const liveKeys = new Set(liveItems.map(keyOf));
  const rows: Array<ToggleRow<TItem>> = liveItems.map((item) => {
    const key = keyOf(item);
    return { key, item, off: false, reappeared: Object.prototype.hasOwnProperty.call(disabledMap, key) };
  });

  for (const [key, snapshot] of Object.entries(disabledMap)) {
    if (!liveKeys.has(key)) rows.push({ key, item: snapshot, off: true, reappeared: false });
  }

  return rows;
};
