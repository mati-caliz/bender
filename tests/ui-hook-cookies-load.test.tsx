import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COOKIE_SNAPSHOTS_KEY, DISABLED_COOKIES_KEY } from "@/lib/constants";
import { cookieKeyOf, useCookies } from "@/ui/hooks/useCookies";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor } from "./support/render-ui";
import { liveCookieWith, snapshotWith } from "./support/ui-hook-fixtures";

const TAB = activeTabFor("https://app.local/home");

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
});

afterEach(() => {
  cleanup();
});

describe("useCookies loading", () => {
  it("explains that non-http tabs have no cookies and never queries chrome", () => {
    const { result } = renderHook(() => useCookies(EMPTY_ACTIVE_TAB));

    expect(result.current.error).toBe("Esta pestaña no tiene cookies http(s) para gestionar.");
    expect(result.current.rows).toEqual([]);
    expect(result.current.snapshotSets).toEqual([]);
    expect(fake.cookies.getAll).not.toHaveBeenCalled();
  });

  it("lists live cookies by name next to the ones switched off for the domain", async () => {
    fake.cookies.getAll.mockResolvedValue([
      liveCookieWith({ name: "theme" }),
      liveCookieWith({ name: "auth" }),
    ]);
    const parked = snapshotWith({ name: "parked" });
    const reappeared = snapshotWith({ name: "theme", expirationDate: 2_000_000_000 });
    fake.storage.local.data.set(DISABLED_COOKIES_KEY, {
      "app.local": { [cookieKeyOf(parked)]: parked, [cookieKeyOf(reappeared)]: reappeared, broken: 3 },
      "other.local": { [cookieKeyOf(parked)]: snapshotWith({ name: "foreign" }) },
    });

    const { result } = renderHook(() => useCookies(TAB));

    await waitFor(() => {
      expect(result.current.rows.map((row) => [row.item.name, row.off, row.reappeared])).toEqual([
        ["auth", false, false],
        ["parked", true, false],
        ["theme", false, true],
      ]);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.liveCookies).toHaveLength(2);
  });

  it("loads the snapshot sets saved for the domain", async () => {
    fake.storage.local.data.set(COOKIE_SNAPSHOTS_KEY, {
      "app.local": { set1: { id: "set1", name: "admin", createdAt: 5, cookies: [snapshotWith()] } },
    });

    const { result } = renderHook(() => useCookies(TAB));

    await waitFor(() => {
      expect(result.current.snapshotSets.map((set) => set.name)).toEqual(["admin"]);
    });
  });

  it("shows the chrome error when cookies cannot be read", async () => {
    fake.cookies.getAll.mockRejectedValue(new Error("Sin permiso para app.local"));

    const { result } = renderHook(() => useCookies(TAB));

    await waitFor(() => {
      expect(result.current.error).toBe("Sin permiso para app.local");
    });
    expect(result.current.rows).toEqual([]);
  });

  it("falls back to a generic message for non-Error failures and recovers on reload", async () => {
    fake.cookies.getAll.mockRejectedValue("boom");
    const { result } = renderHook(() => useCookies(TAB));
    await waitFor(() => {
      expect(result.current.error).toBe("No se pudieron leer las cookies.");
    });

    fake.cookies.getAll.mockResolvedValue([liveCookieWith()]);
    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.rows.map((row) => row.item.name)).toEqual(["sid"]);
  });

  it("reloads when the active tab changes and hides data of a non-http tab", async () => {
    fake.cookies.getAll.mockResolvedValue([liveCookieWith()]);
    const { result, rerender } = renderHook(({ tab }) => useCookies(tab), { initialProps: { tab: TAB } });
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    rerender({ tab: activeTabFor("https://other.local/") });
    await waitFor(() => {
      expect(fake.cookies.getAll).toHaveBeenLastCalledWith({ url: "https://other.local/", partitionKey: {} });
    });

    rerender({ tab: EMPTY_ACTIVE_TAB });
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBe("Esta pestaña no tiene cookies http(s) para gestionar.");
  });
});
