import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";
import { buildJsonTree } from "@/lib/json-tree";
import { JsonTree } from "@/ui/components/JsonTree";
import { JwtPanel } from "@/ui/components/JwtPanel";

const MILLISECONDS_PER_SECOND = 1000;
const ONE_HOUR_SECONDS = 3600;

afterEach(() => {
  cleanup();
});

const nested = buildJsonTree({
  user: { name: "Ana", roles: ["admin", { scope: "all" }] },
  active: true,
  count: 3,
  empty: null,
});

describe("JsonTree", () => {
  it("opens the first two levels and hides deeper ones", () => {
    render(<JsonTree root={nested} />);

    expect(screen.getByRole("button", { name: "Plegar raiz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plegar user" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desplegar roles" })).toBeTruthy();
    expect(screen.queryByText('"admin"')).toBeNull();
    expect(screen.getByText("true")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar name" })).toBeTruthy();
  });

  it("toggles a single branch", () => {
    render(<JsonTree root={nested} />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar roles" }));

    expect(screen.getByText('"admin"')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Plegar roles" }));

    expect(screen.queryByText('"admin"')).toBeNull();
  });

  it("expands and collapses everything from the toolbar", () => {
    render(<JsonTree root={nested} />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar todo" }));

    expect(screen.getByText('"all"')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Plegar todo" }));

    expect(screen.getByRole("button", { name: "Desplegar raiz" })).toBeTruthy();
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("labels copy buttons of unnamed leaves generically", () => {
    render(<JsonTree root={buildJsonTree(["uno"])} />);

    expect(screen.getByRole("button", { name: "Copiar 0" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plegar todo" })).toBeTruthy();
  });

  it("renders a bare leaf without a caret label", () => {
    render(<JsonTree root={buildJsonTree("suelto")} />);

    expect(screen.getByText('"suelto"')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar valor" })).toBeTruthy();
  });
});

const base64Url = (value: object): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replaceAll("=", "");

const jwtWith = (payload: object): string =>
  `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(payload)}.firma`;

const nowSeconds = (): number => Math.floor(Date.now() / MILLISECONDS_PER_SECOND);

describe("JwtPanel", () => {
  it("renders nothing for values that are not a JWT", () => {
    const { container } = render(<JwtPanel value="no es un token" />);

    expect(container.innerHTML).toBe("");
  });

  it("shows a valid token with its dates and payload", () => {
    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + ONE_HOUR_SECONDS;
    render(<JwtPanel value={jwtWith({ sub: "ana", iat: issuedAt, exp: expiresAt })} />);

    expect(screen.getByText("JWT")).toBeTruthy();
    expect(
      screen.getByText(`vigente · ${formatDateTime(expiresAt * MILLISECONDS_PER_SECOND)}`).className,
    ).toBe("badge success");
    expect(screen.getByText(`emitido ${formatDateTime(issuedAt * MILLISECONDS_PER_SECOND)}`)).toBeTruthy();
    expect(screen.getByText(/"sub": "ana"/)).toBeTruthy();
  });

  it("flags an expired token and omits missing dates", () => {
    const expiresAt = nowSeconds() - ONE_HOUR_SECONDS;
    const { container } = render(<JwtPanel value={jwtWith({ exp: expiresAt })} />);

    expect(screen.getByText(/^vencido/).className).toBe("badge danger");
    expect(screen.queryByText(/^emitido/)).toBeNull();
    expect(container.querySelectorAll(".badge")).toHaveLength(2);
  });

  it("shows only the JWT badge when the token has no dates", () => {
    const { container } = render(<JwtPanel value={jwtWith({ sub: "ana" })} />);

    expect(container.querySelectorAll(".badge")).toHaveLength(1);
  });
});
