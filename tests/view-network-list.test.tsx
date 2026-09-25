import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadJson } from "@/lib/download";
import type { ViewId } from "@/ui/App";
import { NetworkView } from "@/ui/views/NetworkView";
import { installFakeChrome, type FakeChrome } from "./support/fake-chrome";
import { renderStateful } from "./support/render-ui";
import { closestElement } from "./support/view-dom";
import {
  installNetworkBackground,
  networkEntry,
  stateWithNetwork,
  type NetworkBackground,
} from "./support/view-network-entries";

vi.mock(import("@/lib/download"), async (importOriginal) => ({
  ...(await importOriginal()),
  downloadJson: vi.fn(),
}));

let fake: FakeChrome;
let background: NetworkBackground;

const renderView = (network: Parameters<typeof stateWithNetwork>[0] = { enabled: true }) => {
  const onNavigate = vi.fn<(view: ViewId) => void>();
  const view = renderStateful(
    (state, update) => <NetworkView state={state} update={update} onNavigate={onNavigate} />,
    stateWithNetwork(network),
  );
  return { ...view, onNavigate };
};

const badgeOfRow = (path: string): { label: string; tone: string } => {
  const badge = closestElement(screen.getByText(path), ".net-row").querySelector(".badge");
  if (badge === null) throw new Error(`La fila ${path} no tiene badge`);
  return { label: badge.textContent, tone: badge.className };
};

beforeEach(() => {
  fake = installFakeChrome();
  background = installNetworkBackground(fake, [
    networkEntry(),
    networkEntry({ id: "req-2", url: "https://api.example.com/missing", statusCode: 404 }),
    networkEntry({ id: "req-3", url: "https://app.example.com/old", statusCode: 301, phase: "redirected" }),
    networkEntry({
      id: "req-4",
      url: "https://ads.example.net/track",
      phase: "blocked",
      statusCode: null,
      matchedRuleLabels: ["Bloquear ads", "Sin trackers", "Regla extra"],
    }),
    networkEntry({ id: "req-5", url: "https://api.example.com/mocked", phase: "mocked", source: "mock" }),
    networkEntry({ id: "req-6", url: "https://api.example.com/down", phase: "error", statusCode: null }),
    networkEntry({ id: "req-7", url: "https://api.example.com/slow", phase: "pending", statusCode: null }),
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NetworkView capture switch", () => {
  it("warns while capture is off and turns it on from the header switch", () => {
    background.entries = [];
    const { currentState } = renderView({ enabled: false });

    expect(screen.getByText(/La captura esta apagada/u)).toBeTruthy();
    expect(screen.getByText("Captura apagada")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Prender o apagar la captura"));

    expect(currentState().network.enabled).toBe(true);
    expect(screen.queryByText(/La captura esta apagada/u)).toBeNull();
    expect(screen.getByText("Todavia no se capturo nada")).toBeTruthy();
  });

  it("persists the only-modified filter", () => {
    const { currentState } = renderView();

    fireEvent.click(screen.getByLabelText("Solo modificadas"));

    expect(currentState().network.onlyModified).toBe(true);
  });
});

describe("NetworkView request list", () => {
  it("lists the captured requests with a status badge per phase", async () => {
    renderView();

    expect(await screen.findByText("/api/users?page=2")).toBeTruthy();
    expect(badgeOfRow("/api/users?page=2").label).toBe("200");
    expect(badgeOfRow("/api/users?page=2").tone).toBe("badge success");
    expect(badgeOfRow("/missing").tone).toBe("badge danger");
    expect(badgeOfRow("/old").tone).toBe("badge warning");
    expect(badgeOfRow("/track").label).toBe("block");
    expect(badgeOfRow("/mocked").label).toBe("mock");
    expect(badgeOfRow("/mocked").tone).toBe("badge info");
    expect(badgeOfRow("/down").label).toBe("error");
    expect(badgeOfRow("/slow").label).toBe("···");
    expect(badgeOfRow("/slow").tone).toBe("badge");
    expect(screen.getByText("Sin trackers")).toBeTruthy();
    expect(screen.queryByText("Regla extra")).toBeNull();
    expect(screen.getByText(/Se guardan las ultimas 500 requests/u)).toBeTruthy();
  });

  it("filters by URL or by the label of a matched rule", async () => {
    renderView();
    await screen.findByText("/missing");
    const search = screen.getByPlaceholderText("Filtrar por URL o regla…");

    fireEvent.change(search, { target: { value: "MISSING" } });
    expect(screen.getByText("/missing")).toBeTruthy();
    expect(screen.queryByText("/track")).toBeNull();

    fireEvent.change(search, { target: { value: "trackers" } });
    expect(screen.getByText("/track")).toBeTruthy();
    expect(screen.queryByText("/missing")).toBeNull();
  });

  it("polls the background for new requests every second and stops on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = renderView();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    background.entries = [networkEntry({ id: "late", url: "https://api.example.com/late" })];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("/late")).toBeTruthy();
    unmount();
    const callsAfterUnmount = fake.runtime.sendMessage.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(fake.runtime.sendMessage.mock.calls).toHaveLength(callsAfterUnmount);
  });

  it("ignores failed or malformed list responses", async () => {
    fake.runtime.sendMessage.mockRejectedValueOnce(new Error("Extension context invalidated."));
    fake.runtime.sendMessage.mockResolvedValueOnce({ unexpected: true });
    vi.useFakeTimers();
    renderView();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("Todavia no se capturo nada")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("/missing")).toBeTruthy();
  });

  it("clears the captured requests in the background and the list", async () => {
    renderView();
    await screen.findByText("/missing");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));

    expect(background.messages).toContainEqual({ type: "network/clear" });
    expect(screen.getByText("Todavia no se capturo nada")).toBeTruthy();
  });
});

describe("NetworkView HAR export", () => {
  it("exports the visible requests as a dated HAR", async () => {
    renderView();
    await screen.findByText("/missing");
    fireEvent.change(screen.getByPlaceholderText("Filtrar por URL o regla…"), {
      target: { value: "missing" },
    });

    fireEvent.click(screen.getByRole("button", { name: "HAR" }));

    const [fileName, har] = vi.mocked(downloadJson).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^bender-\d{4}-\d{2}-\d{2}\.har$/u);
    expect(JSON.stringify(har)).toContain("https://api.example.com/missing");
    expect(JSON.stringify(har)).not.toContain("/track");
    expect(await screen.findByText("HAR exportado")).toBeTruthy();
  });

  it("does not export an empty list", async () => {
    background.entries = [];
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "HAR" }));

    expect(await screen.findByText("No hay requests para exportar")).toBeTruthy();
    expect(vi.mocked(downloadJson)).not.toHaveBeenCalled();
  });
});
