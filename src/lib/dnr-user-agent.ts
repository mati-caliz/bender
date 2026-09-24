import { DNR_ACTION_MODIFY_HEADERS, DNR_OPERATION_REMOVE, DNR_OPERATION_SET } from "@/lib/dnr-enums";
import { type DnrRule, type ModifyHeaderSpec, type RuleSession, toRuleCondition } from "@/lib/dnr-session";
import { navigatorSpoofDiagnostics } from "@/lib/navigator-spoof";
import { scopeToCondition } from "@/lib/scope";
import { userAgentTraits } from "@/lib/user-agent-traits";
import type { UserAgentConfig } from "@/types";

const USER_AGENT_PRIORITY = 120;

const clientHintHeaders = (userAgentValue: string): ModifyHeaderSpec[] => {
  const { mobile, platform, chromium } = userAgentTraits(userAgentValue);

  const headers: ModifyHeaderSpec[] = [
    { header: "sec-ch-ua-mobile", operation: DNR_OPERATION_SET, value: mobile ? "?1" : "?0" },
    { header: "sec-ch-ua-platform", operation: DNR_OPERATION_SET, value: `"${platform}"` },
  ];

  if (!chromium) {
    headers.push(
      { header: "sec-ch-ua", operation: DNR_OPERATION_REMOVE },
      { header: "sec-ch-ua-full-version-list", operation: DNR_OPERATION_REMOVE },
      { header: "sec-ch-ua-platform-version", operation: DNR_OPERATION_REMOVE },
    );
  }

  return headers;
};

export const compileUserAgentRule = (userAgent: UserAgentConfig, session: RuleSession): DnrRule[] => {
  if (!userAgent.enabled) return [];

  const value = userAgent.value.trim();
  if (!value) {
    session.diagnostics.push({ level: "error", message: "User-Agent: el valor esta vacio." });
    return [];
  }

  const condition = scopeToCondition(userAgent.scope, session.context);
  if (!condition) return [];

  const requestHeaders: ModifyHeaderSpec[] = [
    { header: "user-agent", operation: DNR_OPERATION_SET, value },
    ...(userAgent.spoofClientHints ? clientHintHeaders(value) : []),
  ];

  session.diagnostics.push(...navigatorSpoofDiagnostics(userAgent));

  return [
    session.addRule("User-Agent", {
      priority: USER_AGENT_PRIORITY,
      action: { type: DNR_ACTION_MODIFY_HEADERS, requestHeaders },
      condition: toRuleCondition(condition),
    }),
  ];
};
