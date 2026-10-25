import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DESIGN_PICKS_KEY, STORAGE_KEY, createDefaultState } from "@/lib/constants";
import { useDesignPicks } from "@/ui/hooks/useDesignPicks";
import { useToolkitState } from "@/ui/hooks/useToolkitState";
import type { DesignPick } from "@/types";
import { flushPromises, installFakeChrome, type FakeChrome } from "./support/fake-chrome";

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
});

afterEach(() => {
  cleanup();
});

const pickWith = (id: string, label: string): DesignPick => ({
  id,
  kind: "color",
  label,
  detail: "rgb(0, 0, 0)",
  color: "#000000",
  origin: "https://app.local",
  createdAt: 1,
});

describe("useToolkitState", () => {
  it("is not ready until the stored state is read", async () => {
    fake.storage.local.data.set(STORAGE_KEY, { ...createDefaultState(), globalEnabled: false });

    const { result } = renderHook(() => useToolkitState());

    expect(result.current.ready).toBe(false);
    expect(result.current.state.globalEnabled).toBe(true);
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.state.globalEnabled).toBe(false);
  });

  it("persists every update to chrome.storage", async () => {
    const { result } = renderHook(() => useToolkitState());
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    act(() => {
      result.current.update((current) => ({ ...current, ui: { ...current.ui, lastView: "cookies" } }));
    });

    expect(result.current.state.ui.lastView).toBe("cookies");
    await waitFor(() => {
      expect(fake.storage.local.data.get(STORAGE_KEY)).toMatchObject({ ui: { lastView: "cookies" } });
    });
  });

  it("follows changes written by other surfaces and unsubscribes on unmount", async () => {
    const { result, unmount } = renderHook(() => useToolkitState());
    await act(flushPromises);

    await act(async () => {
      await chrome.storage.local.set({ [STORAGE_KEY]: { ...createDefaultState(), globalEnabled: false } });
    });
    expect(result.current.state.globalEnabled).toBe(false);

    unmount();
    expect(fake.storage.onChanged.listenerCount()).toBe(0);
  });

  it("ignores a stored state that arrives after unmount", async () => {
    const { result, unmount } = renderHook(() => useToolkitState());
    unmount();
    await flushPromises();

    expect(result.current.ready).toBe(false);
  });
});

describe("useDesignPicks", () => {
  it("loads the stored picks and follows later changes", async () => {
    fake.storage.local.data.set(DESIGN_PICKS_KEY, [pickWith("a", "Primario")]);

    const { result, unmount } = renderHook(() => useDesignPicks());

    await waitFor(() => {
      expect(result.current.picks.map((pick) => pick.label)).toEqual(["Primario"]);
    });

    await act(async () => {
      await chrome.storage.local.set({ [DESIGN_PICKS_KEY]: [pickWith("b", "Fondo")] });
    });
    expect(result.current.picks.map((pick) => pick.id)).toEqual(["b"]);

    unmount();
    expect(fake.storage.onChanged.listenerCount()).toBe(0);
  });

  it("removes a single pick and clears them all through storage", async () => {
    fake.storage.local.data.set(DESIGN_PICKS_KEY, [pickWith("a", "Primario"), pickWith("b", "Fondo")]);
    const { result } = renderHook(() => useDesignPicks());
    await waitFor(() => {
      expect(result.current.picks).toHaveLength(2);
    });

    await act(async () => {
      result.current.remove("a");
      await flushPromises();
    });
    expect(result.current.picks.map((pick) => pick.id)).toEqual(["b"]);
    expect(fake.storage.local.data.get(DESIGN_PICKS_KEY)).toEqual([pickWith("b", "Fondo")]);

    await act(async () => {
      result.current.clear();
      await flushPromises();
    });
    expect(result.current.picks).toEqual([]);
  });
});
