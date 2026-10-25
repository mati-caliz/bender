import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENGINE_STATUS_KEY } from "@/lib/constants";
import { useActiveTab } from "@/ui/hooks/useActiveTab";
import { useEngineStatus } from "@/ui/hooks/useEngineStatus";
import { readPendingImportView, usePendingImport } from "@/ui/hooks/usePendingImport";
import { flushPromises, installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB } from "./support/render-ui";
import { deferred, engineStatusWith, tabWith } from "./support/ui-hook-fixtures";

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("useActiveTab", () => {
  it("describes an http tab as injectable with its origin and hostname", async () => {
    fake.tabs.query.mockResolvedValue([tabWith({ id: 4, url: "https://app.local:8443/login?next=1" })]);

    const { result } = renderHook(() => useActiveTab());

    await waitFor(() => {
      expect(result.current).toEqual({
        id: 4,
        url: "https://app.local:8443/login?next=1",
        origin: "https://app.local:8443",
        hostname: "app.local",
        injectable: true,
      });
    });
    expect(fake.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it("keeps id and url of non-http tabs but marks them as not injectable", async () => {
    fake.tabs.query.mockResolvedValue([tabWith({ id: 9, url: "chrome://extensions" })]);

    const { result } = renderHook(() => useActiveTab());

    await waitFor(() => {
      expect(result.current).toEqual({ ...EMPTY_ACTIVE_TAB, id: 9, url: "chrome://extensions" });
    });
  });

  it("returns the empty tab when there is no tab, no url or no id", async () => {
    fake.tabs.query.mockResolvedValueOnce([]);
    const { result: noTab } = renderHook(() => useActiveTab());
    fake.tabs.query.mockResolvedValueOnce([tabWith({ url: "" })]);
    const { result: noUrl } = renderHook(() => useActiveTab());
    fake.tabs.query.mockResolvedValueOnce([tabWith({ id: undefined })]);
    const { result: noId } = renderHook(() => useActiveTab());

    await act(flushPromises);

    expect(noTab.current).toEqual(EMPTY_ACTIVE_TAB);
    expect(noUrl.current).toEqual(EMPTY_ACTIVE_TAB);
    expect(noId.current).toEqual(EMPTY_ACTIVE_TAB);
  });

  it("drops a tab query that resolves after unmount", async () => {
    const pendingQuery = deferred<chrome.tabs.Tab[]>();
    fake.tabs.query.mockReturnValue(pendingQuery.promise);
    const { result, unmount } = renderHook(() => useActiveTab());
    unmount();

    pendingQuery.resolve([tabWith()]);
    await flushPromises();

    expect(result.current).toEqual(EMPTY_ACTIVE_TAB);
  });

  it("refreshes when the user switches or updates tabs and stops listening on unmount", async () => {
    fake.tabs.query.mockResolvedValue([tabWith({ url: "https://first.local/" })]);
    const { result, unmount } = renderHook(() => useActiveTab());
    await waitFor(() => {
      expect(result.current.hostname).toBe("first.local");
    });

    fake.tabs.query.mockResolvedValue([tabWith({ url: "https://second.local/" })]);
    act(() => {
      fake.tabs.onActivated.emit({ tabId: 8, windowId: 1 });
    });
    await waitFor(() => {
      expect(result.current.hostname).toBe("second.local");
    });

    fake.tabs.query.mockResolvedValue([tabWith({ url: "https://third.local/" })]);
    act(() => {
      fake.tabs.onUpdated.emit(7, { status: "complete" }, tabWith());
    });
    await waitFor(() => {
      expect(result.current.hostname).toBe("third.local");
    });

    unmount();
    expect(fake.tabs.onActivated.listenerCount()).toBe(0);
    expect(fake.tabs.onUpdated.listenerCount()).toBe(0);
  });
});

describe("useEngineStatus", () => {
  it("starts empty and adopts the status answered by the service worker", async () => {
    const status = engineStatusWith({ appliedRuleCount: 5 });
    fake.runtime.sendMessage.mockResolvedValue(status);

    const { result } = renderHook(() => useEngineStatus());

    expect(result.current.appliedRuleCount).toBe(0);
    await waitFor(() => {
      expect(result.current).toEqual(status);
    });
    expect(fake.runtime.sendMessage).toHaveBeenCalledWith({ type: "engine/status" });
  });

  it("ignores malformed answers and a failing service worker", async () => {
    fake.runtime.sendMessage.mockResolvedValueOnce({ unexpected: true });
    const { result: malformed } = renderHook(() => useEngineStatus());
    fake.runtime.sendMessage.mockRejectedValueOnce(new Error("sin service worker"));
    const { result: failing } = renderHook(() => useEngineStatus());

    await act(flushPromises);

    expect(malformed.current.updatedAt).toBe(0);
    expect(failing.current.updatedAt).toBe(0);
  });

  it("follows status updates published in session storage only", async () => {
    const { result, unmount } = renderHook(() => useEngineStatus());
    await act(flushPromises);

    await act(async () => {
      await chrome.storage.local.set({ [ENGINE_STATUS_KEY]: engineStatusWith({ appliedRuleCount: 1 }) });
      await chrome.storage.session.set({ other: engineStatusWith({ appliedRuleCount: 2 }) });
      await chrome.storage.session.set({ [ENGINE_STATUS_KEY]: { broken: true } });
    });
    expect(result.current.appliedRuleCount).toBe(0);

    await act(async () => {
      await chrome.storage.session.set({ [ENGINE_STATUS_KEY]: engineStatusWith({ appliedRuleCount: 9 }) });
    });
    expect(result.current.appliedRuleCount).toBe(9);

    unmount();
    expect(fake.storage.onChanged.listenerCount()).toBe(0);
  });

  it("drops the late answer once the component is gone", async () => {
    const pendingStatus = deferred<unknown>();
    fake.runtime.sendMessage.mockReturnValue(pendingStatus.promise);
    const { result, unmount } = renderHook(() => useEngineStatus());
    unmount();

    pendingStatus.resolve(engineStatusWith());
    await flushPromises();

    expect(result.current.updatedAt).toBe(0);
  });
});

describe("usePendingImport", () => {
  it("opens the import dialog only for the view named in the url", () => {
    window.history.replaceState({}, "", "/?import=cookies");

    expect(readPendingImportView()).toBe("cookies");
    expect(renderHook(() => usePendingImport("cookies")).result.current[0]).toBe(true);
    expect(renderHook(() => usePendingImport("storage")).result.current[0]).toBe(false);
  });

  it("starts closed without the parameter and lets the view toggle it", () => {
    expect(readPendingImportView()).toBeNull();
    const { result } = renderHook(() => usePendingImport("storage"));
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
  });
});
