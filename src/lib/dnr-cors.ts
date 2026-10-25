import { DNR_ACTION_MODIFY_HEADERS, DNR_OPERATION_REMOVE, DNR_OPERATION_SET } from "@/lib/dnr-enums";
import { type DnrRule, type ModifyHeaderSpec, type RuleSession, toRuleCondition } from "@/lib/dnr-session";
import { type CompiledCondition, scopeToCondition } from "@/lib/scope";
import type { CorsConfig } from "@/types";

const CORS_PRIORITY = 100;

const corsResponseHeaders = (cors: CorsConfig, originValue: string): ModifyHeaderSpec[] => {
  const headers: ModifyHeaderSpec[] = [
    { header: "access-control-allow-origin", operation: DNR_OPERATION_SET, value: originValue },
    { header: "access-control-allow-methods", operation: DNR_OPERATION_SET, value: cors.allowMethods },
    { header: "access-control-allow-headers", operation: DNR_OPERATION_SET, value: cors.allowHeaders },
    { header: "access-control-max-age", operation: DNR_OPERATION_SET, value: String(cors.maxAgeSeconds) },
  ];

  if (cors.exposeHeaders.trim()) {
    headers.push({
      header: "access-control-expose-headers",
      operation: DNR_OPERATION_SET,
      value: cors.exposeHeaders,
    });
  }

  headers.push(
    cors.allowCredentials
      ? { header: "access-control-allow-credentials", operation: DNR_OPERATION_SET, value: "true" }
      : { header: "access-control-allow-credentials", operation: DNR_OPERATION_REMOVE },
  );

  if (cors.removeContentSecurityPolicy) {
    headers.push(
      { header: "content-security-policy", operation: DNR_OPERATION_REMOVE },
      { header: "content-security-policy-report-only", operation: DNR_OPERATION_REMOVE },
    );
  }
  if (cors.removeFrameOptions) {
    headers.push({ header: "x-frame-options", operation: DNR_OPERATION_REMOVE });
  }

  return headers;
};

const compileFixedOriginRule = (
  cors: CorsConfig,
  condition: CompiledCondition,
  session: RuleSession,
): DnrRule[] => {
  const originValue = cors.allowOrigin === "wildcard" ? "*" : cors.customOrigin.trim();
  if (!originValue) {
    session.diagnostics.push({ level: "error", message: "CORS: el origen permitido esta vacio." });
    return [];
  }
  return [
    session.addRule("CORS", {
      priority: CORS_PRIORITY,
      action: { type: DNR_ACTION_MODIFY_HEADERS, responseHeaders: corsResponseHeaders(cors, originValue) },
      condition: toRuleCondition(condition),
    }),
  ];
};

const compileReflectedOriginRules = (
  cors: CorsConfig,
  condition: CompiledCondition,
  session: RuleSession,
): DnrRule[] => {
  const { context } = session;
  const targetTabs = cors.scope.activeTabOnly
    ? context.tabs.filter((tab) => tab.id === context.activeTabId)
    : context.tabs;

  if (targetTabs.length === 0) {
    session.diagnostics.push({
      level: "warning",
      message: "CORS: no hay pestañas http(s) abiertas para reflejar el origen.",
    });
    return [];
  }

  return targetTabs.map((tab) =>
    session.addRule(`CORS · ${tab.origin}`, {
      priority: CORS_PRIORITY,
      action: { type: DNR_ACTION_MODIFY_HEADERS, responseHeaders: corsResponseHeaders(cors, tab.origin) },
      condition: toRuleCondition({ ...condition, tabIds: [tab.id] }),
    }),
  );
};

export const compileCorsRules = (cors: CorsConfig, session: RuleSession): DnrRule[] => {
  if (!cors.enabled) return [];

  const condition = scopeToCondition(cors.scope, session.context);
  if (!condition) return [];

  if (cors.allowOrigin === "wildcard" && cors.allowCredentials) {
    session.diagnostics.push({
      level: "warning",
      message:
        'CORS: el navegador rechaza "*" junto con credenciales. Usa "reflejar el origen" si mandas cookies.',
    });
  }

  return cors.allowOrigin === "reflect"
    ? compileReflectedOriginRules(cors, condition, session)
    : compileFixedOriginRule(cors, condition, session);
};
