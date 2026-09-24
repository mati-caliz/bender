import { IMPORT_PARAM, SURFACE_PARAM } from "@/lib/constants";
import type { IconName } from "@/ui/components/Icon";
import type { HeaderEntry, ToolkitState } from "@/types";

export type ViewId =
  | "overview"
  | "headers"
  | "rules"
  | "cors"
  | "useragent"
  | "network"
  | "cookies"
  | "storage"
  | "scripts"
  | "design"
  | "settings";

export type Surface = "popup" | "panel" | "tab";

export interface NavEntry {
  id: ViewId;
  label: string;
  icon: IconName;
  group: string;
  count?: (state: ToolkitState) => number;
}

const countActiveHeaders = (headers: HeaderEntry[]): number =>
  headers.filter((header) => header.enabled && header.name.trim() !== "").length;

export const NAV_ENTRIES: NavEntry[] = [
  { id: "overview", label: "Resumen", icon: "bolt", group: "General" },
  {
    id: "headers",
    label: "Headers",
    icon: "layers",
    group: "Red",
    count: (state) =>
      state.profiles
        .filter((profile) => profile.enabled)
        .reduce(
          (total, profile) =>
            total + countActiveHeaders(profile.requestHeaders) + countActiveHeaders(profile.responseHeaders),
          0,
        ),
  },
  {
    id: "rules",
    label: "Reglas",
    icon: "filter",
    group: "Red",
    count: (state) => state.trafficRules.filter((rule) => rule.enabled).length,
  },
  { id: "cors", label: "CORS", icon: "shield", group: "Red" },
  { id: "useragent", label: "User-Agent", icon: "smartphone", group: "Red" },
  { id: "network", label: "Trafico", icon: "activity", group: "Red" },
  { id: "cookies", label: "Cookies", icon: "cookie", group: "Sitio" },
  { id: "storage", label: "Storage", icon: "database", group: "Sitio" },
  {
    id: "scripts",
    label: "Scripts",
    icon: "code",
    group: "Sitio",
    count: (state) => state.userScripts.filter((script) => script.enabled).length,
  },
  { id: "design", label: "Diseño", icon: "ruler", group: "Diseño" },
];

const VIEW_IDS: ViewId[] = [
  "overview",
  "headers",
  "rules",
  "cors",
  "useragent",
  "network",
  "cookies",
  "storage",
  "scripts",
  "design",
  "settings",
];

export const isViewId = (value: string | null): value is ViewId => VIEW_IDS.some((id) => id === value);

export const readSurface = (): Surface => {
  const surface = new URLSearchParams(window.location.search).get(SURFACE_PARAM);
  return surface === "popup" || surface === "panel" ? surface : "tab";
};

export const readPendingImportView = (): ViewId | null => {
  const pending = new URLSearchParams(window.location.search).get(IMPORT_PARAM);
  return isViewId(pending) ? pending : null;
};

export const groupNavEntries = (): [string, NavEntry[]][] => {
  const map = new Map<string, NavEntry[]>();
  for (const entry of NAV_ENTRIES) {
    map.set(entry.group, [...(map.get(entry.group) ?? []), entry]);
  }
  return Array.from(map.entries());
};
