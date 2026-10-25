import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shortUrl } from "@/lib/format";
import type { ViewId } from "@/ui/App";
import { NetworkView } from "@/ui/views/NetworkView";
import type { NetworkEntry } from "@/types";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { renderStateful } from "./support/render-ui";
import { installClipboard } from "./support/view-dom";
import { installNetworkBackground, networkEntry, stateWithNetwork } from "./support/view-network-entries";

let fake: FakeChrome;
let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

const renderWithEntry = async (entry: NetworkEntry, captureBodies = false) => {
  installNetworkBackground(fake, [entry]);
  const onNavigate = vi.fn<(view: ViewId) => void>();
  const view = renderStateful(
    (state, update) => <NetworkView state={state} update={update} onNavigate={onNavigate} />,
    stateWithNetwork({ enabled: true, captureBodies }),
  );
  await screen.findByText(shortUrl(entry.url));
  return { ...view, onNavigate };
};

const openDetail = (path: string) => {
  fireEvent.click(screen.getByText(path));
  const detail = document.querySelector(".net-detail");
  if (!(detail instanceof HTMLElement)) throw new Error("No se abrio el detalle");
  return within(detail);
};

beforeEach(() => {
  fake = installFakeChrome();
  writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  installClipboard(writeText);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("NetworkEntryDetail", () => {
  it("shows the request metadata, rules, headers and bodies", async () => {
    await renderWithEntry(
      networkEntry({
        url: "https://api.example.com/orders",
        method: "POST",
        fromCache: true,
        finishedAt: 1_700_000_001_500,
        matchedRuleLabels: ["Header X-Debug"],
        requestHeaders: [{ name: "X-Debug", value: "true" }],
        requestBody: '{"sku":"A1"}',
        responseBody: '{"id":42}',
        bodyTruncated: true,
      }),
      true,
    );

    const detail = openDetail("/orders");

    expect(detail.getByText("xmlhttprequest")).toBeTruthy();
    expect(detail.getByText("cache")).toBeTruthy();
    expect(detail.getByText("1.50 s")).toBeTruthy();
    expect(detail.getByText("https://api.example.com/orders")).toBeTruthy();
    expect(detail.getByText("Reglas aplicadas")).toBeTruthy();
    expect(detail.getByText("X-Debug")).toBeTruthy();
    expect(detail.getByText("Cuerpo enviado")).toBeTruthy();
    expect(detail.getByText('{\n  "id": 42\n}', { normalizer: (text) => text })).toBeTruthy();
    expect(detail.getAllByText("· truncado")).toHaveLength(2);
    expect(detail.queryByText(/Los cuerpos no se estan capturando/u)).toBeNull();
    expect(screen.queryByText(/Se guardan las ultimas/u)).toBeNull();
  });

  it("explains missing headers, bodies and shows network errors", async () => {
    await renderWithEntry(
      networkEntry({
        url: "https://api.example.com/down",
        phase: "error",
        statusCode: null,
        finishedAt: null,
        error: "net::ERR_CONNECTION_REFUSED",
        requestHeaders: [],
        responseHeaders: [],
      }),
    );

    const detail = openDetail("/down");

    expect(detail.getByText("net::ERR_CONNECTION_REFUSED")).toBeTruthy();
    expect(detail.getAllByText("Sin datos capturados.")).toHaveLength(2);
    expect(detail.queryByText("Reglas aplicadas")).toBeNull();
    expect(detail.queryByText(/ ms$/u)).toBeNull();
    expect(detail.getByText(/Los cuerpos no se estan capturando/u)).toBeTruthy();
  });

  it("does not ask to capture bodies for mocked responses", async () => {
    await renderWithEntry(
      networkEntry({
        url: "https://api.example.com/mocked",
        phase: "mocked",
        source: "mock",
        responseBody: "ok",
      }),
    );

    const detail = openDetail("/mocked");

    expect(detail.getByText("Cuerpo recibido")).toBeTruthy();
    expect(detail.queryByText(/Los cuerpos no se estan capturando/u)).toBeNull();
    expect(detail.getByText("120 ms")).toBeTruthy();
  });

  it("collapses when the same row is clicked again", async () => {
    await renderWithEntry(networkEntry());

    openDetail("/api/users?page=2");
    fireEvent.click(screen.getByText("/api/users?page=2"));

    expect(document.querySelector(".net-detail")).toBeNull();
    expect(screen.getByText(/Se guardan las ultimas/u)).toBeTruthy();
  });
});

describe("NetworkView request actions", () => {
  it("copies the request as cURL and as fetch", async () => {
    await renderWithEntry(networkEntry());
    const detail = openDetail("/api/users?page=2");

    fireEvent.click(detail.getByRole("button", { name: "Copiar cURL" }));
    expect(await screen.findByText("cURL copiado")).toBeTruthy();
    expect(writeText.mock.calls[0]?.[0]).toContain("curl");
    expect(writeText.mock.calls[0]?.[0]).toContain("https://api.example.com/api/users?page=2");

    fireEvent.click(detail.getByRole("button", { name: "Copiar fetch" }));
    expect(await screen.findByText("fetch copiado")).toBeTruthy();
    expect(writeText.mock.calls[1]?.[0]).toContain("fetch(");
  });

  it("reports when the clipboard rejects the copy", async () => {
    writeText.mockRejectedValueOnce(new Error("Document is not focused."));
    await renderWithEntry(networkEntry());
    const detail = openDetail("/api/users?page=2");

    fireEvent.click(detail.getByRole("button", { name: "Copiar cURL" }));

    const toast = await screen.findByText("No se pudo copiar al portapapeles");
    expect(toast.getAttribute("data-tone")).toBe("error");
  });

  it("turns the response into a mock rule and navigates to the rules view", async () => {
    const { currentState, onNavigate } = await renderWithEntry(
      networkEntry({ statusCode: 201, responseBody: '[{"id":1}]' }),
    );
    const detail = openDetail("/api/users?page=2");

    fireEvent.click(detail.getByRole("button", { name: "Convertir en mock" }));

    expect(await screen.findByText("Mock creado desde la response")).toBeTruthy();
    expect(onNavigate).toHaveBeenCalledWith("rules");
    const [rule] = currentState().trafficRules;
    expect(rule?.name).toBe("Mock /api/users?page=2");
    expect(rule?.action).toEqual(
      expect.objectContaining({
        kind: "mock",
        status: 201,
        contentType: "application/json",
        body: '[{"id":1}]',
      }),
    );
  });
});
