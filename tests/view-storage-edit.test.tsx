import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISABLED_STORAGE_KEY } from "@/lib/constants";
import { StorageView } from "@/ui/views/StorageView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { activeTabFor, renderWithToasts } from "./support/render-ui";
import { buttonOf } from "./support/view-dom";
import { runInjectionsAgainstThisPage } from "./support/view-storage-page";

const ORIGIN = "https://app.example.com";
const LOCAL_SCOPE = `local:${ORIGIN}`;

let fake: FakeChrome;

const renderView = async () => {
  renderWithToasts(<StorageView activeTab={activeTabFor(`${ORIGIN}/`)} />);
  await screen.findByText("token");
};

const expandItem = (key: string): void => {
  fireEvent.click(screen.getByText(key));
};

beforeEach(() => {
  fake = installFakeChrome();
  runInjectionsAgainstThisPage(fake);
  localStorage.clear();
  localStorage.setItem("token", "abc");
  localStorage.setItem("prefs", '{"theme":"dark","sidebar":true}');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("StorageView editing plain values", () => {
  it("saves an edited value into the page and collapses", async () => {
    await renderView();
    expandItem("token");

    expect(screen.getByText("3 B en disco")).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue("abc"), { target: { value: "rotated" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Item guardado")).toBeTruthy();
    expect(localStorage.getItem("token")).toBe("rotated");
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
  });

  it("moves the value when the key is renamed", async () => {
    await renderView();
    expandItem("token");

    fireEvent.change(screen.getByDisplayValue("token"), { target: { value: "access_token" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("access_token")).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("access_token")).toBe("abc");
  });

  it("requires a key before saving", async () => {
    await renderView();
    expandItem("token");

    fireEvent.change(screen.getByDisplayValue("token"), { target: { value: "  " } });

    expect(buttonOf(screen.getByRole("button", { name: "Guardar" })).disabled).toBe(true);
  });

  it("deletes the item from the page", async () => {
    await renderView();
    expandItem("token");

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(await screen.findByText("Item borrado")).toBeTruthy();
    expect(localStorage.getItem("token")).toBeNull();
    await waitFor(() => {
      expect(screen.queryByText("token")).toBeNull();
    });
  });

  it("closes without saving from the close button and from the header", async () => {
    await renderView();
    expandItem("token");
    fireEvent.change(screen.getByDisplayValue("abc"), { target: { value: "draft" } });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByDisplayValue("draft")).toBeNull();

    expandItem("token");
    expect(screen.getByDisplayValue("abc")).toBeTruthy();
    expandItem("token");
    expect(screen.queryByDisplayValue("abc")).toBeNull();
    expect(localStorage.getItem("token")).toBe("abc");
  });

  it("shows the page error when saving fails", async () => {
    await renderView();
    expandItem("token");
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("The page is not responding"));

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("The page is not responding")).toBeTruthy();
  });
});

describe("StorageView editing JSON values", () => {
  it("shows JSON as a read-only tree and edits it as text", async () => {
    await renderView();
    expandItem("prefs");

    expect(screen.getByText("El arbol es solo lectura: para editar usa Texto.")).toBeTruthy();
    expect(screen.getByText("theme")).toBeTruthy();
    expect(screen.queryByDisplayValue('{"theme":"dark","sidebar":true}')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    fireEvent.change(screen.getByDisplayValue('{"theme":"dark","sidebar":true}'), {
      target: { value: '{"theme":"light"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Formatear JSON" }));
    expect(screen.getByDisplayValue('{\n  "theme": "light"\n}', { normalizer: (text) => text })).toBeTruthy();

    fireEvent.click(screen.getByText("Arbol", { selector: "button" }));
    expect(screen.getByText('"light"')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => {
      expect(localStorage.getItem("prefs")).toBe('{\n  "theme": "light"\n}');
    });
  });

  it("leaves non JSON values untouched when formatting", async () => {
    await renderView();
    expandItem("token");

    fireEvent.click(screen.getByRole("button", { name: "Formatear JSON" }));

    expect(screen.getByDisplayValue("abc")).toBeTruthy();
  });
});

describe("StorageView editing switched-off items", () => {
  beforeEach(async () => {
    await fake.storage.local.set({
      [DISABLED_STORAGE_KEY]: { [LOCAL_SCOPE]: { debug: { key: "debug", value: "false" } } },
    });
  });

  it("updates only the stored copy when saving", async () => {
    await renderView();
    await screen.findByText("debug");
    expandItem("debug");

    fireEvent.change(screen.getByDisplayValue("debug"), { target: { value: "debug_mode" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(fake.storage.local.data.get(DISABLED_STORAGE_KEY)).toEqual({
        [LOCAL_SCOPE]: { debug_mode: { key: "debug_mode", value: "false" } },
      });
    });
    expect(localStorage.getItem("debug_mode")).toBeNull();
  });

  it("forgets the stored copy when deleting", async () => {
    await renderView();
    await screen.findByText("debug");
    expandItem("debug");

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(await screen.findByText("Item borrado")).toBeTruthy();
    expect(fake.storage.local.data.get(DISABLED_STORAGE_KEY)).toEqual({});
  });
});

describe("StorageView creating items", () => {
  it("creates a new item in the page", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo item" }));
    expect(buttonOf(screen.getByRole("button", { name: "Guardar" })).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "onboarding_done" } });
    fireEvent.change(screen.getByLabelText(/^Valor/u), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Item creado")).toBeTruthy();
    expect(localStorage.getItem("onboarding_done")).toBe("true");
    expect(await screen.findByText("onboarding_done")).toBeTruthy();
  });

  it("discards or closes the new item card without writing", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo item" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText("Nuevo item", { selector: ".card-title" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nuevo item" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("Nuevo item", { selector: ".card-title" })).toBeNull();
    expect(localStorage).toHaveLength(2);
  });
});
