import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CORS_CONFIG } from "@/lib/constants";
import { CorsView } from "@/ui/views/CorsView";
import type { CorsConfig, ToolkitState } from "@/types";
import { stateWith } from "./support/dnr-fixtures";
import { activeTabFor, renderStateful } from "./support/render-ui";
import { quickToggleSwitch, switchLabelled } from "./support/view-helpers";

afterEach(() => {
  cleanup();
});

const renderCors = (cors: Partial<CorsConfig> = {}) =>
  renderStateful(
    (state, update) => (
      <CorsView state={state} update={update} activeTab={activeTabFor("https://app.test/")} />
    ),
    stateWith({ cors: { ...DEFAULT_CORS_CONFIG, ...cors } }),
  );

const corsOf = (view: { currentState: () => ToolkitState }): CorsConfig => view.currentState().cors;

const typeInto = (label: RegExp, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe("CorsView", () => {
  it("turns the CORS rewrite on and off", () => {
    const view = renderCors();

    expect(screen.getByText("El navegador aplica el CORS real del servidor.")).toBeTruthy();
    fireEvent.click(quickToggleSwitch(view.container));

    expect(corsOf(view).enabled).toBe(true);
    expect(screen.getByText("Las respuestas llegan con los permisos de abajo.")).toBeTruthy();
  });

  it("warns about wildcard origin with credentials and asks for a custom origin", () => {
    const view = renderCors();

    expect(screen.queryByText(/cuando la request manda cookies/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Comodin *" }));
    expect(corsOf(view).allowOrigin).toBe("wildcard");
    expect(screen.getByText(/cuando la request manda cookies/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Permitir credenciales (cookies y auth headers)"));
    expect(corsOf(view).allowCredentials).toBe(false);
    expect(screen.queryByText(/cuando la request manda cookies/)).toBeNull();

    expect(screen.queryByPlaceholderText("https://app.midominio.com")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fijo" }));
    fireEvent.change(screen.getByPlaceholderText("https://app.midominio.com"), {
      target: { value: "https://front.test" },
    });

    expect(corsOf(view)).toMatchObject({ allowOrigin: "custom", customOrigin: "https://front.test" });
  });

  it("edits methods, headers and max-age", () => {
    const view = renderCors();

    typeInto(/^Metodos permitidos/, "GET");
    typeInto(/^Headers permitidos/, "Authorization");
    typeInto(/^Headers expuestos/, "X-Total");
    typeInto(/^Max-Age/, "60");

    expect(corsOf(view)).toMatchObject({
      allowMethods: "GET",
      allowHeaders: "Authorization",
      exposeHeaders: "X-Total",
      maxAgeSeconds: 60,
    });

    typeInto(/^Max-Age/, "-1");
    expect(corsOf(view).maxAgeSeconds).toBe(600);
    typeInto(/^Max-Age/, "");
    expect(corsOf(view).maxAgeSeconds).toBe(600);
  });

  it("drops the security policies on request", () => {
    const view = renderCors();

    fireEvent.click(screen.getByLabelText("Eliminar Content-Security-Policy"));
    fireEvent.click(screen.getByLabelText(/^Eliminar X-Frame-Options/));

    expect(corsOf(view)).toMatchObject({ removeContentSecurityPolicy: true, removeFrameOptions: true });
  });

  it("edits the scope with the current hostname as suggestion", () => {
    const view = renderCors();

    const [includeCurrentHost] = screen.getAllByRole("button", { name: "app.test" });
    if (includeCurrentHost === undefined) throw new Error("Falta la sugerencia del dominio actual");
    fireEvent.click(includeCurrentHost);
    fireEvent.click(switchLabelled("Solo la pestaña activa"));

    expect(corsOf(view).scope).toMatchObject({ includeDomains: ["app.test"], activeTabOnly: true });
  });

  it("restores the defaults but keeps the on/off state", () => {
    const view = renderCors({
      enabled: true,
      allowOrigin: "custom",
      customOrigin: "https://x.test",
      maxAgeSeconds: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "Restaurar valores" }));

    expect(corsOf(view)).toEqual({ ...DEFAULT_CORS_CONFIG, enabled: true });
  });
});
