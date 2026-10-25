import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesView } from "@/ui/views/RulesView";
import type { ToolkitState, TrafficRuleAction } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { header, stateWith, trafficRuleWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, renderStateful } from "./support/render-ui";

vi.mock("@/ui/components/CodeMirrorEditor", () => import("./support/view-code-editor-stub"));

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderExpandedRule = (action: TrafficRuleAction) => {
  const view = renderStateful(
    (state, update) => <RulesView state={state} update={update} activeTab={EMPTY_ACTIVE_TAB} />,
    stateWith({ trafficRules: [trafficRuleWith(action, { name: "Api" })] }),
  );
  fireEvent.click(screen.getByText("Api"));
  return view;
};

const actionOf = (state: ToolkitState): TrafficRuleAction | undefined => state.trafficRules[0]?.action;

const typeInto = (label: RegExp, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const mockAction = (
  overrides: Partial<Extract<TrafficRuleAction, { kind: "mock" }>> = {},
): TrafficRuleAction => ({
  kind: "mock",
  status: 200,
  contentType: "application/json",
  body: "",
  delayMs: 0,
  headers: [],
  ...overrides,
});

describe("ChaosActionEditor", () => {
  it("warns that a chaos rule without delay nor failures does nothing", () => {
    renderExpandedRule({ kind: "chaos", delayMs: 0, failRate: 0, failStatus: 500 });

    expect(screen.getByText("Con delay 0 y 0% de fallos la regla no hace nada.")).toBeTruthy();
  });

  it("clamps delay and failure rate and describes the effect", () => {
    const view = renderExpandedRule({ kind: "chaos", delayMs: 0, failRate: 0, failStatus: 500 });

    typeInto(/^Delay \(ms\)/, "999999");
    typeInto(/^Fallos \(%\)/, "150");

    expect(actionOf(view.currentState())).toEqual({
      kind: "chaos",
      delayMs: 60000,
      failRate: 100,
      failStatus: 500,
    });
    expect(screen.getByText(/^Efecto: \+60000 ms · 100% 500\./)).toBeTruthy();

    typeInto(/^Delay \(ms\)/, "abc");
    typeInto(/^Fallos \(%\)/, "-4");

    expect(actionOf(view.currentState())).toMatchObject({ delayMs: 0, failRate: 0 });

    typeInto(/^Fallos \(%\)/, "nada");
    expect(actionOf(view.currentState())).toMatchObject({ failRate: 0 });
  });

  it("chooses how the request fails", () => {
    const view = renderExpandedRule({ kind: "chaos", delayMs: 0, failRate: 50, failStatus: 500 });

    typeInto(/^Como falla/, "0");
    expect(actionOf(view.currentState())).toMatchObject({ failStatus: 0 });
    expect(screen.getByText(/50% error de red/, { selector: ".notice div" })).toBeTruthy();

    typeInto(/^Como falla/, "429");
    expect(actionOf(view.currentState())).toMatchObject({ failStatus: 429 });
  });
});

describe("MockActionEditor", () => {
  it("bounds the status code and the delay", () => {
    const view = renderExpandedRule(mockAction());

    typeInto(/^Status/, "700");
    expect(actionOf(view.currentState())).toMatchObject({ status: 599 });
    typeInto(/^Status/, "12");
    expect(actionOf(view.currentState())).toMatchObject({ status: 100 });
    typeInto(/^Status/, "x");
    expect(actionOf(view.currentState())).toMatchObject({ status: 200 });

    typeInto(/^Delay \(ms\)/, "250");
    expect(actionOf(view.currentState())).toMatchObject({ delayMs: 250 });
    typeInto(/^Delay \(ms\)/, "-3");
    expect(actionOf(view.currentState())).toMatchObject({ delayMs: 0 });
    typeInto(/^Delay \(ms\)/, "x");
    expect(actionOf(view.currentState())).toMatchObject({ delayMs: 0 });
  });

  it("labels the body by content type", () => {
    const view = renderExpandedRule(mockAction());

    expect(screen.getByText("JSON")).toBeTruthy();
    typeInto(/^Content-Type/, "text/plain");

    expect(actionOf(view.currentState())).toMatchObject({ contentType: "text/plain" });
    expect(screen.getByText("texto")).toBeTruthy();
  });

  it("edits and formats the response body", async () => {
    const view = renderExpandedRule(mockAction());

    fireEvent.change(await screen.findByLabelText("Editor javascript"), { target: { value: '{"ok":true}' } });
    fireEvent.click(screen.getByText("Formatear"));

    expect(actionOf(view.currentState())).toMatchObject({ body: '{\n  "ok": true\n}' });
  });

  it("adds, edits and removes extra response headers", () => {
    const view = renderExpandedRule(mockAction({ headers: [header("X-Old", "1")] }));

    fireEvent.click(screen.getByRole("button", { name: "Agregar header" }));
    const [, newName] = screen.getAllByPlaceholderText("X-Mock");
    const [, newValue] = screen.getAllByPlaceholderText("valor");
    if (newName === undefined || newValue === undefined) throw new Error("Falta la fila nueva");
    fireEvent.change(newName, { target: { value: "X-Mocked" } });
    fireEvent.change(newValue, { target: { value: "yes" } });
    const [removeOld] = screen.getAllByTitle("Quitar header");
    if (removeOld === undefined) throw new Error("Falta el boton de quitar");
    fireEvent.click(removeOld);

    const action = actionOf(view.currentState());
    expect(action?.kind === "mock" ? action.headers : []).toMatchObject([{ name: "X-Mocked", value: "yes" }]);
  });
});
