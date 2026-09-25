import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { ScriptsView } from "@/ui/views/ScriptsView";
import type { ToolkitState, UserScript } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { stateWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderStateful } from "./support/render-ui";
import { userScriptWith } from "./support/view-helpers";

vi.mock("@/ui/components/CodeMirrorEditor", () => import("./support/view-code-editor-stub"));

const TAMPERMONKEY_CODE = [
  "// ==UserScript==",
  "// @name Nuevo nombre",
  "// @description Hace cosas",
  "// @match https://site.test/*",
  "// @exclude https://site.test/admin/*",
  "// @run-at document-start",
  "// ==/UserScript==",
  "console.log(1);",
].join("\n");

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderExpanded = (script: UserScript, activeTab: ActiveTab = EMPTY_ACTIVE_TAB) => {
  const view = renderStateful(
    (state, update) => <ScriptsView state={state} update={update} activeTab={activeTab} />,
    stateWith({ userScripts: [script] }),
  );
  fireEvent.click(screen.getByText(script.name, { selector: ".item-name" }));
  return view;
};

const onlyScript = (state: ToolkitState): UserScript => {
  const [script] = state.userScripts;
  if (script === undefined) throw new Error("No hay scripts");
  return script;
};

const PATTERN_PLACEHOLDER = "https://*.midominio.com/*";

describe("ScriptForm fields", () => {
  it("edits name and description", () => {
    const view = renderExpanded(userScriptWith());

    fireEvent.change(screen.getByDisplayValue("Mi script"), { target: { value: "Login" } });
    fireEvent.change(screen.getByLabelText("Descripcion"), { target: { value: "Rellena el form" } });

    expect(onlyScript(view.currentState())).toMatchObject({ name: "Login", description: "Rellena el form" });
  });

  it("changes when and where the script runs", () => {
    const view = renderExpanded(userScriptWith());

    fireEvent.change(screen.getByLabelText("Momento"), { target: { value: "document_start" } });
    fireEvent.change(screen.getByLabelText(/^Contexto/), { target: { value: "USER_SCRIPT" } });
    fireEvent.click(screen.getByLabelText("Tambien en iframes"));

    expect(onlyScript(view.currentState())).toMatchObject({
      runAt: "document_start",
      world: "USER_SCRIPT",
      allFrames: true,
    });
  });

  it("ignores select values outside the known options", () => {
    const view = renderExpanded(userScriptWith());

    fireEvent.change(screen.getByLabelText("Momento"), { target: { value: "never" } });
    fireEvent.change(screen.getByLabelText(/^Contexto/), { target: { value: "ISOLATED" } });

    expect(view.updateSpy).not.toHaveBeenCalled();
  });

  it("edits the code and counts its lines", async () => {
    const view = renderExpanded(userScriptWith({ code: "" }));

    expect(screen.getByText("1 lineas")).toBeTruthy();
    expect(screen.getByText("modulo clasico")).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Editor javascript"), { target: { value: "a();\nb();" } });

    expect(onlyScript(view.currentState()).code).toBe("a();\nb();");
    expect(screen.getByText("2 lineas")).toBeTruthy();
  });
});

describe("ScriptPatternsField", () => {
  it("adds typed patterns, skipping duplicates, and clears the draft", () => {
    const view = renderExpanded(userScriptWith({ matches: ["https://a.test/*"] }));

    const addButton = screen.getByRole("button", { name: "Agregar" });
    expect(addButton).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByPlaceholderText(PATTERN_PLACEHOLDER), {
      target: { value: "https://a.test/*, https://*.b.test/*" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(onlyScript(view.currentState()).matches).toEqual(["https://a.test/*", "https://*.b.test/*"]);
    expect(screen.getByPlaceholderText(PATTERN_PLACEHOLDER)).toHaveProperty("value", "");
  });

  it("rejects an invalid pattern with a toast", () => {
    const view = renderExpanded(userScriptWith());

    fireEvent.change(screen.getByPlaceholderText(PATTERN_PLACEHOLDER), {
      target: { value: "sin-esquema.test/*" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("Patron invalido: usa https://dominio.com/*")).toBeTruthy();
    expect(onlyScript(view.currentState()).matches).toEqual([]);
    expect(screen.getByPlaceholderText(PATTERN_PLACEHOLDER)).toHaveProperty("value", "sin-esquema.test/*");
  });

  it("adds the active site and removes patterns", () => {
    const view = renderExpanded(userScriptWith(), activeTabFor("https://app.test/x"));

    fireEvent.click(screen.getByRole("button", { name: "app.test" }));
    expect(onlyScript(view.currentState()).matches).toEqual(["https://app.test/*"]);

    fireEvent.click(screen.getByRole("button", { name: "Quitar https://app.test/*" }));
    expect(onlyScript(view.currentState()).matches).toEqual([]);
  });

  it("warns about stored patterns that are invalid", () => {
    renderExpanded(userScriptWith({ matches: ["nope", "https://ok.test/*"] }));

    expect(screen.getByText(/Patrones invalidos \(se ignoran\): nope\./)).toBeTruthy();
  });
});

describe("HeaderImportNotice", () => {
  it("applies the Tampermonkey header without dropping existing patterns", () => {
    const view = renderExpanded(
      userScriptWith({ code: TAMPERMONKEY_CODE, matches: ["https://mine.test/*"], description: "vieja" }),
    );

    expect(
      screen.getByText(/nombre "Nuevo nombre" · 1 patron\(es\) · 1 exclusion\(es\) · run-at document_start/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onlyScript(view.currentState())).toMatchObject({
      name: "Nuevo nombre",
      description: "Hace cosas",
      matches: ["https://mine.test/*", "https://site.test/*"],
      excludeMatches: ["https://site.test/admin/*"],
      runAt: "document_start",
    });
    expect(screen.queryByText(/Este script trae header de Tampermonkey/)).toBeNull();
  });

  it("keeps the current values for tags the header does not bring", () => {
    const view = renderExpanded(
      userScriptWith({ code: "// ==UserScript==\n// @match https://site.test/*\n// ==/UserScript==" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onlyScript(view.currentState())).toMatchObject({
      name: "Mi script",
      description: "",
      runAt: "document_idle",
      matches: ["https://site.test/*"],
    });
  });

  it("can be dismissed without changes", () => {
    const view = renderExpanded(userScriptWith({ code: TAMPERMONKEY_CODE }));

    fireEvent.click(screen.getByRole("button", { name: "Ignorar" }));

    expect(screen.queryByText(/Este script trae header de Tampermonkey/)).toBeNull();
    expect(view.updateSpy).not.toHaveBeenCalled();
  });
});
