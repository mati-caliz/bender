import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, createEmptyScope } from '@/lib/constants';
import { normalizeStateDetailed } from '@/lib/state';

const storedProfile = (overrides: Record<string, unknown> = {}) => ({
  id: 'profile-1',
  name: 'Local',
  color: '#6366f1',
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
  ...overrides,
});

describe('normalizeStateDetailed con entradas invalidas', () => {
  it('descarta los perfiles que no son objetos y los cuenta', () => {
    const { state, dropped } = normalizeStateDetailed({ profiles: [storedProfile(), 'roto', null, 42] });

    expect(state.profiles).toHaveLength(1);
    expect(dropped.profiles).toBe(3);
  });

  it('descarta reglas de trafico con una accion desconocida', () => {
    const { state, dropped } = normalizeStateDetailed({
      trafficRules: [
        { id: 'rule-1', name: 'Bloqueo', enabled: true, scope: createEmptyScope(), action: { kind: 'block' } },
        { id: 'rule-2', name: 'Raro', enabled: true, scope: createEmptyScope(), action: { kind: 'teletransportar' } },
      ],
    });

    expect(state.trafficRules).toHaveLength(1);
    expect(dropped.trafficRules).toBe(1);
  });

  it('completa los campos faltantes de un perfil en vez de descartarlo', () => {
    const { state, dropped } = normalizeStateDetailed({ profiles: [{ id: 'profile-1' }] });

    expect(dropped.profiles).toBe(0);
    expect(state.profiles[0]).toMatchObject({
      id: 'profile-1',
      enabled: true,
      requestHeaders: [],
      responseHeaders: [],
      scope: createEmptyScope(),
    });
  });

  it('filtra los tipos de recurso que no existen', () => {
    const { state } = normalizeStateDetailed({
      profiles: [storedProfile({ scope: { ...createEmptyScope(), resourceTypes: ['image', 'holograma'] } })],
    });

    expect(state.profiles[0]?.scope.resourceTypes).toEqual(['image']);
  });

  it('no deja un perfil seleccionado que ya no existe', () => {
    const { state } = normalizeStateDetailed({ profiles: [storedProfile()], selectedProfileId: 'profile-borrado' });

    expect(state.selectedProfileId).toBeNull();
  });

  it('deja el estado por defecto si lo guardado no es un objeto', () => {
    const { state, dropped } = normalizeStateDetailed('cualquier cosa');

    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.profiles).toEqual([]);
    expect(dropped).toEqual({ profiles: 0, trafficRules: 0, userScripts: 0, environments: 0 });
  });

  it('genera un id cuando el guardado esta vacio', () => {
    const { state } = normalizeStateDetailed({ profiles: [storedProfile({ id: '' })] });

    expect(state.profiles[0]?.id).toBeTruthy();
  });
});
