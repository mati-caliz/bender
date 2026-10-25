import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeadersView } from "@/ui/views/HeadersView";
import type { ToolkitState } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, renderStateful } from "./support/render-ui";

const IMPORT_PLACEHOLDER =
  '[{ "name": "Local", "requestHeaders": [{ "name": "X-Debug", "value": "true" }] }]';

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const renderHeaders = (initial: ToolkitState) =>
  renderStateful(
    (state, update) => <HeadersView state={state} update={update} activeTab={EMPTY_ACTIVE_TAB} />,
    initial,
  );

const existing = (): ToolkitState =>
  stateWith({
    profiles: [
      profileWith({ id: "local", name: "Local", requestHeaders: [header("X-Old", "1")] }),
      profileWith({ id: "keep", name: "Keep" }),
    ],
    selectedProfileId: "keep",
  });

const pasteImport = (payload: unknown): void => {
  fireEvent.click(screen.getByRole("button", { name: "Importar" }));
  fireEvent.change(screen.getByPlaceholderText(IMPORT_PLACEHOLDER), {
    target: { value: JSON.stringify(payload) },
  });
};

describe("HeadersView import", () => {
  it("merges imported profiles by id and selects the first one", () => {
    const view = renderHeaders(existing());

    pasteImport([
      { id: "local", name: "Local nuevo", requestHeaders: [{ name: "X-New", value: "2" }] },
      { id: "extra", name: "Extra" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Agregar a lo actual" }));

    const state = view.currentState();
    expect(state.profiles.map((profile) => profile.name)).toEqual(["Local nuevo", "Keep", "Extra"]);
    expect(state.profiles[0]?.requestHeaders.map((entry) => entry.name)).toEqual(["X-New"]);
    expect(state.selectedProfileId).toBe("local");
    expect(screen.getByText("2 perfil(es) importado(s)")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("replaces every profile when asked to", () => {
    const view = renderHeaders(existing());

    pasteImport({ profiles: [{ id: "solo", name: "Solo" }] });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(view.currentState().profiles.map((profile) => profile.id)).toEqual(["solo"]);
    expect(view.currentState().selectedProfileId).toBe("solo");
  });

  it("keeps the dialog open with the parser error", () => {
    const view = renderHeaders(existing());

    pasteImport({ nada: true });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(screen.getByText("El JSON tiene que ser un array de perfiles.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Importar perfiles" })).toBeTruthy();
    expect(view.currentState().profiles).toHaveLength(2);
  });

  it("closes the dialog without touching the profiles", () => {
    const view = renderHeaders(existing());

    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(view.updateSpy).not.toHaveBeenCalled();
  });

  it("opens the dialog right away when the URL asks for a pending headers import", () => {
    window.history.replaceState(null, "", "/?import=headers");

    renderHeaders(stateWith({}));

    expect(screen.getByRole("dialog", { name: "Importar perfiles" })).toBeTruthy();
  });
});
