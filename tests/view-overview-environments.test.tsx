import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverviewView } from "@/ui/views/OverviewView";
import type { ToolkitState } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { profileWith, stateWith, trafficRuleWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, renderStateful } from "./support/render-ui";
import { engineStatusWith } from "./support/view-helpers";

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderOverview = (initial: ToolkitState) =>
  renderStateful(
    (state, update) => (
      <OverviewView
        state={state}
        update={update}
        status={engineStatusWith()}
        activeTab={EMPTY_ACTIVE_TAB}
        onNavigate={vi.fn()}
      />
    ),
    initial,
  );

const withTwoProfiles = (): ToolkitState =>
  stateWith({
    profiles: [
      profileWith({ id: "local", name: "Local", enabled: true }),
      profileWith({ id: "prod", name: "Prod", enabled: false }),
    ],
    trafficRules: [trafficRuleWith({ kind: "block" }, { id: "block-ads", enabled: true })],
  });

const typeEnvironmentName = (name: string): void => {
  fireEvent.change(screen.getByTitle("Nombre del entorno"), { target: { value: name } });
};

describe("OverviewView environments", () => {
  it("disables saving when there is nothing to capture", () => {
    renderOverview(stateWith({}));

    const saveCurrent = screen.getByRole("button", { name: "Guardar actual" });

    expect(saveCurrent).toHaveProperty("disabled", true);
    expect(saveCurrent.getAttribute("title")).toBe("Crea al menos un perfil o una regla primero");
    expect(screen.getByText(/guardalos con un nombre/)).toBeTruthy();
  });

  it("captures the enabled profiles and rules under a trimmed name", () => {
    const view = renderOverview(withTwoProfiles());

    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));
    const confirm = screen.getByRole("button", { name: "Guardar" });
    expect(confirm).toHaveProperty("disabled", true);

    typeEnvironmentName("  dev  ");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const [environment] = view.currentState().environments;
    expect(environment?.name).toBe("dev");
    expect(environment?.profileIds).toEqual(["local"]);
    expect(environment?.ruleIds).toEqual(["block-ads"]);
    expect(screen.getByText('Entorno "dev" guardado')).toBeTruthy();
    expect(screen.queryByTitle("Nombre del entorno")).toBeNull();
    expect(screen.getByText("activo")).toBeTruthy();
    expect(screen.getByText("1 perfil(es) · 1 regla(s)")).toBeTruthy();
  });

  it("ignores a blank name even if the save handler runs", () => {
    const view = renderOverview(withTwoProfiles());

    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));
    typeEnvironmentName("   ");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(view.currentState().environments).toEqual([]);
    expect(view.updateSpy).not.toHaveBeenCalled();
  });

  it("overwrites an environment saved with the same name and keeps its id", () => {
    const initial = stateWith({
      ...withTwoProfiles(),
      environments: [{ id: "env-dev", name: "dev", profileIds: ["prod"], ruleIds: [] }],
    });
    const view = renderOverview(initial);

    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));
    typeEnvironmentName("dev");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(view.currentState().environments).toEqual([
      { id: "env-dev", name: "dev", profileIds: ["local"], ruleIds: ["block-ads"] },
    ]);
  });

  it("closes the naming row and clears the draft on cancel", () => {
    renderOverview(withTwoProfiles());

    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));
    typeEnvironmentName("staging");
    fireEvent.click(screen.getByTitle("Cancelar"));

    expect(screen.queryByTitle("Nombre del entorno")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));
    expect(screen.getByTitle("Nombre del entorno")).toHaveProperty("value", "");
  });

  it("applies an environment and marks it as the active one", () => {
    const initial = stateWith({
      ...withTwoProfiles(),
      environments: [{ id: "env-prod", name: "prod", profileIds: ["prod"], ruleIds: [] }],
    });
    const view = renderOverview(initial);

    expect(screen.queryByText("activo")).toBeNull();
    fireEvent.click(screen.getByTitle('Aplicar "prod"'));

    const enabledById = Object.fromEntries(
      view.currentState().profiles.map((profile) => [profile.id, profile.enabled]),
    );
    expect(enabledById).toEqual({ local: false, prod: true });
    expect(view.currentState().trafficRules[0]?.enabled).toBe(false);
    expect(screen.getByText('Entorno "prod" aplicado')).toBeTruthy();
    expect(screen.getByTitle("Ya es el estado actual")).toBeTruthy();
    expect(screen.getByText("activo")).toBeTruthy();
  });

  it("deletes an environment", () => {
    const initial = stateWith({
      ...withTwoProfiles(),
      environments: [{ id: "env-prod", name: "prod", profileIds: ["prod"], ruleIds: [] }],
    });
    const view = renderOverview(initial);

    fireEvent.click(screen.getByTitle("Eliminar entorno"));

    expect(view.currentState().environments).toEqual([]);
    expect(screen.queryByText("prod")).toBeNull();
  });
});
