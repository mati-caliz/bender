import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultState } from "@/lib/constants";
import { SettingsView } from "@/ui/views/SettingsView";
import type { EngineStatus, ToolkitState } from "@/types";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";
import { profileWith, stateWith } from "./support/dnr-fixtures";
import { renderStateful } from "./support/render-ui";
import {
  type CapturedDownload,
  captureDownloads,
  engineStatusWith,
  readDownloadedJson,
  switchLabelled,
} from "./support/view-helpers";

const IMPORT_PLACEHOLDER =
  '[{ "name": "Local", "requestHeaders": [{ "name": "X-Debug", "value": "true" }] }]';

let fakeChrome: FakeChrome;
let downloads: CapturedDownload[];

beforeEach(() => {
  fakeChrome = installFakeChrome();
  downloads = captureDownloads();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderSettings = (initial: ToolkitState = stateWith({}), status: EngineStatus = engineStatusWith()) =>
  renderStateful((state, update) => <SettingsView state={state} update={update} status={status} />, initial);

describe("SettingsView preferences", () => {
  it("changes theme, density and accent", () => {
    const view = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
    fireEvent.click(screen.getByRole("button", { name: "Compacta" }));
    fireEvent.click(screen.getByRole("button", { name: "Acento #10b981" }));

    expect(view.currentState().ui).toMatchObject({ theme: "dark", density: "compact", accent: "#10b981" });
    expect(screen.getByRole("button", { name: "Oscuro" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sets the traffic buffer and body capture", () => {
    const view = renderSettings();

    fireEvent.change(screen.getByLabelText(/^Tamaño del buffer/), { target: { value: "2000" } });
    fireEvent.click(switchLabelled("Guardar los cuerpos de las requests"));

    expect(view.currentState().network).toMatchObject({ maxEntries: 2000, captureBodies: true });

    fireEvent.change(screen.getByLabelText(/^Tamaño del buffer/), { target: { value: "otro" } });
    expect(view.currentState().network.maxEntries).toBe(500);
  });

  it("opens the Chrome shortcuts page", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar atajos" }));

    expect(fakeChrome.tabs.create).toHaveBeenCalledWith({ url: "chrome://extensions/shortcuts" });
  });
});

describe("SettingsView engine", () => {
  it("shows the engine counters and a clean bill of health", () => {
    renderSettings(
      stateWith({}),
      engineStatusWith({ appliedRuleCount: 4, activeProfileCount: 2, activeHeaderCount: 7 }),
    );

    expect(screen.getByText("Sin aplicar todavia")).toBeTruthy();
    expect(screen.getByText("Reglas activas").nextElementSibling?.textContent).toBe("4");
    expect(screen.getByText("Perfiles activos").nextElementSibling?.textContent).toBe("2");
    expect(screen.getByText("Headers activos").nextElementSibling?.textContent).toBe("7");
    expect(screen.getByText("Sin advertencias: todo lo configurado se esta aplicando.")).toBeTruthy();
  });

  it("lists diagnostics and the last time rules were applied", () => {
    const updatedAt = new Date(2026, 8, 25, 14, 30, 5).getTime();
    renderSettings(
      stateWith({}),
      engineStatusWith({
        updatedAt,
        diagnostics: [
          { level: "error", message: "Regex invalida" },
          { level: "warning", message: "Header repetido" },
        ],
      }),
    );

    expect(
      screen.getByText(`Ultima aplicacion: ${new Date(updatedAt).toLocaleTimeString("es-AR")}`),
    ).toBeTruthy();
    expect(screen.getByText("Regex invalida").closest(".notice")?.className).toBe("notice danger");
    expect(screen.getByText("Header repetido").closest(".notice")?.className).toBe("notice warning");
    expect(screen.queryByText(/Sin advertencias/)).toBeNull();
  });

  it("reapplies the rules and confirms with a toast", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Reaplicar" }));

    expect(await screen.findByText("Reglas reaplicadas")).toBeTruthy();
    expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "engine/refresh" });
  });
});

describe("SettingsView backup", () => {
  it("exports the whole state with today's date in the file name", async () => {
    const state = stateWith({ profiles: [profileWith({ id: "local" })] });
    renderSettings(state);

    fireEvent.click(screen.getByRole("button", { name: "Exportar todo" }));

    expect(downloads[0]?.fileName).toBe(`bender-backup-${new Date().toISOString().slice(0, 10)}.json`);
    expect(await readDownloadedJson(downloads[0])).toEqual(state);
    expect(screen.getByText("Backup exportado")).toBeTruthy();
  });

  it("resets everything only after confirming", () => {
    const view = renderSettings(stateWith({ profiles: [profileWith({ id: "local" })] }));

    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    expect(screen.getByText("Esto borra perfiles, reglas y scripts. No se puede deshacer.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(view.currentState().profiles).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer todo" }));

    expect(view.currentState()).toEqual(createDefaultState());
    expect(screen.getByText("Configuracion restablecida")).toBeTruthy();
    expect(screen.queryByText(/No se puede deshacer/)).toBeNull();
  });

  it("imports a backup replacing the whole configuration", () => {
    const view = renderSettings();
    const backup = {
      ...createDefaultState(),
      globalEnabled: false,
      profiles: [profileWith({ id: "restored" })],
    };

    fireEvent.click(screen.getByRole("button", { name: "Importar backup" }));
    expect(screen.queryByRole("button", { name: "Agregar a lo actual" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(IMPORT_PLACEHOLDER), {
      target: { value: JSON.stringify(backup) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    expect(view.currentState().globalEnabled).toBe(false);
    expect(view.currentState().profiles.map((profile) => profile.id)).toEqual(["restored"]);
    expect(screen.getByText("Backup importado")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports a malformed backup and keeps the state", () => {
    const view = renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Importar backup" }));
    fireEvent.change(screen.getByPlaceholderText(IMPORT_PLACEHOLDER), { target: { value: "{no es json" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    expect(screen.getByRole("dialog", { name: "Importar backup" })).toBeTruthy();
    expect(view.updateSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
