import { PANEL_WIDTH } from "@/content/overlay-layout";

export const OVERLAY_STYLES = `
  .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
    font: 500 11px/1.45 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .box { position: fixed; box-sizing: border-box; }
  .box-margin { background: rgba(246, 178, 107, 0.28); }
  .box-border { background: rgba(255, 229, 153, 0.35); }
  .box-padding { background: rgba(147, 196, 125, 0.38); }
  .box-content { background: rgba(111, 168, 220, 0.45); }
  .outline { position: fixed; box-sizing: border-box; border: 1px solid #6366f1;
    background: rgba(99, 102, 241, 0.1); }
  .outline.pinned { border-style: dashed; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
  .measure-rect { position: fixed; box-sizing: border-box; border: 1px dashed #6366f1;
    background: rgba(99, 102, 241, 0.14); }
  .guide { position: fixed; background: rgba(99, 102, 241, 0.55); }
  .gap { position: fixed; background: rgba(236, 72, 153, 0.9); }
  .tag { position: fixed; padding: 2px 6px; border-radius: 4px; white-space: nowrap; color: #f9fafb;
    background: #111827; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); font-variant-numeric: tabular-nums; }
  .tag.accent { background: #6366f1; }
  .tag.pink { background: #ec4899; }
  .panel { position: fixed; width: ${PANEL_WIDTH}px; max-height: 62vh; overflow: auto; padding: 9px 11px;
    border-radius: 9px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(15, 20, 32, 0.97);
    color: #e5e7eb; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); pointer-events: auto; }
  .panel-title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #fff;
    margin-bottom: 6px; word-break: break-all; }
  .panel-row { display: flex; gap: 10px; justify-content: space-between; padding: 2px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06); }
  .panel-row:first-of-type { border-top: 0; }
  .panel-key { color: #9ca3af; white-space: nowrap; }
  .panel-value { font-family: ui-monospace, 'SF Mono', Menlo, monospace; text-align: right;
    word-break: break-all; color: #f3f4f6; }
  .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px;
    vertical-align: -1px; border: 1px solid rgba(255, 255, 255, 0.4); }
  .hud { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 3px;
    align-items: center; padding: 5px; border-radius: 11px; border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(15, 20, 32, 0.97); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); pointer-events: auto;
    font: 500 11px/1 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .hud button { all: unset; cursor: pointer; padding: 6px 9px; border-radius: 7px; color: #d1d5db; }
  .hud button:hover { background: rgba(255, 255, 255, 0.09); color: #fff; }
  .hud button[data-active='true'] { background: #6366f1; color: #fff; }
  .hud-brand { padding: 0 7px 0 5px; font-weight: 700; color: #818cf8; letter-spacing: 0.02em; }
  .hud-separator { width: 1px; height: 18px; margin: 0 3px; background: rgba(255, 255, 255, 0.12); }
  .hud-hint { padding: 0 6px; color: #6b7280; }
`;
