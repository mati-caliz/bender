import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDesignInspector } from "@/ui/hooks/useDesignInspector";
import type { DesignOverlayState } from "@/types";
import { flushPromises, installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor } from "./support/render-ui";
import { EMPTY_DESIGN_AUDIT, injectsFiles } from "./support/ui-hook-fixtures";

const TAB = activeTabFor("https://app.local/home", 11);
const INACTIVE: DesignOverlayState = { active: false, tool: "inspect" };
const UNAVAILABLE = "Abri una pagina http(s) para analizar su diseño.";

let fake: FakeChrome;

beforeEach(() => {
  fake = installFakeChrome();
  fake.scripting.executeScript.mockImplementation((injection) =>
    Promise.resolve(injectsFiles(injection) ? [] : [{ result: EMPTY_DESIGN_AUDIT }]),
  );
});

afterEach(() => {
  cleanup();
});

const commandsSent = (): unknown[] => fake.tabs.sendMessage.mock.calls.map(([, message]) => message);

describe("useDesignInspector without an inspectable tab", () => {
  it("explains that an http page is needed and never touches the tab", async () => {
    const { result } = renderHook(() => useDesignInspector(EMPTY_ACTIVE_TAB));

    expect(result.current.error).toBe(UNAVAILABLE);
    expect(result.current.audit).toBeNull();
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.activate("ruler");
    });
    expect(result.current.error).toBe("Abri una pagina http(s) para usar el inspector.");

    act(() => {
      result.current.runAudit();
    });
    expect(result.current.error).toBe(UNAVAILABLE);

    await act(async () => {
      await result.current.close();
    });
    expect(fake.tabs.sendMessage).not.toHaveBeenCalled();
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("still closes the overlay of a known but non-http tab", async () => {
    const { result } = renderHook(() => useDesignInspector({ ...EMPTY_ACTIVE_TAB, id: 5 }));

    await act(async () => {
      await result.current.close();
    });

    expect(fake.tabs.sendMessage).toHaveBeenCalledWith(5, { channel: "bender-design", type: "close" });
  });
});

describe("useDesignInspector on an http tab", () => {
  it("pings the overlay and audits the page on mount", async () => {
    fake.tabs.sendMessage.mockResolvedValue({ active: true, tool: "spacing" });

    const { result } = renderHook(() => useDesignInspector(TAB));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.audit).toEqual(EMPTY_DESIGN_AUDIT);
    expect(result.current.overlay).toEqual({ active: true, tool: "spacing" });
    expect(result.current.error).toBeNull();
    expect(commandsSent()).toEqual([{ channel: "bender-design", type: "ping" }]);
  });

  it("assumes an inactive overlay when the ping gets no answer or fails", async () => {
    const { result: silent } = renderHook(() => useDesignInspector(TAB));
    fake.tabs.sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist"));
    const { result: failing } = renderHook(() => useDesignInspector(TAB));

    await act(flushPromises);

    expect(silent.current.overlay).toEqual(INACTIVE);
    expect(failing.current.overlay).toEqual(INACTIVE);
  });

  it("injects the overlay script and selects the requested tool", async () => {
    const { result } = renderHook(() => useDesignInspector(TAB));
    await act(flushPromises);
    fake.tabs.sendMessage.mockResolvedValue({ active: true, tool: "ruler" });

    await act(async () => {
      await result.current.activate("ruler");
    });

    expect(fake.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 11, allFrames: false },
      files: ["content/design-overlay.js"],
    });
    expect(commandsSent()).toContainEqual({ channel: "bender-design", type: "set-tool", tool: "ruler" });
    expect(result.current.overlay).toEqual({ active: true, tool: "ruler" });

    fake.tabs.sendMessage.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.activate("inspect");
    });
    expect(result.current.overlay).toEqual(INACTIVE);
  });

  it("reports why the overlay could not be injected", async () => {
    const { result } = renderHook(() => useDesignInspector(TAB));
    await act(flushPromises);
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access a chrome:// URL"));

    await act(async () => {
      await result.current.activate("ruler");
    });
    expect(result.current.error).toBe("Cannot access a chrome:// URL");

    fake.scripting.executeScript.mockRejectedValueOnce("boom");
    await act(async () => {
      await result.current.activate("ruler");
    });
    expect(result.current.error).toBe("No se pudo inyectar el inspector en la pagina.");
  });

  it("closes the overlay even when the page no longer answers", async () => {
    fake.tabs.sendMessage.mockResolvedValue({ active: true, tool: "inspect" });
    const { result } = renderHook(() => useDesignInspector(TAB));
    await waitFor(() => {
      expect(result.current.overlay.active).toBe(true);
    });
    fake.tabs.sendMessage.mockRejectedValue(new Error("desconectada"));

    await act(async () => {
      await result.current.close();
    });

    expect(commandsSent()).toContainEqual({ channel: "bender-design", type: "close" });
    expect(result.current.overlay).toEqual(INACTIVE);
  });

  it("shows audit failures and an empty audit result", async () => {
    fake.scripting.executeScript.mockRejectedValueOnce("boom");
    const { result } = renderHook(() => useDesignInspector(TAB));
    await waitFor(() => {
      expect(result.current.error).toBe("No se pudo analizar la pagina.");
    });
    expect(result.current.audit).toBeNull();
    expect(result.current.loading).toBe(false);

    fake.scripting.executeScript.mockResolvedValueOnce([]);
    act(() => {
      result.current.runAudit();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.audit).toBeNull();

    act(() => {
      result.current.runAudit();
    });
    await waitFor(() => {
      expect(result.current.audit).toEqual(EMPTY_DESIGN_AUDIT);
    });
  });

  it("resets overlay and audit when the user moves to a non-http tab", async () => {
    fake.tabs.sendMessage.mockResolvedValue({ active: true, tool: "ruler" });
    const { result, rerender } = renderHook(({ tab }) => useDesignInspector(tab), {
      initialProps: { tab: TAB },
    });
    await waitFor(() => {
      expect(result.current.audit).toEqual(EMPTY_DESIGN_AUDIT);
    });

    rerender({ tab: { ...EMPTY_ACTIVE_TAB, id: 11, url: "chrome://newtab" } });

    expect(result.current.overlay).toEqual(INACTIVE);
    expect(result.current.audit).toBeNull();
    expect(result.current.error).toBe(UNAVAILABLE);
  });
});
