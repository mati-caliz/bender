// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCKS_STORAGE_KEY } from "@/lib/mocks";
import type { BridgePortMessage, PageConfig } from "@/types";
import { type FakeChrome, flushPromises, installFakeChrome } from "./support/fake-chrome";

/**
 * bridge.ts se engancha al importarse y se queda con el primer port que recibe,
 * sin forma de soltarlo: el archivo carga el módulo una sola vez y los tests
 * recorren el ciclo de vida en orden (antes del handshake, handshake, tráfico).
 */
const EMPTY_CONFIG: PageConfig = { mocks: [], chaos: [], captureBodies: false };

let fakeChrome: FakeChrome;
let resolveInitialConfig: ((stored: Record<string, unknown>) => void) | null = null;
const received: BridgePortMessage[] = [];
const channel = new MessageChannel();
const spareChannel = new MessageChannel();

const sendHandshake = (data: unknown, ports: MessagePort[], source: Window | null = window): void => {
  window.dispatchEvent(new MessageEvent("message", { data, source, ports }));
};

const HANDSHAKE = { channel: "bender", type: "connect" };

beforeAll(async () => {
  fakeChrome = installFakeChrome();
  fakeChrome.storage.local.get = () =>
    new Promise((resolve) => {
      resolveInitialConfig = resolve;
    });
  channel.port2.onmessage = (event: MessageEvent<BridgePortMessage>) => {
    received.push(event.data);
  };
  await import("@/content/bridge");
});

afterAll(() => {
  channel.port1.close();
  channel.port2.close();
  spareChannel.port1.close();
  spareChannel.port2.close();
});

beforeEach(() => {
  received.length = 0;
  fakeChrome.runtime.sendMessage.mockClear();
});

describe("bridge: page handshake", () => {
  it("ignores messages that are not a handshake from the page itself", async () => {
    sendHandshake(HANDSHAKE, [spareChannel.port1], null);
    sendHandshake(null, [spareChannel.port1]);
    sendHandshake("connect", [spareChannel.port1]);
    sendHandshake({ channel: "otro", type: "connect" }, [spareChannel.port1]);
    sendHandshake({ channel: "bender" }, [spareChannel.port1]);
    sendHandshake({ channel: "bender", type: "disconnect" }, [spareChannel.port1]);
    sendHandshake(HANDSHAKE, []);
    await flushPromises();

    expect(received).toHaveLength(0);
  });

  it("waits for the stored config before publishing to the connected page", async () => {
    sendHandshake(HANDSHAKE, [channel.port1]);
    await flushPromises();
    expect(received).toHaveLength(0);

    resolveInitialConfig?.({ [MOCKS_STORAGE_KEY]: { captureBodies: true } });
    await vi.waitFor(() => {
      expect(received).toEqual([{ type: "page-config", config: { ...EMPTY_CONFIG, captureBodies: true } }]);
    });
  });

  it("keeps the first port and ignores later handshakes", async () => {
    const spareReceived: unknown[] = [];
    spareChannel.port2.onmessage = (event) => {
      spareReceived.push(event.data);
    };

    sendHandshake(HANDSHAKE, [spareChannel.port1]);
    await fakeChrome.storage.local.set({ [MOCKS_STORAGE_KEY]: { captureBodies: false } });

    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    });
    expect(spareReceived).toHaveLength(0);
  });
});

describe("bridge: config updates", () => {
  it("republishes when the mocks key changes in local storage", async () => {
    await fakeChrome.storage.local.set({ [MOCKS_STORAGE_KEY]: "basura" });

    await vi.waitFor(() => {
      expect(received).toEqual([{ type: "page-config", config: EMPTY_CONFIG }]);
    });
  });

  it("ignores other keys and other storage areas", async () => {
    await fakeChrome.storage.local.set({ otraClave: 1 });
    await fakeChrome.storage.session.set({ [MOCKS_STORAGE_KEY]: EMPTY_CONFIG });
    await flushPromises();
    await flushPromises();

    expect(received).toHaveLength(0);
  });
});

describe("bridge: page traffic", () => {
  it("forwards mock hits with the tab url", async () => {
    channel.port2.postMessage({
      type: "mock-hit",
      url: "https://api.test/users",
      method: "GET",
      status: 201,
      ruleName: "Usuarios",
    } satisfies BridgePortMessage);

    await vi.waitFor(() => {
      expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "network/hit",
        payload: {
          url: "https://api.test/users",
          method: "GET",
          status: 201,
          ruleName: "Usuarios",
          tabUrl: window.location.href,
        },
      });
    });
  });

  it("forwards captured bodies and survives a rejected send", async () => {
    fakeChrome.runtime.sendMessage.mockRejectedValueOnce(new Error("sin receptor"));
    const bodies = {
      url: "https://api.test/login",
      method: "POST",
      requestBody: "{}",
      responseBody: null,
      truncated: false,
    };

    channel.port2.postMessage({ type: "bodies", bodies } satisfies BridgePortMessage);

    await vi.waitFor(() => {
      expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "network/bodies",
        payload: bodies,
      });
    });
  });

  it("does not forward config messages coming back from the page", async () => {
    channel.port2.postMessage({ type: "page-config", config: EMPTY_CONFIG } satisfies BridgePortMessage);
    await flushPromises();
    await flushPromises();

    expect(fakeChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe("bridge: userscript errors", () => {
  it("forwards only errors whose source is a registered userscript", () => {
    window.dispatchEvent(
      new ErrorEvent("error", { message: "boom", filename: "https://example.com/app.js" }),
    );
    window.dispatchEvent(
      new ErrorEvent("error", { message: "boom", filename: "bender-script-abc.js", lineno: 3 }),
    );

    expect(fakeChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(fakeChrome.runtime.sendMessage.mock.calls[0]?.[0]).toMatchObject({
      type: "scripts/error",
      payload: { scriptId: "abc", message: "boom", line: 3, tabUrl: window.location.href },
    });
  });
});

describe("bridge: without a connected page", () => {
  it("loads the config without publishing anywhere", async () => {
    fakeChrome.storage.local.get = () => Promise.resolve({ [MOCKS_STORAGE_KEY]: EMPTY_CONFIG });
    vi.resetModules();

    await import("@/content/bridge");
    await fakeChrome.storage.local.set({ [MOCKS_STORAGE_KEY]: EMPTY_CONFIG });
    await flushPromises();

    expect(received).toHaveLength(1);
    expect(fakeChrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
