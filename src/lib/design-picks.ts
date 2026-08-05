import { DESIGN_PICKS_KEY } from '@/lib/constants';
import type { DesignPick } from '@/types';

export const MAX_DESIGN_PICKS = 60;

export const readDesignPicks = async (): Promise<DesignPick[]> => {
  const stored = await chrome.storage.local.get(DESIGN_PICKS_KEY);
  const picks = stored[DESIGN_PICKS_KEY];
  return Array.isArray(picks) ? (picks as DesignPick[]) : [];
};

export const writeDesignPicks = async (picks: DesignPick[]): Promise<void> => {
  await chrome.storage.local.set({ [DESIGN_PICKS_KEY]: picks.slice(0, MAX_DESIGN_PICKS) });
};

export const appendDesignPick = async (pick: DesignPick): Promise<void> => {
  await writeDesignPicks([pick, ...(await readDesignPicks())]);
};

export const subscribeToDesignPicks = (listener: (picks: DesignPick[]) => void): (() => void) => {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[DESIGN_PICKS_KEY]) return;
    const picks = changes[DESIGN_PICKS_KEY].newValue;
    listener(Array.isArray(picks) ? (picks as DesignPick[]) : []);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};
