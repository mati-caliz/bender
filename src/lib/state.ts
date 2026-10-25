import {
  DEFAULT_CORS_CONFIG,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_UI_CONFIG,
  DEFAULT_USER_AGENT_CONFIG,
  STORAGE_KEY,
  createDefaultState,
} from "@/lib/constants";
import { migrateStoredState } from "@/lib/migrations";
import { isRecord } from "@/lib/records";
import {
  coerceEnvironment,
  coerceList,
  coerceProfile,
  coerceTrafficRule,
  coerceUserScript,
} from "@/lib/sanitize";
import type { ToolkitState } from "@/types";

export interface DroppedItems {
  profiles: number;
  trafficRules: number;
  userScripts: number;
  environments: number;
}

export interface NormalizedState {
  state: ToolkitState;
  dropped: DroppedItems;
}

const NOTHING_DROPPED: DroppedItems = { profiles: 0, trafficRules: 0, userScripts: 0, environments: 0 };

const mergeSection = <TSection extends object>(defaults: TSection, stored: unknown): TSection =>
  isRecord(stored) ? { ...defaults, ...stored } : defaults;

export const normalizeStateDetailed = (stored: unknown): NormalizedState => {
  const defaults = createDefaultState();
  if (!isRecord(stored)) return { state: defaults, dropped: NOTHING_DROPPED };

  const migrated = migrateStoredState(stored);
  const profiles = coerceList(migrated["profiles"], coerceProfile);
  const trafficRules = coerceList(migrated["trafficRules"], coerceTrafficRule);
  const userScripts = coerceList(migrated["userScripts"], coerceUserScript);
  const environments = coerceList(migrated["environments"], coerceEnvironment);
  const storedSelection = migrated["selectedProfileId"];
  const selectedProfileId =
    typeof storedSelection === "string" && profiles.items.some((profile) => profile.id === storedSelection)
      ? storedSelection
      : null;
  const schemaVersion = migrated["schemaVersion"];
  const globalEnabled = migrated["globalEnabled"];

  return {
    state: {
      schemaVersion: typeof schemaVersion === "number" ? schemaVersion : defaults.schemaVersion,
      globalEnabled: typeof globalEnabled === "boolean" ? globalEnabled : defaults.globalEnabled,
      profiles: profiles.items,
      selectedProfileId,
      trafficRules: trafficRules.items,
      userScripts: userScripts.items,
      environments: environments.items,
      cors: mergeSection(DEFAULT_CORS_CONFIG, migrated["cors"]),
      userAgent: mergeSection(DEFAULT_USER_AGENT_CONFIG, migrated["userAgent"]),
      network: mergeSection(DEFAULT_NETWORK_CONFIG, migrated["network"]),
      ui: mergeSection(DEFAULT_UI_CONFIG, migrated["ui"]),
    },
    dropped: {
      profiles: profiles.dropped,
      trafficRules: trafficRules.dropped,
      userScripts: userScripts.dropped,
      environments: environments.dropped,
    },
  };
};

export const normalizeState = (stored: unknown): ToolkitState => normalizeStateDetailed(stored).state;

export const readStateDetailed = async (): Promise<NormalizedState> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeStateDetailed(stored[STORAGE_KEY]);
};

export const readState = async (): Promise<ToolkitState> => (await readStateDetailed()).state;

export const writeState = async (state: ToolkitState): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
};

export const updateState = async (mutate: (state: ToolkitState) => ToolkitState): Promise<ToolkitState> => {
  const next = mutate(await readState());
  await writeState(next);
  return next;
};

export const subscribeToState = (listener: (state: ToolkitState) => void): (() => void) => {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    const change = changes[STORAGE_KEY];
    if (area !== "local" || change === undefined) return;
    listener(normalizeState(change.newValue));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
};
