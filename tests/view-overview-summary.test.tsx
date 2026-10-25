import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewId } from "@/ui/App";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { OverviewView } from "@/ui/views/OverviewView";
import type { EngineStatus, ToolkitState } from "@/types";
import { type FakeChrome, installFakeChrome } from "./support/fake-chrome";
import { header, profileWith, stateWith, trafficRuleWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderStateful } from "./support/render-ui";
import { engineStatusWith, userScriptWith } from "./support/view-helpers";

let fakeChrome: FakeChrome;

beforeEach(() => {
  fakeChrome = installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface OverviewOptions {
  status?: EngineStatus;
  activeTab?: ActiveTab;
}

const renderOverview = (initial: ToolkitState, options: OverviewOptions = {}) => {
  const onNavigate = vi.fn<(view: ViewId) => void>();
  const view = renderStateful(
    (state, update) => (
      <OverviewView
        state={state}
        update={update}
        status={options.status ?? engineStatusWith()}
        activeTab={options.activeTab ?? EMPTY_ACTIVE_TAB}
        onNavigate={onNavigate}
      />
    ),
    initial,
  );
  return { ...view, onNavigate };
};

const statValue = (label: string): string | null =>
  screen.getByText(label).parentElement?.querySelector(".stat-value")?.textContent ?? null;

describe("OverviewView summary", () => {
  it("warns when Bender is off and lists engine diagnostics", () => {
    renderOverview(stateWith({ globalEnabled: false }), {
      status: engineStatusWith({
        diagnostics: [
          { level: "error", message: "Regla rota" },
          { level: "warning", message: "Header dudoso" },
        ],
      }),
    });

    expect(screen.getByText(/Bender esta apagado/)).toBeTruthy();
    expect(screen.getByText("Regla rota").closest(".notice")?.className).toBe("notice danger");
    expect(screen.getByText("Header dudoso").closest(".notice")?.className).toBe("notice warning");
    expect(screen.getByText("Abri una pagina http(s) para ver el detalle")).toBeTruthy();
    expect(screen.getByText("sin pestaña http(s)")).toBeTruthy();
    expect(screen.getByText("sin URL")).toBeTruthy();
  });

  it("counts active rules, profiles and mocks", () => {
    const state = stateWith({
      profiles: [profileWith({ id: "on" }), profileWith({ id: "off", enabled: false })],
      trafficRules: [
        trafficRuleWith(
          { kind: "mock", status: 200, contentType: "text/plain", body: "", delayMs: 0, headers: [] },
          { id: "mock-on" },
        ),
        trafficRuleWith(
          { kind: "mock", status: 200, contentType: "text/plain", body: "", delayMs: 0, headers: [] },
          { id: "mock-off", enabled: false },
        ),
        trafficRuleWith({ kind: "block" }, { id: "block-on" }),
      ],
    });

    renderOverview(state, {
      status: engineStatusWith({ appliedRuleCount: 9 }),
      activeTab: activeTabFor("https://app.test/home"),
    });

    expect(statValue("Reglas activas")).toBe("9");
    expect(statValue("Perfiles activos")).toBe("1/2");
    expect(statValue("Mocks activos")).toBe("1");
    expect(screen.getByText("Estado actual sobre app.test")).toBeTruthy();
    expect(screen.getByText("sobre app.test")).toBeTruthy();
  });

  it("asks the engine to reapply the rules", () => {
    renderOverview(stateWith({}));

    fireEvent.click(screen.getByRole("button", { name: "Reaplicar" }));

    expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "engine/refresh" });
  });

  it("lists the headers that apply to the active tab", () => {
    const state = stateWith({
      profiles: [
        profileWith({
          name: "Local",
          requestHeaders: [header("X-Debug", "1")],
          responseHeaders: [header("X-Frame-Options", "", { operation: "remove" })],
        }),
      ],
    });

    renderOverview(state, { activeTab: activeTabFor("https://app.test/home") });

    expect(statValue("Headers efectivos")).toBe("2");
    expect(screen.getByText("https://app.test/home")).toBeTruthy();
    expect(screen.getByText("X-Debug").parentElement?.textContent).toBe("X-Debug: 1");
    expect(screen.getByText("X-Frame-Options").parentElement?.textContent).toBe(
      "X-Frame-Options — eliminado",
    );
    expect(screen.getByText("request")).toBeTruthy();
    expect(screen.getByText("response")).toBeTruthy();
    expect(screen.getAllByText("Local")).toHaveLength(2);
  });

  it("navigates to the headers view from the empty state and the edit action", () => {
    const { onNavigate } = renderOverview(stateWith({}), { activeTab: activeTabFor("https://app.test/") });

    expect(screen.getByText("Ningun header aplica aca")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Headers" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(onNavigate.mock.calls).toEqual([["headers"], ["headers"]]);
  });
});

describe("OverviewView quick toggles", () => {
  it("turns CORS, User-Agent and the traffic logger on", () => {
    const view = renderOverview(stateWith({}));

    expect(screen.getByText("Sin tocar los headers de CORS")).toBeTruthy();
    expect(screen.getByText("Usando el del navegador")).toBeTruthy();
    expect(screen.getByText("Apagado (cero overhead)")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "CORS abierto" }));
    fireEvent.click(screen.getByRole("switch", { name: "User-Agent" }));
    fireEvent.click(screen.getByRole("switch", { name: "Logger de trafico" }));

    const state = view.currentState();
    expect(state.cors.enabled).toBe(true);
    expect(state.userAgent.enabled).toBe(true);
    expect(state.network.enabled).toBe(true);
    expect(screen.getByText("Respuestas con Access-Control-Allow-*")).toBeTruthy();
    expect(screen.getByText(state.userAgent.value.slice(0, 46))).toBeTruthy();
    expect(screen.getByText("Grabando requests y reglas aplicadas")).toBeTruthy();
  });

  it("switches every userscript at once", () => {
    const state = stateWith({
      userScripts: [
        userScriptWith({ id: "one", enabled: true }),
        userScriptWith({ id: "two", enabled: false }),
      ],
    });
    const view = renderOverview(state);

    expect(screen.getByText("1 activo(s) de 2")).toBeTruthy();
    const toggle = screen.getByRole("switch", { name: "Userscripts" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);

    expect(view.currentState().userScripts.map((script) => script.enabled)).toEqual([false, false]);
    expect(screen.getByText("0 activo(s) de 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Userscripts" }));

    expect(view.currentState().userScripts.map((script) => script.enabled)).toEqual([true, true]);
  });

  it("opens the configuration of each quick toggle", () => {
    const { onNavigate } = renderOverview(stateWith({}));

    for (const button of screen.getAllByTitle("Configurar")) fireEvent.click(button);

    expect(onNavigate.mock.calls).toEqual([["cors"], ["useragent"], ["network"], ["scripts"]]);
  });
});
