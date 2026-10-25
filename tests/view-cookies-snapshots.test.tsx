import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_SNAPSHOTS_KEY, DISABLED_COOKIES_KEY } from "@/lib/constants";
import { CookiesView } from "@/ui/views/CookiesView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { activeTabFor, renderWithToasts } from "./support/render-ui";
import { installCookieJar, liveCookie, type CookieJar } from "./support/view-cookies-jar";
import { buttonOf, closestElement } from "./support/view-dom";

const DOMAIN = "app.example.com";

let fake: FakeChrome;
let jar: CookieJar;

const adminCookie = {
  name: "role",
  value: "admin",
  domain: DOMAIN,
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "strict",
  hostOnly: true,
  expirationDate: null,
};

const renderView = async () => {
  renderWithToasts(<CookiesView activeTab={activeTabFor(`https://${DOMAIN}/`)} />);
  await screen.findByText("session_id");
};

const snapshotRow = (name: string) => within(closestElement(screen.getByText(name), ".row"));

const seedAdminSnapshot = async (): Promise<void> => {
  await fake.storage.local.set({
    [COOKIE_SNAPSHOTS_KEY]: {
      [DOMAIN]: {
        "snap-admin": {
          id: "snap-admin",
          name: "admin",
          createdAt: 1_700_000_000_000,
          cookies: [adminCookie],
        },
      },
    },
  });
};

beforeEach(() => {
  fake = installFakeChrome();
  jar = installCookieJar(fake, [liveCookie({ name: "session_id", value: "abc123" })]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CookieSnapshotsCard", () => {
  it("explains snapshots while there are none and needs a name to save", async () => {
    await renderView();

    expect(screen.getByText(/Todavia no guardaste ninguno/u)).toBeTruthy();
    const save = buttonOf(screen.getByRole("button", { name: "Guardar actual" }));
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Nombre del snapshot (admin, user readonly…)"), {
      target: { value: "   " },
    });
    expect(save.disabled).toBe(true);
  });

  it("saves the current cookies under a trimmed name", async () => {
    await renderView();
    const nameInput = screen.getByPlaceholderText("Nombre del snapshot (admin, user readonly…)");

    fireEvent.change(nameInput, { target: { value: "  readonly  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar actual" }));

    expect(await screen.findByText('Snapshot "readonly" guardado')).toBeTruthy();
    expect(snapshotRow("readonly").getByText(/1 cookie\(s\)/u)).toBeTruthy();
    expect(nameInput).toHaveProperty("value", "");
    const stored = fake.storage.local.data.get(COOKIE_SNAPSHOTS_KEY);
    expect(JSON.stringify(stored)).toContain('"value":"abc123"');
  });

  it("restores a snapshot replacing the live cookies and re-enabling restored ones", async () => {
    await seedAdminSnapshot();
    await fake.storage.local.set({
      [DISABLED_COOKIES_KEY]: { [DOMAIN]: { [`role\t${DOMAIN}\t/`]: { ...adminCookie, value: "guest" } } },
    });
    await renderView();
    await screen.findByText("admin");

    fireEvent.click(snapshotRow("admin").getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByText('Snapshot "admin" restaurado')).toBeTruthy();
    expect([...jar.cookies.keys()]).toEqual(["role"]);
    expect(jar.cookies.get("role")?.value).toBe("admin");
    expect(fake.storage.local.data.get(DISABLED_COOKIES_KEY)).toEqual({});
  });

  it("shows the error when a restore fails", async () => {
    await seedAdminSnapshot();
    fake.cookies.set.mockRejectedValueOnce(new Error("Cookie de otro dominio"));
    await renderView();
    await screen.findByText("admin");

    fireEvent.click(snapshotRow("admin").getByRole("button", { name: "Restaurar" }));

    expect(await screen.findByText("Cookie de otro dominio")).toBeTruthy();
  });

  it("deletes a snapshot", async () => {
    await seedAdminSnapshot();
    await renderView();
    await screen.findByText("admin");

    fireEvent.click(snapshotRow("admin").getByRole("button", { name: "Borrar" }));

    expect(await screen.findByText("Snapshot borrado")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("admin")).toBeNull();
    });
    expect(fake.storage.local.data.get(COOKIE_SNAPSHOTS_KEY)).toEqual({});
  });
});
