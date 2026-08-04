import { urlMatchesScope } from '@/lib/scope';
import type { HeaderEntry, ToolkitState } from '@/types';

export interface EffectiveHeader {
  name: string;
  value: string;
  operation: HeaderEntry['operation'];
  source: string;
  direction: 'request' | 'response';
}

const collect = (
  entries: HeaderEntry[],
  source: string,
  direction: EffectiveHeader['direction']
): EffectiveHeader[] =>
  entries
    .filter((entry) => entry.enabled && entry.name.trim())
    .map((entry) => ({
      name: entry.name.trim(),
      value: entry.value,
      operation: entry.operation,
      source,
      direction,
    }));

export const effectiveHeadersFor = (state: ToolkitState, url: string): EffectiveHeader[] => {
  if (!state.globalEnabled || !url) return [];

  const merged = new Map<string, EffectiveHeader>();

  for (const profile of state.profiles) {
    if (!profile.enabled) continue;
    if (!urlMatchesScope(profile.scope, url)) continue;
    const headers = [
      ...collect(profile.requestHeaders, profile.name, 'request'),
      ...collect(profile.responseHeaders, profile.name, 'response'),
    ];
    for (const header of headers) {
      merged.set(`${header.direction}:${header.name.toLowerCase()}:${header.operation === 'append' ? merged.size : ''}`, header);
    }
  }

  if (state.userAgent.enabled && state.userAgent.value.trim() && urlMatchesScope(state.userAgent.scope, url)) {
    merged.set('request:user-agent:', {
      name: 'User-Agent',
      value: state.userAgent.value,
      operation: 'set',
      source: 'User-Agent',
      direction: 'request',
    });
  }

  return Array.from(merged.values());
};
