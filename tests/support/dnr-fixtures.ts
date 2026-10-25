import { createDefaultState, createEmptyScope } from "@/lib/constants";
import { type CompileContext, compileRules } from "@/lib/dnr";
import { createHeaderEntry } from "@/lib/factories";
import type { HeaderEntry, Profile, ToolkitState, TrafficRule, TrafficRuleAction } from "@/types";

export const EMPTY_CONTEXT: CompileContext = { activeTabId: null, tabs: [] };

export const profileWith = (overrides: Partial<Profile>): Profile => ({
  id: "profile-1",
  name: "Test",
  color: "#000000",
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
  ...overrides,
});

export const trafficRuleWith = (
  action: TrafficRuleAction,
  overrides: Partial<TrafficRule> = {},
): TrafficRule => ({
  id: "rule-1",
  name: "Regla",
  enabled: true,
  scope: createEmptyScope(),
  action,
  ...overrides,
});

export const stateWith = (overrides: Partial<ToolkitState>): ToolkitState => ({
  ...createDefaultState(),
  ...overrides,
});

export const header = (name: string, value: string, overrides: Partial<HeaderEntry> = {}): HeaderEntry =>
  createHeaderEntry({ name, value, ...overrides });

export const errorMessages = (state: ToolkitState, context: CompileContext = EMPTY_CONTEXT): string[] =>
  compileRules(state, context)
    .diagnostics.filter((diagnostic) => diagnostic.level === "error")
    .map((diagnostic) => diagnostic.message);
