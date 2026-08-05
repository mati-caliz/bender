import { describe, expect, it } from 'vitest';
import { createDefaultState, createEmptyScope } from '@/lib/constants';
import { createHeaderEntry } from '@/lib/factories';
import { collectMockDefinitions, findMatchingMock } from '@/lib/mocks';
import type { MockDefinition, Scope, ToolkitState, TrafficRule, TrafficRuleAction } from '@/types';

const mockAction = (overrides: Partial<Extract<TrafficRuleAction, { kind: 'mock' }>> = {}): TrafficRuleAction => ({
  kind: 'mock',
  status: 200,
  contentType: 'application/json; charset=utf-8',
  body: '{"ok":true}',
  delayMs: 0,
  headers: [],
  ...overrides,
});

const ruleWith = (overrides: Partial<TrafficRule> = {}): TrafficRule => ({
  id: 'rule-1',
  name: 'Mock',
  enabled: true,
  scope: createEmptyScope(),
  action: mockAction(),
  ...overrides,
});

const stateWith = (overrides: Partial<ToolkitState>): ToolkitState => ({ ...createDefaultState(), ...overrides });

const mockWith = (scope: Partial<Scope>, id: string): MockDefinition => ({
  id,
  name: id,
  scope: { ...createEmptyScope(), ...scope },
  status: 200,
  contentType: 'application/json',
  body: '{}',
  delayMs: 0,
  headers: [],
});

describe('collectMockDefinitions', () => {
  it('no devuelve nada con el motor apagado', () => {
    const state = stateWith({ globalEnabled: false, trafficRules: [ruleWith()] });
    expect(collectMockDefinitions(state)).toEqual([]);
  });

  it('deja afuera reglas apagadas y las que no son mock', () => {
    const state = stateWith({
      trafficRules: [
        ruleWith({ id: 'apagada', enabled: false }),
        ruleWith({ id: 'bloqueo', action: { kind: 'block' } }),
        ruleWith({ id: 'valida' }),
      ],
    });
    expect(collectMockDefinitions(state).map((mock) => mock.id)).toEqual(['valida']);
  });

  it('conserva el cuerpo, el delay y el alcance de la regla', () => {
    const scope: Scope = { ...createEmptyScope(), includeDomains: ['example.com'], urlFilter: '/api/' };
    const state = stateWith({
      trafficRules: [ruleWith({ scope, action: mockAction({ status: 503, delayMs: 250, body: 'caido' }) })],
    });
    const [mock] = collectMockDefinitions(state);
    expect(mock?.status).toBe(503);
    expect(mock?.delayMs).toBe(250);
    expect(mock?.body).toBe('caido');
    expect(mock?.scope).toEqual(scope);
  });

  it('limpia los headers apagados o sin nombre', () => {
    const state = stateWith({
      trafficRules: [
        ruleWith({
          action: mockAction({
            headers: [
              createHeaderEntry({ name: '  x-mock  ', value: '1' }),
              createHeaderEntry({ name: 'x-off', value: '2', enabled: false }),
              createHeaderEntry({ name: '   ', value: '3' }),
            ],
          }),
        }),
      ],
    });
    expect(collectMockDefinitions(state)[0]?.headers).toEqual([{ name: 'x-mock', value: '1' }]);
  });
});

describe('findMatchingMock', () => {
  it('devuelve el primero que matchea', () => {
    const mocks = [
      mockWith({ includeDomains: ['otro.com'] }, 'otro'),
      mockWith({ includeDomains: ['example.com'] }, 'primero'),
      mockWith({ includeDomains: ['example.com'] }, 'segundo'),
    ];
    expect(findMatchingMock(mocks, 'https://example.com/api')?.id).toBe('primero');
  });

  it('devuelve null cuando ninguno matchea', () => {
    expect(findMatchingMock([mockWith({ includeDomains: ['otro.com'] }, 'otro')], 'https://example.com/')).toBeNull();
  });
});
