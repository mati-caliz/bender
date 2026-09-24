import type { Box, Point } from "@/content/overlay-layout";
import type { DesignTool } from "@/types";

interface OverlayState {
  activeTool: DesignTool;
  hoveredElement: Element | null;
  pinnedElement: Element | null;
  frozen: boolean;
  pointer: Point;
  dragOrigin: Point | null;
  measureBox: Box | null;
}

export const overlayState: OverlayState = {
  activeTool: "inspect",
  hoveredElement: null,
  pinnedElement: null,
  frozen: false,
  pointer: { x: 0, y: 0 },
  dragOrigin: null,
  measureBox: null,
};
