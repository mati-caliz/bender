import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESIGN_PICKS_KEY } from "@/lib/constants";
import { DesignView } from "@/ui/views/DesignView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { activeTabFor, renderWithToasts } from "./support/render-ui";
import { installDesignPage, pick, sampleAudit, type DesignPage } from "./support/view-design-page";
import { closestElement, installClipboard, inputOf } from "./support/view-dom";

let fake: FakeChrome;
let page: DesignPage;
let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

const renderAudited = async () => {
  renderWithToasts(<DesignView activeTab={activeTabFor("https://app.example.com/")} />);
  await screen.findByText("app.example.com · 120 elementos · raiz 16px");
};

const cardTitled = (title: string) => within(closestElement(screen.getByText(title), ".card"));

const textInputWithValue = (value: string): HTMLInputElement => {
  const input = screen
    .getAllByDisplayValue(value)
    .map(inputOf)
    .find((candidate) => candidate.type === "text");
  if (input === undefined) throw new Error(`No hay un input de texto con ${value}`);
  return input;
};

beforeEach(() => {
  fake = installFakeChrome();
  page = installDesignPage(fake, { audit: sampleAudit(), overlay: undefined });
  writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  installClipboard(writeText);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("DesignView token cards", () => {
  it("shows spacings and radii sorted numerically, plus shadows", async () => {
    await renderAudited();

    const spacings = cardTitled("Espaciados")
      .getAllByTitle(/usos$/u)
      .map((chip) => chip.firstChild?.textContent);
    expect(spacings).toEqual(["4px", "8px", "16px"]);
    const shapes = cardTitled("Radios y sombras")
      .getAllByTitle(/usos$/u)
      .map((chip) => chip.firstChild?.textContent);
    expect(shapes).toEqual(["2px", "8px", "0 1px 2px rgba(0,0,0,.1)"]);
  });

  it("lists fonts with their sizes, weights and a copyable family", async () => {
    await renderAudited();

    expect(screen.getByText("Inter")).toBeTruthy();
    expect(screen.getByText("14px · 16px — pesos 400 · 700")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Copiar font-family"));
    expect(writeText).toHaveBeenCalledWith('"Inter", system-ui, sans-serif');
  });

  it("lists root variables, with a swatch only for colors", async () => {
    await renderAudited();

    const variables = cardTitled("Variables CSS");
    expect(variables.getByText("2 tokens en :root")).toBeTruthy();
    expect(
      closestElement(variables.getByText("--brand"), ".token-row").querySelector(".swatch-dot"),
    ).not.toBeNull();
    expect(
      closestElement(variables.getByText("--radius"), ".token-row").querySelector(".swatch-dot"),
    ).toBeNull();
    fireEvent.click(
      within(closestElement(variables.getByText("--brand"), ".token-row")).getByTitle("Copiar var()"),
    );
    expect(writeText).toHaveBeenCalledWith("var(--brand)");
  });

  it("shows only shadows when the page has no radii", async () => {
    page.audit = sampleAudit({ radii: [], spacings: [], fonts: [], variables: [] });
    await renderAudited();

    expect(cardTitled("Radios y sombras").getByText("0 1px 2px rgba(0,0,0,.1)")).toBeTruthy();
    expect(screen.getByText("Sin espaciados")).toBeTruthy();
    expect(screen.getByText("Sin tipografias detectadas")).toBeTruthy();
    expect(screen.getByText("Sin variables en :root")).toBeTruthy();
  });

  it("falls back to empty states when the audit found nothing", async () => {
    page.audit = sampleAudit({ colors: [], radii: [], shadows: [] });
    await renderAudited();

    expect(screen.getByText("0 colores detectados")).toBeTruthy();
    expect(screen.getByText("Sin colores")).toBeTruthy();
    expect(screen.getByText("Sin radios ni sombras")).toBeTruthy();
    expect(textInputWithValue("#111827")).toBeTruthy();
    expect(textInputWithValue("#ffffff")).toBeTruthy();
  });
});

describe("DesignView contrast card", () => {
  it("starts from the audited text and background colors", async () => {
    await renderAudited();

    expect(textInputWithValue("#1f2937")).toBeTruthy();
    expect(textInputWithValue("#f9fafb")).toBeTruthy();
  });

  it("grades the contrast of the typed colors against WCAG", async () => {
    await renderAudited();

    fireEvent.change(textInputWithValue("#1f2937"), { target: { value: "#000000" } });
    fireEvent.change(textInputWithValue("#f9fafb"), { target: { value: "#ffffff" } });

    expect(screen.getByText("21.00:1").className).toBe("badge success");
    expect(screen.getByText("AAA normal").className).toBe("badge success");
    fireEvent.click(screen.getByTitle("Copiar rgb del texto"));
    expect(writeText).toHaveBeenCalledWith("rgb(0, 0, 0)");
    fireEvent.click(screen.getByTitle("Copiar hsl del texto"));
    expect(writeText).toHaveBeenCalledTimes(2);

    fireEvent.change(textInputWithValue("#000000"), { target: { value: "#cccccc" } });
    expect(screen.getByText("AA normal").className).toBe("badge warning");
    expect(screen.getByText("AA grande").className).toBe("badge warning");
  });

  it("flags invalid colors and hides the copy buttons", async () => {
    await renderAudited();

    fireEvent.change(textInputWithValue("#1f2937"), { target: { value: "not-a-color" } });

    expect(screen.getByText("color invalido").className).toBe("badge danger");
    expect(screen.queryByTitle("Copiar rgb del texto")).toBeNull();
  });
});

describe("DesignView saved picks", () => {
  it("explains how to save picks while there are none", async () => {
    await renderAudited();

    expect(screen.getByText("Nada guardado todavia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Limpiar" })).toBeNull();
  });

  it("lists stored picks, removes one and clears the rest", async () => {
    await fake.storage.local.set({
      [DESIGN_PICKS_KEY]: [
        pick(),
        pick({ id: "pick-2", kind: "measure", label: "24 × 120", detail: "gap vertical", color: null }),
      ],
    });
    await renderAudited();

    expect(await screen.findByText("background de button.primary")).toBeTruthy();
    expect(screen.getByText("gap vertical")).toBeTruthy();
    const measureRow = within(closestElement(screen.getByText("24 × 120"), ".token-row"));
    fireEvent.click(measureRow.getByTitle("Borrar"));

    await waitFor(() => {
      expect(screen.queryByText("gap vertical")).toBeNull();
    });
    expect(fake.storage.local.data.get(DESIGN_PICKS_KEY)).toEqual([pick()]);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(await screen.findByText("Nada guardado todavia")).toBeTruthy();
    expect(fake.storage.local.data.get(DESIGN_PICKS_KEY)).toEqual([]);
  });

  it("shows picks saved from the page while the view is open", async () => {
    await renderAudited();

    await fake.storage.local.set({
      [DESIGN_PICKS_KEY]: [pick({ kind: "element", label: "button.primary", color: null })],
    });

    expect(await screen.findByText("button.primary")).toBeTruthy();
  });
});
