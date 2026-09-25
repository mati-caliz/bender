import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportDialog, type ImportMode } from "@/ui/components/ImportDialog";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";

const PROFILE_JSON = '[{ "name": "Local" }]';
const TEXTAREA_PLACEHOLDER =
  '[{ "name": "Local", "requestHeaders": [{ "name": "X-Debug", "value": "true" }] }]';

let fakeChrome: FakeChrome;
const closeWindow = vi.fn();

beforeEach(() => {
  fakeChrome = installFakeChrome();
  closeWindow.mockReset();
  vi.spyOn(window, "close").mockImplementation(closeWindow);
});

afterEach(() => {
  cleanup();
  delete document.body.dataset["surface"];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderDialog = (
  options: { allowAppend?: boolean; onImport?: (text: string, mode: ImportMode) => void } = {},
) => {
  const onClose = vi.fn();
  const onImport = vi.fn(options.onImport ?? (() => undefined));
  const view = render(
    <ImportDialog
      title="Importar perfiles"
      description="Pega el JSON exportado."
      viewId="headers"
      onClose={onClose}
      onImport={onImport}
      {...(options.allowAppend === undefined ? {} : { allowAppend: options.allowAppend })}
    />,
  );
  return { ...view, onClose, onImport };
};

const textarea = (): HTMLElement => screen.getByPlaceholderText(TEXTAREA_PLACEHOLDER);

const jsonFile = (content: string): File =>
  new File([content], "perfiles.json", { type: "application/json" });

describe("ImportDialog", () => {
  it("asks for content before importing", () => {
    const { onImport, onClose } = renderDialog();

    fireEvent.change(textarea(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(screen.getByText("Pega el JSON o elegi un archivo.")).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("imports in replace or append mode and closes", () => {
    const { onImport, onClose } = renderDialog();

    fireEvent.change(textarea(), { target: { value: PROFILE_JSON } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar a lo actual" }));
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(onImport).toHaveBeenNthCalledWith(1, PROFILE_JSON, "append");
    expect(onImport).toHaveBeenNthCalledWith(2, PROFILE_JSON, "replace");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the import error and stays open", () => {
    const { onClose } = renderDialog({
      onImport: () => {
        throw new Error("JSON invalido en la linea 1");
      },
    });

    fireEvent.change(textarea(), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(screen.getByText("JSON invalido en la linea 1")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hides the notice when the import error has no message", () => {
    renderDialog({
      onImport: () => {
        throw new TypeError("");
      },
    });
    fireEvent.change(textarea(), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Reemplazar todo" }));

    expect(document.querySelector(".notice.danger")).toBeNull();
  });

  it("offers a single import button when appending is not allowed", () => {
    const { onImport } = renderDialog({ allowAppend: false });

    expect(screen.queryByRole("button", { name: "Agregar a lo actual" })).toBeNull();
    fireEvent.change(textarea(), { target: { value: PROFILE_JSON } });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    expect(onImport).toHaveBeenCalledWith(PROFILE_JSON, "replace");
  });

  it("cancels from the footer", () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker outside the popup", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Elegir archivo" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Chrome cierra el popup/)).toBeNull();
  });

  it("loads the chosen file into the textarea", async () => {
    const { container } = renderDialog();
    const input = container.ownerDocument.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("Falta el input de archivo");

    fireEvent.change(input, { target: { files: [jsonFile(PROFILE_JSON)] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue(PROFILE_JSON)).toBeTruthy();
    });
  });

  it("ignores a file change without files", () => {
    const { container } = renderDialog();
    const input = container.ownerDocument.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("Falta el input de archivo");

    fireEvent.change(input, { target: { files: [] } });

    expect(textarea()).toHaveProperty("value", "");
  });

  it("loads a dropped file and ignores drops without files", async () => {
    renderDialog();

    fireEvent.dragOver(textarea());
    fireEvent.drop(textarea(), { dataTransfer: { files: [] } });
    expect(textarea()).toHaveProperty("value", "");

    fireEvent.drop(textarea(), { dataTransfer: { files: [jsonFile('{"rules": []}')] } });

    await waitFor(() => {
      expect(textarea()).toHaveProperty("value", '{"rules": []}');
    });
  });

  it("sends the popup to a tab to pick the file", () => {
    document.body.dataset["surface"] = "popup";
    renderDialog();

    expect(screen.getByText(/Chrome cierra el popup/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Elegir archivo en una pestaña" }));

    expect(fakeChrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://bender-test/index.html?surface=tab&import=headers",
    });
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });
});
