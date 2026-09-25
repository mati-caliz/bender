import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_UI_CONFIG } from "@/lib/constants";
import type { Surface } from "@/ui/components/app-navigation";
import { useDocumentAppearance } from "@/ui/hooks/useDocumentAppearance";
import type { UiConfig } from "@/types";
import { installFakeMatchMedia } from "./support/ui-hook-fixtures";

const NARROW_QUERY = "(max-width: 620px)";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderAppearance = (surface: Surface, ui: UiConfig) =>
  renderHook(
    (props: { surface: Surface; ui: UiConfig }) => {
      useDocumentAppearance(props.surface, props.ui);
    },
    { initialProps: { surface, ui } },
  );

describe("useDocumentAppearance", () => {
  it("publishes surface, density and accent on the document", () => {
    installFakeMatchMedia(() => false);

    renderAppearance("tab", { ...DEFAULT_UI_CONFIG, density: "compact", accent: "#ff0000" });

    expect(document.body.dataset["surface"]).toBe("tab");
    expect(document.body.dataset["density"]).toBe("compact");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff0000");
  });

  it("forces the narrow layout in the popup without watching the viewport", () => {
    const media = installFakeMatchMedia(() => false);

    renderAppearance("popup", { ...DEFAULT_UI_CONFIG, theme: "dark" });

    expect(document.body.dataset["narrow"]).toBe("true");
    expect(media.listFor(NARROW_QUERY)).toBeUndefined();
  });

  it("follows the viewport width in the side panel and stops on unmount", () => {
    const media = installFakeMatchMedia((query) => query === NARROW_QUERY);
    const { unmount } = renderAppearance("panel", { ...DEFAULT_UI_CONFIG, theme: "light" });
    expect(document.body.dataset["narrow"]).toBe("true");

    act(() => {
      media.listFor(NARROW_QUERY)?.change(false);
    });
    expect(document.body.dataset["narrow"]).toBe("false");

    unmount();
    media.listFor(NARROW_QUERY)?.change(true);
    expect(document.body.dataset["narrow"]).toBe("false");
  });

  it("applies an explicit theme as is", () => {
    installFakeMatchMedia(() => true);

    renderAppearance("tab", { ...DEFAULT_UI_CONFIG, theme: "dark" });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("mirrors the system color scheme and reacts when it changes", () => {
    const media = installFakeMatchMedia((query) => query === LIGHT_QUERY);
    const { rerender } = renderAppearance("tab", { ...DEFAULT_UI_CONFIG, theme: "system" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      media.listFor(LIGHT_QUERY)?.change(false);
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    rerender({ surface: "tab", ui: { ...DEFAULT_UI_CONFIG, theme: "light" } });
    media.listFor(LIGHT_QUERY)?.change(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
