import { act, cleanup, renderHook, waitFor, type RenderHookResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_SNAPSHOTS_KEY, DISABLED_COOKIES_KEY } from "@/lib/constants";
import { cookieKeyOf, useCookies, type CookiesController } from "@/ui/hooks/useCookies";
import type { CookieSnapshot, ToggleRow } from "@/types";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { activeTabFor } from "./support/render-ui";
import { liveCookieWith, snapshotWith } from "./support/ui-hook-fixtures";

const TAB = activeTabFor("https://app.local/home");
const LIVE_SID = snapshotWith({ expirationDate: 2_000_000_000 });

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
  fake.cookies.getAll.mockResolvedValue([liveCookieWith()]);
});

afterEach(() => {
  cleanup();
});

const disabledForDomain = (): unknown => {
  const stored = fake.storage.local.data.get(DISABLED_COOKIES_KEY);
  return typeof stored === "object" && stored !== null ? Object.entries(stored) : [];
};

const renderLoaded = async (): Promise<RenderHookResult<CookiesController, unknown>> => {
  const hook = renderHook(() => useCookies(TAB));
  await waitFor(() => {
    expect(hook.result.current.rows).toHaveLength(1);
  });
  return hook;
};

const firstRow = (controller: CookiesController): ToggleRow<CookieSnapshot> => {
  const [row] = controller.rows;
  if (row === undefined) throw new Error("sin filas");
  return row;
};

describe("useCookies toggle", () => {
  it("parks a cookie in storage and deletes it from the browser when switched off", async () => {
    const { result } = await renderLoaded();
    fake.cookies.getAll.mockResolvedValue([]);

    await act(async () => {
      await result.current.toggle(firstRow(result.current), false);
    });

    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: "https://app.local/", name: "sid" });
    expect(disabledForDomain()).toEqual([["app.local", { [cookieKeyOf(LIVE_SID)]: LIVE_SID }]]);
    await waitFor(() => {
      expect(result.current.rows.map((row) => row.off)).toEqual([true]);
    });
  });

  it("writes the cookie back and forgets the parked copy when switched on", async () => {
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, { "app.local": { [cookieKeyOf(LIVE_SID)]: LIVE_SID } });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.toggle(firstRow(result.current), true);
    });

    expect(fake.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "sid", url: "https://app.local/" }),
    );
    expect(disabledForDomain()).toEqual([]);
  });

  it("reports a failed toggle with the chrome message or a fallback", async () => {
    const { result } = await renderLoaded();
    fake.cookies.set.mockRejectedValueOnce(new Error("Cookie invalida")).mockRejectedValueOnce("boom");

    await act(async () => {
      await result.current.toggle(firstRow(result.current), true);
    });
    expect(result.current.error).toBe("Cookie invalida");

    await act(async () => {
      await result.current.toggle(firstRow(result.current), true);
    });
    expect(result.current.error).toBe("No se pudo cambiar la cookie.");
  });
});

describe("useCookies save and remove", () => {
  it("creates a new cookie without deleting anything", async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.save(null, snapshotWith({ name: "fresh" }), false);
    });

    expect(fake.cookies.remove).not.toHaveBeenCalled();
    expect(fake.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: "fresh" }));
  });

  it("deletes the old cookie first when name, domain or path change", async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.save(LIVE_SID, { ...LIVE_SID, value: "same identity" }, false);
    });
    expect(fake.cookies.remove).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.save(LIVE_SID, { ...LIVE_SID, path: "/api" }, false);
    });
    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: "https://app.local/", name: "sid" });
    expect(fake.cookies.set).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/api" }));
  });

  it("edits a switched-off cookie only in storage", async () => {
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, { "app.local": { [cookieKeyOf(LIVE_SID)]: LIVE_SID } });
    const { result } = await renderLoaded();
    const renamed = { ...LIVE_SID, name: "renamed" };

    await act(async () => {
      await result.current.save(LIVE_SID, renamed, true);
    });

    expect(fake.cookies.set).not.toHaveBeenCalled();
    expect(disabledForDomain()).toEqual([["app.local", { [cookieKeyOf(renamed)]: renamed }]]);
  });

  it("reports a failed save", async () => {
    const { result } = await renderLoaded();
    fake.cookies.set.mockRejectedValue("boom");

    await act(async () => {
      await result.current.save(null, snapshotWith(), false);
    });

    expect(result.current.error).toBe("No se pudo guardar la cookie.");
  });

  it("removes a live cookie from the browser and a parked one from storage", async () => {
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, { "app.local": { [cookieKeyOf(LIVE_SID)]: LIVE_SID } });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.remove(LIVE_SID, true);
    });
    expect(fake.cookies.remove).not.toHaveBeenCalled();
    expect(disabledForDomain()).toEqual([]);

    await act(async () => {
      await result.current.remove(LIVE_SID, false);
    });
    expect(fake.cookies.remove).toHaveBeenCalledTimes(1);
  });

  it("reports a failed removal", async () => {
    const { result } = await renderLoaded();
    fake.cookies.remove.mockRejectedValue("boom");

    await act(async () => {
      await result.current.remove(LIVE_SID, false);
    });
    expect(result.current.error).toBe("No se pudo borrar la cookie.");

    await act(async () => {
      await result.current.removeAll();
    });
    expect(result.current.error).toBe("No se pudieron borrar las cookies.");
  });

  it("removes every live cookie and forgets the parked ones", async () => {
    fake.cookies.getAll.mockResolvedValue([liveCookieWith(), liveCookieWith({ name: "theme" })]);
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, {
      "app.local": { parked: snapshotWith({ name: "parked" }) },
    });
    const { result } = renderHook(() => useCookies(TAB));
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });

    await act(async () => {
      await result.current.removeAll();
    });

    expect(fake.cookies.remove).toHaveBeenCalledTimes(2);
    expect(disabledForDomain()).toEqual([]);
  });
});

describe("useCookies import and snapshots", () => {
  it("imports the cookies it can and counts only the successful ones", async () => {
    const { result } = await renderLoaded();
    fake.cookies.set.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("rechazada"));
    let imported = 0;

    await act(async () => {
      imported = await result.current.importCookies([
        snapshotWith({ name: "one" }),
        snapshotWith({ name: "two" }),
      ]);
    });

    expect(imported).toBe(1);
    expect(fake.cookies.set).toHaveBeenCalledTimes(2);
  });

  it("saves, restores and deletes a snapshot set", async () => {
    const parkedTheme = snapshotWith({ name: "theme" });
    const parkedOther = snapshotWith({ name: "other" });
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, {
      "app.local": { [cookieKeyOf(parkedTheme)]: parkedTheme, [cookieKeyOf(parkedOther)]: parkedOther },
    });
    const { result } = renderHook(() => useCookies(TAB));
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });

    await act(async () => {
      await result.current.saveSnapshotSet("admin");
    });
    expect(result.current.snapshotSets.map((set) => set.name)).toEqual(["admin"]);
    expect(fake.storage.local.data.get(COOKIE_SNAPSHOTS_KEY)).toHaveProperty("app.local");

    const [saved] = result.current.snapshotSets;
    if (saved === undefined) throw new Error("sin snapshot");
    await act(async () => {
      await result.current.restoreSnapshotSet({ ...saved, cookies: [...saved.cookies, parkedTheme] });
    });
    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: "https://app.local/", name: "sid" });
    expect(fake.cookies.set).toHaveBeenCalledWith(expect.objectContaining({ name: "theme" }));
    expect(disabledForDomain()).toEqual([["app.local", { [cookieKeyOf(parkedOther)]: parkedOther }]]);

    await act(async () => {
      await result.current.deleteSnapshotSet(saved.id);
    });
    expect(result.current.snapshotSets).toEqual([]);
  });

  it("reports failures while handling snapshot sets", async () => {
    const { result } = await renderLoaded();
    fake.cookies.remove.mockRejectedValue("boom");

    await act(async () => {
      await result.current.restoreSnapshotSet({ id: "x", name: "x", createdAt: 1, cookies: [] });
    });
    expect(result.current.error).toBe("No se pudo restaurar el snapshot.");

    vi.spyOn(fake.storage.local, "get").mockRejectedValue(new Error("storage caido"));
    await act(async () => {
      await result.current.saveSnapshotSet("admin");
    });
    expect(result.current.error).toBe("storage caido");

    vi.spyOn(fake.storage.local, "get").mockRejectedValue("boom");
    await act(async () => {
      await result.current.deleteSnapshotSet("x");
    });
    expect(result.current.error).toBe("No se pudo borrar el snapshot.");
  });
});
