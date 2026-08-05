import { findMatchingMock } from '@/lib/mocks';
import type { ScopeRequest } from '@/lib/scope';
import type { BridgeHandshake, BridgePortMessage, MockDefinition } from '@/types';

const MOCKS_TIMEOUT_MS = 2000;
const READY_STATE_HEADERS_RECEIVED = 2;
const READY_STATE_LOADING = 3;
const READY_STATE_DONE = 4;

const originalFetch = window.fetch.bind(window);
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
const BEACON_METHOD = 'POST';

interface PendingRequest {
  method: string;
  url: string;
}

const pendingRequests = new WeakMap<XMLHttpRequest, PendingRequest>();

let mocks: MockDefinition[] = [];
let resolveMocksReady: (() => void) | null = null;
const mocksReady = new Promise<void>((resolve) => {
  resolveMocksReady = resolve;
});
window.setTimeout(() => resolveMocksReady?.(), MOCKS_TIMEOUT_MS);

const bridgeChannel = new MessageChannel();
const bridgePort = bridgeChannel.port1;

bridgePort.onmessage = (event: MessageEvent<BridgePortMessage>) => {
  if (event.data.type !== 'mocks') return;
  mocks = Array.isArray(event.data.mocks) ? event.data.mocks : [];
  resolveMocksReady?.();
  resolveMocksReady = null;
};

const handshake: BridgeHandshake = { channel: 'bender', type: 'connect' };
window.postMessage(handshake, '*', [bridgeChannel.port2]);

const reportHit = (mock: MockDefinition, url: string, method: string): void => {
  const message: BridgePortMessage = {
    type: 'mock-hit',
    url,
    method,
    ruleName: mock.name,
    status: mock.status,
  };
  bridgePort.postMessage(message);
};

const resolveMocks = async (): Promise<MockDefinition[]> => {
  await mocksReady;
  return mocks;
};

const absoluteUrl = (url: string): string => {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
};

const requestUrlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return absoluteUrl(input);
  if (input instanceof URL) return input.href;
  return input.url;
};

const requestMethodOf = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL)) return input.method.toUpperCase();
  return 'GET';
};

const scopeRequestFor = (url: string, method: string): ScopeRequest => ({
  url,
  method,
  initiatorHostname: window.location.hostname,
});

const wait = (milliseconds: number): Promise<void> =>
  milliseconds > 0 ? new Promise((resolve) => window.setTimeout(resolve, milliseconds)) : Promise.resolve();

const mockHeaders = (mock: MockDefinition): Headers => {
  const headers = new Headers();
  if (mock.contentType) headers.set('content-type', mock.contentType);
  for (const header of mock.headers) headers.set(header.name, header.value);
  return headers;
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = requestUrlOf(input);
  const method = requestMethodOf(input, init);
  const mock = findMatchingMock(await resolveMocks(), scopeRequestFor(url, method));
  if (!mock) return originalFetch(input, init);

  await wait(mock.delayMs);
  reportHit(mock, url, method);

  const response = new Response(mock.body, {
    status: mock.status,
    statusText: `${mock.status}`,
    headers: mockHeaders(mock),
  });
  Object.defineProperty(response, 'url', { value: url });
  return response;
};

const serializeHeaders = (mock: MockDefinition): string => {
  const lines = [`content-type: ${mock.contentType}`, ...mock.headers.map(({ name, value }) => `${name}: ${value}`)];
  return `${lines.join('\r\n')}\r\n`;
};

const parseBody = (xhr: XMLHttpRequest, mock: MockDefinition): unknown => {
  if (xhr.responseType === 'json') {
    try {
      return JSON.parse(mock.body);
    } catch {
      return null;
    }
  }
  return mock.body;
};

const simulateXhr = (xhr: XMLHttpRequest, mock: MockDefinition, request: PendingRequest): void => {
  let readyState = READY_STATE_HEADERS_RECEIVED;
  const headerMap = new Map<string, string>([['content-type', mock.contentType]]);
  for (const header of mock.headers) headerMap.set(header.name.toLowerCase(), header.value);

  const defineReadOnly = (property: string, getter: () => unknown): void => {
    Object.defineProperty(xhr, property, { configurable: true, get: getter });
  };

  defineReadOnly('readyState', () => readyState);
  defineReadOnly('status', () => mock.status);
  defineReadOnly('statusText', () => String(mock.status));
  defineReadOnly('responseURL', () => request.url);
  defineReadOnly('responseText', () => mock.body);
  defineReadOnly('response', () => parseBody(xhr, mock));

  Object.defineProperty(xhr, 'getAllResponseHeaders', {
    configurable: true,
    value: () => serializeHeaders(mock),
  });
  Object.defineProperty(xhr, 'getResponseHeader', {
    configurable: true,
    value: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
  });

  const dispatch = (type: string): void => {
    xhr.dispatchEvent(new ProgressEvent(type, { lengthComputable: false, loaded: mock.body.length, total: 0 }));
  };

  window.setTimeout(() => {
    reportHit(mock, request.url, request.method);
    xhr.dispatchEvent(new Event('readystatechange'));
    readyState = READY_STATE_LOADING;
    xhr.dispatchEvent(new Event('readystatechange'));
    dispatch('progress');
    readyState = READY_STATE_DONE;
    xhr.dispatchEvent(new Event('readystatechange'));
    dispatch('load');
    dispatch('loadend');
  }, mock.delayMs);
};

XMLHttpRequest.prototype.open = function patchedOpen(
  this: XMLHttpRequest,
  method: string,
  url: string | URL,
  ...rest: unknown[]
): void {
  pendingRequests.set(this, { method: method.toUpperCase(), url: absoluteUrl(String(url)) });
  const args = [method, url, ...rest] as Parameters<XMLHttpRequest['open']>;
  originalOpen.apply(this, args);
};

XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
  const request = pendingRequests.get(this);
  if (!request) {
    originalSend.call(this, body);
    return;
  }

  void resolveMocks().then((available) => {
    const mock = findMatchingMock(available, scopeRequestFor(request.url, request.method));
    if (mock) {
      simulateXhr(this, mock, request);
      return;
    }
    originalSend.call(this, body);
  });
};

if (originalSendBeacon) {
  navigator.sendBeacon = function patchedSendBeacon(url: string | URL, data?: BodyInit | null): boolean {
    const target = absoluteUrl(String(url));
    const mock = findMatchingMock(mocks, scopeRequestFor(target, BEACON_METHOD));
    if (!mock) return originalSendBeacon(url, data);

    reportHit(mock, target, BEACON_METHOD);
    return true;
  };
}
