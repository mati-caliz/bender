import { DNR_ACTION_BLOCK, DNR_ACTION_REDIRECT } from "@/lib/dnr-enums";
import { type DnrRule, type RuleSession, toRuleCondition } from "@/lib/dnr-session";
import { isValidRegExp } from "@/lib/regexp";
import { type CompiledCondition, scopeToCondition } from "@/lib/scope";
import type { TrafficRule } from "@/types";

const REDIRECT_PRIORITY = 150;
const BLOCK_PRIORITY = 200;

type RedirectRule = TrafficRule & { action: { kind: "redirect"; target: string; useRegex: boolean } };

const isAbsoluteUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const compileRegexRedirect = (
  trafficRule: RedirectRule,
  target: string,
  condition: CompiledCondition,
  session: RuleSession,
): DnrRule | null => {
  const pattern = trafficRule.scope.urlFilter.trim();
  if (!pattern) {
    session.diagnostics.push({
      level: "error",
      message: `La regla "${trafficRule.name}" usa regex pero el patron de URL esta vacio.`,
    });
    return null;
  }
  if (!isValidRegExp(pattern)) {
    session.diagnostics.push({ level: "error", message: `La regex de "${trafficRule.name}" es invalida.` });
    return null;
  }

  const regexCondition: CompiledCondition = { ...condition, regexFilter: pattern };
  delete regexCondition.urlFilter;
  return session.addRule(`Redirect · ${trafficRule.name}`, {
    priority: REDIRECT_PRIORITY,
    action: { type: DNR_ACTION_REDIRECT, redirect: { regexSubstitution: target } },
    condition: toRuleCondition(regexCondition),
  });
};

const compileUrlRedirect = (
  trafficRule: RedirectRule,
  target: string,
  condition: CompiledCondition,
  session: RuleSession,
): DnrRule | null => {
  if (!isAbsoluteUrl(target)) {
    session.diagnostics.push({
      level: "error",
      message: `El destino de "${trafficRule.name}" tiene que ser una URL absoluta.`,
    });
    return null;
  }
  return session.addRule(`Redirect · ${trafficRule.name}`, {
    priority: REDIRECT_PRIORITY,
    action: { type: DNR_ACTION_REDIRECT, redirect: { url: target } },
    condition: toRuleCondition(condition),
  });
};

const compileRedirect = (
  trafficRule: RedirectRule,
  condition: CompiledCondition,
  session: RuleSession,
): DnrRule | null => {
  const target = trafficRule.action.target.trim();
  if (!target) {
    session.diagnostics.push({
      level: "error",
      message: `La regla "${trafficRule.name}" no tiene destino de redirect.`,
    });
    return null;
  }
  return trafficRule.action.useRegex
    ? compileRegexRedirect(trafficRule, target, condition, session)
    : compileUrlRedirect(trafficRule, target, condition, session);
};

const isRedirectRule = (trafficRule: TrafficRule): trafficRule is RedirectRule =>
  trafficRule.action.kind === "redirect";

const compileTrafficRule = (trafficRule: TrafficRule, session: RuleSession): DnrRule | null => {
  // mock y chaos no son declarativos: los aplica inject.ts sobre fetch/XHR.
  if (!trafficRule.enabled || trafficRule.action.kind === "mock" || trafficRule.action.kind === "chaos") {
    return null;
  }

  const condition = scopeToCondition(trafficRule.scope, session.context);
  if (!condition) return null;

  if (isRedirectRule(trafficRule)) return compileRedirect(trafficRule, condition, session);

  return session.addRule(`Bloqueo · ${trafficRule.name}`, {
    priority: BLOCK_PRIORITY,
    action: { type: DNR_ACTION_BLOCK },
    condition: toRuleCondition(condition),
  });
};

export const compileTrafficRules = (trafficRules: TrafficRule[], session: RuleSession): DnrRule[] =>
  trafficRules
    .map((trafficRule) => compileTrafficRule(trafficRule, session))
    .filter((rule): rule is DnrRule => rule !== null);
