import { createId } from '@/lib/ids';
import type { Environment, ToolkitState } from '@/types';

const idsOf = <TItem extends { id: string }>(items: TItem[]): string[] => items.map((item) => item.id);

const enabledIdsOf = <TItem extends { id: string; enabled: boolean }>(items: TItem[]): string[] =>
  idsOf(items.filter((item) => item.enabled));

const sameIdSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const known = new Set(left);
  return right.every((id) => known.has(id));
};

/**
 * Un entorno puede listar ids que ya no existen (perfil borrado despues de guardarlo).
 * Para comparar contra lo que hay prendido hoy solo cuentan los que siguen vivos.
 */
const resolveTargets = (environment: Environment, state: ToolkitState): { profileIds: string[]; ruleIds: string[] } => {
  const liveProfiles = new Set(idsOf(state.profiles));
  const liveRules = new Set(idsOf(state.trafficRules));

  return {
    profileIds: environment.profileIds.filter((id) => liveProfiles.has(id)),
    ruleIds: environment.ruleIds.filter((id) => liveRules.has(id)),
  };
};

/** Guarda lo que esta prendido ahora mismo como un entorno nuevo. */
export const captureEnvironment = (state: ToolkitState, name: string): Environment => ({
  id: createId(),
  name: name.trim(),
  profileIds: enabledIdsOf(state.profiles),
  ruleIds: enabledIdsOf(state.trafficRules),
});

/**
 * Deja prendido exactamente lo que el entorno lista y apagado todo lo demas.
 * No toca CORS, User-Agent ni userscripts: esos son globales, no por entorno.
 */
export const applyEnvironment = (state: ToolkitState, environmentId: string): ToolkitState => {
  const environment = state.environments.find((candidate) => candidate.id === environmentId);
  if (!environment) return state;

  const wantedProfiles = new Set(environment.profileIds);
  const wantedRules = new Set(environment.ruleIds);

  return {
    ...state,
    profiles: state.profiles.map((profile) => ({ ...profile, enabled: wantedProfiles.has(profile.id) })),
    trafficRules: state.trafficRules.map((rule) => ({ ...rule, enabled: wantedRules.has(rule.id) })),
  };
};

/**
 * Cual entorno describe lo que esta prendido ahora. Se deriva en vez de guardarse
 * para que togglear un perfil suelto no deje un "entorno activo" que ya no aplica.
 */
export const findActiveEnvironment = (state: ToolkitState): Environment | null => {
  const enabledProfiles = enabledIdsOf(state.profiles);
  const enabledRules = enabledIdsOf(state.trafficRules);

  return (
    state.environments.find((environment) => {
      const targets = resolveTargets(environment, state);
      return sameIdSet(targets.profileIds, enabledProfiles) && sameIdSet(targets.ruleIds, enabledRules);
    }) ?? null
  );
};

/** Cuantos perfiles y reglas vivos deja prendidos, para mostrarlo en la UI. */
export const describeEnvironment = (environment: Environment, state: ToolkitState): string => {
  const targets = resolveTargets(environment, state);
  return `${targets.profileIds.length} perfil(es) · ${targets.ruleIds.length} regla(s)`;
};

/** Saca de todos los entornos un perfil o regla borrado, para no dejar ids colgados. */
export const forgetFromEnvironments = (environments: Environment[], removedId: string): Environment[] =>
  environments.map((environment) => ({
    ...environment,
    profileIds: environment.profileIds.filter((id) => id !== removedId),
    ruleIds: environment.ruleIds.filter((id) => id !== removedId),
  }));
