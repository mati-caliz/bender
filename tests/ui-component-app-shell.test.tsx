import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUserScript } from "@/lib/factories";
import { AppNav } from "@/ui/components/AppNav";
import { AppTopbar } from "@/ui/components/AppTopbar";
import type { Surface } from "@/ui/components/app-navigation";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";
import { flushPromises, installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderStateful } from "./support/render-ui";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AppNav", () => {
  it("marks the current view, shows counters and navigates", () => {
    const onNavigate = vi.fn();
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header("X-One", "1"), header("X-Two", "2")] })],
      userScripts: [createUserScript("javascript", 0)],
    });
    const { container } = render(<AppNav navOpen view="headers" state={state} onNavigate={onNavigate} />);

    expect(container.querySelector("nav")?.getAttribute("data-open")).toBe("true");
    expect(screen.getByTitle("Headers").getAttribute("aria-current")).toBe("true");
    expect(screen.getByTitle("Headers").textContent).toContain("2");
    expect(screen.getByTitle("Scripts").textContent).toContain("1");
    expect(screen.getByTitle("Reglas").querySelector(".nav-count")).toBeNull();
    expect(screen.getByText("Sitio")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Cookies"));
    fireEvent.click(screen.getByTitle("Ajustes"));

    expect(onNavigate).toHaveBeenNthCalledWith(1, "cookies");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "settings");
  });

  it("highlights settings when it is the current view", () => {
    render(<AppNav navOpen={false} view="settings" state={stateWith({})} onNavigate={vi.fn()} />);

    expect(screen.getByTitle("Ajustes").getAttribute("aria-current")).toBe("true");
    expect(screen.getByTitle("Resumen").getAttribute("aria-current")).toBe("false");
  });
});

interface TopbarOptions {
  navOpen?: boolean;
  activeTab?: ActiveTab;
  errorCount?: number;
  surface?: Surface;
  globalEnabled?: boolean;
}

const renderTopbar = (options: TopbarOptions = {}) => {
  const onToggleNav = vi.fn();
  const view = renderStateful(
    (state, update) => (
      <AppTopbar
        navOpen={options.navOpen ?? false}
        onToggleNav={onToggleNav}
        activeTab={options.activeTab ?? EMPTY_ACTIVE_TAB}
        errorCount={options.errorCount ?? 0}
        store={{ state, update }}
        surface={options.surface ?? "tab"}
      />
    ),
    stateWith({ globalEnabled: options.globalEnabled ?? true }),
  );
  return { ...view, onToggleNav };
};

describe("AppTopbar", () => {
  let fakeChrome: FakeChrome;
  const closeWindow = vi.fn();

  beforeEach(() => {
    fakeChrome = installFakeChrome();
    closeWindow.mockReset();
    vi.spyOn(window, "close").mockImplementation(closeWindow);
  });

  it("toggles the navigation menu and reflects its state", () => {
    const { onToggleNav } = renderTopbar();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    expect(onToggleNav).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Abrir menu" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("labels the menu button as close when the nav is open", () => {
    renderTopbar({ navOpen: true });

    expect(screen.getByRole("button", { name: "Cerrar menu" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the active domain and the error badge only when relevant", () => {
    const { unmount } = renderTopbar();

    expect(screen.queryByText(/error\(es\)/)).toBeNull();
    expect(document.querySelector(".topbar-domain")).toBeNull();
    unmount();

    renderTopbar({ activeTab: activeTabFor("https://api.example.com/v1"), errorCount: 3 });

    expect(screen.getByText("api.example.com")).toBeTruthy();
    expect(screen.getByTitle("https://api.example.com/v1")).toBeTruthy();
    expect(screen.getByText("3 error(es)")).toBeTruthy();
  });

  it("switches every rule off and on from the master toggle", () => {
    const { currentState } = renderTopbar();

    expect(screen.getByText("Activo")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Prender o apagar todas las reglas (Alt+Shift+T)"));

    expect(currentState().globalEnabled).toBe(false);
    expect(screen.getByText("Apagado")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch"));

    expect(currentState().globalEnabled).toBe(true);
  });

  it("hides the popup shortcuts outside the popup", () => {
    renderTopbar({ surface: "panel" });

    expect(screen.queryByRole("button", { name: "Abrir en el panel lateral" })).toBeNull();
  });

  it("opens the side panel of the current window and closes the popup", async () => {
    renderTopbar({ surface: "popup" });

    fireEvent.click(screen.getByRole("button", { name: "Abrir en el panel lateral" }));
    await flushPromises();

    expect(fakeChrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });

  it("skips the side panel when the window has no id", async () => {
    vi.stubGlobal("chrome", { ...fakeChrome, windows: { getCurrent: () => Promise.resolve({}) } });
    renderTopbar({ surface: "popup" });

    fireEvent.click(screen.getByRole("button", { name: "Abrir en el panel lateral" }));
    await flushPromises();

    expect(fakeChrome.sidePanel.open).not.toHaveBeenCalled();
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });

  it("opens the app in a tab and closes the popup", () => {
    renderTopbar({ surface: "popup" });

    fireEvent.click(screen.getByRole("button", { name: "Abrir en una pestaña" }));

    expect(fakeChrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://bender-test/index.html?surface=tab",
    });
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });
});
