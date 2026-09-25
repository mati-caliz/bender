import type { DesignAudit, DesignOverlayState, DesignPick } from "@/types";
import type { FakeChrome } from "./fake-chrome";

export const sampleAudit = (overrides: Partial<DesignAudit> = {}): DesignAudit => ({
  elementCount: 120,
  rootFontSize: 16,
  colors: [
    { hex: "#1f2937", count: 40, roles: ["text"] },
    { hex: "#f9fafb", count: 12, roles: ["background", "border"] },
    { hex: "#2563eb", count: 5, roles: ["text", "border"] },
  ],
  fonts: [{ family: '"Inter", system-ui, sans-serif', count: 90, sizes: [14, 16], weights: [400, 700] }],
  spacings: [
    { value: "16px", count: 30 },
    { value: "4px", count: 12 },
    { value: "8px", count: 20 },
  ],
  radii: [
    { value: "8px", count: 6 },
    { value: "2px", count: 3 },
  ],
  shadows: [{ value: "0 1px 2px rgba(0,0,0,.1)", count: 4 }],
  variables: [
    { name: "--brand", value: "#2563eb" },
    { name: "--radius", value: "8px" },
  ],
  ...overrides,
});

export interface DesignPage {
  audit: DesignAudit | null;
  overlay: DesignOverlayState | undefined;
  commands: unknown[];
}

const isFileInjection = (injection: unknown): boolean =>
  typeof injection === "object" && injection !== null && "files" in injection;

const toolOf = (message: unknown): DesignOverlayState["tool"] | null => {
  if (typeof message !== "object" || message === null || !("tool" in message)) return null;
  const tool = message.tool;
  return tool === "inspect" || tool === "ruler" || tool === "spacing" ? tool : null;
};

const typeOf = (message: unknown): unknown =>
  typeof message === "object" && message !== null && "type" in message ? message.type : undefined;

export const installDesignPage = (
  fake: FakeChrome,
  initial: Pick<DesignPage, "audit" | "overlay">,
): DesignPage => {
  const page: DesignPage = { ...initial, commands: [] };
  fake.scripting.executeScript.mockImplementation((injection) =>
    Promise.resolve(isFileInjection(injection) ? [] : [{ result: page.audit }]),
  );
  fake.tabs.sendMessage.mockImplementation((_tabId, message) => {
    page.commands.push(message);
    const tool = toolOf(message);
    if (tool !== null) page.overlay = { active: true, tool };
    if (typeOf(message) === "close") page.overlay = { active: false, tool: "inspect" };
    return Promise.resolve(page.overlay);
  });
  return page;
};

export const pick = (overrides: Partial<DesignPick> = {}): DesignPick => ({
  id: "pick-1",
  kind: "color",
  label: "#2563eb",
  detail: "background de button.primary",
  color: "#2563eb",
  origin: "https://app.example.com",
  createdAt: 1_700_000_000_000,
  ...overrides,
});
