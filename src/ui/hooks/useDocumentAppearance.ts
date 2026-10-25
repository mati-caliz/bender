import { useEffect } from "react";
import type { Surface } from "@/ui/components/app-navigation";
import type { UiConfig } from "@/types";

const NARROW_BREAKPOINT_PX = 620;

const useSurfaceDataset = (surface: Surface, density: UiConfig["density"]): void => {
  useEffect(() => {
    document.body.dataset["surface"] = surface;
    document.body.dataset["density"] = density;
  }, [surface, density]);
};

// El popup y el panel lateral son angostos: el layout pasa a nav colapsado y filas apiladas.
const useNarrowLayout = (surface: Surface): void => {
  useEffect(() => {
    if (surface === "popup") {
      document.body.dataset["narrow"] = "true";
      return undefined;
    }
    const media = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT_PX}px)`);
    const apply = (): void => {
      document.body.dataset["narrow"] = String(media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
    };
  }, [surface]);
};

const useTheme = (theme: UiConfig["theme"], accent: string): void => {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      const apply = (): void => {
        root.setAttribute("data-theme", media.matches ? "light" : "dark");
      };
      apply();
      media.addEventListener("change", apply);
      return () => {
        media.removeEventListener("change", apply);
      };
    }
    root.setAttribute("data-theme", theme);
    return undefined;
  }, [theme, accent]);
};

export const useDocumentAppearance = (surface: Surface, ui: UiConfig): void => {
  useSurfaceDataset(surface, ui.density);
  useNarrowLayout(surface);
  useTheme(ui.theme, ui.accent);
};
