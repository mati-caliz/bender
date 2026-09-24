import type { TrafficRule, TrafficRuleAction } from "@/types";

export type ActionOfKind<Kind extends TrafficRuleAction["kind"]> = Extract<TrafficRuleAction, { kind: Kind }>;
export type RedirectAction = ActionOfKind<"redirect">;
export type ChaosAction = ActionOfKind<"chaos">;
export type MockAction = ActionOfKind<"mock">;

export type MutateBoundRule = (mutate: (rule: TrafficRule) => TrafficRule) => void;

const DECIMAL_RADIX = 10;

export const parseDecimal = (value: string): number => Number.parseInt(value, DECIMAL_RADIX);

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const redirectPatcher =
  (mutateRule: MutateBoundRule) =>
  (patch: Partial<Omit<RedirectAction, "kind">>): void => {
    mutateRule((current) =>
      current.action.kind === "redirect" ? { ...current, action: { ...current.action, ...patch } } : current,
    );
  };

export const chaosPatcher =
  (mutateRule: MutateBoundRule) =>
  (patch: Partial<Omit<ChaosAction, "kind">>): void => {
    mutateRule((current) =>
      current.action.kind === "chaos" ? { ...current, action: { ...current.action, ...patch } } : current,
    );
  };

export const mockMutator =
  (mutateRule: MutateBoundRule) =>
  (mutate: (action: MockAction) => MockAction): void => {
    mutateRule((current) =>
      current.action.kind === "mock" ? { ...current, action: mutate(current.action) } : current,
    );
  };
