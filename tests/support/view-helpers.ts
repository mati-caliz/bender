import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { createUserScript } from "@/lib/factories";
import type { ScriptError } from "@/lib/script-errors";
import type { EngineStatus, UserScript, UserScriptsStatus } from "@/types";
import type { FakeChrome } from "./fake-chrome";

export const engineStatusWith = (overrides: Partial<EngineStatus> = {}): EngineStatus => ({
  appliedRuleCount: 0,
  activeProfileCount: 0,
  activeHeaderCount: 0,
  diagnostics: [],
  updatedAt: 0,
  ...overrides,
});

export const userScriptWith = (overrides: Partial<UserScript> = {}): UserScript =>
  createUserScript("javascript", 0, { id: "script-1", name: "Mi script", ...overrides });

export const scriptErrorWith = (overrides: Partial<ScriptError> = {}): ScriptError => ({
  scriptId: "script-1",
  message: "ReferenceError: foo is not defined",
  line: 12,
  tabUrl: "https://app.test/panel",
  at: 1,
  ...overrides,
});

export const userScriptsStatusWith = (overrides: Partial<UserScriptsStatus> = {}): UserScriptsStatus => ({
  supported: true,
  registeredCount: 0,
  error: null,
  ...overrides,
});

export interface CapturedDownload {
  fileName: string;
  blob: Blob;
}

export const captureDownloads = (): CapturedDownload[] => {
  const blobs: Blob[] = [];
  const downloads: CapturedDownload[] = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      blobs.push(blob);
      return `blob:bender/${blobs.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
  click.mockImplementation(() => {
    const anchor = click.mock.contexts.at(-1);
    const blob = blobs.at(-1);
    if (anchor instanceof HTMLAnchorElement && blob !== undefined) {
      downloads.push({ fileName: anchor.download, blob });
    }
  });
  return downloads;
};

const messageTypeOf = (message: unknown): string =>
  typeof message === "object" && message !== null && "type" in message && typeof message.type === "string"
    ? message.type
    : "";

export const answerMessages = (
  sendMessage: FakeChrome["runtime"]["sendMessage"],
  answers: Record<string, () => Promise<unknown>>,
): void => {
  sendMessage.mockImplementation((message) => {
    const answer = answers[messageTypeOf(message)];
    return answer === undefined ? Promise.resolve(undefined) : answer();
  });
};

export const switchLabelled = (text: string): HTMLElement => {
  const toggle = screen.getByText(text).closest("label")?.querySelector("[role=switch]");
  if (!(toggle instanceof HTMLElement)) throw new Error(`No hay un switch para "${text}"`);
  return toggle;
};

export const quickToggleSwitch = (container: HTMLElement): HTMLElement => {
  const toggle = container.querySelector(".quick-toggle [role=switch]");
  if (!(toggle instanceof HTMLElement)) throw new Error("No hay un switch principal");
  return toggle;
};

export const readDownloadedJson = async (download: CapturedDownload | undefined): Promise<unknown> => {
  if (download === undefined) throw new Error("No hubo ninguna descarga");
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(download.blob);
  });
  return JSON.parse(text);
};
