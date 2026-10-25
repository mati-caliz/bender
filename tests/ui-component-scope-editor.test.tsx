import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyScope } from "@/lib/constants";
import { ScopeEditor } from "@/ui/components/ScopeEditor";
import type { Scope } from "@/types";

afterEach(() => {
  cleanup();
});

const StatefulScope = ({
  initial,
  onChange,
  currentHostname,
}: {
  initial: Scope;
  onChange: (scope: Scope) => void;
  currentHostname?: string;
}): ReactElement => {
  const [scope, setScope] = useState(initial);
  return (
    <ScopeEditor
      scope={scope}
      currentHostname={currentHostname}
      onChange={(next) => {
        onChange(next);
        setScope(next);
      }}
    />
  );
};

const renderScope = (initial: Partial<Scope> = {}, currentHostname?: string) => {
  const onChange = vi.fn<(scope: Scope) => void>();
  const view = render(
    <StatefulScope
      initial={{ ...createEmptyScope(), ...initial }}
      onChange={onChange}
      {...(currentHostname === undefined ? {} : { currentHostname })}
    />,
  );
  const latest = (): Scope => {
    const call = onChange.mock.lastCall;
    if (call === undefined) throw new Error("onChange no fue llamado");
    return call[0];
  };
  return { ...view, onChange, latest };
};

const fieldByLabel = (label: string): HTMLElement => {
  const field = screen.getByText(label).closest(".field");
  if (!(field instanceof HTMLElement)) throw new Error(`Falta el campo ${label}`);
  return field;
};

describe("ScopeEditor", () => {
  it("toggles the active tab restriction", () => {
    const { latest } = renderScope();

    fireEvent.click(screen.getByRole("switch"));

    expect(latest().activeTabOnly).toBe(true);
  });

  it("adds sanitized unique domains and clears the draft", () => {
    const { latest } = renderScope({ includeDomains: ["api.test"] });
    const field = within(fieldByLabel("Dominios incluidos"));
    const input = field.getByPlaceholderText("ejemplo.com");

    expect(field.getByRole("button", { name: "Agregar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "https://Shop.test/path, api.test" } });
    fireEvent.click(field.getByRole("button", { name: "Agregar" }));

    expect(latest().includeDomains).toEqual(["api.test", "shop.test"]);
    expect(input).toHaveProperty("value", "");
  });

  it("keeps the draft when nothing valid was typed", () => {
    const { onChange } = renderScope();
    const field = within(fieldByLabel("Dominios excluidos"));
    const input = field.getByPlaceholderText("ejemplo.com");

    fireEvent.change(input, { target: { value: "%%%" } });
    fireEvent.click(field.getByRole("button", { name: "Agregar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveProperty("value", "%%%");
    expect(field.getByText("Opcional: dominios donde la regla nunca se aplica.")).toBeTruthy();
  });

  it("suggests the current hostname until it is added", () => {
    const { latest } = renderScope({}, "app.example.com");
    const includeField = within(fieldByLabel("Dominios incluidos"));

    expect(within(fieldByLabel("Dominios excluidos")).queryByTitle("Usar el dominio actual")).toBeNull();
    fireEvent.click(includeField.getByTitle("Usar el dominio actual"));

    expect(latest().includeDomains).toEqual(["app.example.com"]);
    expect(includeField.queryByTitle("Usar el dominio actual")).toBeNull();
    expect(
      within(fieldByLabel("Sitios que originan la request")).getByTitle("Usar el dominio actual"),
    ).toBeTruthy();
  });

  it("removes a domain chip from each list", () => {
    const { latest } = renderScope({
      excludeDomains: ["ads.test"],
      initiatorDomains: ["origin.test"],
      excludedInitiatorDomains: ["evil.test", "other.test"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Quitar ads.test" }));
    expect(latest().excludeDomains).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Quitar origin.test" }));
    expect(latest().initiatorDomains).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Quitar evil.test" }));
    expect(latest().excludedInitiatorDomains).toEqual(["other.test"]);
  });

  it("adds domains to the initiator lists", () => {
    const { latest } = renderScope();

    for (const label of ["Sitios que originan la request", "Sitios de origen excluidos"]) {
      const field = within(fieldByLabel(label));
      fireEvent.change(field.getByPlaceholderText("ejemplo.com"), { target: { value: "cdn.test" } });
      fireEvent.click(field.getByRole("button", { name: "Agregar" }));
    }

    expect(latest()).toMatchObject({
      initiatorDomains: ["cdn.test"],
      excludedInitiatorDomains: ["cdn.test"],
    });
  });

  it("toggles request methods and explains the empty selection", () => {
    const { latest } = renderScope();

    expect(screen.getByText("Vacio = todos los metodos.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("POST"));

    expect(latest().requestMethods).toEqual(["post"]);
    expect(screen.queryByText("Vacio = todos los metodos.")).toBeNull();

    fireEvent.click(screen.getByLabelText("POST"));

    expect(latest().requestMethods).toEqual([]);
  });

  it("edits the URL filter and clears it with Escape", () => {
    const { latest } = renderScope({ urlFilter: "/api/*" });
    const input = screen.getByPlaceholderText("/api/*");

    fireEvent.change(input, { target: { value: "*.json" } });
    expect(latest().urlFilter).toBe("*.json");

    fireEvent.keyDown(input, { key: "a" });
    expect(latest().urlFilter).toBe("*.json");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(latest().urlFilter).toBe("");
  });

  it("reveals resource types on demand and toggles them", () => {
    const { latest } = renderScope();
    const toggle = screen.getByRole("button", { name: /Tipos de request/ });

    expect(toggle.textContent).toContain("(todos)");
    expect(screen.queryByLabelText("XHR / fetch")).toBeNull();

    fireEvent.click(toggle);
    fireEvent.click(screen.getByLabelText("XHR / fetch"));

    expect(latest().resourceTypes).toEqual(["xmlhttprequest"]);
    expect(toggle.textContent).toContain("(1)");

    fireEvent.click(screen.getByLabelText("XHR / fetch"));
    expect(latest().resourceTypes).toEqual([]);

    fireEvent.click(toggle);
    expect(screen.queryByLabelText("XHR / fetch")).toBeNull();
  });

  it("starts with resource types open when some are selected", () => {
    renderScope({ resourceTypes: ["script"] });

    expect(screen.getByLabelText("JS")).toHaveProperty("checked", true);
  });
});
