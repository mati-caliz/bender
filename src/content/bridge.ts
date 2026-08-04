import { MOCKS_STORAGE_KEY, readMocks } from '@/lib/mocks';
import type { ExtensionMessage } from '@/lib/messages';
import type { BridgeMessage, MockDefinition } from '@/types';

const publishToPage = (mocks: MockDefinition[]): void => {
  const message: BridgeMessage = { channel: 'bender', type: 'mocks', mocks };
  window.postMessage(message, '*');
};

const forwardHit = (message: Extract<BridgeMessage, { type: 'mock-hit' }>): void => {
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

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<BridgeMessage> | null;
  if (!data || data.channel !== 'bender' || data.type !== 'mock-hit') return;
  forwardHit(data as Extract<BridgeMessage, { type: 'mock-hit' }>);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[MOCKS_STORAGE_KEY]) return;
  const mocks = changes[MOCKS_STORAGE_KEY].newValue;
  publishToPage(Array.isArray(mocks) ? (mocks as MockDefinition[]) : []);
});

void readMocks().then(publishToPage);
