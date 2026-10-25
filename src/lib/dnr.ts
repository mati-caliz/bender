import { HTTP_TOKEN_PATTERN } from "@/lib/constants";
import { compileCorsRules } from "@/lib/dnr-cors";
import { DNR_ACTION_MODIFY_HEADERS, toDnrHeaderOperation } from "@/lib/dnr-enums";
import {
  type CompileContext,
  createRuleSession,
  type DnrRule,
  type ModifyHeaderSpec,
  type RuleSession,
  toRuleCondition,
} from "@/lib/dnr-session";
import { compileTrafficRules } from "@/lib/dnr-traffic";
import { compileUserAgentRule } from "@/lib/dnr-user-agent";
import { hasTabPlaceholders, type PlaceholderContext, resolvePlaceholders } from "@/lib/placeholders";
import { scopeToCondition } from "@/lib/scope";
import type { EngineDiagnostic, HeaderEntry, Profile, ToolkitState } from "@/types";

export type { CompileContext, TabOrigin } from "@/lib/dnr-session";

const PROFILE_BASE_PRIORITY = 10;
const FIRST_RULE_ID = 1;

export interface CompiledRules {
  rules: DnrRule[];
  labels: Record<number, string>;
  diagnostics: EngineDiagnostic[];
  activeProfileCount: number;
  activeHeaderCount: number;
}

interface CompiledProfileRules {
  rules: DnrRule[];
  headerCount: number;
}

const compileHeaderValue = (
  entry: HeaderEntry,
  ownerName: string,
  placeholders: PlaceholderContext,
  diagnostics: EngineDiagnostic[],
): string => {
  const { value, unknownNames, unavailableNames } = resolvePlaceholders(entry.value, placeholders);

  for (const name of unknownNames) {
    diagnostics.push({
      level: "warning",
      message: `"{{${name}}}" no es un valor dinamico conocido (${ownerName}, header "${entry.name}"): se manda tal cual.`,
    });
  }
  if (unavailableNames.length > 0) {
    diagnostics.push({
      level: "warning",
      message: `No hay pestaña activa para resolver ${unavailableNames
        .map((name) => `"{{${name}}}"`)
        .join(", ")} (${ownerName}, header "${entry.name}"): queda vacio.`,
    });
  }

  return value;
};

const compileHeaderEntries = (
  entries: HeaderEntry[],
  ownerName: string,
  placeholders: PlaceholderContext,
  diagnostics: EngineDiagnostic[],
): ModifyHeaderSpec[] => {
  const byName = new Map<string, ModifyHeaderSpec>();

  for (const entry of entries) {
    if (!entry.enabled) continue;
    const name = entry.name.trim();
    if (!name) continue;

    if (!HTTP_TOKEN_PATTERN.test(name)) {
      diagnostics.push({
        level: "error",
        message: `"${name}" no es un nombre de header valido (${ownerName}), se ignora.`,
      });
      continue;
    }

    const key = `${name.toLowerCase()}:${entry.operation}`;
    if (byName.has(key) && entry.operation !== "append") {
      diagnostics.push({
        level: "warning",
        message: `El header "${name}" esta repetido en ${ownerName}: gana el ultimo de la lista.`,
      });
    }

    const spec: ModifyHeaderSpec = { header: name, operation: toDnrHeaderOperation(entry.operation) };
    if (entry.operation !== "remove") {
      spec.value = compileHeaderValue(entry, ownerName, placeholders, diagnostics);
    }
    byName.set(entry.operation === "append" ? `${key}:${byName.size}` : key, spec);
  }

  return Array.from(byName.values());
};

const compileProfileRule = (profile: Profile, index: number, session: RuleSession): DnrRule | null => {
  const condition = scopeToCondition(profile.scope, session.context);
  if (!condition) return null;

  const owner = `perfil "${profile.name}"`;
  const { placeholders, diagnostics } = session;
  const requestHeaders = compileHeaderEntries(profile.requestHeaders, owner, placeholders, diagnostics);
  const responseHeaders = compileHeaderEntries(profile.responseHeaders, owner, placeholders, diagnostics);
  if (requestHeaders.length === 0 && responseHeaders.length === 0) return null;

  return session.addRule(`Perfil · ${profile.name}`, {
    priority: PROFILE_BASE_PRIORITY + index,
    action: {
      type: DNR_ACTION_MODIFY_HEADERS,
      ...(requestHeaders.length > 0 ? { requestHeaders } : {}),
      ...(responseHeaders.length > 0 ? { responseHeaders } : {}),
    },
    condition: toRuleCondition(condition),
  });
};

const countHeaders = (rule: DnrRule): number =>
  (rule.action.requestHeaders?.length ?? 0) + (rule.action.responseHeaders?.length ?? 0);

const compileProfileRules = (profiles: Profile[], session: RuleSession): CompiledProfileRules => {
  const rules = profiles
    .map((profile, index) => compileProfileRule(profile, index, session))
    .filter((rule): rule is DnrRule => rule !== null);
  return { rules, headerCount: rules.reduce((total, rule) => total + countHeaders(rule), 0) };
};

export const dependsOnTabs = (state: ToolkitState): boolean => {
  if (!state.globalEnabled) return false;
  if (state.cors.enabled && state.cors.allowOrigin === "reflect") return true;

  const usesTabPlaceholder = state.profiles
    .filter((profile) => profile.enabled)
    .some((profile) =>
      [...profile.requestHeaders, ...profile.responseHeaders].some(
        (entry) => entry.enabled && entry.operation !== "remove" && hasTabPlaceholders(entry.value),
      ),
    );
  if (usesTabPlaceholder) return true;

  const activeScopes = [
    ...state.profiles.filter((profile) => profile.enabled).map((profile) => profile.scope),
    ...state.trafficRules
      .filter((trafficRule) => trafficRule.enabled)
      .map((trafficRule) => trafficRule.scope),
    ...(state.cors.enabled ? [state.cors.scope] : []),
    ...(state.userAgent.enabled ? [state.userAgent.scope] : []),
  ];

  return activeScopes.some((scope) => scope.activeTabOnly);
};

export const compileRules = (state: ToolkitState, context: CompileContext): CompiledRules => {
  if (!state.globalEnabled) {
    return { rules: [], labels: {}, diagnostics: [], activeProfileCount: 0, activeHeaderCount: 0 };
  }

  const activeTab = context.tabs.find((tab) => tab.id === context.activeTabId) ?? null;
  const placeholders: PlaceholderContext = { tabUrl: activeTab?.url ?? null, now: Date.now() };
  const session = createRuleSession(context, placeholders, FIRST_RULE_ID);

  const enabledProfiles = state.profiles.filter((profile) => profile.enabled);
  const profileRules = compileProfileRules(enabledProfiles, session);
  const rules = [
    ...profileRules.rules,
    ...compileCorsRules(state.cors, session),
    ...compileUserAgentRule(state.userAgent, session),
    ...compileTrafficRules(state.trafficRules, session),
  ];

  return {
    rules,
    labels: session.labels,
    diagnostics: session.diagnostics,
    activeProfileCount: enabledProfiles.length,
    activeHeaderCount: profileRules.headerCount,
  };
};
