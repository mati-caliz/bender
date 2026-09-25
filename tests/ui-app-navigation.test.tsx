import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY, createDefaultState } from "@/lib/constants";
import { App } from "@/ui/App";
import { ToastProvider } from "@/ui/hooks/useToasts";
import type { EngineStatus } from "@/types";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import {
  engineStatusWith,
  installFakeMatchMedia,
  runInjectedFunction,
  tabWith,
} from "./support/ui-hook-fixtures";

let fake: FakeChrome;

const answerFor =
  (status: EngineStatus) =>
  (message: unknown): Promise<unknown> => {
    const type = typeof message === "object" && message !== null && "type" in message ? message.type : null;
    if (type === "engine/status" || type === "engine/refresh") return Promise.resolve(status);
    if (type === "network/list" || type === "scripts/errors") return Promise.resolve([]);
    return Promise.resolve(null);
  };

const storeLastView = (lastView: string): void => {
  const defaults = createDefaultState();
  fake.storage.local.data.set(STORAGE_KEY, { ...defaults, ui: { ...defaults.ui, lastView } });
};

const renderApp = () =>
  render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );

const viewTitle = async (title: string): Promise<HTMLElement> =>
  await screen.findByRole("heading", { level: 1, name: title });

const nav = (): HTMLElement => {
  const element = document.querySelector("nav");
  if (element === null) throw new Error("sin nav");
  return element;
};

const storedLastView = (): unknown => {
  const stored = fake.storage.local.data.get(STORAGE_KEY);
  if (typeof stored !== "object" || stored === null || !("ui" in stored)) return undefined;
  const { ui } = stored;
  return typeof ui === "object" && ui !== null && "lastView" in ui ? ui.lastView : undefined;
};

beforeEach(() => {
  fake = installFakeChrome();
  installFakeMatchMedia(() => false);
  fake.tabs.query.mockResolvedValue([tabWith({ url: "https://app.local/home" })]);
  fake.runtime.sendMessage.mockImplementation(answerFor(engineStatusWith()));
  fake.scripting.executeScript.mockImplementation(runInjectedFunction);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("App view restoration", () => {
  it("reopens the last view saved in the state", async () => {
    storeLastView("cookies");

    renderApp();

    expect(await viewTitle("Cookies")).toBeTruthy();
    expect(within(nav()).getByTitle("Cookies").getAttribute("aria-current")).toBe("true");
  });

  it("falls back to the overview when the saved view is unknown", async () => {
    storeLastView("removed-view");

    renderApp();

    expect(await viewTitle("Resumen")).toBeTruthy();
  });

  it("prefers the view named by a pending import over the saved one", async () => {
    storeLastView("cookies");
    window.history.replaceState({}, "", "/?import=storage");

    renderApp();

    expect(await viewTitle("Storage")).toBeTruthy();
  });

  it("shows the active tab hostname in the top bar", async () => {
    renderApp();

    expect(await screen.findByText("app.local")).toBeTruthy();
  });
});

describe("App navigation", () => {
  it("switches views from the nav and remembers the choice", async () => {
    renderApp();
    await viewTitle("Resumen");

    fireEvent.click(within(nav()).getByTitle("Headers"));

    expect(await viewTitle("Headers")).toBeTruthy();
    await waitFor(() => {
      expect(storedLastView()).toBe("headers");
    });

    fireEvent.click(within(nav()).getByTitle("Ajustes"));
    expect(await viewTitle("Ajustes")).toBeTruthy();
    await waitFor(() => {
      expect(storedLastView()).toBe("settings");
    });
  });

  it.each([
    ["Reglas", "Reglas de trafico"],
    ["CORS", "CORS"],
    ["User-Agent", "User-Agent"],
    ["Trafico", "Trafico"],
    ["Scripts", "Scripts"],
    ["Diseño", "Diseño"],
  ])("opens the %s view from the nav", async (label, title) => {
    renderApp();
    await viewTitle("Resumen");

    fireEvent.click(within(nav()).getByTitle(label));

    expect(await viewTitle(title)).toBeTruthy();
  });

  it("opens the menu with a scrim that closes it again", async () => {
    const { container } = renderApp();
    await viewTitle("Resumen");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    expect(container.querySelector(".layout")?.getAttribute("data-nav-open")).toBe("true");
    const scrim = container.querySelector(".nav-scrim");
    if (scrim === null) throw new Error("sin scrim");
    fireEvent.click(scrim);

    expect(container.querySelector(".nav-scrim")).toBeNull();
    expect(container.querySelector(".layout")?.getAttribute("data-nav-open")).toBe("false");
  });

  it("closes the open menu after navigating", async () => {
    const { container } = renderApp();
    await viewTitle("Resumen");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    fireEvent.click(within(nav()).getByTitle("Storage"));

    expect(await viewTitle("Storage")).toBeTruthy();
    expect(container.querySelector(".nav-scrim")).toBeNull();
  });

  it("toggles the menu from the top bar button", async () => {
    renderApp();
    await viewTitle("Resumen");
    const toggle = screen.getByTitle("Menu");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("App engine errors", () => {
  it("counts only error diagnostics in the top bar badge", async () => {
    fake.runtime.sendMessage.mockImplementation(
      answerFor(
        engineStatusWith({
          diagnostics: [
            { level: "error", message: "Regla invalida" },
            { level: "warning", message: "Header vacio" },
            { level: "error", message: "Otra regla invalida" },
          ],
        }),
      ),
    );

    renderApp();

    expect(await screen.findByText("2 error(es)")).toBeTruthy();
  });

  it("hides the badge when the engine has no errors", async () => {
    fake.runtime.sendMessage.mockImplementation(
      answerFor(engineStatusWith({ diagnostics: [{ level: "warning", message: "Header vacio" }] })),
    );

    renderApp();
    await viewTitle("Resumen");

    expect(screen.queryByText(/error\(es\)/)).toBeNull();
  });
});
