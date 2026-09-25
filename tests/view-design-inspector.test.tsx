import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadJson } from "@/lib/download";
import { DesignView } from "@/ui/views/DesignView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { EMPTY_ACTIVE_TAB, activeTabFor, renderWithToasts } from "./support/render-ui";
import { installDesignPage, sampleAudit, type DesignPage } from "./support/view-design-page";
import { buttonOf, installClipboard } from "./support/view-dom";

vi.mock(import("@/lib/download"), async (importOriginal) => ({
  ...(await importOriginal()),
  downloadJson: vi.fn(),
}));

const PAGE_URL = "https://app.example.com/pricing";
const TAB_ID = 7;

let fake: FakeChrome;
let page: DesignPage;

const renderView = () => renderWithToasts(<DesignView activeTab={activeTabFor(PAGE_URL, TAB_ID)} />);

const renderAudited = async () => {
  const view = renderView();
  await screen.findByText("app.example.com · 120 elementos · raiz 16px");
  return view;
};

beforeEach(() => {
  fake = installFakeChrome();
  page = installDesignPage(fake, { audit: sampleAudit(), overlay: undefined });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("DesignView audit", () => {
  it("audits the page on load and summarizes it in the subtitle", async () => {
    await renderAudited();

    expect(screen.getByText("3 colores detectados")).toBeTruthy();
    expect(fake.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: TAB_ID }, args: [4000, 60] }),
    );
    expect(page.commands).toEqual([{ channel: "bender-design", type: "ping" }]);
  });

  it("copies a palette color when its swatch is clicked", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    installClipboard(writeText);
    await renderAudited();

    fireEvent.click(screen.getByText("#f9fafb"));

    expect(writeText).toHaveBeenCalledWith("#f9fafb");
    expect(await screen.findByText("#f9fafb copiado")).toBeTruthy();
    expect(screen.getByText("fondo · borde · 12")).toBeTruthy();
  });

  it("exports the audited tokens", async () => {
    await renderAudited();

    fireEvent.click(screen.getByRole("button", { name: "Exportar tokens" }));

    expect(vi.mocked(downloadJson)).toHaveBeenCalledWith("tokens-app.example.com.json", sampleAudit());
    expect(await screen.findByText("Tokens exportados")).toBeTruthy();
  });

  it("re-runs the audit and shows the loading label meanwhile", async () => {
    await renderAudited();
    page.audit = sampleAudit({ elementCount: 300 });

    fireEvent.click(screen.getByRole("button", { name: "Reanalizar" }));

    expect(screen.getByRole("button", { name: "Analizando…" })).toBeTruthy();
    expect(await screen.findByText("app.example.com · 300 elementos · raiz 16px")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Reanalizar" })).disabled).toBe(false);
  });

  it("shows the scripting error when the audit fails", async () => {
    fake.scripting.executeScript.mockRejectedValue(new Error("Cannot access contents of the page"));
    renderView();

    expect(await screen.findByText("Cannot access contents of the page")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Exportar tokens" })).disabled).toBe(true);
    expect(screen.getByText("Sin colores")).toBeTruthy();
  });

  it("treats an empty injection result as no audit", async () => {
    fake.scripting.executeScript.mockResolvedValue([]);
    renderView();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reanalizar" })).toBeTruthy();
    });
    expect(screen.getByText("Inspector visual, regla y tokens de la pagina")).toBeTruthy();
  });

  it("explains that only http(s) pages can be analyzed", () => {
    renderWithToasts(<DesignView activeTab={EMPTY_ACTIVE_TAB} />);

    expect(screen.getByText("Abri una pagina http(s) para analizar su diseño.")).toBeTruthy();
    expect(buttonOf(screen.getByRole("button", { name: "Activar" })).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reanalizar" }));
    expect(screen.getByText("Abri una pagina http(s) para analizar su diseño.")).toBeTruthy();
    expect(fake.scripting.executeScript).not.toHaveBeenCalled();
    expect(fake.tabs.sendMessage).not.toHaveBeenCalled();
  });
});

describe("DesignView inspector overlay", () => {
  it("activates the chosen tool by injecting the overlay", async () => {
    await renderAudited();
    expect(screen.getByText("Inactivo")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Espaciado" }));
    expect(
      screen.getByText(
        "Click fija un elemento base y al pasar por otro te muestra el gap horizontal y vertical.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    expect(await screen.findByText("Activo · Esc en la pagina lo cierra")).toBeTruthy();
    expect(fake.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: TAB_ID, allFrames: false },
      files: ["content/design-overlay.js"],
    });
    expect(page.commands).toContainEqual({ channel: "bender-design", type: "set-tool", tool: "spacing" });
    expect(screen.getByRole("button", { name: "Cambiar herramienta" })).toBeTruthy();
  });

  it("follows the tool already active in the page and can switch it off", async () => {
    page.overlay = { active: true, tool: "ruler" };
    await renderAudited();

    expect(await screen.findByText("Activo · Esc en la pagina lo cierra")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regla" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByText(
        "Arrastrá sobre la pagina para medir cualquier distancia, con guias en todo el viewport.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    expect(await screen.findByText("Inactivo")).toBeTruthy();
    expect(page.commands).toContainEqual({ channel: "bender-design", type: "close" });
  });

  it("closes the overlay even when the page no longer answers", async () => {
    page.overlay = { active: true, tool: "inspect" };
    await renderAudited();
    await screen.findByText("Activo · Esc en la pagina lo cierra");
    fake.tabs.sendMessage.mockRejectedValue(new Error("Receiving end does not exist."));

    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    expect(await screen.findByText("Inactivo")).toBeTruthy();
  });

  it("stays inactive when the ping fails or the overlay does not answer", async () => {
    fake.tabs.sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist."));
    await renderAudited();
    expect(screen.getByText("Inactivo")).toBeTruthy();

    fake.tabs.sendMessage.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    await waitFor(() => {
      expect(fake.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Inactivo")).toBeTruthy();
  });

  it("shows the injection error when the overlay cannot be loaded", async () => {
    await renderAudited();
    fake.scripting.executeScript.mockRejectedValueOnce(new Error("Frame with ID 0 was removed."));

    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    expect(await screen.findByText("Frame with ID 0 was removed.")).toBeTruthy();
  });
});
