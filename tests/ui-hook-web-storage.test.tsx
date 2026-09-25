import { act, cleanup, renderHook, waitFor, type RenderHookResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DISABLED_STORAGE_KEY } from "@/lib/constants";
import { useWebStorage, type WebStorageController } from "@/ui/hooks/useWebStorage";
import type { StorageArea, StoredItem, ToggleRow } from "@/types";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor } from "./support/render-ui";
import { injectedArgs, runInjectedFunction } from "./support/ui-hook-fixtures";

const TAB = activeTabFor("https://app.local/home");
const LOCAL_SCOPE = "local:https://app.local";

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
  fake.scripting.executeScript.mockImplementation(runInjectedFunction);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

const parkedItems = (scope: string): unknown => {
  const stored = fake.storage.local.data.get(DISABLED_STORAGE_KEY);
  return typeof stored === "object" && stored !== null && scope in stored ? Object.entries(stored) : [];
};

const renderLoaded = async (
  area: StorageArea,
  expectedRows: number,
): Promise<RenderHookResult<WebStorageController, unknown>> => {
  const hook = renderHook(() => useWebStorage(TAB, area));
  await waitFor(() => {
    expect(hook.result.current.rows).toHaveLength(expectedRows);
  });
  return hook;
};

const rowNamed = (controller: WebStorageController, key: string): ToggleRow<StoredItem> => {
  const row = controller.rows.find((candidate) => candidate.key === key);
  if (row === undefined) throw new Error(`sin fila ${key}`);
  return row;
};

describe("useWebStorage loading", () => {
  it("explains that non-http tabs expose no storage and never injects", () => {
    const { result } = renderHook(() => useWebStorage(EMPTY_ACTIVE_TAB, "local"));

    expect(result.current.error).toBe("Esta pestaña no expone storage: abri una pagina http(s).");
    expect(result.current.items).toEqual([]);
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("reads the page items sorted by key together with the parked ones", async () => {
    window.localStorage.setItem("theme", "dark");
    window.localStorage.setItem("auth", "token");
    fake.storage.local.data.set(DISABLED_STORAGE_KEY, {
      [LOCAL_SCOPE]: { flag: { key: "flag", value: "on" }, broken: { key: 1 } },
    });

    const { result } = await renderLoaded("local", 3);

    expect(result.current.rows.map((row) => [row.key, row.off])).toEqual([
      ["auth", false],
      ["flag", true],
      ["theme", false],
    ]);
    expect(result.current.error).toBeNull();
    expect(fake.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: TAB.id }, args: ["local"] }),
    );
  });

  it("reads sessionStorage for the session area", async () => {
    window.sessionStorage.setItem("draft", "hola");

    const { result } = await renderLoaded("session", 1);

    expect(result.current.items).toEqual([{ key: "draft", value: "hola" }]);
  });

  it("treats an empty injection result as an empty storage", async () => {
    fake.scripting.executeScript.mockResolvedValue([]);

    const { result } = renderHook(() => useWebStorage(TAB, "local"));

    await waitFor(() => {
      expect(fake.scripting.executeScript).toHaveBeenCalled();
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("shows why the storage could not be read", async () => {
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access contents of the page"));
    const { result } = renderHook(() => useWebStorage(TAB, "local"));
    await waitFor(() => {
      expect(result.current.error).toBe("Cannot access contents of the page");
    });

    fake.scripting.executeScript.mockRejectedValueOnce("boom");
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.error).toBe("No se pudo leer el storage de la pagina.");
    });
  });

  it("complains when the tab is injectable but has no id", async () => {
    const { result } = renderHook(() => useWebStorage({ ...TAB, id: null }, "local"));

    await waitFor(() => {
      expect(result.current.error).toBe("No hay una pestaña activa.");
    });
  });
});

describe("useWebStorage mutations", () => {
  it("parks an item and removes it from the page when switched off, and restores it back", async () => {
    window.localStorage.setItem("theme", "dark");
    const { result } = await renderLoaded("local", 1);

    await act(async () => {
      await result.current.toggle(rowNamed(result.current, "theme"), false);
    });
    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(parkedItems(LOCAL_SCOPE)).toEqual([[LOCAL_SCOPE, { theme: { key: "theme", value: "dark" } }]]);
    await waitFor(() => {
      expect(rowNamed(result.current, "theme").off).toBe(true);
    });

    await act(async () => {
      await result.current.toggle(rowNamed(result.current, "theme"), true);
    });
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(parkedItems(LOCAL_SCOPE)).toEqual([]);
  });

  it("renames an item by deleting the old key and edits parked items only in storage", async () => {
    window.localStorage.setItem("old", "1");
    fake.storage.local.data.set(DISABLED_STORAGE_KEY, {
      [LOCAL_SCOPE]: { parked: { key: "parked", value: "x" } },
    });
    const { result } = await renderLoaded("local", 2);

    await act(async () => {
      await result.current.save("old", { key: "new", value: "2" }, false);
    });
    expect(window.localStorage.getItem("old")).toBeNull();
    expect(window.localStorage.getItem("new")).toBe("2");

    await act(async () => {
      await result.current.save("new", { key: "new", value: "3" }, false);
      await result.current.save(null, { key: "added", value: "4" }, false);
    });
    expect(window.localStorage.getItem("new")).toBe("3");
    expect(window.localStorage.getItem("added")).toBe("4");

    await act(async () => {
      await result.current.save("parked", { key: "parked2", value: "y" }, true);
    });
    expect(window.localStorage.getItem("parked2")).toBeNull();
    expect(parkedItems(LOCAL_SCOPE)).toEqual([[LOCAL_SCOPE, { parked2: { key: "parked2", value: "y" } }]]);
  });

  it("removes live items from the page and parked items from storage", async () => {
    window.localStorage.setItem("theme", "dark");
    fake.storage.local.data.set(DISABLED_STORAGE_KEY, {
      [LOCAL_SCOPE]: { parked: { key: "parked", value: "x" } },
    });
    const { result } = await renderLoaded("local", 2);

    await act(async () => {
      await result.current.remove({ key: "parked", value: "x" }, true);
      await result.current.remove({ key: "theme", value: "dark" }, false);
    });

    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(parkedItems(LOCAL_SCOPE)).toEqual([]);
    await waitFor(() => {
      expect(result.current.rows).toEqual([]);
    });
  });

  it("writes and deletes session items in sessionStorage", async () => {
    window.sessionStorage.setItem("draft", "hola");
    const { result } = await renderLoaded("session", 1);

    await act(async () => {
      await result.current.save("draft", { key: "renamed", value: "chau" }, false);
    });

    expect(window.sessionStorage.getItem("draft")).toBeNull();
    expect(window.sessionStorage.getItem("renamed")).toBe("chau");
    expect(window.localStorage).toHaveLength(0);
  });

  it("clears the page storage and the parked items of the origin", async () => {
    window.sessionStorage.setItem("one", "1");
    window.sessionStorage.setItem("two", "2");
    fake.storage.local.data.set(DISABLED_STORAGE_KEY, {
      "session:https://app.local": { parked: { key: "parked", value: "x" } },
    });
    const { result } = await renderLoaded("session", 3);

    await act(async () => {
      await result.current.clear();
    });

    expect(window.sessionStorage).toHaveLength(0);
    expect(parkedItems("session:https://app.local")).toEqual([]);
  });

  it("imports what it can and counts only the successful items", async () => {
    const { result } = renderHook(() => useWebStorage(TAB, "local"));
    fake.scripting.executeScript.mockImplementation((injection) =>
      injectedArgs(injection).includes("bad")
        ? Promise.reject(new Error("quota"))
        : runInjectedFunction(injection),
    );
    let imported = 0;

    await act(async () => {
      imported = await result.current.importItems([
        { key: "good", value: "1" },
        { key: "bad", value: "2" },
      ]);
    });

    expect(imported).toBe(1);
    expect(window.localStorage.getItem("good")).toBe("1");
    expect(window.localStorage.getItem("bad")).toBeNull();
  });

  it("reports each failed mutation with its own message", async () => {
    window.localStorage.setItem("theme", "dark");
    const { result } = await renderLoaded("local", 1);
    const row = rowNamed(result.current, "theme");
    fake.scripting.executeScript.mockRejectedValue("boom");

    const failures: [string, () => Promise<void>][] = [
      [
        "No se pudo cambiar el item.",
        async () => {
          await result.current.toggle(row, true);
        },
      ],
      [
        "No se pudo guardar el item.",
        async () => {
          await result.current.save(null, row.item, false);
        },
      ],
      [
        "No se pudo borrar el item.",
        async () => {
          await result.current.remove(row.item, false);
        },
      ],
      [
        "No se pudo vaciar el storage.",
        async () => {
          await result.current.clear();
        },
      ],
    ];
    for (const [message, action] of failures) {
      await act(action);
      expect(result.current.error).toBe(message);
    }
  });
});
