import { MOCKS_STORAGE_KEY, readMocks } from '@/lib/mocks';
import type { ExtensionMessage } from '@/lib/messages';
import type { BridgeHandshake, BridgePortMessage, MockDefinition } from '@/types';

let pagePort: MessagePort | null = null;
let publishedMocks: MockDefinition[] | null = null;

const publishToPage = (): void => {
  if (!pagePort || !publishedMocks) return;
  const message: BridgePortMessage = { type: 'mocks', mocks: publishedMocks };
  pagePort.postMessage(message);
};

const forwardHit = (message: Extract<BridgePortMessage, { type: 'mock-hit' }>): void => {
  const request: ExtensionMessage = {
    type: 'network/hit',
    payload: {
      url: message.url,
      method: message.method,
      status: message.status,
      ruleName: message.ruleName,
      tabUrl: window.location.href,
    },
  };
  void chrome.runtime.sendMessage(request).catch(() => undefined);
};

const isHandshake = (data: unknown): data is BridgeHandshake => {
  const candidate = data as Partial<BridgeHandshake> | null;
  return candidate?.channel === 'bender' && candidate.type === 'connect';
};

window.addEventListener('message', (event) => {
  if (pagePort || event.source !== window || !isHandshake(event.data)) return;
  const [port] = event.ports;
  if (!port) return;

  pagePort = port;
  port.onmessage = (portEvent: MessageEvent<BridgePortMessage>) => {
    if (portEvent.data.type === 'mock-hit') forwardHit(portEvent.data);
  };
  publishToPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[MOCKS_STORAGE_KEY]) return;
  const mocks = changes[MOCKS_STORAGE_KEY].newValue;
  publishedMocks = Array.isArray(mocks) ? (mocks as MockDefinition[]) : [];
  publishToPage();
});

void readMocks().then((mocks) => {
  publishedMocks = mocks;
  publishToPage();
});
