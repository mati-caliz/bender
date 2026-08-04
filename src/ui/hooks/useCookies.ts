import { useCallback, useEffect, useState } from 'react';
import { DISABLED_COOKIES_KEY } from '@/lib/constants';
import type { ImportedCookie } from '@/lib/import';
import { computeToggleRows, loadDisabledMap, saveDisabledMap } from '@/lib/toggleable';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { ToggleRow } from '@/types';

export interface CookieSnapshot {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: chrome.cookies.SameSiteStatus;
  hostOnly: boolean;
  expirationDate: number | null;
  partitionKey?: chrome.cookies.CookiePartitionKey;
}

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
}

export const useCookies = (activeTab: ActiveTab): CookiesController => {
  const [liveCookies, setLiveCookies] = useState<CookieSnapshot[]>([]);
  const [disabled, setDisabled] = useState<Record<string, CookieSnapshot>>({});
  const [error, setError] = useState<string | null>(null);
  const domain = activeTab.hostname;

  const reload = useCallback(() => {
    if (!activeTab.injectable) {
      setLiveCookies([]);
      setDisabled({});
      setError('Esta pestaña no tiene cookies http(s) para gestionar.');
      return;
    }

    setError(null);
    void loadDisabledMap<CookieSnapshot>(DISABLED_COOKIES_KEY, domain).then(setDisabled);
    void chrome.cookies
      .getAll({ url: activeTab.url, partitionKey: {} })
      .catch(() => chrome.cookies.getAll({ url: activeTab.url }))
      .then((cookies) => setLiveCookies(cookies.map(toSnapshot)))
      .catch((cookieError: unknown) => {
        setError(cookieError instanceof Error ? cookieError.message : 'No se pudieron leer las cookies.');
        setLiveCookies([]);
      });
  }, [activeTab.injectable, activeTab.url, domain]);

  useEffect(reload, [reload]);

  const persistDisabled = useCallback(
    async (map: Record<string, CookieSnapshot>) => {
      setDisabled(map);
      await saveDisabledMap(DISABLED_COOKIES_KEY, domain, map);
    },
    [domain]
  );

  const toggle = useCallback(
    async (row: ToggleRow<CookieSnapshot>, enabled: boolean) => {
      try {
        if (enabled) {
          await chrome.cookies.set(toSetDetails(row.item, domain));
          const next = { ...disabled };
          delete next[row.key];
          await persistDisabled(next);
        } else {
          await persistDisabled({ ...disabled, [row.key]: row.item });
          await chrome.cookies.remove(toRemoveDetails(row.item, domain));
        }
        reload();
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : 'No se pudo cambiar la cookie.');
      }
    },
    [disabled, domain, persistDisabled, reload]
  );

  const save = useCallback(
    async (original: CookieSnapshot | null, next: CookieSnapshot, wasOff: boolean) => {
      try {
        if (wasOff && original) {
          const map = { ...disabled };
          delete map[cookieKeyOf(original)];
          map[cookieKeyOf(next)] = next;
          await persistDisabled(map);
          reload();
          return;
        }

        const identityChanged =
          original !== null &&
          (original.name !== next.name || original.domain !== next.domain || original.path !== next.path);
        if (identityChanged && original) await chrome.cookies.remove(toRemoveDetails(original, domain));
        await chrome.cookies.set(toSetDetails(next, domain));
        reload();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la cookie.');
      }
    },
    [disabled, domain, persistDisabled, reload]
  );

  const remove = useCallback(
    async (cookie: CookieSnapshot, wasOff: boolean) => {
      try {
        if (wasOff) {
          const map = { ...disabled };
          delete map[cookieKeyOf(cookie)];
          await persistDisabled(map);
        } else {
          await chrome.cookies.remove(toRemoveDetails(cookie, domain));
        }
        reload();
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : 'No se pudo borrar la cookie.');
      }
    },
    [disabled, domain, persistDisabled, reload]
  );

  const removeAll = useCallback(async () => {
    try {
      await Promise.all(liveCookies.map((cookie) => chrome.cookies.remove(toRemoveDetails(cookie, domain))));
      await persistDisabled({});
      reload();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudieron borrar las cookies.');
    }
  }, [domain, liveCookies, persistDisabled, reload]);

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
  };
};
