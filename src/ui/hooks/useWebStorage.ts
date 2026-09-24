import { useCallback, useEffect, useState } from "react";
import { DISABLED_STORAGE_KEY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { isStoredItem } from "@/lib/sanitize";
import { computeToggleRows, loadScopedMap, saveScopedMap, withoutKey } from "@/lib/toggleable";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { StorageArea, StoredItem, ToggleRow } from "@/types";

const NOT_INJECTABLE_MESSAGE = "Esta pestaña no expone storage: abri una pagina http(s).";
const NO_ITEMS: StoredItem[] = [];
const NO_DISABLED_ITEMS: Record<string, StoredItem> = {};

const pageReadAll = (area: StorageArea): StoredItem[] => {
  const store = area === "local" ? window.localStorage : window.sessionStorage;
  const items: StoredItem[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null) items.push({ key, value: store.getItem(key) ?? "" });
  }
  return items;
};

const pageSet = (area: StorageArea, key: string, value: string): void => {
  const store = area === "local" ? window.localStorage : window.sessionStorage;
  store.setItem(key, value);
};

const pageRemove = (area: StorageArea, key: string): void => {
  const store = area === "local" ? window.localStorage : window.sessionStorage;
  store.removeItem(key);
};

const pageClear = (area: StorageArea): void => {
  const store = area === "local" ? window.localStorage : window.sessionStorage;
  store.clear();
};

const runInTab = async <TArgs extends unknown[], TResult>(
  tabId: number | null,
  func: (...args: TArgs) => TResult,
  args: TArgs,
): Promise<chrome.scripting.Awaited<TResult> | undefined> => {
  if (tabId === null) throw new Error("No hay una pestaña activa.");
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return results[0]?.result;
};

export interface WebStorageController {
  rows: ToggleRow<StoredItem>[];
  items: StoredItem[];
  error: string | null;
  reload: () => void;
  toggle: (row: ToggleRow<StoredItem>, enabled: boolean) => Promise<void>;
  save: (originalKey: string | null, item: StoredItem, wasOff: boolean) => Promise<void>;
  remove: (item: StoredItem, wasOff: boolean) => Promise<void>;
  clear: () => Promise<void>;
  importItems: (items: StoredItem[]) => Promise<number>;
}

export const useWebStorage = (activeTab: ActiveTab, area: StorageArea): WebStorageController => {
  const [loadedItems, setItems] = useState<StoredItem[]>(NO_ITEMS);
  const [loadedDisabled, setDisabled] = useState<Record<string, StoredItem>>(NO_DISABLED_ITEMS);
  const [loadError, setError] = useState<string | null>(null);
  const injectable = activeTab.injectable;
  const items = injectable ? loadedItems : NO_ITEMS;
  const disabled = injectable ? loadedDisabled : NO_DISABLED_ITEMS;
  const error = injectable ? loadError : NOT_INJECTABLE_MESSAGE;
  const scope = activeTab.origin ? `${area}:${activeTab.origin}` : "";

  const tabId = activeTab.id;

  const reload = useCallback(() => {
    if (!injectable) return;
    void loadScopedMap(DISABLED_STORAGE_KEY, scope, isStoredItem).then(setDisabled);
    void runInTab(tabId, pageReadAll, [area])
      .then((result) => {
        setError(null);
        setItems(result ?? NO_ITEMS);
      })
      .catch((readError: unknown) => {
        setItems(NO_ITEMS);
        setError(errorMessage(readError, "No se pudo leer el storage de la pagina."));
      });
  }, [injectable, area, tabId, scope]);

  useEffect(reload, [reload]);

  const persistDisabled = useCallback(
    async (map: Record<string, StoredItem>) => {
      setDisabled(map);
      await saveScopedMap(DISABLED_STORAGE_KEY, scope, map);
    },
    [scope],
  );

  const runAndReload = useCallback(
    async (fallbackMessage: string, action: () => Promise<void>) => {
      try {
        await action();
        reload();
      } catch (actionError) {
        setError(errorMessage(actionError, fallbackMessage));
      }
    },
    [reload],
  );

  const toggle = useCallback(
    async (row: ToggleRow<StoredItem>, enabled: boolean) => {
      await runAndReload("No se pudo cambiar el item.", async () => {
        if (enabled) {
          await runInTab(tabId, pageSet, [area, row.item.key, row.item.value]);
          await persistDisabled(withoutKey(disabled, row.key));
          return;
        }
        await persistDisabled({ ...disabled, [row.key]: row.item });
        await runInTab(tabId, pageRemove, [area, row.item.key]);
      });
    },
    [area, disabled, persistDisabled, runAndReload, tabId],
  );

  const save = useCallback(
    async (originalKey: string | null, item: StoredItem, wasOff: boolean) => {
      await runAndReload("No se pudo guardar el item.", async () => {
        if (wasOff && originalKey !== null) {
          await persistDisabled({ ...withoutKey(disabled, originalKey), [item.key]: item });
          return;
        }
        if (originalKey !== null && originalKey !== item.key)
          await runInTab(tabId, pageRemove, [area, originalKey]);
        await runInTab(tabId, pageSet, [area, item.key, item.value]);
      });
    },
    [area, disabled, persistDisabled, runAndReload, tabId],
  );

  const remove = useCallback(
    async (item: StoredItem, wasOff: boolean) => {
      await runAndReload("No se pudo borrar el item.", async () => {
        if (wasOff) {
          await persistDisabled(withoutKey(disabled, item.key));
          return;
        }
        await runInTab(tabId, pageRemove, [area, item.key]);
      });
    },
    [area, disabled, persistDisabled, runAndReload, tabId],
  );

  const clear = useCallback(async () => {
    await runAndReload("No se pudo vaciar el storage.", async () => {
      await runInTab(tabId, pageClear, [area]);
      await persistDisabled({});
    });
  }, [area, persistDisabled, runAndReload, tabId]);

  const importItems = useCallback(
    async (incoming: StoredItem[]) => {
      let failed = 0;
      for (const item of incoming) {
        try {
          await runInTab(tabId, pageSet, [area, item.key, item.value]);
        } catch {
          failed += 1;
        }
      }
      reload();
      return incoming.length - failed;
    },
    [area, reload, tabId],
  );

  return {
    rows: computeToggleRows(items, disabled, (item) => item.key).sort((left, right) =>
      left.item.key.localeCompare(right.item.key),
    ),
    items,
    error,
    reload,
    toggle,
    save,
    remove,
    clear,
    importItems,
  };
};
