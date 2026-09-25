import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISABLED_STORAGE_KEY } from "@/lib/constants";
import { downloadJson } from "@/lib/download";
import { StorageView } from "@/ui/views/StorageView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderWithToasts } from "./support/render-ui";
import { buttonOf, queryConfirmBar, withinConfirmBar, withinItemCard } from "./support/view-dom";
import { runInjectionsAgainstThisPage } from "./support/view-storage-page";

vi.mock(import("@/lib/download"), async (importOriginal) => ({
  ...(await importOriginal()),
  downloadJson: vi.fn(),
}));

const ORIGIN = "https://app.example.com";
const LOCAL_SCOPE = `local:${ORIGIN}`;

let fake: FakeChrome;

const renderView = async () => {
  renderWithToasts(<StorageView activeTab={activeTabFor(`${ORIGIN}/settings`)} />);
  await screen.findByText("token");
};

beforeEach(() => {
  fake = installFakeChrome();
  runInjectionsAgainstThisPage(fake);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("token", "abc");
  localStorage.setItem("prefs", '{"theme":"dark"}');
  sessionStorage.setItem("wizard_step", "3");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("StorageView listing", () => {
  it("lists the page localStorage with the origin and total size", async () => {
    await renderView();

    expect(screen.getByText("prefs")).toBeTruthy();
    expect(screen.getByText(`${ORIGIN} · 29 B`)).toBeTruthy();
    const names = [...document.querySelectorAll(".item-name")].map((element) => element.textContent);
    expect(names).toEqual(["prefs", "token"]);
  });

  it("switches to sessionStorage", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "sessionStorage" }));

    expect(await screen.findByText("wizard_step")).toBeTruthy();
    expect(screen.queryByText("token")).toBeNull();
    sessionStorage.clear();
    fireEvent.click(screen.getByRole("button", { name: "Recargar" }));
    expect(await screen.findByText("Sin items en sessionStorage")).toBeTruthy();
  });

  it("filters by key or value", async () => {
    await renderView();
    const search = screen.getByPlaceholderText("Filtrar por key o valor…");

    fireEvent.change(search, { target: { value: "DARK" } });
    expect(screen.queryByText("token")).toBeNull();
    expect(screen.getByText("prefs")).toBeTruthy();

    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText("Ningun item coincide con el filtro")).toBeTruthy();
  });

  it("explains that non http(s) tabs expose no storage", () => {
    renderWithToasts(<StorageView activeTab={EMPTY_ACTIVE_TAB} />);

    expect(screen.getByText("Esta pestaña no expone storage: abri una pagina http(s).")).toBeTruthy();
    expect(screen.getByText("Abri una pagina http(s)")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Nuevo item" })).disabled).toBe(true);
    expect(buttonOf(screen.getByRole("button", { name: "Vaciar" })).disabled).toBe(true);
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("reports when the page cannot be scripted", async () => {
    fake.scripting.executeScript.mockRejectedValue(new Error("Cannot access a chrome:// URL"));
    renderWithToasts(<StorageView activeTab={activeTabFor(`${ORIGIN}/`)} />);

    expect(await screen.findByText("Cannot access a chrome:// URL")).toBeTruthy();
    expect(screen.getByText("Sin items en localStorage")).toBeTruthy();
  });

  it("reports a missing tab id and treats an empty injection result as no items", async () => {
    const { unmount } = renderWithToasts(
      <StorageView activeTab={{ ...activeTabFor(`${ORIGIN}/`), id: null }} />,
    );
    expect(await screen.findByText("No hay una pestaña activa.")).toBeTruthy();
    unmount();

    fake.scripting.executeScript.mockResolvedValue([]);
    renderWithToasts(<StorageView activeTab={activeTabFor(`${ORIGIN}/`)} />);
    await waitFor(() => {
      expect(fake.scripting.executeScript).toHaveBeenCalled();
    });
    expect(screen.getByText("Sin items en localStorage")).toBeTruthy();
  });
});

describe("StorageView switching items off and on", () => {
  it("keeps a copy of the disabled item and writes it back on restore", async () => {
    await renderView();

    fireEvent.click(withinItemCard("token").getByTitle("Apagar"));

    await waitFor(() => {
      expect(withinItemCard("token").getByTitle("Restaurar")).toBeTruthy();
    });
    expect(localStorage.getItem("token")).toBeNull();
    expect(fake.storage.local.data.get(DISABLED_STORAGE_KEY)).toEqual({
      [LOCAL_SCOPE]: { token: { key: "token", value: "abc" } },
    });

    fireEvent.click(withinItemCard("token").getByTitle("Restaurar"));

    await waitFor(() => {
      expect(withinItemCard("token").getByTitle("Apagar")).toBeTruthy();
    });
    expect(localStorage.getItem("token")).toBe("abc");
    expect(fake.storage.local.data.get(DISABLED_STORAGE_KEY)).toEqual({});
  });

  it("flags keys that the page wrote again while disabled", async () => {
    await fake.storage.local.set({
      [DISABLED_STORAGE_KEY]: { [LOCAL_SCOPE]: { token: { key: "token", value: "old" } } },
    });
    await renderView();

    expect(await screen.findByText("reaparecio")).toBeTruthy();
  });

  it("shows the error when switching off fails", async () => {
    await renderView();
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("Frame removido"));

    fireEvent.click(withinItemCard("token").getByTitle("Apagar"));

    expect(await screen.findByText("Frame removido")).toBeTruthy();
  });
});

describe("StorageView bulk actions", () => {
  it("exports the items as a key/value object", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    expect(vi.mocked(downloadJson)).toHaveBeenCalledWith("localstorage-app.example.com.json", {
      token: "abc",
      prefs: '{"theme":"dark"}',
    });
    expect(await screen.findByText("Storage exportado")).toBeTruthy();
  });

  it("clears the storage only after confirming", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Vaciar" }));
    expect(screen.getByText(`Vaciar el localStorage de ${ORIGIN} (incluidos los apagados)?`)).toBeTruthy();
    fireEvent.click(withinConfirmBar().getByRole("button", { name: "Cancelar" }));
    expect(queryConfirmBar()).toBeNull();
    expect(localStorage).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Vaciar" }));
    fireEvent.click(withinConfirmBar().getByRole("button", { name: "Vaciar" }));

    expect(await screen.findByText("Storage vaciado")).toBeTruthy();
    expect(await screen.findByText("Sin items en localStorage")).toBeTruthy();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage.getItem("wizard_step")).toBe("3");
  });
});

describe("StorageView import", () => {
  const openImportDialog = () => {
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    return within(screen.getByRole("dialog", { name: "Importar a localStorage" }));
  };

  it("writes every imported item into the page", async () => {
    await renderView();
    const dialog = openImportDialog();

    fireEvent.change(dialog.getByRole("textbox"), {
      target: { value: JSON.stringify({ locale: "es-AR", flags: { beta: true } }) },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("2/2 items importados")).toBeTruthy();
    expect(localStorage.getItem("locale")).toBe("es-AR");
    expect(localStorage.getItem("flags")).toBe('{"beta":true}');
    expect(await screen.findByText("locale")).toBeTruthy();
  });

  it("reports partial imports as an error", async () => {
    await renderView();
    const dialog = openImportDialog();
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("QuotaExceededError"));

    fireEvent.change(dialog.getByRole("textbox"), {
      target: {
        value: JSON.stringify([
          { key: "one", value: "1" },
          { key: "two", value: "2" },
        ]),
      },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    const toast = await screen.findByText("1/2 items importados");
    expect(toast.getAttribute("data-tone")).toBe("error");
    expect(localStorage.getItem("two")).toBe("2");
  });

  it("keeps the dialog open when the JSON has no items", async () => {
    await renderView();
    const dialog = openImportDialog();

    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "[{}]" } });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    expect(dialog.getByText("No se encontro ningun item para importar.")).toBeTruthy();
  });

  it("opens the dialog on load when the tab was opened to import storage", async () => {
    window.history.replaceState(null, "", "/index.html?import=storage");
    await renderView();

    expect(screen.getByRole("dialog", { name: "Importar a localStorage" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
