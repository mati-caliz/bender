import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISABLED_COOKIES_KEY } from "@/lib/constants";
import { CookiesView } from "@/ui/views/CookiesView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { activeTabFor, renderWithToasts } from "./support/render-ui";
import { installCookieJar, liveCookie, type CookieJar } from "./support/view-cookies-jar";
import { buttonOf, inputOf } from "./support/view-dom";

const DOMAIN = "app.example.com";
const EXPIRATION = 1_900_000_000;
const DISABLED_KEY = `legacy\t${DOMAIN}\t/`;

let fake: FakeChrome;
let jar: CookieJar;

const renderView = async (url = `https://${DOMAIN}/`) => {
  const view = renderWithToasts(<CookiesView activeTab={activeTabFor(url)} />);
  await screen.findByText("session_id");
  return view;
};

const expandCookie = (name: string): void => {
  fireEvent.click(screen.getByText(name));
};

const disabledSnapshot = {
  name: "legacy",
  value: "v1",
  domain: DOMAIN,
  path: "/",
  secure: false,
  httpOnly: false,
  sameSite: "lax",
  hostOnly: true,
  expirationDate: null,
};

beforeEach(() => {
  fake = installFakeChrome();
  jar = installCookieJar(fake, [
    liveCookie({ name: "session_id", value: "abc123" }),
    liveCookie({ name: "remember", value: "1", expirationDate: EXPIRATION, session: false }),
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CookiesView editing an existing cookie", () => {
  it("expands a cookie, saves the edited value and keeps it open", async () => {
    await renderView();
    expandCookie("session_id");

    fireEvent.change(screen.getByDisplayValue("abc123"), { target: { value: "xyz789" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Cookie guardada")).toBeTruthy();
    expect(fake.cookies.remove).not.toHaveBeenCalled();
    expect(jar.cookies.get("session_id")?.value).toBe("xyz789");
    expect(await screen.findByDisplayValue("xyz789")).toBeTruthy();
  });

  it("removes the old cookie when the name changes and collapses the card", async () => {
    await renderView();
    expandCookie("session_id");

    fireEvent.change(screen.getByDisplayValue("session_id"), { target: { value: "sid" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("sid")).toBeTruthy();
    expect(fake.cookies.remove).toHaveBeenCalledWith({ url: `https://${DOMAIN}/`, name: "session_id" });
    expect(jar.cookies.has("session_id")).toBe(false);
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
  });

  it("sends the edited flags, SameSite, domain and expiration to chrome", async () => {
    await renderView();
    expandCookie("remember");

    const expiration = inputOf(screen.getByLabelText("Expira"));
    expect(expiration.value).not.toBe("");
    fireEvent.change(expiration, { target: { value: "2031-05-10T08:30" } });
    fireEvent.click(screen.getByLabelText("Secure"));
    fireEvent.click(screen.getByLabelText("HttpOnly"));
    fireEvent.click(screen.getByLabelText("Solo este host"));
    fireEvent.change(screen.getByDisplayValue("SameSite: Lax"), { target: { value: "strict" } });
    fireEvent.change(screen.getByDisplayValue("/"), { target: { value: "/app" } });
    fireEvent.change(screen.getByDisplayValue(DOMAIN), { target: { value: ".example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(fake.cookies.set).toHaveBeenCalledTimes(1);
    });
    expect(fake.cookies.set).toHaveBeenCalledWith({
      url: "http://example.com/app",
      name: "remember",
      value: "1",
      path: "/app",
      secure: false,
      httpOnly: false,
      sameSite: "strict",
      domain: ".example.com",
      expirationDate: Math.floor(new Date("2031-05-10T08:30").getTime() / 1000),
    });
  });

  it("ignores unknown SameSite values and toggles between session and persistent", async () => {
    await renderView();
    expandCookie("session_id");
    const sameSite = screen.getByDisplayValue("SameSite: Lax");

    fireEvent.change(sameSite, { target: { value: "bogus" } });
    expect(screen.getByDisplayValue("SameSite: Lax")).toBe(sameSite);

    expect(screen.queryByLabelText("Expira")).toBeNull();
    fireEvent.click(screen.getByLabelText("Cookie de sesion"));
    expect(inputOf(screen.getByLabelText("Expira")).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u);
    fireEvent.click(screen.getByLabelText("Cookie de sesion"));
    expect(screen.queryByLabelText("Expira")).toBeNull();
  });

  it("deletes the cookie from the browser", async () => {
    await renderView();
    expandCookie("session_id");

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(await screen.findByText("Cookie borrada")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("session_id")).toBeNull();
    });
  });

  it("closes the form without saving from the close button or the header", async () => {
    await renderView();
    expandCookie("session_id");
    fireEvent.change(screen.getByDisplayValue("abc123"), { target: { value: "draft" } });

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByDisplayValue("draft")).toBeNull();

    expandCookie("session_id");
    expect(screen.getByDisplayValue("abc123")).toBeTruthy();
    expandCookie("session_id");
    expect(screen.queryByDisplayValue("abc123")).toBeNull();
    expect(fake.cookies.set).not.toHaveBeenCalled();
  });

  it("shows the chrome error when saving is rejected", async () => {
    fake.cookies.set.mockRejectedValueOnce(new Error('Failed to parse or set cookie named "session_id".'));
    await renderView();
    expandCookie("session_id");

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText('Failed to parse or set cookie named "session_id".')).toBeTruthy();
  });

  it("uses a placeholder name for nameless cookies and requires a name to save", async () => {
    jar.cookies.set("", liveCookie({ name: "", value: "anonymous" }));
    await renderView();

    expandCookie("(sin nombre)");

    expect(buttonOf(screen.getByRole("button", { name: "Guardar" })).disabled).toBe(true);
  });
});

describe("CookiesView editing a switched-off cookie", () => {
  beforeEach(async () => {
    await fake.storage.local.set({
      [DISABLED_COOKIES_KEY]: { [DOMAIN]: { [DISABLED_KEY]: disabledSnapshot } },
    });
  });

  it("updates only the stored copy when saving", async () => {
    await renderView();
    await screen.findByText("legacy");
    expandCookie("legacy");

    fireEvent.change(screen.getByDisplayValue("v1"), { target: { value: "v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(fake.storage.local.data.get(DISABLED_COOKIES_KEY)).toEqual({
        [DOMAIN]: { [DISABLED_KEY]: { ...disabledSnapshot, value: "v2" } },
      });
    });
    expect(fake.cookies.set).not.toHaveBeenCalled();
  });

  it("forgets the stored copy when deleting", async () => {
    await renderView();
    await screen.findByText("legacy");
    expandCookie("legacy");

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(await screen.findByText("Cookie borrada")).toBeTruthy();
    expect(fake.storage.local.data.get(DISABLED_COOKIES_KEY)).toEqual({});
    expect(fake.cookies.remove).not.toHaveBeenCalled();
    expect(screen.queryByText("legacy")).toBeNull();
  });
});

describe("CookiesView creating a cookie", () => {
  it("prefills the host and https flag and creates the cookie", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Nueva cookie" }));
    expect(buttonOf(screen.getByRole("button", { name: "Guardar" })).disabled).toBe(true);
    expect(inputOf(screen.getByLabelText("Secure")).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "feature_flag" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "on" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Cookie creada")).toBeTruthy();
    expect(fake.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ url: `https://${DOMAIN}/`, name: "feature_flag", value: "on", secure: true }),
    );
    expect(await screen.findByText("feature_flag")).toBeTruthy();
  });

  it("starts insecure on http pages and can be discarded or closed", async () => {
    await renderView(`http://${DOMAIN}/login`);

    fireEvent.click(screen.getByRole("button", { name: "Nueva cookie" }));
    expect(inputOf(screen.getByLabelText("Secure")).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nueva cookie" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
    expect(fake.cookies.set).not.toHaveBeenCalled();
  });
});
