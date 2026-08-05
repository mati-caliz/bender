import { requestMatchesScope, type ScopeRequest } from '@/lib/scope';
import type { MockDefinition, ToolkitState } from '@/types';

export const MOCKS_STORAGE_KEY = 'benderMocks';

export const collectMockDefinitions = (state: ToolkitState): MockDefinition[] => {
  if (!state.globalEnabled) return [];

  return state.trafficRules
    .filter((rule) => rule.enabled && rule.action.kind === 'mock')
    .map((rule) => {
      const action = rule.action;
      if (action.kind !== 'mock') return null;
      return {
        id: rule.id,
        name: rule.name,
        scope: rule.scope,
        status: action.status,
        contentType: action.contentType,
        body: action.body,
        delayMs: action.delayMs,
        headers: action.headers
          .filter((header) => header.enabled && header.name.trim())
          .map((header) => ({ name: header.name.trim(), value: header.value })),
      };
    })
    .filter((mock): mock is MockDefinition => mock !== null);
};

export const findMatchingMock = (mocks: MockDefinition[], request: ScopeRequest): MockDefinition | null =>
  mocks.find((mock) => requestMatchesScope(mock.scope, request)) ?? null;

export const publishMocks = async (state: ToolkitState): Promise<void> => {
  await chrome.storage.local.set({ [MOCKS_STORAGE_KEY]: collectMockDefinitions(state) });
};

export const readMocks = async (): Promise<MockDefinition[]> => {
  const stored = await chrome.storage.local.get(MOCKS_STORAGE_KEY);
  const mocks = stored[MOCKS_STORAGE_KEY];
  return Array.isArray(mocks) ? (mocks as MockDefinition[]) : [];
};
