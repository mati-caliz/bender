import { MOCKS_STORAGE_KEY, readPageConfig, toPageConfig } from '@/lib/mocks';
import type { ExtensionMessage } from '@/lib/messages';
import type { BridgeHandshake, BridgePortMessage, CapturedBodies, PageConfig } from '@/types';

let pagePort: MessagePort | null = null;
let publishedConfig: PageConfig | null = null;

const publishToPage = (): void => {
  if (!pagePort || !publishedConfig) return;
  const message: BridgePortMessage = { type: 'page-config', config: publishedConfig };
  pagePort.postMessage(message);
};

const sendToBackground = (request: ExtensionMessage): void => {
  void chrome.runtime.sendMessage(request).catch(() => undefined);
};

const forwardHit = (message: Extract<BridgePortMessage, { type: 'mock-hit' }>): void => {
  sendToBackground({
    type: 'network/hit',
    payload: {
      url: message.url,
      method: message.method,
      status: message.status,
      ruleName: message.ruleName,
      tabUrl: window.location.href,
    },
  });
};

const forwardBodies = (bodies: CapturedBodies): void => {
  sendToBackground({ type: 'network/bodies', payload: bodies });
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
    if (portEvent.data.type === 'bodies') forwardBodies(portEvent.data.bodies);
  };
  publishToPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[MOCKS_STORAGE_KEY]) return;
  publishedConfig = toPageConfig(changes[MOCKS_STORAGE_KEY].newValue);
  publishToPage();
});

void readPageConfig().then((config) => {
  publishedConfig = config;
  publishToPage();
});
