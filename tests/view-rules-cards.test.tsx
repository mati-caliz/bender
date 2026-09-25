import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesView } from "@/ui/views/RulesView";
import type { ToolkitState, TrafficRule } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { stateWith, trafficRuleWith } from "./support/dnr-fixtures";
import { activeTabFor, renderStateful } from "./support/render-ui";
import { switchLabelled } from "./support/view-helpers";

vi.mock("@/ui/components/CodeMirrorEditor", () => import("./support/view-code-editor-stub"));

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderRules = (initial: ToolkitState = stateWith({})) =>
  renderStateful(
    (state, update) => (
      <RulesView state={state} update={update} activeTab={activeTabFor("https://app.test/")} />
    ),
    initial,
  );

const onlyRule = (state: ToolkitState): TrafficRule => {
  const [rule] = state.trafficRules;
  if (rule === undefined) throw new Error("No hay reglas");
  return rule;
};

describe("RulesView", () => {
  it("shows the empty card until a rule exists", () => {
    renderRules();

    expect(screen.getByText("Sin reglas de trafico")).toBeTruthy();
  });

  it.each([
    ["Bloqueo", "block"],
    ["Redirect", "redirect"],
    ["Chaos", "chaos"],
    ["Mock", "mock"],
  ])("adds a %s rule already expanded", (label, kind) => {
    const view = renderRules();

    fireEvent.click(screen.getByRole("button", { name: label }));

    const rule = onlyRule(view.currentState());
    expect(rule.action.kind).toBe(kind);
    expect(rule.name).toBe("Regla 1");
    expect(screen.getByDisplayValue("Regla 1")).toBeTruthy();
    expect(screen.queryByText("Sin reglas de trafico")).toBeNull();
  });

  it("explains what a block rule does", () => {
    renderRules();

    fireEvent.click(screen.getByRole("button", { name: "Bloqueo" }));

    expect(screen.getByText(/se cortan antes de salir/)).toBeTruthy();
  });

  it("collapses and expands a rule from its header", () => {
    renderRules(stateWith({ trafficRules: [trafficRuleWith({ kind: "block" }, { name: "Ads" })] }));

    expect(screen.queryByDisplayValue("Ads")).toBeNull();
    fireEvent.click(screen.getByText("Ads"));
    expect(screen.getByDisplayValue("Ads")).toBeTruthy();
    fireEvent.click(screen.getByText("Ads", { selector: ".item-name" }));
    expect(screen.queryByDisplayValue("Ads")).toBeNull();
  });

  it("switches a rule off without expanding it", () => {
    const view = renderRules(
      stateWith({ trafficRules: [trafficRuleWith({ kind: "block" }, { name: "Ads" })] }),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Prender o apagar esta regla" }));

    expect(onlyRule(view.currentState()).enabled).toBe(false);
    expect(view.container.querySelector(".item-card")?.getAttribute("data-off")).toBe("true");
    expect(screen.queryByDisplayValue("Ads")).toBeNull();
  });

  it("renames a rule and edits its scope", () => {
    const view = renderRules(
      stateWith({ trafficRules: [trafficRuleWith({ kind: "block" }, { name: "Ads" })] }),
    );

    expect(screen.getByText("todas las requests")).toBeTruthy();
    fireEvent.click(screen.getByText("Ads"));
    fireEvent.change(screen.getByDisplayValue("Ads"), { target: { value: "Trackers" } });
    fireEvent.click(switchLabelled("Solo la pestaña activa"));

    const rule = onlyRule(view.currentState());
    expect(rule.name).toBe("Trackers");
    expect(rule.scope.activeTabOnly).toBe(true);
    expect(screen.getByText("solo pestaña activa")).toBeTruthy();
  });

  it("previews the chaos effect next to the scope", () => {
    renderRules(
      stateWith({
        trafficRules: [trafficRuleWith({ kind: "chaos", delayMs: 300, failRate: 20, failStatus: 0 })],
      }),
    );

    expect(screen.getByText("+300 ms · 20% error de red · todas las requests")).toBeTruthy();
  });

  it("deletes a rule and forgets it from environments", () => {
    const initial = stateWith({
      trafficRules: [
        trafficRuleWith({ kind: "block" }, { id: "ads" }),
        trafficRuleWith({ kind: "block" }, { id: "keep" }),
      ],
      environments: [{ id: "env", name: "dev", profileIds: [], ruleIds: ["ads", "keep"] }],
    });
    const view = renderRules(initial);

    const [firstDelete] = screen.getAllByTitle("Eliminar regla");
    if (firstDelete === undefined) throw new Error("Falta el boton de eliminar");
    fireEvent.click(firstDelete);

    expect(view.currentState().trafficRules.map((rule) => rule.id)).toEqual(["keep"]);
    expect(view.currentState().environments[0]?.ruleIds).toEqual(["keep"]);
  });
});

describe("RedirectActionEditor", () => {
  it("edits the target and toggles regex mode", () => {
    const view = renderRules();
    fireEvent.click(screen.getByRole("button", { name: "Redirect" }));

    expect(screen.getByText(/URL absoluta, por ejemplo/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("http://localhost:3000/bundle.js"), {
      target: { value: "http://localhost:5173/\\1" },
    });
    fireEvent.click(screen.getByLabelText("Tratar el filtro de URL como expresion regular"));

    expect(onlyRule(view.currentState()).action).toEqual({
      kind: "redirect",
      target: "http://localhost:5173/\\1",
      useRegex: true,
    });
    expect(screen.getByText(/grupos capturados/)).toBeTruthy();
  });
});
