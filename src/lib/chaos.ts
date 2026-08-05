import { requestMatchesScope, type ScopeRequest } from '@/lib/scope';
import type { ChaosDefinition, ToolkitState } from '@/types';

export const MIN_FAIL_RATE = 0;
export const MAX_FAIL_RATE = 100;

/** `failStatus: 0` corta la request como un error de red en vez de responder algo. */
export const NETWORK_ERROR_STATUS = 0;

export const collectChaosDefinitions = (state: ToolkitState): ChaosDefinition[] => {
  if (!state.globalEnabled) return [];

  return state.trafficRules
    .filter((rule) => rule.enabled && rule.action.kind === 'chaos')
    .map((rule) => {
      const action = rule.action;
      if (action.kind !== 'chaos') return null;
      return {
        id: rule.id,
        name: rule.name,
        scope: rule.scope,
        delayMs: action.delayMs,
        failRate: action.failRate,
        failStatus: action.failStatus,
      };
    })
    .filter((chaos): chaos is ChaosDefinition => chaos !== null);
};

export const findMatchingChaos = (chaos: ChaosDefinition[], request: ScopeRequest): ChaosDefinition | null =>
  chaos.find((candidate) => requestMatchesScope(candidate.scope, request)) ?? null;

/**
 * `roll` viene de afuera (0 <= roll < 1) para que la decision sea testeable.
 * 0% no falla nunca y 100% falla siempre, sin depender de como caiga el random.
 */
export const shouldFail = (failRate: number, roll: number): boolean => {
  if (failRate <= MIN_FAIL_RATE) return false;
  if (failRate >= MAX_FAIL_RATE) return true;
  return roll * MAX_FAIL_RATE < failRate;
};

export const describeChaos = (chaos: { delayMs: number; failRate: number; failStatus: number }): string => {
  const parts: string[] = [];
  if (chaos.delayMs > 0) parts.push(`+${chaos.delayMs} ms`);
  if (chaos.failRate > 0) {
    const failure = chaos.failStatus === NETWORK_ERROR_STATUS ? 'error de red' : String(chaos.failStatus);
    parts.push(`${chaos.failRate}% ${failure}`);
  }
  return parts.length ? parts.join(' · ') : 'sin efecto';
};
