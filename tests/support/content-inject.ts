import { vi } from "vitest";
import { createEmptyScope } from "@/lib/constants";
import { isRecord } from "@/lib/records";
import type { CapturedBodies, ChaosDefinition, MockDefinition } from "@/types";

export const API_URL = "https://api.example.com/v1";

export const mockRule = (overrides: Partial<MockDefinition> = {}): MockDefinition => ({
  id: "m1",
  name: "Mock de prueba",
  scope: createEmptyScope(),
  status: 200,
  contentType: "application/json",
  body: '{"ok":true}',
  delayMs: 0,
  headers: [],
  ...overrides,
});

export const chaosRule = (overrides: Partial<ChaosDefinition> = {}): ChaosDefinition => ({
  id: "c1",
  name: "Chaos de prueba",
  scope: createEmptyScope(),
  delayMs: 0,
  failRate: 0,
  failStatus: 500,
  ...overrides,
});

const pristineOpen = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "open");
const pristinePostMessage = window.postMessage.bind(window);

export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export interface NetworkXhr {
  sentBodies: unknown[];
  respondWith: (getter: () => unknown) => void;
}

/**
 * Hace de "red" para los XHR que inject.ts deja pasar: jsdom saldría a internet,
 * así que el send original se reemplaza antes de importar por uno que dispara load
 * con el responseText que pida el test.
 */
const installNetworkXhr = (): NetworkXhr => {
  const sentBodies: unknown[] = [];
  const state = { responseText: (): unknown => "respuesta real" };
  if (pristineOpen) Object.defineProperty(XMLHttpRequest.prototype, "open", pristineOpen);
  XMLHttpRequest.prototype.send = function networkSend(this: XMLHttpRequest, body?: unknown): void {
    sentBodies.push(body);
    Object.defineProperty(this, "responseText", { configurable: true, get: state.responseText });
    this.dispatchEvent(new ProgressEvent("load"));
  };
  return {
    sentBodies,
    respondWith: (getter) => {
      state.responseText = getter;
    },
  };
};

const capturePortFromHandshake = (): { port: MessagePort | null } => {
  const handshake: { port: MessagePort | null } = { port: null };
  function capturingPostMessage(message: unknown, targetOrigin: string, transfer?: Transferable[]): void;
  function capturingPostMessage(message: unknown, options?: WindowPostMessageOptions): void;
  function capturingPostMessage(
    message: unknown,
    targetOrOptions?: string | WindowPostMessageOptions,
    transfer?: Transferable[],
  ): void {
    const port = transfer?.[0];
    if (port instanceof MessagePort) handshake.port = port;
    pristinePostMessage(message, typeof targetOrOptions === "string" ? targetOrOptions : "/");
  }
  window.postMessage = capturingPostMessage;
  return handshake;
};

export interface InjectHarness {
  realFetch: ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;
  network: NetworkXhr;
  messages: unknown[];
  port: MessagePort;
}

export interface LoadOptions {
  withBeacon?: boolean;
  sendConfig?: boolean;
}

export const loadInject = async (
  config: Record<string, unknown> = {},
  options: LoadOptions = {},
): Promise<InjectHarness> => {
  const realFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response("real", { status: 200 })),
  );
  window.fetch = realFetch;
  if (options.withBeacon === false) Reflect.deleteProperty(navigator, "sendBeacon");
  else navigator.sendBeacon = vi.fn(() => true);
  const network = installNetworkXhr();
  const handshake = capturePortFromHandshake();

  vi.resetModules();
  await import("@/content/inject");
  window.postMessage = pristinePostMessage;

  const port = handshake.port;
  if (port === null) throw new Error("inject.ts no transfirió el port del handshake");
  const messages: unknown[] = [];
  port.onmessage = (event: MessageEvent) => {
    messages.push(event.data);
  };
  port.start();

  if (options.sendConfig !== false) {
    port.postMessage({
      type: "page-config",
      config: { mocks: [], chaos: [], captureBodies: false, ...config },
    });
    await flush();
  }
  return { realFetch, network, messages, port };
};

const isBodiesMessage = (value: unknown): value is { type: "bodies"; bodies: CapturedBodies } =>
  isRecord(value) && value["type"] === "bodies" && isRecord(value["bodies"]);

export const capturedBodies = (messages: unknown[]): CapturedBodies[] =>
  messages.filter(isBodiesMessage).map((message) => message.bodies);

export interface XhrOptions {
  responseType?: XMLHttpRequestResponseType;
  body?: string;
}

export const runXhr = (url: string, options: XhrOptions = {}): Promise<XMLHttpRequest> =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (options.responseType !== undefined) xhr.responseType = options.responseType;
    xhr.addEventListener("load", () => {
      resolve(xhr);
    });
    xhr.send(options.body);
  });
