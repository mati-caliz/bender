import { useState } from "react";
import type { DesignAudit, DesignOverlayState, DesignTool } from "@/types";

const DEFAULT_TOOL: DesignTool = "inspect";
const DEFAULT_FOREGROUND = "#111827";
const DEFAULT_BACKGROUND = "#ffffff";

const firstColorWithRole = (audit: DesignAudit | null, role: "text" | "background"): string | undefined =>
  audit?.colors.find((color) => color.roles.includes(role))?.hex;

export interface DesignViewState {
  tool: DesignTool;
  setTool: (tool: DesignTool) => void;
  foreground: string;
  setForeground: (color: string) => void;
  background: string;
  setBackground: (color: string) => void;
}

const useToolFollowingOverlay = (overlay: DesignOverlayState): [DesignTool, (tool: DesignTool) => void] => {
  const [tool, setTool] = useState<DesignTool>(() => (overlay.active ? overlay.tool : DEFAULT_TOOL));
  const [syncedOverlay, setSyncedOverlay] = useState(overlay);
  if (syncedOverlay.active !== overlay.active || syncedOverlay.tool !== overlay.tool) {
    setSyncedOverlay(overlay);
    if (overlay.active) setTool(overlay.tool);
  }
  return [tool, setTool];
};

export const useDesignViewState = (
  overlay: DesignOverlayState,
  audit: DesignAudit | null,
): DesignViewState => {
  const [tool, setTool] = useToolFollowingOverlay(overlay);
  const [foreground, setForeground] = useState(() => firstColorWithRole(audit, "text") ?? DEFAULT_FOREGROUND);
  const [background, setBackground] = useState(
    () => firstColorWithRole(audit, "background") ?? DEFAULT_BACKGROUND,
  );
  const [syncedAudit, setSyncedAudit] = useState(audit);

  if (syncedAudit !== audit) {
    setSyncedAudit(audit);
    const textColor = firstColorWithRole(audit, "text");
    const backgroundColor = firstColorWithRole(audit, "background");
    if (textColor !== undefined) setForeground(textColor);
    if (backgroundColor !== undefined) setBackground(backgroundColor);
  }

  return { tool, setTool, foreground, setForeground, background, setBackground };
};
