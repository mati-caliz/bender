import { useCallback, useEffect, useState } from "react";
import { DISABLED_COOKIES_KEY } from "@/lib/constants";
import {
  deleteCookieSnapshotSet,
  listCookieSnapshotSets,
  saveCookieSnapshotSet,
} from "@/lib/cookie-snapshots";
import { errorMessage } from "@/lib/errors";
import type { ImportedCookie } from "@/lib/import";
import { isCookieSnapshot } from "@/lib/sanitize";
import { computeToggleRows, loadScopedMap, saveScopedMap, withoutKey } from "@/lib/toggleable";
import {
  cookieKeyOf,
  fetchLiveCookies,
  removeCookies,
  toRemoveDetails,
  toSetDetails,
} from "@/ui/hooks/cookie-details";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { CookieSnapshot, CookieSnapshotSet, ToggleRow } from "@/types";

export { cookieKeyOf } from "@/ui/hooks/cookie-details";

const NOT_INJECTABLE_MESSAGE = "Esta pestaña no tiene cookies http(s) para gestionar.";
const NO_COOKIES: CookieSnapshot[] = [];
const NO_DISABLED_COOKIES: Record<string, CookieSnapshot> = {};
const NO_SNAPSHOT_SETS: CookieSnapshotSet[] = [];

export interface CookiesController {
  rows: ToggleRow<CookieSnapshot>[];
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

interface MutationContext {
  domain: string;
  disabled: Record<string, CookieSnapshot>;
  liveCookies: CookieSnapshot[];
  persistDisabled: (map: Record<string, CookieSnapshot>) => Promise<void>;
}

const applyToggle = async (
  context: MutationContext,
  row: ToggleRow<CookieSnapshot>,
  enabled: boolean,
): Promise<void> => {
  if (enabled) {
    await chrome.cookies.set(toSetDetails(row.item, context.domain));
    await context.persistDisabled(withoutKey(context.disabled, row.key));
    return;
  }
  await context.persistDisabled({ ...context.disabled, [row.key]: row.item });
  await chrome.cookies.remove(toRemoveDetails(row.item, context.domain));
};

const applySave = async (
  context: MutationContext,
  original: CookieSnapshot | null,
  next: CookieSnapshot,
  wasOff: boolean,
): Promise<void> => {
  if (wasOff && original) {
    await context.persistDisabled({
      ...withoutKey(context.disabled, cookieKeyOf(original)),
      [cookieKeyOf(next)]: next,
    });
    return;
  }

  const identityChanged =
    original !== null &&
    (original.name !== next.name || original.domain !== next.domain || original.path !== next.path);
  if (identityChanged) await chrome.cookies.remove(toRemoveDetails(original, context.domain));
  await chrome.cookies.set(toSetDetails(next, context.domain));
};

const applyRemove = async (
  context: MutationContext,
  cookie: CookieSnapshot,
  wasOff: boolean,
): Promise<void> => {
  if (wasOff) {
    await context.persistDisabled(withoutKey(context.disabled, cookieKeyOf(cookie)));
    return;
  }
  await chrome.cookies.remove(toRemoveDetails(cookie, context.domain));
};

const applyRestore = async (context: MutationContext, set: CookieSnapshotSet): Promise<void> => {
  await removeCookies(context.liveCookies, context.domain);
  for (const cookie of set.cookies) {
    await chrome.cookies.set(toSetDetails(cookie, context.domain));
  }

  const restoredKeys = new Set(set.cookies.map(cookieKeyOf));
  const stillDisabled = Object.fromEntries(
    Object.entries(context.disabled).filter(([key]) => !restoredKeys.has(key)),
  );
  await context.persistDisabled(stillDisabled);
};

const importAll = async (cookies: ImportedCookie[], domain: string): Promise<number> => {
  let failed = 0;
  for (const cookie of cookies) {
    try {
      await chrome.cookies.set(toSetDetails(cookie, domain));
    } catch {
      failed += 1;
    }
  }
  return cookies.length - failed;
};

export const useCookies = (activeTab: ActiveTab): CookiesController => {
  const [loadedLiveCookies, setLiveCookies] = useState<CookieSnapshot[]>(NO_COOKIES);
  const [loadedDisabled, setDisabled] = useState<Record<string, CookieSnapshot>>(NO_DISABLED_COOKIES);
  const [loadedSnapshotSets, setSnapshotSets] = useState<CookieSnapshotSet[]>(NO_SNAPSHOT_SETS);
  const [loadError, setError] = useState<string | null>(null);
  const domain = activeTab.hostname;
  const injectable = activeTab.injectable;
  const liveCookies = injectable ? loadedLiveCookies : NO_COOKIES;
  const disabled = injectable ? loadedDisabled : NO_DISABLED_COOKIES;
  const snapshotSets = injectable ? loadedSnapshotSets : NO_SNAPSHOT_SETS;
  const error = injectable ? loadError : NOT_INJECTABLE_MESSAGE;

  const reload = useCallback(() => {
    if (!injectable) return;
    void loadScopedMap(DISABLED_COOKIES_KEY, domain, isCookieSnapshot).then(setDisabled);
    void listCookieSnapshotSets(domain).then(setSnapshotSets);
    void fetchLiveCookies(activeTab.url)
      .then((cookies) => {
        setError(null);
        setLiveCookies(cookies);
      })
      .catch((cookieError: unknown) => {
        setError(errorMessage(cookieError, "No se pudieron leer las cookies."));
        setLiveCookies(NO_COOKIES);
      });
  }, [injectable, activeTab.url, domain]);

  useEffect(reload, [reload]);

  const persistDisabled = useCallback(
    async (map: Record<string, CookieSnapshot>) => {
      setDisabled(map);
      await saveScopedMap(DISABLED_COOKIES_KEY, domain, map);
    },
    [domain],
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

  const context: MutationContext = { domain, disabled, liveCookies, persistDisabled };

  return {
    rows: computeToggleRows(liveCookies, disabled, cookieKeyOf).sort((left, right) =>
      left.item.name.localeCompare(right.item.name),
    ),
    error,
    liveCookies,
    reload,
    toggle: async (row, enabled) => {
      await runAndReload("No se pudo cambiar la cookie.", async () => {
        await applyToggle(context, row, enabled);
      });
    },
    save: async (original, next, wasOff) => {
      await runAndReload("No se pudo guardar la cookie.", async () => {
        await applySave(context, original, next, wasOff);
      });
    },
    remove: async (cookie, wasOff) => {
      await runAndReload("No se pudo borrar la cookie.", async () => {
        await applyRemove(context, cookie, wasOff);
      });
    },
    removeAll: async () => {
      await runAndReload("No se pudieron borrar las cookies.", async () => {
        await removeCookies(liveCookies, domain);
        await persistDisabled({});
      });
    },
    importCookies: async (cookies) => {
      const imported = await importAll(cookies, domain);
      reload();
      return imported;
    },
    snapshotSets,
    saveSnapshotSet: async (name) => {
      await runAndReload("No se pudo guardar el snapshot.", async () => {
        setSnapshotSets(await saveCookieSnapshotSet(domain, name, liveCookies));
      });
    },
    restoreSnapshotSet: async (set) => {
      await runAndReload("No se pudo restaurar el snapshot.", async () => {
        await applyRestore(context, set);
      });
    },
    deleteSnapshotSet: async (id) => {
      await runAndReload("No se pudo borrar el snapshot.", async () => {
        setSnapshotSets(await deleteCookieSnapshotSet(domain, id));
      });
    },
  };
};
