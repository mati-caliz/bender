import {
  DEFAULT_CORS_CONFIG,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_UI_CONFIG,
  DEFAULT_USER_AGENT_CONFIG,
  STORAGE_KEY,
  createDefaultState,
} from '@/lib/constants';
import type { ToolkitState } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeSection = <T extends object>(defaults: T, stored: unknown): T =>
  isRecord(stored) ? { ...defaults, ...(stored as Partial<T>) } : defaults;

export const normalizeState = (stored: unknown): ToolkitState => {
  const defaults = createDefaultState();
  if (!isRecord(stored)) return defaults;

  return {
    schemaVersion: typeof stored.schemaVersion === 'number' ? stored.schemaVersion : defaults.schemaVersion,
    globalEnabled: typeof stored.globalEnabled === 'boolean' ? stored.globalEnabled : defaults.globalEnabled,
    profiles: Array.isArray(stored.profiles) ? (stored.profiles as ToolkitState['profiles']) : defaults.profiles,
    selectedProfileId: typeof stored.selectedProfileId === 'string' ? stored.selectedProfileId : null,
    trafficRules: Array.isArray(stored.trafficRules)
      ? (stored.trafficRules as ToolkitState['trafficRules'])
      : defaults.trafficRules,
    userScripts: Array.isArray(stored.userScripts)
      ? (stored.userScripts as ToolkitState['userScripts'])
      : defaults.userScripts,
    cors: mergeSection(DEFAULT_CORS_CONFIG, stored.cors),
    userAgent: mergeSection(DEFAULT_USER_AGENT_CONFIG, stored.userAgent),
    network: mergeSection(DEFAULT_NETWORK_CONFIG, stored.network),
    ui: mergeSection(DEFAULT_UI_CONFIG, stored.ui),
  };
};

export const readState = async (): Promise<ToolkitState> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(stored[STORAGE_KEY]);
};

export const writeState = async (state: ToolkitState): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
};

export const updateState = async (mutate: (state: ToolkitState) => ToolkitState): Promise<ToolkitState> => {
  const next = mutate(await readState());
  await writeState(next);
  return next;
};

export const subscribeToState = (listener: (state: ToolkitState) => void): (() => void) => {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    listener(normalizeState(changes[STORAGE_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};
