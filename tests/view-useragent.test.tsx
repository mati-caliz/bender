import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CUSTOM_USER_AGENT_PRESET_ID, USER_AGENT_PRESETS } from "@/lib/constants";
import { UserAgentView } from "@/ui/views/UserAgentView";
import type { ToolkitState, UserAgentConfig } from "@/types";
import { stateWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, renderStateful } from "./support/render-ui";
import { quickToggleSwitch, switchLabelled } from "./support/view-helpers";

afterEach(() => {
  cleanup();
});

const renderUserAgent = () =>
  renderStateful(
    (state, update) => <UserAgentView state={state} update={update} activeTab={EMPTY_ACTIVE_TAB} />,
    stateWith({}),
  );

const userAgentOf = (view: { currentState: () => ToolkitState }): UserAgentConfig =>
  view.currentState().userAgent;

const presetNamed = (id: string) => {
  const preset = USER_AGENT_PRESETS.find((candidate) => candidate.id === id);
  if (preset === undefined) throw new Error(`No existe el preset ${id}`);
  return preset;
};

describe("UserAgentView", () => {
  it("enables spoofing and shows the value being sent", () => {
    const view = renderUserAgent();

    expect(screen.getByText("Se manda el User-Agent real del navegador")).toBeTruthy();
    fireEvent.click(quickToggleSwitch(view.container));

    expect(userAgentOf(view).enabled).toBe(true);
    expect(
      screen.getByText(presetNamed("iphone-safari").value, { selector: ".quick-toggle-hint" }),
    ).toBeTruthy();
  });

  it("groups the presets and applies the chosen one", () => {
    const view = renderUserAgent();
    const curl = presetNamed("curl");

    expect(screen.getByText("Mobile")).toBeTruthy();
    expect(screen.getByText("Bots")).toBeTruthy();
    expect(screen.getByRole("button", { name: presetNamed("iphone-safari").label }).className).toBe(
      "btn primary small",
    );

    fireEvent.click(screen.getByRole("button", { name: curl.label }));

    expect(userAgentOf(view)).toMatchObject({ presetId: "curl", value: curl.value });
    expect(screen.getByRole("button", { name: curl.label }).className).toBe("btn primary small");
    expect(screen.getByDisplayValue(curl.value)).toBeTruthy();
  });

  it("marks a hand-written value as custom", () => {
    const view = renderUserAgent();

    expect(screen.queryByText("personalizado")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Mozilla/5.0 …"), { target: { value: "MiBot/1.0" } });

    expect(userAgentOf(view)).toMatchObject({ value: "MiBot/1.0", presetId: CUSTOM_USER_AGENT_PRESET_ID });
    expect(screen.getByText("personalizado")).toBeTruthy();
  });

  it("toggles client hints and navigator spoofing", () => {
    const view = renderUserAgent();

    expect(screen.getByText(/sigue\s+siendo el real/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Ajustar tambien los client hints/));
    fireEvent.click(screen.getByLabelText(/^Pisar tambien/));

    expect(userAgentOf(view)).toMatchObject({ spoofClientHints: false, spoofNavigator: true });
    expect(screen.getByText(/necesita el modo desarrollador/)).toBeTruthy();
  });

  it("edits the scope", () => {
    const view = renderUserAgent();

    fireEvent.click(switchLabelled("Solo la pestaña activa"));

    expect(userAgentOf(view).scope.activeTabOnly).toBe(true);
  });
});
