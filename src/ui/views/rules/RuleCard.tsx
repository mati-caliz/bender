import type { ReactElement } from "react";
import { describeChaos } from "@/lib/chaos";
import { describeScope } from "@/lib/scope";
import { Icon } from "@/ui/components/Icon";
import { ScopeEditor } from "@/ui/components/ScopeEditor";
import { Badge, Field, IconButton, Notice, Switch, TextInput } from "@/ui/components/primitives";
import { ChaosActionEditor } from "@/ui/views/rules/ChaosActionEditor";
import { MockActionEditor } from "@/ui/views/rules/MockActionEditor";
import { RedirectActionEditor } from "@/ui/views/rules/RedirectActionEditor";
import type { MutateBoundRule } from "@/ui/views/rules/rule-actions";
import type { TrafficRule, TrafficRuleAction } from "@/types";

const ACTION_LABELS: Record<TrafficRuleAction["kind"], string> = {
  block: "Bloqueo",
  redirect: "Redirect",
  mock: "Mock",
  chaos: "Chaos",
};

const ACTION_TONES: Record<TrafficRuleAction["kind"], "danger" | "warning" | "info"> = {
  block: "danger",
  redirect: "warning",
  mock: "info",
  chaos: "warning",
};

const ActionEditor = ({
  rule,
  mutateRule,
}: {
  rule: TrafficRule;
  mutateRule: MutateBoundRule;
}): ReactElement => {
  switch (rule.action.kind) {
    case "block":
      return (
        <Notice tone="warning">
          Las requests que matcheen se cortan antes de salir. Ideal para simular caidas de un servicio o matar
          tracking.
        </Notice>
      );
    case "redirect":
      return <RedirectActionEditor action={rule.action} mutateRule={mutateRule} />;
    case "chaos":
      return <ChaosActionEditor action={rule.action} mutateRule={mutateRule} />;
    case "mock":
      return <MockActionEditor action={rule.action} mutateRule={mutateRule} />;
  }
};

const rulePreview = (rule: TrafficRule): string =>
  rule.action.kind === "chaos"
    ? `${describeChaos(rule.action)} · ${describeScope(rule.scope)}`
    : describeScope(rule.scope);

interface RuleCardProps {
  rule: TrafficRule;
  expanded: boolean;
  currentHostname: string;
  mutateRule: MutateBoundRule;
  onToggleExpanded: () => void;
  onDelete: () => void;
}

export const RuleCard = ({
  rule,
  expanded,
  currentHostname,
  mutateRule,
  onToggleExpanded,
  onDelete,
}: RuleCardProps): ReactElement => (
  <div className="item-card" data-expanded={expanded} data-off={!rule.enabled}>
    <div className="item-head" onClick={onToggleExpanded}>
      <Switch
        small
        checked={rule.enabled}
        onChange={(enabled) => {
          mutateRule((current) => ({ ...current, enabled }));
        }}
        title="Prender o apagar esta regla"
      />
      <Badge tone={ACTION_TONES[rule.action.kind]}>{ACTION_LABELS[rule.action.kind]}</Badge>
      <span className="item-name">{rule.name}</span>
      <span className="item-preview">{rulePreview(rule)}</span>
      <IconButton icon="trash" title="Eliminar regla" tone="danger" small onClick={onDelete} />
      <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
    </div>

    {expanded ? (
      <div className="item-form">
        <Field label="Nombre">
          <TextInput
            value={rule.name}
            onChange={(name) => {
              mutateRule((current) => ({ ...current, name }));
            }}
          />
        </Field>

        <ScopeEditor
          scope={rule.scope}
          currentHostname={currentHostname}
          onChange={(scope) => {
            mutateRule((current) => ({ ...current, scope }));
          }}
        />

        <ActionEditor rule={rule} mutateRule={mutateRule} />
      </div>
    ) : null}
  </div>
);
