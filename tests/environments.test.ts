import { describe, expect, it } from 'vitest';
import { createDefaultState } from '@/lib/constants';
import {
  applyEnvironment,
  captureEnvironment,
  describeEnvironment,
  findActiveEnvironment,
  forgetFromEnvironments,
} from '@/lib/environments';
import { createProfile, createTrafficRule } from '@/lib/factories';
import type { Environment, ToolkitState } from '@/types';

const stateWith = (profiles: Array<[string, boolean]>, rules: Array<[string, boolean]>): ToolkitState => ({
  ...createDefaultState(),
  profiles: profiles.map(([id, enabled]) => ({ ...createProfile(0), id, enabled })),
  trafficRules: rules.map(([id, enabled]) => ({ ...createTrafficRule('block', 0), id, enabled })),
});

const environment = (overrides: Partial<Environment> = {}): Environment => ({
  id: 'env',
  name: 'staging',
  profileIds: [],
  ruleIds: [],
  ...overrides,
});

describe('captureEnvironment', () => {
  it('guarda solo los ids de lo que esta prendido', () => {
    const state = stateWith(
      [
        ['p1', true],
        ['p2', false],
      ],
      [
        ['r1', false],
        ['r2', true],
      ]
    );

    const captured = captureEnvironment(state, 'staging');

    expect(captured.name).toBe('staging');
    expect(captured.profileIds).toEqual(['p1']);
    expect(captured.ruleIds).toEqual(['r2']);
  });

  it('recorta el nombre', () => {
    expect(captureEnvironment(stateWith([], []), '  dev  ').name).toBe('dev');
  });
});

describe('applyEnvironment', () => {
  it('prende lo que el entorno lista y apaga todo lo demas', () => {
    const base = stateWith(
      [
        ['p1', false],
        ['p2', true],
      ],
      [
        ['r1', true],
        ['r2', false],
      ]
    );
    const state: ToolkitState = {
      ...base,
      environments: [environment({ profileIds: ['p1'], ruleIds: ['r2'] })],
    };

    const next = applyEnvironment(state, 'env');

    expect(next.profiles.map((profile) => [profile.id, profile.enabled])).toEqual([
      ['p1', true],
      ['p2', false],
    ]);
    expect(next.trafficRules.map((rule) => [rule.id, rule.enabled])).toEqual([
      ['r1', false],
      ['r2', true],
    ]);
  });

  it('un entorno vacio apaga todo', () => {
    const state: ToolkitState = {
      ...stateWith([['p1', true]], [['r1', true]]),
      environments: [environment()],
    };

    const next = applyEnvironment(state, 'env');

    expect(next.profiles[0]?.enabled).toBe(false);
    expect(next.trafficRules[0]?.enabled).toBe(false);
  });

  it('devuelve el estado intacto si el entorno no existe', () => {
    const state = stateWith([['p1', true]], []);
    expect(applyEnvironment(state, 'fantasma')).toBe(state);
  });

  it('ignora ids de items que ya no existen', () => {
    const state: ToolkitState = {
      ...stateWith([['p1', false]], []),
      environments: [environment({ profileIds: ['p1', 'borrado'] })],
    };

    expect(applyEnvironment(state, 'env').profiles).toHaveLength(1);
    expect(applyEnvironment(state, 'env').profiles[0]?.enabled).toBe(true);
  });
});

describe('findActiveEnvironment', () => {
  it('detecta el entorno que describe lo que esta prendido', () => {
    const state: ToolkitState = {
      ...stateWith(
        [
          ['p1', true],
          ['p2', false],
        ],
        []
      ),
      environments: [environment({ id: 'a', profileIds: ['p2'] }), environment({ id: 'b', profileIds: ['p1'] })],
    };

    expect(findActiveEnvironment(state)?.id).toBe('b');
  });

  it('no marca ninguno cuando se toca un perfil suelto', () => {
    const state: ToolkitState = {
      ...stateWith(
        [
          ['p1', true],
          ['p2', true],
        ],
        []
      ),
      environments: [environment({ profileIds: ['p1'] })],
    };

    expect(findActiveEnvironment(state)).toBeNull();
  });

  it('un id borrado no impide reconocer el entorno', () => {
    const state: ToolkitState = {
      ...stateWith([['p1', true]], []),
      environments: [environment({ profileIds: ['p1', 'borrado'] })],
    };

    expect(findActiveEnvironment(state)?.id).toBe('env');
  });

  it('reconoce el entorno vacio cuando no hay nada prendido', () => {
    const state: ToolkitState = {
      ...stateWith([['p1', false]], []),
      environments: [environment()],
    };

    expect(findActiveEnvironment(state)?.id).toBe('env');
  });
});

describe('describeEnvironment', () => {
  it('cuenta solo los items que siguen existiendo', () => {
    const state = stateWith([['p1', true]], [['r1', true]]);
    const env = environment({ profileIds: ['p1', 'borrado'], ruleIds: ['r1'] });

    expect(describeEnvironment(env, state)).toBe('1 perfil(es) · 1 regla(s)');
  });
});

describe('forgetFromEnvironments', () => {
  it('saca el id borrado de todos los entornos', () => {
    const environments = [
      environment({ id: 'a', profileIds: ['p1', 'p2'] }),
      environment({ id: 'b', ruleIds: ['p1'] }),
    ];

    const next = forgetFromEnvironments(environments, 'p1');

    expect(next[0]?.profileIds).toEqual(['p2']);
    expect(next[1]?.ruleIds).toEqual([]);
  });
});
