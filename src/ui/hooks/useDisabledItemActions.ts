import { useCallback } from "react";
import { errorMessage } from "@/lib/errors";
import { saveScopedMap } from "@/lib/toggleable";

interface DisabledItemState<TItem> {
  storageKey: string;
  scope: string;
  setDisabled: (map: Record<string, TItem>) => void;
  setError: (message: string) => void;
  reload: () => void;
}

export interface DisabledItemActions<TItem> {
  persistDisabled: (map: Record<string, TItem>) => Promise<void>;
  runAndReload: (fallbackMessage: string, action: () => Promise<void>) => Promise<void>;
}

/** Guardar lo apagado de un sitio y correr una acción que, si sale bien, vuelve a leer la pestaña. */
export const useDisabledItemActions = <TItem>({
  storageKey,
  scope,
  setDisabled,
  setError,
  reload,
}: DisabledItemState<TItem>): DisabledItemActions<TItem> => {
  const persistDisabled = useCallback(
    async (map: Record<string, TItem>) => {
      setDisabled(map);
      await saveScopedMap(storageKey, scope, map);
    },
    [setDisabled, storageKey, scope],
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
    [reload, setError],
  );

  return { persistDisabled, runAndReload };
};
