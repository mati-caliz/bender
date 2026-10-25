import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeadersView } from "@/ui/views/HeadersView";
import type { ToolkitState } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";
import { activeTabFor, renderStateful } from "./support/render-ui";
import {
  type CapturedDownload,
  captureDownloads,
  readDownloadedJson,
  switchLabelled,
} from "./support/view-helpers";

let downloads: CapturedDownload[];

beforeEach(() => {
  installFakeChrome();
  downloads = captureDownloads();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderHeaders = (initial: ToolkitState) =>
  renderStateful(
    (state, update) => (
      <HeadersView state={state} update={update} activeTab={activeTabFor("https://app.test/")} />
    ),
    initial,
  );

const twoProfiles = (): ToolkitState =>
  stateWith({
    profiles: [
      profileWith({ id: "local", name: "Local dev", requestHeaders: [header("X-Debug", "1")] }),
      profileWith({ id: "prod", name: "Prod", enabled: false }),
    ],
    selectedProfileId: "local",
    environments: [{ id: "env", name: "dev", profileIds: ["local", "prod"], ruleIds: [] }],
  });

describe("HeadersView profiles", () => {
  it("creates the first profile from the empty state", () => {
    const view = renderHeaders(stateWith({}));

    expect(screen.getByText("Todavia no hay perfiles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar todos" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("Valores dinamicos")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Crear el primero" }));

    const [profile] = view.currentState().profiles;
    expect(profile?.name).toBe("Perfil 1");
    expect(view.currentState().selectedProfileId).toBe(profile?.id);
    expect(screen.getByDisplayValue("Perfil 1")).toBeTruthy();
    expect(screen.getByText("Valores dinamicos")).toBeTruthy();
  });

  it("adds and selects profiles from the rail", () => {
    const view = renderHeaders(twoProfiles());

    expect(screen.getByTitle("Local dev · todas las requests").textContent).toBe("LD");
    fireEvent.click(screen.getByTitle("Prod · todas las requests"));
    expect(view.currentState().selectedProfileId).toBe("prod");
    expect(screen.getByDisplayValue("Prod")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Nuevo perfil"));

    expect(view.currentState().profiles).toHaveLength(3);
    expect(view.currentState().selectedProfileId).toBe(view.currentState().profiles[2]?.id);
    expect(screen.getByDisplayValue("Perfil 3")).toBeTruthy();
  });

  it("falls back to the first profile and shows a placeholder avatar for blank names", () => {
    renderHeaders(
      stateWith({ profiles: [profileWith({ id: "blank", name: "   " })], selectedProfileId: "gone" }),
    );

    expect(screen.getByText("?").getAttribute("title")).toBe("    · todas las requests");
    expect(screen.getByText("Sin headers de request")).toBeTruthy();
  });

  it("edits name, color and switch of the selected profile", () => {
    const view = renderHeaders(twoProfiles());

    fireEvent.change(screen.getByDisplayValue("Local dev"), { target: { value: "Local" } });
    fireEvent.change(screen.getByTitle("Color del perfil"), { target: { value: "#ff0000" } });
    fireEvent.click(screen.getByRole("switch", { name: "Prender o apagar este perfil" }));

    const edited = view.currentState().profiles[0];
    expect(edited?.name).toBe("Local");
    expect(edited?.color).toBe("#ff0000");
    expect(edited?.enabled).toBe(false);
    expect(view.currentState().profiles[1]?.name).toBe("Prod");
  });

  it("duplicates the selected profile and selects the copy", () => {
    const view = renderHeaders(twoProfiles());

    fireEvent.click(screen.getByTitle("Duplicar perfil"));

    const copy = view.currentState().profiles[2];
    expect(copy?.name).toBe("Local dev (copia)");
    expect(copy?.id).not.toBe("local");
    expect(copy?.requestHeaders).toEqual(view.currentState().profiles[0]?.requestHeaders);
    expect(view.currentState().selectedProfileId).toBe(copy?.id);
  });

  it("asks before deleting and forgets the profile from environments", () => {
    const view = renderHeaders(twoProfiles());

    fireEvent.click(screen.getByTitle("Eliminar perfil"));
    expect(screen.getByText('Eliminar el perfil "Local dev" y sus headers?')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(view.currentState().profiles).toHaveLength(2);
    expect(screen.queryByText(/Eliminar el perfil/)).toBeNull();

    fireEvent.click(screen.getByTitle("Eliminar perfil"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    const state = view.currentState();
    expect(state.profiles.map((profile) => profile.id)).toEqual(["prod"]);
    expect(state.selectedProfileId).toBe("prod");
    expect(state.environments[0]?.profileIds).toEqual(["prod"]);
    expect(screen.getByText("Perfil eliminado")).toBeTruthy();
  });

  it("leaves no selection after deleting the last profile", () => {
    const view = renderHeaders(stateWith({ profiles: [profileWith({ id: "only" })] }));

    fireEvent.click(screen.getByTitle("Eliminar perfil"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(view.currentState().selectedProfileId).toBeNull();
    expect(screen.getByText("Todavia no hay perfiles")).toBeTruthy();
  });

  it("exports one profile or all of them as JSON", async () => {
    renderHeaders(twoProfiles());

    fireEvent.click(screen.getByTitle("Exportar solo este perfil"));
    fireEvent.click(screen.getByRole("button", { name: "Exportar todos" }));

    expect(downloads.map((download) => download.fileName)).toEqual([
      "bender-perfil-local-dev.json",
      "bender-perfiles.json",
    ]);
    const single = await readDownloadedJson(downloads[0]);
    const all = await readDownloadedJson(downloads[1]);
    expect(single).toMatchObject([{ id: "local", name: "Local dev" }]);
    expect(all).toMatchObject([{ id: "local" }, { id: "prod" }]);
    expect(screen.getByText('Perfil "Local dev" exportado')).toBeTruthy();
    expect(screen.getByText("Perfiles exportados")).toBeTruthy();
  });

  it("edits the scope of the selected profile", () => {
    const view = renderHeaders(twoProfiles());

    expect(screen.queryByText("Solo la pestaña activa")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Alcance" }));
    fireEvent.click(switchLabelled("Solo la pestaña activa"));

    expect(view.currentState().profiles[0]?.scope.activeTabOnly).toBe(true);
    expect(screen.getByText("solo pestaña activa").className).toBe("badge accent");

    fireEvent.click(screen.getByRole("button", { name: "Alcance" }));
    expect(screen.queryByText("Solo la pestaña activa")).toBeNull();
  });

  it("switches between request and response headers", () => {
    renderHeaders(twoProfiles());

    expect(screen.getByDisplayValue("X-Debug")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Response (0)" }));

    expect(screen.getByText("Sin headers de response")).toBeTruthy();
    expect(screen.queryByDisplayValue("X-Debug")).toBeNull();
    expect(screen.getByRole("button", { name: "Response (0)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Request (1)" }));
    expect(screen.getByDisplayValue("X-Debug")).toBeTruthy();
  });
});
