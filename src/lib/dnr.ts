import { HTTP_TOKEN_PATTERN } from '@/lib/constants';
import {
  DNR_ACTION_BLOCK,
  DNR_ACTION_MODIFY_HEADERS,
  DNR_ACTION_REDIRECT,
  DNR_OPERATION_REMOVE,
  DNR_OPERATION_SET,
  toDnrHeaderOperation,
  toDnrResourceTypes,
} from '@/lib/dnr-enums';
import { type CompiledCondition, scopeToCondition } from '@/lib/scope';
import type { CorsConfig, EngineDiagnostic, HeaderEntry, Profile, ToolkitState, UserAgentConfig } from '@/types';

const PROFILE_BASE_PRIORITY = 10;
const CORS_PRIORITY = 100;
const USER_AGENT_PRIORITY = 120;
const REDIRECT_PRIORITY = 150;
const BLOCK_PRIORITY = 200;
const FIRST_RULE_ID = 1;

export interface TabOrigin {
  id: number;
  origin: string;
}

export interface CompileContext {
  activeTabId: number | null;
  tabs: TabOrigin[];
}

export interface CompiledRules {
  rules: chrome.declarativeNetRequest.Rule[];
  labels: Record<number, string>;
  diagnostics: EngineDiagnostic[];
  activeProfileCount: number;
}

interface ModifyHeaderSpec {
  header: string;
  operation: chrome.declarativeNetRequest.HeaderOperation;
  value?: string;
}

const toRuleCondition = (condition: CompiledCondition): chrome.declarativeNetRequest.RuleCondition => {
  const ruleCondition: chrome.declarativeNetRequest.RuleCondition = {
    resourceTypes: toDnrResourceTypes(condition.resourceTypes),
  };
  if (condition.urlFilter) ruleCondition.urlFilter = condition.urlFilter;
  if (condition.regexFilter) ruleCondition.regexFilter = condition.regexFilter;
  if (condition.requestDomains) ruleCondition.requestDomains = condition.requestDomains;
  if (condition.excludedRequestDomains) ruleCondition.excludedRequestDomains = condition.excludedRequestDomains;
  if (condition.tabIds) ruleCondition.tabIds = condition.tabIds;
  return ruleCondition;
};

const compileHeaderEntries = (
  entries: HeaderEntry[],
  ownerName: string,
  diagnostics: EngineDiagnostic[]
): ModifyHeaderSpec[] => {
  const byName = new Map<string, ModifyHeaderSpec>();

  for (const entry of entries) {
    if (!entry.enabled) continue;
    const name = entry.name.trim();
    if (!name) continue;

    if (!HTTP_TOKEN_PATTERN.test(name)) {
      diagnostics.push({
        level: 'error',
        message: `"${name}" no es un nombre de header valido (${ownerName}), se ignora.`,
      });
      continue;
    }

    const key = `${name.toLowerCase()}:${entry.operation}`;
    if (byName.has(key) && entry.operation !== 'append') {
      diagnostics.push({
        level: 'warning',
        message: `El header "${name}" esta repetido en ${ownerName}: gana el ultimo de la lista.`,
      });
    }

    const spec: ModifyHeaderSpec = { header: name, operation: toDnrHeaderOperation(entry.operation) };
    if (entry.operation !== 'remove') spec.value = entry.value;
    byName.set(entry.operation === 'append' ? `${key}:${byName.size}` : key, spec);
  }

  return Array.from(byName.values());
};

const compileProfileRules = (
  profiles: Profile[],
  context: CompileContext,
  nextId: () => number,
  labels: Record<number, string>,
  diagnostics: EngineDiagnostic[]
): chrome.declarativeNetRequest.Rule[] => {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  profiles.forEach((profile, index) => {
    const condition = scopeToCondition(profile.scope, context);
    if (!condition) return;

    const requestHeaders = compileHeaderEntries(profile.requestHeaders, `perfil "${profile.name}"`, diagnostics);
    const responseHeaders = compileHeaderEntries(profile.responseHeaders, `perfil "${profile.name}"`, diagnostics);
    if (!requestHeaders.length && !responseHeaders.length) return;

    const id = nextId();
    labels[id] = `Perfil · ${profile.name}`;
    rules.push({
      id,
      priority: PROFILE_BASE_PRIORITY + index,
      action: {
        type: DNR_ACTION_MODIFY_HEADERS,
        ...(requestHeaders.length ? { requestHeaders } : {}),
        ...(responseHeaders.length ? { responseHeaders } : {}),
      },
      condition: toRuleCondition(condition),
    });
  });

  return rules;
};

const corsResponseHeaders = (cors: CorsConfig, originValue: string): ModifyHeaderSpec[] => {
  const headers: ModifyHeaderSpec[] = [
    { header: 'access-control-allow-origin', operation: DNR_OPERATION_SET, value: originValue },
    { header: 'access-control-allow-methods', operation: DNR_OPERATION_SET, value: cors.allowMethods },
    { header: 'access-control-allow-headers', operation: DNR_OPERATION_SET, value: cors.allowHeaders },
    { header: 'access-control-max-age', operation: DNR_OPERATION_SET, value: String(cors.maxAgeSeconds) },
  ];

  if (cors.exposeHeaders.trim()) {
    headers.push({
      header: 'access-control-expose-headers',
      operation: DNR_OPERATION_SET,
      value: cors.exposeHeaders,
    });
  }

  headers.push(
    cors.allowCredentials
      ? { header: 'access-control-allow-credentials', operation: DNR_OPERATION_SET, value: 'true' }
      : { header: 'access-control-allow-credentials', operation: DNR_OPERATION_REMOVE }
  );

  if (cors.removeContentSecurityPolicy) {
    headers.push(
      { header: 'content-security-policy', operation: DNR_OPERATION_REMOVE },
      { header: 'content-security-policy-report-only', operation: DNR_OPERATION_REMOVE }
    );
  }
  if (cors.removeFrameOptions) {
    headers.push({ header: 'x-frame-options', operation: DNR_OPERATION_REMOVE });
  }

  return headers;
};

const compileCorsRules = (
  cors: CorsConfig,
  context: CompileContext,
  nextId: () => number,
  labels: Record<number, string>,
  diagnostics: EngineDiagnostic[]
): chrome.declarativeNetRequest.Rule[] => {
  if (!cors.enabled) return [];

  const condition = scopeToCondition(cors.scope, context);
  if (!condition) return [];

  if (cors.allowOrigin === 'wildcard' && cors.allowCredentials) {
    diagnostics.push({
      level: 'warning',
      message: 'CORS: el navegador rechaza "*" junto con credenciales. Usa "reflejar el origen" si mandas cookies.',
    });
  }

  if (cors.allowOrigin !== 'reflect') {
    const originValue = cors.allowOrigin === 'wildcard' ? '*' : cors.customOrigin.trim();
    if (!originValue) {
      diagnostics.push({ level: 'error', message: 'CORS: el origen permitido esta vacio.' });
      return [];
    }
    const id = nextId();
    labels[id] = 'CORS';
    return [
      {
        id,
        priority: CORS_PRIORITY,
        action: { type: DNR_ACTION_MODIFY_HEADERS, responseHeaders: corsResponseHeaders(cors, originValue) },
        condition: toRuleCondition(condition),
      },
    ];
  }

  const targetTabs = cors.scope.activeTabOnly
    ? context.tabs.filter((tab) => tab.id === context.activeTabId)
    : context.tabs;

  if (!targetTabs.length) {
    diagnostics.push({
      level: 'warning',
      message: 'CORS: no hay pestañas http(s) abiertas para reflejar el origen.',
    });
    return [];
  }

  return targetTabs.map((tab) => {
    const id = nextId();
    labels[id] = `CORS · ${tab.origin}`;
    return {
      id,
      priority: CORS_PRIORITY,
      action: { type: DNR_ACTION_MODIFY_HEADERS, responseHeaders: corsResponseHeaders(cors, tab.origin) },
      condition: toRuleCondition({ ...condition, tabIds: [tab.id] }),
    };
  });
};

const clientHintHeaders = (userAgentValue: string): ModifyHeaderSpec[] => {
  const isMobile = /Mobile|Android|iPhone|iPod/i.test(userAgentValue);
  const platform = /Android/i.test(userAgentValue)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgentValue)
      ? 'iOS'
      : /Macintosh|Mac OS X/i.test(userAgentValue)
        ? 'macOS'
        : /Windows/i.test(userAgentValue)
          ? 'Windows'
          : 'Linux';

  const headers: ModifyHeaderSpec[] = [
    { header: 'sec-ch-ua-mobile', operation: DNR_OPERATION_SET, value: isMobile ? '?1' : '?0' },
    { header: 'sec-ch-ua-platform', operation: DNR_OPERATION_SET, value: `"${platform}"` },
  ];

  if (!/Chrome\/|Chromium\/|Edg\//i.test(userAgentValue)) {
    headers.push(
      { header: 'sec-ch-ua', operation: DNR_OPERATION_REMOVE },
      { header: 'sec-ch-ua-full-version-list', operation: DNR_OPERATION_REMOVE },
      { header: 'sec-ch-ua-platform-version', operation: DNR_OPERATION_REMOVE }
    );
  }

  return headers;
};

const compileUserAgentRule = (
  userAgent: UserAgentConfig,
  context: CompileContext,
  nextId: () => number,
  labels: Record<number, string>,
  diagnostics: EngineDiagnostic[]
): chrome.declarativeNetRequest.Rule[] => {
  if (!userAgent.enabled) return [];

  const value = userAgent.value.trim();
  if (!value) {
    diagnostics.push({ level: 'error', message: 'User-Agent: el valor esta vacio.' });
    return [];
  }

  const condition = scopeToCondition(userAgent.scope, context);
  if (!condition) return [];

  const requestHeaders: ModifyHeaderSpec[] = [
    { header: 'user-agent', operation: DNR_OPERATION_SET, value },
    ...(userAgent.spoofClientHints ? clientHintHeaders(value) : []),
  ];

  const id = nextId();
  labels[id] = 'User-Agent';
  return [
    {
      id,
      priority: USER_AGENT_PRIORITY,
      action: { type: DNR_ACTION_MODIFY_HEADERS, requestHeaders },
      condition: toRuleCondition(condition),
    },
  ];
};

const compileTrafficRules = (
  state: ToolkitState,
  context: CompileContext,
  nextId: () => number,
  labels: Record<number, string>,
  diagnostics: EngineDiagnostic[]
): chrome.declarativeNetRequest.Rule[] => {
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  for (const trafficRule of state.trafficRules) {
    if (!trafficRule.enabled || trafficRule.action.kind === 'mock') continue;

    const condition = scopeToCondition(trafficRule.scope, context);
    if (!condition) continue;

    if (trafficRule.action.kind === 'block') {
      const id = nextId();
      labels[id] = `Bloqueo · ${trafficRule.name}`;
      rules.push({
        id,
        priority: BLOCK_PRIORITY,
        action: { type: DNR_ACTION_BLOCK },
        condition: toRuleCondition(condition),
      });
      continue;
    }

    const target = trafficRule.action.target.trim();
    if (!target) {
      diagnostics.push({ level: 'error', message: `La regla "${trafficRule.name}" no tiene destino de redirect.` });
      continue;
    }

    if (trafficRule.action.useRegex) {
      const pattern = trafficRule.scope.urlFilter.trim();
      if (!pattern) {
        diagnostics.push({
          level: 'error',
          message: `La regla "${trafficRule.name}" usa regex pero el patron de URL esta vacio.`,
        });
        continue;
      }
      try {
        new RegExp(pattern);
      } catch {
        diagnostics.push({ level: 'error', message: `La regex de "${trafficRule.name}" es invalida.` });
        continue;
      }

      const id = nextId();
      labels[id] = `Redirect · ${trafficRule.name}`;
      const regexCondition: CompiledCondition = { ...condition, regexFilter: pattern };
      delete regexCondition.urlFilter;
      rules.push({
        id,
        priority: REDIRECT_PRIORITY,
        action: { type: DNR_ACTION_REDIRECT, redirect: { regexSubstitution: target } },
        condition: toRuleCondition(regexCondition),
      });
      continue;
    }

    try {
      new URL(target);
    } catch {
      diagnostics.push({
        level: 'error',
        message: `El destino de "${trafficRule.name}" tiene que ser una URL absoluta.`,
      });
      continue;
    }

    const id = nextId();
    labels[id] = `Redirect · ${trafficRule.name}`;
    rules.push({
      id,
      priority: REDIRECT_PRIORITY,
      action: { type: DNR_ACTION_REDIRECT, redirect: { url: target } },
      condition: toRuleCondition(condition),
    });
  }

  return rules;
};

export const compileRules = (state: ToolkitState, context: CompileContext): CompiledRules => {
  const labels: Record<number, string> = {};
  const diagnostics: EngineDiagnostic[] = [];

  if (!state.globalEnabled) {
    return { rules: [], labels, diagnostics, activeProfileCount: 0 };
  }

  let currentId = FIRST_RULE_ID;
  const nextId = () => currentId++;

  const enabledProfiles = state.profiles.filter((profile) => profile.enabled);
  const rules = [
    ...compileProfileRules(enabledProfiles, context, nextId, labels, diagnostics),
    ...compileCorsRules(state.cors, context, nextId, labels, diagnostics),
    ...compileUserAgentRule(state.userAgent, context, nextId, labels, diagnostics),
    ...compileTrafficRules(state, context, nextId, labels, diagnostics),
  ];

  return { rules, labels, diagnostics, activeProfileCount: enabledProfiles.length };
};
