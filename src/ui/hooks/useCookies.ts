import { useCallback, useEffect, useState } from 'react';
import { DISABLED_COOKIES_KEY } from '@/lib/constants';
import {
  deleteCookieSnapshotSet,
  listCookieSnapshotSets,
  saveCookieSnapshotSet,
} from '@/lib/cookie-snapshots';
import { errorMessage } from '@/lib/errors';
import type { ImportedCookie } from '@/lib/import';
import { computeToggleRows, loadScopedMap, saveScopedMap, withoutKey } from '@/lib/toggleable';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { CookieSnapshot, CookieSnapshotSet, ToggleRow } from '@/types';

export const cookieKeyOf = (cookie: CookieSnapshot): string => `${cookie.name}\t${cookie.domain}\t${cookie.path}`;

const toSnapshot = (cookie: chrome.cookies.Cookie): CookieSnapshot => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
  sameSite: cookie.sameSite,
  hostOnly: cookie.hostOnly,
  expirationDate: cookie.expirationDate ?? null,
  partitionKey: cookie.partitionKey,
});

const cookieUrl = (cookie: CookieSnapshot, fallbackDomain: string): string => {
  const domain = (cookie.domain || fallbackDomain).replace(/^\./, '');
  return `${cookie.secure ? 'https' : 'http'}://${domain}${cookie.path || '/'}`;
};

const toSetDetails = (cookie: CookieSnapshot, fallbackDomain: string): chrome.cookies.SetDetails => {
  const details: chrome.cookies.SetDetails = {
    url: cookieUrl(cookie, fallbackDomain),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path || '/',
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
  };
  if (!cookie.hostOnly && cookie.domain) details.domain = cookie.domain;
  if (cookie.expirationDate) details.expirationDate = cookie.expirationDate;
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return details;
};

const toRemoveDetails = (cookie: CookieSnapshot, fallbackDomain: string): chrome.cookies.CookieDetails => {
  const details: chrome.cookies.CookieDetails = { url: cookieUrl(cookie, fallbackDomain), name: cookie.name };
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  return details;
};

export interface CookiesController {
  rows: Array<ToggleRow<CookieSnapshot>>;
  error: string | null;
  liveCookies: CookieSnapshot[];
  reload: () => void;
  toggle: (row: ToggleRow<CookieSnapshot>, enabled: boolean) => Promise<void>;
  save: (original: CookieSnapshot | null, next: CookieSnapshot, wasOff: boolean) => Promise<void>;
  remove: (cookie: CookieSnapshot, wasOff: boolean) => Promise<void>;
  removeAll: () => Promise<void>;
  importCookies: (cookies: ImportedCookie[]) => Promise<number>;
  snapshotSets: CookieSnapshotSet[];
  saveSnapshotSet: (name: string) => Promise<void>;
  restoreSnapshotSet: (set: CookieSnapshotSet) => Promise<void>;
  deleteSnapshotSet: (id: string) => Promise<void>;
}

export const useCookies = (activeTab: ActiveTab): CookiesController => {
  const [liveCookies, setLiveCookies] = useState<CookieSnapshot[]>([]);
  const [disabled, setDisabled] = useState<Record<string, CookieSnapshot>>({});
  const [snapshotSets, setSnapshotSets] = useState<CookieSnapshotSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const domain = activeTab.hostname;

  const reload = useCallback(() => {
    if (!activeTab.injectable) {
      setLiveCookies([]);
      setDisabled({});
      setSnapshotSets([]);
      setError('Esta pestaña no tiene cookies http(s) para gestionar.');
      return;
    }

    setError(null);
    void loadScopedMap<CookieSnapshot>(DISABLED_COOKIES_KEY, domain).then(setDisabled);
    void listCookieSnapshotSets(domain).then(setSnapshotSets);
    void chrome.cookies
      .getAll({ url: activeTab.url, partitionKey: {} })
      .catch(() => chrome.cookies.getAll({ url: activeTab.url }))
      .then((cookies) => setLiveCookies(cookies.map(toSnapshot)))
      .catch((cookieError: unknown) => {
        setError(errorMessage(cookieError, 'No se pudieron leer las cookies.'));
        setLiveCookies([]);
      });
  }, [activeTab.injectable, activeTab.url, domain]);

  useEffect(reload, [reload]);

  const persistDisabled = useCallback(
    async (map: Record<string, CookieSnapshot>) => {
      setDisabled(map);
      await saveScopedMap(DISABLED_COOKIES_KEY, domain, map);
    },
    [domain]
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
    async (row: ToggleRow<CookieSnapshot>, enabled: boolean) =>
      runAndReload('No se pudo cambiar la cookie.', async () => {
        if (enabled) {
          await chrome.cookies.set(toSetDetails(row.item, domain));
          await persistDisabled(withoutKey(disabled, row.key));
          return;
        }
        await persistDisabled({ ...disabled, [row.key]: row.item });
        await chrome.cookies.remove(toRemoveDetails(row.item, domain));
      }),
    [disabled, domain, persistDisabled, runAndReload]
  );

  const save = useCallback(
    async (original: CookieSnapshot | null, next: CookieSnapshot, wasOff: boolean) =>
      runAndReload('No se pudo guardar la cookie.', async () => {
        if (wasOff && original) {
          await persistDisabled({ ...withoutKey(disabled, cookieKeyOf(original)), [cookieKeyOf(next)]: next });
          return;
        }

        const identityChanged =
          original !== null &&
          (original.name !== next.name || original.domain !== next.domain || original.path !== next.path);
        if (identityChanged && original) await chrome.cookies.remove(toRemoveDetails(original, domain));
        await chrome.cookies.set(toSetDetails(next, domain));
      }),
    [disabled, domain, persistDisabled, runAndReload]
  );

  const remove = useCallback(
    async (cookie: CookieSnapshot, wasOff: boolean) =>
      runAndReload('No se pudo borrar la cookie.', async () => {
        if (wasOff) {
          await persistDisabled(withoutKey(disabled, cookieKeyOf(cookie)));
          return;
        }
        await chrome.cookies.remove(toRemoveDetails(cookie, domain));
      }),
    [disabled, domain, persistDisabled, runAndReload]
  );

  const removeAll = useCallback(
    async () =>
      runAndReload('No se pudieron borrar las cookies.', async () => {
        await Promise.all(liveCookies.map((cookie) => chrome.cookies.remove(toRemoveDetails(cookie, domain))));
        await persistDisabled({});
      }),
    [domain, liveCookies, persistDisabled, runAndReload]
  );

  const saveSnapshotSet = useCallback(
    async (name: string) =>
      runAndReload('No se pudo guardar el snapshot.', async () => {
        setSnapshotSets(await saveCookieSnapshotSet(domain, name, liveCookies));
      }),
    [domain, liveCookies, runAndReload]
  );

  const deleteSnapshotSet = useCallback(
    async (id: string) =>
      runAndReload('No se pudo borrar el snapshot.', async () => {
        setSnapshotSets(await deleteCookieSnapshotSet(domain, id));
      }),
    [domain, runAndReload]
  );

  const restoreSnapshotSet = useCallback(
    async (set: CookieSnapshotSet) =>
      runAndReload('No se pudo restaurar el snapshot.', async () => {
        await Promise.all(liveCookies.map((cookie) => chrome.cookies.remove(toRemoveDetails(cookie, domain))));
        for (const cookie of set.cookies) {
          await chrome.cookies.set(toSetDetails(cookie, domain));
        }

        const restoredKeys = new Set(set.cookies.map(cookieKeyOf));
        const stillDisabled = Object.fromEntries(
          Object.entries(disabled).filter(([key]) => !restoredKeys.has(key))
        );
        await persistDisabled(stillDisabled);
      }),
    [disabled, domain, liveCookies, persistDisabled, runAndReload]
  );

  const importCookies = useCallback(
    async (cookies: ImportedCookie[]) => {
      let failed = 0;
      for (const cookie of cookies) {
        try {
          await chrome.cookies.set(toSetDetails({ ...cookie, partitionKey: undefined }, domain));
        } catch {
          failed += 1;
        }
      }
      reload();
      return cookies.length - failed;
    },
    [domain, reload]
  );

  return {
    rows: computeToggleRows(liveCookies, disabled, cookieKeyOf).sort((left, right) =>
      left.item.name.localeCompare(right.item.name)
    ),
    error,
    liveCookies,
    reload,
    toggle,
    save,
    remove,
    removeAll,
    importCookies,
    snapshotSets,
    saveSnapshotSet,
    restoreSnapshotSet,
    deleteSnapshotSet,
  };
};
