import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderValueField } from "@/ui/components/HeaderValueField";
import type { HeaderEntry } from "@/types";
import { header } from "./support/dnr-fixtures";

afterEach(() => {
  cleanup();
});

const SAVE_TITLE_EMPTY = "Guardar varios valores para este header";
const SWITCH_TITLE = "Cambiar entre los valores guardados";

const renderField = (entry: HeaderEntry) => {
  const onChange = vi.fn<(next: HeaderEntry) => void>();
  const view = render(<HeaderValueField entry={entry} onChange={onChange} />);
  return { ...view, onChange };
};

const lastEntry = (onChange: ReturnType<typeof vi.fn<(next: HeaderEntry) => void>>): HeaderEntry => {
  const call = onChange.mock.lastCall;
  if (call === undefined) throw new Error("onChange no fue llamado");
  return call[0];
};

const StatefulField = ({
  initial,
  onChange,
}: {
  initial: HeaderEntry;
  onChange: (next: HeaderEntry) => void;
}): ReactElement => {
  const [entry, setEntry] = useState(initial);
  return (
    <HeaderValueField
      entry={entry}
      onChange={(next) => {
        onChange(next);
        setEntry(next);
      }}
    />
  );
};

describe("HeaderValueField", () => {
  it("edits the value from the input", () => {
    const { onChange } = renderField(header("X-Env", "dev"));

    fireEvent.change(screen.getByPlaceholderText("valor"), { target: { value: "prod" } });

    expect(lastEntry(onChange).value).toBe("prod");
  });

  it("disables everything for remove operations", () => {
    renderField(header("X-Env", "", { operation: "remove" }));

    expect(screen.getByPlaceholderText("(no aplica)").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTitle(SAVE_TITLE_EMPTY).hasAttribute("disabled")).toBe(true);
  });

  it("stores the current value as a variant", () => {
    const { onChange } = renderField(header("X-Env", "dev"));

    fireEvent.click(screen.getByTitle(SAVE_TITLE_EMPTY));
    fireEvent.click(screen.getByText("Guardar el valor actual"));

    expect(lastEntry(onChange).variants).toEqual(["dev"]);
  });

  it("refuses to store an empty or already stored value", () => {
    renderField(header("X-Env", "dev", { variants: ["dev"] }));

    fireEvent.click(screen.getByTitle(SWITCH_TITLE));

    expect(screen.getByTitle("Escribi un valor nuevo primero").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("swaps the chosen variant with the current value", () => {
    const { onChange } = renderField(header("X-Env", "dev", { variants: ["staging", "prod"] }));

    fireEvent.click(screen.getByTitle(SWITCH_TITLE));
    fireEvent.click(screen.getByText("prod"));

    expect(lastEntry(onChange)).toMatchObject({ value: "prod", variants: ["staging", "dev"] });
    expect(screen.queryByText("Guardar el valor actual")).toBeNull();
  });

  it("drops the empty current value when activating a variant", () => {
    const { onChange } = renderField(header("X-Env", "  ", { variants: ["staging", "prod"] }));

    fireEvent.click(screen.getByTitle(SWITCH_TITLE));
    fireEvent.click(screen.getByText("staging"));

    expect(lastEntry(onChange)).toMatchObject({ value: "staging", variants: ["prod"] });
  });

  it("removes a stored variant and labels blank ones", () => {
    const { onChange } = renderField(header("X-Env", "", { variants: [" ", "prod"] }));

    fireEvent.click(screen.getByTitle(SWITCH_TITLE));

    expect(screen.getAllByText("(vacio)")).toHaveLength(2);

    const removeButtons = screen.getAllByRole("button", { name: "Borrar este valor" });
    const lastRemove = removeButtons.at(-1);
    if (lastRemove === undefined) throw new Error("Falta el boton de borrar");
    fireEvent.click(lastRemove);

    expect(lastEntry(onChange).variants).toEqual([" "]);
  });

  it("closes the menu from the current value, Escape and outside clicks", () => {
    const onChange = vi.fn<(next: HeaderEntry) => void>();
    render(
      <div>
        <StatefulField initial={header("X-Env", "dev", { variants: ["prod"] })} onChange={onChange} />
        <span>afuera</span>
      </div>,
    );
    const toggle = screen.getByTitle(SWITCH_TITLE);

    fireEvent.click(toggle);
    fireEvent.click(screen.getByText("dev", { selector: ".header-value-menu .mono" }));
    expect(toggle.getAttribute("data-open")).toBe("false");

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(toggle.getAttribute("data-open")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("data-open")).toBe("false");

    fireEvent.click(toggle);
    fireEvent.mouseDown(screen.getByText("prod"));
    expect(toggle.getAttribute("data-open")).toBe("true");
    fireEvent.mouseDown(screen.getByText("afuera"));
    expect(toggle.getAttribute("data-open")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
