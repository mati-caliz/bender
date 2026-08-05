import { useCallback, useEffect, useState } from 'react';
import { DISABLED_STORAGE_KEY } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import { computeToggleRows, loadScopedMap, saveScopedMap, withoutKey } from '@/lib/toggleable';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { StorageArea, StoredItem, ToggleRow } from '@/types';

const pageReadAll = (area: StorageArea): StoredItem[] => {
  const store = area === 'local' ? window.localStorage : window.sessionStorage;
  const items: StoredItem[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null) items.push({ key, value: store.getItem(key) ?? '' });
  }
  return items;
};

const pageSet = (area: StorageArea, key: string, value: string): void => {
  const store = area === 'local' ? window.localStorage : window.sessionStorage;
  store.setItem(key, value);
};

const pageRemove = (area: StorageArea, key: string): void => {
  const store = area === 'local' ? window.localStorage : window.sessionStorage;
  store.removeItem(key);
};

const pageClear = (area: StorageArea): void => {
  const store = area === 'local' ? window.localStorage : window.sessionStorage;
  store.clear();
};

export interface WebStorageController {
  rows: Array<ToggleRow<StoredItem>>;
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
  const [items, setItems] = useState<StoredItem[]>([]);
  const [disabled, setDisabled] = useState<Record<string, StoredItem>>({});
  const [error, setError] = useState<string | null>(null);
  const scope = activeTab.origin ? `${area}:${activeTab.origin}` : '';

  const runInPage = useCallback(
    async <TArgs extends unknown[], TResult>(
      func: (...args: TArgs) => TResult,
      args: TArgs
    ): Promise<chrome.scripting.Awaited<TResult> | undefined> => {
      if (activeTab.id === null) throw new Error('No hay una pestaña activa.');
      const results = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func, args });
      return results[0]?.result;
    },
    [activeTab.id]
  );

  const reload = useCallback(() => {
    if (!activeTab.injectable) {
      setItems([]);
      setDisabled({});
      setError('Esta pestaña no expone storage: abri una pagina http(s).');
      return;
    }

    setError(null);
    void loadScopedMap<StoredItem>(DISABLED_STORAGE_KEY, scope).then(setDisabled);
    void runInPage(pageReadAll, [area])
      .then((result) => setItems(result ?? []))
      .catch((readError: unknown) => {
        setItems([]);
        setError(errorMessage(readError, 'No se pudo leer el storage de la pagina.'));
      });
  }, [activeTab.injectable, area, runInPage, scope]);

  useEffect(reload, [reload]);

  const persistDisabled = useCallback(
    async (map: Record<string, StoredItem>) => {
      setDisabled(map);
      await saveScopedMap(DISABLED_STORAGE_KEY, scope, map);
    },
    [scope]
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
    [reload]
  );

  const toggle = useCallback(
    async (row: ToggleRow<StoredItem>, enabled: boolean) =>
      runAndReload('No se pudo cambiar el item.', async () => {
        if (enabled) {
          await runInPage(pageSet, [area, row.item.key, row.item.value]);
          await persistDisabled(withoutKey(disabled, row.key));
          return;
        }
        await persistDisabled({ ...disabled, [row.key]: row.item });
        await runInPage(pageRemove, [area, row.item.key]);
      }),
    [area, disabled, persistDisabled, runAndReload, runInPage]
  );

  const save = useCallback(
    async (originalKey: string | null, item: StoredItem, wasOff: boolean) =>
      runAndReload('No se pudo guardar el item.', async () => {
        if (wasOff && originalKey !== null) {
          await persistDisabled({ ...withoutKey(disabled, originalKey), [item.key]: item });
          return;
        }
        if (originalKey !== null && originalKey !== item.key) await runInPage(pageRemove, [area, originalKey]);
        await runInPage(pageSet, [area, item.key, item.value]);
      }),
    [area, disabled, persistDisabled, runAndReload, runInPage]
  );

  const remove = useCallback(
    async (item: StoredItem, wasOff: boolean) =>
      runAndReload('No se pudo borrar el item.', async () => {
        if (wasOff) {
          await persistDisabled(withoutKey(disabled, item.key));
          return;
        }
        await runInPage(pageRemove, [area, item.key]);
      }),
    [area, disabled, persistDisabled, runAndReload, runInPage]
  );

  const clear = useCallback(
    async () =>
      runAndReload('No se pudo vaciar el storage.', async () => {
        await runInPage(pageClear, [area]);
        await persistDisabled({});
      }),
    [area, persistDisabled, runAndReload, runInPage]
  );

  const importItems = useCallback(
    async (incoming: StoredItem[]) => {
      let failed = 0;
      for (const item of incoming) {
        try {
          await runInPage(pageSet, [area, item.key, item.value]);
        } catch {
          failed += 1;
        }
      }
      reload();
      return incoming.length - failed;
    },
    [area, reload, runInPage]
  );

  return {
    rows: computeToggleRows(items, disabled, (item) => item.key).sort((left, right) =>
      left.item.key.localeCompare(right.item.key)
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
