import { toDnrRequestMethods, toDnrResourceTypes } from "@/lib/dnr-enums";
import type { PlaceholderContext } from "@/lib/placeholders";
import type { CompiledCondition } from "@/lib/scope";
import { hasText } from "@/lib/text";
import type { EngineDiagnostic } from "@/types";

export type DnrRule = chrome.declarativeNetRequest.Rule;

export interface TabOrigin {
  id: number;
  origin: string;
  url: string;
}

export interface CompileContext {
  activeTabId: number | null;
  tabs: TabOrigin[];
}

export interface ModifyHeaderSpec {
  header: string;
  operation: chrome.declarativeNetRequest.HeaderOperation;
  value?: string;
}

export interface RuleSession {
  context: CompileContext;
  placeholders: PlaceholderContext;
  diagnostics: EngineDiagnostic[];
  labels: Record<number, string>;
  addRule: (label: string, rule: Omit<DnrRule, "id">) => DnrRule;
}

export const createRuleSession = (
  context: CompileContext,
  placeholders: PlaceholderContext,
  firstRuleId: number,
): RuleSession => {
  const labels: Record<number, string> = {};
  let nextId = firstRuleId;
  return {
    context,
    placeholders,
    diagnostics: [],
    labels,
    addRule: (label, rule) => {
      const id = nextId;
      nextId += 1;
      labels[id] = label;
      return { id, ...rule };
    },
  };
};

export const toRuleCondition = (condition: CompiledCondition): chrome.declarativeNetRequest.RuleCondition => {
  const ruleCondition: chrome.declarativeNetRequest.RuleCondition = {
    resourceTypes: toDnrResourceTypes(condition.resourceTypes),
  };
  if (hasText(condition.urlFilter)) ruleCondition.urlFilter = condition.urlFilter;
  if (hasText(condition.regexFilter)) ruleCondition.regexFilter = condition.regexFilter;
  if (condition.requestDomains) ruleCondition.requestDomains = condition.requestDomains;
  if (condition.excludedRequestDomains)
    ruleCondition.excludedRequestDomains = condition.excludedRequestDomains;
  if (condition.initiatorDomains) ruleCondition.initiatorDomains = condition.initiatorDomains;
  if (condition.excludedInitiatorDomains) {
    ruleCondition.excludedInitiatorDomains = condition.excludedInitiatorDomains;
  }
  if (condition.requestMethods) ruleCondition.requestMethods = toDnrRequestMethods(condition.requestMethods);
  if (condition.tabIds) ruleCondition.tabIds = condition.tabIds;
  return ruleCondition;
};
