import { describe, expect, it } from 'vitest';
import {
  NETWORK_ERROR_STATUS,
  collectChaosDefinitions,
  describeChaos,
  findMatchingChaos,
  shouldFail,
} from '@/lib/chaos';
import { createDefaultState, createEmptyScope } from '@/lib/constants';
import { createTrafficRule } from '@/lib/factories';
import { collectPageConfig } from '@/lib/mocks';
import type { Scope, ToolkitState, TrafficRule } from '@/types';

const chaosRule = (overrides: Partial<TrafficRule> = {}, scope: Partial<Scope> = {}): TrafficRule => ({
  ...createTrafficRule('chaos', 0),
  scope: { ...createEmptyScope(), ...scope },
  ...overrides,
});

const stateWith = (rules: TrafficRule[]): ToolkitState => ({ ...createDefaultState(), trafficRules: rules });

describe('shouldFail', () => {
  it('con 0% no falla ni con el peor tiro', () => {
    expect(shouldFail(0, 0)).toBe(false);
  });

  it('con 100% falla siempre, incluso con el tiro mas alto', () => {
    expect(shouldFail(100, 0.999999)).toBe(true);
  });

  it('reparte segun el porcentaje', () => {
    expect(shouldFail(30, 0.29)).toBe(true);
    expect(shouldFail(30, 0.3)).toBe(false);
    expect(shouldFail(30, 0.9)).toBe(false);
  });

  it('trata los porcentajes fuera de rango como los extremos', () => {
    expect(shouldFail(-10, 0)).toBe(false);
    expect(shouldFail(150, 0.99)).toBe(true);
  });
});

describe('collectChaosDefinitions', () => {
  it('toma solo las reglas de chaos prendidas', () => {
    const state = stateWith([
      chaosRule({ id: 'on', enabled: true }),
      chaosRule({ id: 'off', enabled: false }),
      createTrafficRule('block', 1),
    ]);

    expect(collectChaosDefinitions(state).map((chaos) => chaos.id)).toEqual(['on']);
  });

  it('no devuelve nada con Bender apagado', () => {
    const state = { ...stateWith([chaosRule({ id: 'on' })]), globalEnabled: false };
    expect(collectChaosDefinitions(state)).toEqual([]);
  });

  it('copia delay, porcentaje y forma de fallo', () => {
    const state = stateWith([
      chaosRule({ action: { kind: 'chaos', delayMs: 250, failRate: 40, failStatus: 503 } }),
    ]);

    expect(collectChaosDefinitions(state)[0]).toMatchObject({ delayMs: 250, failRate: 40, failStatus: 503 });
  });
});

describe('findMatchingChaos', () => {
  it('respeta el alcance de la regla', () => {
    const chaos = collectChaosDefinitions(
      stateWith([chaosRule({ id: 'api' }, { includeDomains: ['api.example.com'] })])
    );

    const from = (url: string) => ({ url, method: 'GET', initiatorHostname: 'app.example.com' });

    expect(findMatchingChaos(chaos, from('https://api.example.com/v1'))?.id).toBe('api');
    expect(findMatchingChaos(chaos, from('https://otro.com/v1'))).toBeNull();
  });
});

describe('collectPageConfig', () => {
  it('publica las reglas de chaos junto a los mocks', () => {
    const config = collectPageConfig(stateWith([chaosRule({ id: 'lento' })]));

    expect(config.chaos.map((chaos) => chaos.id)).toEqual(['lento']);
    expect(config.mocks).toEqual([]);
  });
});

describe('describeChaos', () => {
  it('describe solo lo que esta configurado', () => {
    expect(describeChaos({ delayMs: 500, failRate: 0, failStatus: 500 })).toBe('+500 ms');
    expect(describeChaos({ delayMs: 0, failRate: 25, failStatus: 503 })).toBe('25% 503');
    expect(describeChaos({ delayMs: 500, failRate: 25, failStatus: 503 })).toBe('+500 ms · 25% 503');
  });

  it('nombra el error de red en vez de mostrar un status 0', () => {
    expect(describeChaos({ delayMs: 0, failRate: 10, failStatus: NETWORK_ERROR_STATUS })).toBe('10% error de red');
  });

  it('avisa cuando la regla no hace nada', () => {
    expect(describeChaos({ delayMs: 0, failRate: 0, failStatus: 500 })).toBe('sin efecto');
  });
});
