import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { ScriptsView } from "@/ui/views/ScriptsView";
import type { ToolkitState, UserScript } from "@/types";
import { type FakeChrome, flushPromises, installFakeChrome } from "./support/fake-chrome";
import { stateWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderStateful } from "./support/render-ui";
import {
  answerMessages,
  scriptErrorWith,
  userScriptWith,
  userScriptsStatusWith,
} from "./support/view-helpers";

vi.mock("@/ui/components/CodeMirrorEditor", () => import("./support/view-code-editor-stub"));

let fakeChrome: FakeChrome;

beforeEach(() => {
  fakeChrome = installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderScripts = (scripts: UserScript[] = [], activeTab: ActiveTab = EMPTY_ACTIVE_TAB) =>
  renderStateful(
    (state, update) => <ScriptsView state={state} update={update} activeTab={activeTab} />,
    stateWith({ userScripts: scripts }),
  );

const onlyScript = (state: ToolkitState): UserScript => {
  const [script] = state.userScripts;
  if (script === undefined) throw new Error("No hay scripts");
  return script;
};

const sentTypes = (): unknown[] => fakeChrome.runtime.sendMessage.mock.calls.map(([message]) => message);

describe("ScriptsView status", () => {
  it("syncs userscripts and polls for runtime errors on mount", async () => {
    renderScripts();
    await flushPromises();

    expect(sentTypes()).toEqual(
      expect.arrayContaining([{ type: "userscripts/sync" }, { type: "scripts/errors" }]),
    );
    expect(screen.getByText("Todavia no hay scripts")).toBeTruthy();
  });

  it("explains how to enable the userScripts API when it is missing", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "userscripts/sync": () =>
        Promise.resolve(userScriptsStatusWith({ supported: false, error: "Sin permiso" })),
    });

    renderScripts();

    expect(await screen.findByText(/Chrome no expone/)).toBeTruthy();
    expect(screen.getByText("Sin permiso").closest(".notice")?.className).toBe("notice warning");
  });

  it("survives a failing sync and error poll", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "userscripts/sync": () => Promise.reject(new Error("sin service worker")),
      "scripts/errors": () => Promise.reject(new Error("sin service worker")),
    });

    renderScripts([userScriptWith()]);
    await flushPromises();

    expect(screen.queryByText(/Chrome no expone/)).toBeNull();
    expect(screen.queryByText("error")).toBeNull();
  });

  it("re-registers on demand and reports the outcome", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "userscripts/sync": () => Promise.resolve(userScriptsStatusWith({ registeredCount: 3 })),
    });
    renderScripts();

    fireEvent.click(screen.getByRole("button", { name: "Re-registrar" }));

    const toast = await screen.findByText("3 script(s) registrados");
    expect(toast.getAttribute("data-tone")).toBe("success");
  });

  it("flags the toast as an error when registering fails", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "userscripts/sync": () => Promise.resolve(userScriptsStatusWith({ registeredCount: 0, error: "Boom" })),
    });
    renderScripts();

    fireEvent.click(screen.getByRole("button", { name: "Re-registrar" }));

    const toast = await screen.findByText("0 script(s) registrados");
    expect(toast.getAttribute("data-tone")).toBe("error");
  });
});

describe("ScriptsView list", () => {
  it("creates a script from a template targeting the active site", () => {
    const view = renderScripts([], activeTabFor("https://app.test/login"));

    fireEvent.click(screen.getByRole("button", { name: "Autocompletar login" }));

    const script = onlyScript(view.currentState());
    expect(script).toMatchObject({
      name: "Autocompletar login",
      language: "javascript",
      matches: ["https://app.test/*"],
    });
    expect(screen.getByDisplayValue("Autocompletar login")).toBeTruthy();
    expect(screen.getByText(/Los cambios se registran solos/)).toBeTruthy();
  });

  it("creates a CSS script without patterns when there is no active site", () => {
    const view = renderScripts();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar ruido" }));

    const script = onlyScript(view.currentState());
    expect(script).toMatchObject({ language: "css", matches: [] });
    expect(screen.getByText("CSS", { selector: ".badge" })).toBeTruthy();
    expect(screen.getByText("sin patrones — no se ejecuta")).toBeTruthy();
    expect(screen.getByText("hoja de estilos")).toBeTruthy();
    expect(screen.getByDisplayValue("Mundo de la pagina")).toHaveProperty("disabled", true);
  });

  it("toggles, expands and deletes a script", () => {
    const view = renderScripts([userScriptWith({ matches: ["https://a.test/*", "https://b.test/*"] })]);

    expect(screen.getByText("https://a.test/*, https://b.test/*")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Prender o apagar este script" }));
    expect(onlyScript(view.currentState()).enabled).toBe(false);
    expect(onlyScript(view.currentState()).updatedAt).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Mi script"));
    expect(screen.getByDisplayValue("Mi script")).toBeTruthy();
    fireEvent.click(screen.getByText("Mi script", { selector: ".item-name" }));
    expect(screen.queryByDisplayValue("Mi script")).toBeNull();

    fireEvent.click(screen.getByTitle("Eliminar script"));
    expect(view.currentState().userScripts).toEqual([]);
  });

  it("marks scripts that failed at runtime and clears the errors", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "scripts/errors": () => Promise.resolve([scriptErrorWith()]),
    });
    renderScripts([userScriptWith()]);

    expect(await screen.findByText("error")).toBeTruthy();
    fireEvent.click(screen.getByText("Mi script"));
    expect(screen.getByText("Reventó al ejecutarse")).toBeTruthy();
    expect(screen.getByText("línea 12")).toBeTruthy();
    expect(screen.getByText("ReferenceError: foo is not defined")).toBeTruthy();
    expect(screen.getByText("en https://app.test/panel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(sentTypes()).toContainEqual({ type: "scripts/errors-clear" });
    await waitFor(() => {
      expect(screen.queryByText("Reventó al ejecutarse")).toBeNull();
    });
  });

  it("ignores an error poll that does not return a list", async () => {
    answerMessages(fakeChrome.runtime.sendMessage, {
      "scripts/errors": () => Promise.resolve({ unexpected: true }),
    });
    renderScripts([userScriptWith()]);
    await flushPromises();

    expect(screen.queryByText("error")).toBeNull();
  });
});
