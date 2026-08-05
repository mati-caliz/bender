import { useEffect, useState } from 'react';
import { ENGINE_STATUS_KEY } from '@/lib/constants';
import { sendMessage } from '@/lib/messages';
import type { EngineStatus } from '@/types';

const EMPTY_STATUS: EngineStatus = { appliedRuleCount: 0, activeProfileCount: 0, diagnostics: [], updatedAt: 0 };

const isEngineStatus = (value: unknown): value is EngineStatus =>
  typeof value === 'object' && value !== null && 'appliedRuleCount' in value;

export const useEngineStatus = (): EngineStatus => {
  const [status, setStatus] = useState<EngineStatus>(EMPTY_STATUS);

  useEffect(() => {
    let active = true;
    void sendMessage({ type: 'engine/status' })
      .then((current) => {
        if (active && isEngineStatus(current)) setStatus(current);
      })
      .catch(() => undefined);

    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session' || !changes[ENGINE_STATUS_KEY]) return;
      const next: unknown = changes[ENGINE_STATUS_KEY].newValue;
      if (isEngineStatus(next)) setStatus(next);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handler);
    };
  }, []);

  return status;
};
