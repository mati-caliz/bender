import { useState } from "react";
import type { ReactElement } from "react";
import { CONTENT_TYPE_PRESETS } from "@/lib/constants";
import { forgetFromEnvironments } from "@/lib/environments";
import { createTrafficRule } from "@/lib/factories";
import { Icon } from "@/ui/components/Icon";
import { ViewShell } from "@/ui/components/ViewShell";
import { Button, Card } from "@/ui/components/primitives";
import { RuleCard } from "@/ui/views/rules/RuleCard";
import type { ViewProps } from "@/ui/views/types";
import type { TrafficRule, TrafficRuleAction } from "@/types";

type RuleKind = TrafficRuleAction["kind"];

const AddRuleButtons = ({ onAdd }: { onAdd: (kind: RuleKind) => void }): ReactElement => (
  <>
    <Button
      small
      icon="plus"
      onClick={() => {
        onAdd("block");
      }}
    >
      Bloqueo
    </Button>
    <Button
      small
      icon="plus"
      onClick={() => {
        onAdd("redirect");
      }}
    >
      Redirect
    </Button>
    <Button
      small
      icon="plus"
      title="Demora o hace fallar un porcentaje"
      onClick={() => {
        onAdd("chaos");
      }}
    >
      Chaos
    </Button>
    <Button
      small
      variant="primary"
      icon="plus"
      onClick={() => {
        onAdd("mock");
      }}
    >
      Mock
    </Button>
  </>
);

const NoRulesCard = (): ReactElement => (
  <Card>
    <div className="empty">
      <div className="empty-icon">
        <Icon name="filter" size={20} />
      </div>
      <div className="empty-title">Sin reglas de trafico</div>
      <div className="empty-text">
        Bloquea un endpoint para probar el manejo de errores, redirigi un bundle de produccion a tu localhost
        o devolve un JSON fijo sin tocar el backend.
      </div>
    </div>
  </Card>
);

export const RulesView = ({ state, update, activeTab }: ViewProps): ReactElement => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mutateRule = (id: string, mutate: (rule: TrafficRule) => TrafficRule): void => {
    update((current) => ({
      ...current,
      trafficRules: current.trafficRules.map((rule) => (rule.id === id ? mutate(rule) : rule)),
    }));
  };

  const addRule = (kind: RuleKind): void => {
    update((current) => {
      const rule = createTrafficRule(kind, current.trafficRules.length);
      setExpandedId(rule.id);
      return { ...current, trafficRules: [...current.trafficRules, rule] };
    });
  };

  const deleteRule = (ruleId: string): void => {
    update((current) => ({
      ...current,
      trafficRules: current.trafficRules.filter((candidate) => candidate.id !== ruleId),
      environments: forgetFromEnvironments(current.environments, ruleId),
    }));
  };

  return (
    <ViewShell
      title="Reglas de trafico"
      subtitle="Bloquear, redirigir o mockear requests segun su URL."
      actions={<AddRuleButtons onAdd={addRule} />}
    >
      <datalist id="bender-content-types">
        {CONTENT_TYPE_PRESETS.map((contentType) => (
          <option key={contentType} value={contentType} />
        ))}
      </datalist>

      {state.trafficRules.length === 0 ? <NoRulesCard /> : null}

      <div className="list">
        {state.trafficRules.map((rule) => {
          const expanded = expandedId === rule.id;
          return (
            <RuleCard
              key={rule.id}
              rule={rule}
              expanded={expanded}
              currentHostname={activeTab.hostname}
              mutateRule={(mutate) => {
                mutateRule(rule.id, mutate);
              }}
              onToggleExpanded={() => {
                setExpandedId(expanded ? null : rule.id);
              }}
              onDelete={() => {
                deleteRule(rule.id);
              }}
            />
          );
        })}
      </div>
    </ViewShell>
  );
};
