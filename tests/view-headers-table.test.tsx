import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeadersView } from "@/ui/views/HeadersView";
import type { HeaderEntry, ToolkitState } from "@/types";
import { installFakeChrome } from "./support/fake-chrome";
import { header, profileWith, stateWith } from "./support/dnr-fixtures";
import { EMPTY_ACTIVE_TAB, renderStateful } from "./support/render-ui";

beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stateWithHeaders = (requestHeaders: HeaderEntry[]): ToolkitState =>
  stateWith({ profiles: [profileWith({ id: "local", name: "Local", requestHeaders })] });

const renderHeaders = (initial: ToolkitState) =>
  renderStateful(
    (state, update) => <HeadersView state={state} update={update} activeTab={EMPTY_ACTIVE_TAB} />,
    initial,
  );

const requestHeadersOf = (state: ToolkitState): HeaderEntry[] => state.profiles[0]?.requestHeaders ?? [];

const headerNames = (state: ToolkitState): string[] => requestHeadersOf(state).map((entry) => entry.name);

const headerRows = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(".header-row"));

const rowAt = (container: HTMLElement, index: number): HTMLElement => {
  const row = headerRows(container)[index];
  if (row === undefined) throw new Error(`No hay fila ${index}`);
  return row;
};

describe("HeaderTable editing", () => {
  it("adds a header and edits its name, value and operation", () => {
    const view = renderHeaders(stateWithHeaders([]));

    expect(screen.getByText("Sin headers de request")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar header" }));
    fireEvent.change(screen.getByPlaceholderText("X-Mi-Header"), { target: { value: "X-Env" } });
    fireEvent.change(screen.getByPlaceholderText("valor"), { target: { value: "staging" } });
    fireEvent.change(screen.getByTitle("set reemplaza, append suma otro valor, remove lo saca"), {
      target: { value: "append" },
    });

    expect(requestHeadersOf(view.currentState())).toMatchObject([
      { name: "X-Env", value: "staging", operation: "append", enabled: true },
    ]);
    expect(screen.getByRole("button", { name: "Request (1)" })).toBeTruthy();
  });

  it("ignores an operation that is not set, append or remove", () => {
    const view = renderHeaders(stateWithHeaders([header("X-Env", "dev")]));

    fireEvent.change(screen.getByTitle("set reemplaza, append suma otro valor, remove lo saca"), {
      target: { value: "bogus" },
    });

    expect(requestHeadersOf(view.currentState())[0]?.operation).toBe("set");
  });

  it("switches a header off", () => {
    const view = renderHeaders(stateWithHeaders([header("X-Env", "dev")]));

    fireEvent.click(screen.getByRole("switch", { name: "Prender o apagar este header" }));

    expect(requestHeadersOf(view.currentState())[0]?.enabled).toBe(false);
    expect(rowAt(view.container, 0).dataset["enabled"]).toBe("false");
  });

  it("duplicates a header right below it as a disabled copy", () => {
    const view = renderHeaders(
      stateWithHeaders([header("X-A", "1", { variants: ["2"], comment: "nota" }), header("X-B", "3")]),
    );

    const [firstDuplicate] = screen.getAllByTitle("Duplicar (la copia queda apagada)");
    if (firstDuplicate === undefined) throw new Error("Falta el boton de duplicar");
    fireEvent.click(firstDuplicate);

    const headers = requestHeadersOf(view.currentState());
    expect(headers.map((entry) => entry.name)).toEqual(["X-A", "X-A", "X-B"]);
    expect(headers[1]).toMatchObject({ value: "1", variants: ["2"], comment: "nota", enabled: false });
    expect(headers[1]?.id).not.toBe(headers[0]?.id);
  });

  it("deletes a header", () => {
    const view = renderHeaders(stateWithHeaders([header("X-A", "1"), header("X-B", "2")]));

    const [firstDelete] = screen.getAllByTitle("Eliminar header");
    if (firstDelete === undefined) throw new Error("Falta el boton de eliminar");
    fireEvent.click(firstDelete);

    expect(headerNames(view.currentState())).toEqual(["X-B"]);
  });
});

describe("HeaderTable drag and drop", () => {
  const threeHeaders = (): ToolkitState =>
    stateWithHeaders([header("X-A", "1"), header("X-B", "2"), header("X-C", "3")]);

  it("moves a header down to the drop target", () => {
    const view = renderHeaders(threeHeaders());

    fireEvent.dragStart(rowAt(view.container, 0));
    expect(rowAt(view.container, 0).dataset["dragging"]).toBe("true");
    fireEvent.dragOver(rowAt(view.container, 2));
    expect(rowAt(view.container, 2).dataset["drop"]).toBe("true");
    fireEvent.drop(rowAt(view.container, 2));

    expect(headerNames(view.currentState())).toEqual(["X-B", "X-A", "X-C"]);
    expect(headerRows(view.container).some((row) => row.dataset["dragging"] === "true")).toBe(false);
  });

  it("moves a header up to the drop target", () => {
    const view = renderHeaders(threeHeaders());

    fireEvent.dragStart(rowAt(view.container, 2));
    fireEvent.drop(rowAt(view.container, 0));

    expect(headerNames(view.currentState())).toEqual(["X-C", "X-A", "X-B"]);
  });

  it("keeps the order when dropped on itself or without a drag in progress", () => {
    const view = renderHeaders(threeHeaders());

    fireEvent.dragStart(rowAt(view.container, 1));
    fireEvent.dragOver(rowAt(view.container, 1));
    expect(rowAt(view.container, 1).dataset["drop"]).toBe("false");
    fireEvent.drop(rowAt(view.container, 1));
    fireEvent.drop(rowAt(view.container, 0));

    expect(view.updateSpy).not.toHaveBeenCalled();

    fireEvent.dragStart(rowAt(view.container, 0));
    fireEvent.dragEnd(rowAt(view.container, 0));
    expect(rowAt(view.container, 0).dataset["dragging"]).toBe("false");
  });
});
