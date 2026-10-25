import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISABLED_COOKIES_KEY } from "@/lib/constants";
import { downloadJson } from "@/lib/download";
import { CookiesView } from "@/ui/views/CookiesView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderWithToasts } from "./support/render-ui";
import { installCookieJar, liveCookie, type CookieJar } from "./support/view-cookies-jar";
import { buttonOf, queryConfirmBar, withinConfirmBar, withinItemCard } from "./support/view-dom";

vi.mock(import("@/lib/download"), async (importOriginal) => ({
  ...(await importOriginal()),
  downloadJson: vi.fn(),
}));

const PAGE_URL = "https://app.example.com/dashboard";
const DOMAIN = "app.example.com";

let fake: FakeChrome;
let jar: CookieJar;

const renderView = (url = PAGE_URL) => renderWithToasts(<CookiesView activeTab={activeTabFor(url)} />);

beforeEach(() => {
  fake = installFakeChrome();
  jar = installCookieJar(fake, [
    liveCookie({ name: "session_id", value: "abc123" }),
    liveCookie({ name: "theme", value: "dark", httpOnly: false }),
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("CookiesView listing", () => {
  it("lists the live cookies of the active domain sorted by name", async () => {
    renderView();

    expect(await screen.findByText("session_id")).toBeTruthy();
    expect(screen.getByText("theme")).toBeTruthy();
    expect(screen.getByText(`Cookies de ${DOMAIN}`)).toBeTruthy();
    const names = [...document.querySelectorAll(".item-name")].map((element) => element.textContent);
    expect(names).toEqual(["session_id", "theme"]);
    expect(fake.cookies.getAll).toHaveBeenCalledWith({ url: PAGE_URL, partitionKey: {} });
  });

  it("filters rows by name or value and explains when nothing matches", async () => {
    renderView();
    await screen.findByText("session_id");
    const search = screen.getByPlaceholderText("Filtrar por nombre o valor…");

    fireEvent.change(search, { target: { value: "DARK" } });
    expect(screen.queryByText("session_id")).toBeNull();
    expect(screen.getByText("theme")).toBeTruthy();

    fireEvent.change(search, { target: { value: "nope" } });
    expect(screen.getByText("Ninguna cookie coincide con el filtro")).toBeTruthy();
  });

  it("shows the empty state when the domain has no cookies", async () => {
    jar.cookies.clear();
    renderView();

    expect(await screen.findByText("No hay cookies para este dominio")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Exportar" })).disabled).toBe(true);
    expect(buttonOf(screen.getByRole("button", { name: "Borrar todas" })).disabled).toBe(true);
  });

  it("disables every page action when the tab cannot be managed", () => {
    renderWithToasts(<CookiesView activeTab={EMPTY_ACTIVE_TAB} />);

    expect(screen.getByText("Esta pestaña no tiene cookies http(s) para gestionar.")).toBeTruthy();
    expect(screen.getByText("Abri una pagina http(s)")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Importar" })).disabled).toBe(true);
    expect(buttonOf(screen.getByRole("button", { name: "Nueva cookie" })).disabled).toBe(true);
    expect(fake.cookies.getAll).not.toHaveBeenCalled();
  });

  it("falls back to an unpartitioned read and reports when both reads fail", async () => {
    fake.cookies.getAll
      .mockRejectedValueOnce(new Error("partitionKey no soportado"))
      .mockRejectedValueOnce(new Error("Sin permiso para leer cookies"));
    renderView();

    expect(await screen.findByText("Sin permiso para leer cookies")).toBeTruthy();
    expect(fake.cookies.getAll).toHaveBeenLastCalledWith({ url: PAGE_URL });
    expect(screen.getByText("No hay cookies para este dominio")).toBeTruthy();
  });

  it("reloads the jar on demand", async () => {
    renderView();
    await screen.findByText("session_id");
    jar.cookies.set("csrf", liveCookie({ name: "csrf", value: "tok" }));

    fireEvent.click(screen.getByTitle("Recargar"));

    expect(await screen.findByText("csrf")).toBeTruthy();
  });
});

describe("CookiesView switching cookies off and on", () => {
  it("stores a disabled copy, removes it from the browser and restores it later", async () => {
    renderView();
    await screen.findByText("theme");

    fireEvent.click(withinItemCard("theme").getByTitle("Apagar"));

    await waitFor(() => {
      expect(withinItemCard("theme").getByTitle("Restaurar")).toBeTruthy();
    });
    expect(jar.cookies.has("theme")).toBe(false);
    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: `https://${DOMAIN}/`, name: "theme" });
    const stored = fake.storage.local.data.get(DISABLED_COOKIES_KEY);
    expect(stored).toEqual({
      [DOMAIN]: {
        [`theme\t${DOMAIN}\t/`]: {
          name: "theme",
          value: "dark",
          domain: DOMAIN,
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "lax",
          hostOnly: true,
          expirationDate: null,
        },
      },
    });

    fireEvent.click(withinItemCard("theme").getByTitle("Restaurar"));

    await waitFor(() => {
      expect(withinItemCard("theme").getByTitle("Apagar")).toBeTruthy();
    });
    expect(jar.cookies.get("theme")?.value).toBe("dark");
    expect(fake.storage.local.data.get(DISABLED_COOKIES_KEY)).toEqual({});
  });

  it("flags a disabled cookie that the site wrote again", async () => {
    await fake.storage.local.set({
      [DISABLED_COOKIES_KEY]: {
        [DOMAIN]: {
          [`session_id\t${DOMAIN}\t/`]: {
            name: "session_id",
            value: "old",
            domain: DOMAIN,
            path: "/",
            secure: true,
            httpOnly: true,
            sameSite: "lax",
            hostOnly: true,
            expirationDate: null,
          },
        },
      },
    });
    renderView();

    expect(await screen.findByText("reaparecio")).toBeTruthy();
    expect(withinItemCard("session_id").getByText("reaparecio")).toBeTruthy();
  });

  it("shows the browser error when switching a cookie off fails", async () => {
    fake.cookies.remove.mockRejectedValueOnce(new Error("No se puede borrar una cookie de otro sitio"));
    renderView();
    await screen.findByText("theme");

    fireEvent.click(withinItemCard("theme").getByTitle("Apagar"));

    expect(await screen.findByText("No se puede borrar una cookie de otro sitio")).toBeTruthy();
  });
});

describe("CookiesView bulk actions", () => {
  it("exports the live cookies as JSON named after the host", async () => {
    renderView();
    await screen.findByText("session_id");

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    expect(vi.mocked(downloadJson)).toHaveBeenCalledWith(
      `cookies-${DOMAIN}.json`,
      expect.arrayContaining([expect.objectContaining({ name: "session_id", value: "abc123" })]),
    );
    expect(await screen.findByText("Cookies exportadas")).toBeTruthy();
  });

  it("asks before deleting every cookie and can be cancelled", async () => {
    renderView();
    await screen.findByText("session_id");

    fireEvent.click(screen.getByRole("button", { name: "Borrar todas" }));
    expect(screen.getByText(`Borrar las 2 cookies de ${DOMAIN} (incluidas las apagadas)?`)).toBeTruthy();
    fireEvent.click(withinConfirmBar().getByRole("button", { name: "Cancelar" }));

    expect(queryConfirmBar()).toBeNull();
    expect(fake.cookies.remove).not.toHaveBeenCalled();
  });

  it("deletes live and disabled cookies after confirming", async () => {
    renderView();
    await screen.findByText("session_id");
    fireEvent.click(withinItemCard("theme").getByTitle("Apagar"));
    await waitFor(() => {
      expect(withinItemCard("theme").getByTitle("Restaurar")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Borrar todas" }));
    fireEvent.click(withinConfirmBar().getByRole("button", { name: "Borrar todas" }));

    expect(await screen.findByText("Cookies borradas")).toBeTruthy();
    expect(await screen.findByText("No hay cookies para este dominio")).toBeTruthy();
    expect(jar.cookies.size).toBe(0);
    expect(fake.storage.local.data.get(DISABLED_COOKIES_KEY)).toEqual({});
  });
});

describe("CookiesView import", () => {
  const openImportDialog = () => {
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    return within(screen.getByRole("dialog", { name: "Importar cookies" }));
  };

  it("imports the cookies pasted in the dialog and reports the count", async () => {
    renderView();
    await screen.findByText("session_id");
    const dialog = openImportDialog();

    fireEvent.change(dialog.getByRole("textbox"), {
      target: {
        value: JSON.stringify([
          { name: "lang", value: "es", domain: DOMAIN, path: "/" },
          { name: "consent", value: "yes", domain: ".example.com", path: "/" },
        ]),
      },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("2/2 cookies importadas")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("consent")).toBeTruthy();
    expect(jar.cookies.get("consent")?.domain).toBe(".example.com");
  });

  it("reports partial imports as an error toast", async () => {
    fake.cookies.set.mockRejectedValueOnce(new Error("Cookie rechazada"));
    renderView();
    await screen.findByText("session_id");
    const dialog = openImportDialog();

    fireEvent.change(dialog.getByRole("textbox"), {
      target: {
        value: JSON.stringify([
          { name: "first", value: "1" },
          { name: "second", value: "2" },
        ]),
      },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    const toast = await screen.findByText("1/2 cookies importadas");
    expect(toast.getAttribute("data-tone")).toBe("error");
  });

  it("keeps the dialog open with the parser error when nothing is importable", async () => {
    renderView();
    await screen.findByText("session_id");
    const dialog = openImportDialog();

    fireEvent.change(dialog.getByRole("textbox"), { target: { value: JSON.stringify([{ value: "x" }]) } });
    fireEvent.click(dialog.getByRole("button", { name: "Importar" }));

    expect(dialog.getByText("No se encontro ninguna cookie para importar.")).toBeTruthy();
    expect(fake.cookies.set).not.toHaveBeenCalled();
  });

  it("opens the import dialog straight away when the tab was opened to import cookies", async () => {
    window.history.replaceState(null, "", "/index.html?import=cookies");
    renderView();

    expect(screen.getByRole("dialog", { name: "Importar cookies" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
