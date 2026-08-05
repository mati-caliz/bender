import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_AGENT_CONFIG, createDefaultState, createEmptyScope } from '@/lib/constants';
import { effectiveHeadersFor } from '@/lib/effective';
import { createHeaderEntry } from '@/lib/factories';
import type { Profile, ToolkitState } from '@/types';

const profileWith = (overrides: Partial<Profile>): Profile => ({
  id: 'profile-1',
  name: 'Perfil',
  color: '#000000',
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
  ...overrides,
});

const stateWith = (overrides: Partial<ToolkitState>): ToolkitState => ({ ...createDefaultState(), ...overrides });

const URL = 'https://example.com/api/users';

describe('effectiveHeadersFor', () => {
  it('no devuelve nada sin motor o sin url', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [createHeaderEntry({ name: 'x-test', value: '1' })] })],
    });
    expect(effectiveHeadersFor({ ...state, globalEnabled: false }, URL)).toEqual([]);
    expect(effectiveHeadersFor(state, '')).toEqual([]);
  });

  it('deja afuera perfiles apagados y fuera de alcance', () => {
    const state = stateWith({
      profiles: [
        profileWith({ id: 'a', enabled: false, requestHeaders: [createHeaderEntry({ name: 'x-a', value: '1' })] }),
        profileWith({
          id: 'b',
          scope: { ...createEmptyScope(), includeDomains: ['otro.com'] },
          requestHeaders: [createHeaderEntry({ name: 'x-b', value: '2' })],
        }),
        profileWith({ id: 'c', requestHeaders: [createHeaderEntry({ name: 'x-c', value: '3' })] }),
      ],
    });
    expect(effectiveHeadersFor(state, URL).map((header) => header.name)).toEqual(['x-c']);
  });

  it('gana el ultimo perfil cuando dos pisan el mismo header', () => {
    const state = stateWith({
      profiles: [
        profileWith({ id: 'a', name: 'A', requestHeaders: [createHeaderEntry({ name: 'x-token', value: 'viejo' })] }),
        profileWith({ id: 'b', name: 'B', requestHeaders: [createHeaderEntry({ name: 'X-Token', value: 'nuevo' })] }),
      ],
    });
    expect(effectiveHeadersFor(state, URL)).toEqual([
      { name: 'X-Token', value: 'nuevo', operation: 'set', source: 'B', direction: 'request' },
    ]);
  });

  it('no colapsa los append', () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [
            createHeaderEntry({ name: 'x-tag', value: 'uno', operation: 'append' }),
            createHeaderEntry({ name: 'x-tag', value: 'dos', operation: 'append' }),
          ],
        }),
      ],
    });
    expect(effectiveHeadersFor(state, URL).map((header) => header.value)).toEqual(['uno', 'dos']);
  });

  it('separa request de response', () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [createHeaderEntry({ name: 'x-mismo', value: 'req' })],
          responseHeaders: [createHeaderEntry({ name: 'x-mismo', value: 'res' })],
        }),
      ],
    });
    expect(effectiveHeadersFor(state, URL).map((header) => header.direction)).toEqual(['request', 'response']);
  });

  it('el user agent pisa el que puso un perfil a mano', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [createHeaderEntry({ name: 'user-agent', value: 'a mano' })] })],
      userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: 'curl/8.7.1' },
    });
    expect(effectiveHeadersFor(state, URL)).toEqual([
      { name: 'User-Agent', value: 'curl/8.7.1', operation: 'set', source: 'User-Agent', direction: 'request' },
    ]);
  });

  it('ignora el user agent fuera de alcance', () => {
    const state = stateWith({
      userAgent: {
        ...DEFAULT_USER_AGENT_CONFIG,
        enabled: true,
        value: 'curl/8.7.1',
        scope: { ...createEmptyScope(), includeDomains: ['otro.com'] },
      },
    });
    expect(effectiveHeadersFor(state, URL)).toEqual([]);
  });
});
