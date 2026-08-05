import { useState } from 'react';
import { CONTENT_TYPE_PRESETS } from '@/lib/constants';
import { forgetFromEnvironments } from '@/lib/environments';
import { createHeaderEntry, createTrafficRule } from '@/lib/factories';
import { prettyJson } from '@/lib/format';
import { describeScope } from '@/lib/scope';
import { CodeEditor } from '@/ui/components/CodeEditor';
import { Icon } from '@/ui/components/Icon';
import { ScopeEditor } from '@/ui/components/ScopeEditor';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Notice,
  Switch,
  TextInput,
} from '@/ui/components/primitives';
import type { ViewProps } from '@/ui/views/types';
import type { TrafficRule, TrafficRuleAction } from '@/types';

const ACTION_LABELS: Record<TrafficRuleAction['kind'], string> = {
  block: 'Bloqueo',
  redirect: 'Redirect',
  mock: 'Mock',
};

const ACTION_TONES: Record<TrafficRuleAction['kind'], 'danger' | 'warning' | 'info'> = {
  block: 'danger',
  redirect: 'warning',
  mock: 'info',
};

const MIN_STATUS = 100;
const MAX_STATUS = 599;
const DEFAULT_STATUS = 200;

export const RulesView = ({ state, update, activeTab }: ViewProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mutateRule = (id: string, mutate: (rule: TrafficRule) => TrafficRule) => {
    update((current) => ({
      ...current,
      trafficRules: current.trafficRules.map((rule) => (rule.id === id ? mutate(rule) : rule)),
    }));
  };

  const addRule = (kind: TrafficRuleAction['kind']) => {
    update((current) => {
      const rule = createTrafficRule(kind, current.trafficRules.length);
      setExpandedId(rule.id);
      return { ...current, trafficRules: [...current.trafficRules, rule] };
    });
  };

  const renderActionEditor = (rule: TrafficRule) => {
    if (rule.action.kind === 'block') {
      return (
        <Notice tone="warning">
          Las requests que matcheen se cortan antes de salir. Ideal para simular caidas de un servicio o matar tracking.
        </Notice>
      );
    }

    if (rule.action.kind === 'redirect') {
      const action = rule.action;
      return (
        <>
          <Field
            label="Destino"
            hint={
              action.useRegex
                ? 'Podes usar \\1, \\2 para los grupos capturados en el patron de URL.'
                : 'URL absoluta, por ejemplo http://localhost:3000/bundle.js'
            }
          >
            <TextInput
              value={action.target}
              mono
              placeholder="http://localhost:3000/bundle.js"
              onChange={(target) =>
                mutateRule(rule.id, (current) =>
                  current.action.kind === 'redirect'
                    ? { ...current, action: { ...current.action, target } }
                    : current
                )
              }
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={action.useRegex}
              onChange={(event) => {
                const useRegex = event.target.checked;
                mutateRule(rule.id, (current) =>
                  current.action.kind === 'redirect'
                    ? { ...current, action: { ...current.action, useRegex } }
                    : current
                );
              }}
            />
            Tratar el filtro de URL como expresion regular
          </label>
        </>
      );
    }

    const action = rule.action;
    return (
      <>
        <div className="grid-3">
          <Field label="Status">
            <TextInput
              type="number"
              value={String(action.status)}
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                const status = Number.isNaN(parsed) ? DEFAULT_STATUS : Math.min(Math.max(parsed, MIN_STATUS), MAX_STATUS);
                mutateRule(rule.id, (current) =>
                  current.action.kind === 'mock' ? { ...current, action: { ...current.action, status } } : current
                );
              }}
            />
          </Field>
          <Field label="Content-Type">
            <input
              className="input mono"
              list="bender-content-types"
              value={action.contentType}
              onChange={(event) => {
                const contentType = event.target.value;
                mutateRule(rule.id, (current) =>
                  current.action.kind === 'mock' ? { ...current, action: { ...current.action, contentType } } : current
                );
              }}
            />
          </Field>
          <Field label="Delay (ms)" hint="Para simular latencia">
            <TextInput
              type="number"
              value={String(action.delayMs)}
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                const delayMs = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
                mutateRule(rule.id, (current) =>
                  current.action.kind === 'mock' ? { ...current, action: { ...current.action, delayMs } } : current
                );
              }}
            />
          </Field>
        </div>

        <Field label="Cuerpo de la respuesta">
          <CodeEditor
            value={action.body}
            minHeight={150}
            onChange={(body) =>
              mutateRule(rule.id, (current) =>
                current.action.kind === 'mock' ? { ...current, action: { ...current.action, body } } : current
              )
            }
            toolbar={
              <>
                <Icon name="code" size={12} />
                <span>{action.contentType.includes('json') ? 'JSON' : 'texto'}</span>
                <div className="spacer" />
                <Button
                  small
                  variant="ghost"
                  onClick={() =>
                    mutateRule(rule.id, (current) =>
                      current.action.kind === 'mock'
                        ? { ...current, action: { ...current.action, body: prettyJson(current.action.body) } }
                        : current
                    )
                  }
                >
                  Formatear
                </Button>
              </>
            }
          />
        </Field>

        <div className="field">
          <span className="field-label">Headers extra de la respuesta</span>
          {action.headers.map((header) => (
            <div key={header.id} className="row">
              <TextInput
                value={header.name}
                mono
                placeholder="X-Mock"
                onChange={(name) =>
                  mutateRule(rule.id, (current) =>
                    current.action.kind === 'mock'
                      ? {
                          ...current,
                          action: {
                            ...current.action,
                            headers: current.action.headers.map((entry) =>
                              entry.id === header.id ? { ...entry, name } : entry
                            ),
                          },
                        }
                      : current
                  )
                }
              />
              <TextInput
                value={header.value}
                mono
                placeholder="valor"
                onChange={(value) =>
                  mutateRule(rule.id, (current) =>
                    current.action.kind === 'mock'
                      ? {
                          ...current,
                          action: {
                            ...current.action,
                            headers: current.action.headers.map((entry) =>
                              entry.id === header.id ? { ...entry, value } : entry
                            ),
                          },
                        }
                      : current
                  )
                }
              />
              <IconButton
                icon="trash"
                title="Quitar header"
                tone="danger"
                small
                onClick={() =>
                  mutateRule(rule.id, (current) =>
                    current.action.kind === 'mock'
                      ? {
                          ...current,
                          action: {
                            ...current.action,
                            headers: current.action.headers.filter((entry) => entry.id !== header.id),
                          },
                        }
                      : current
                  )
                }
              />
            </div>
          ))}
          <Button
            small
            variant="ghost"
            icon="plus"
            onClick={() =>
              mutateRule(rule.id, (current) =>
                current.action.kind === 'mock'
                  ? { ...current, action: { ...current.action, headers: [...current.action.headers, createHeaderEntry()] } }
                  : current
              )
            }
          >
            Agregar header
          </Button>
        </div>

        <Notice>
          Los mocks se resuelven en la pagina interceptando <code>fetch</code> y <code>XMLHttpRequest</code>, asi que
          no aplican a navegacion, imagenes ni requests hechas por otras extensiones.
        </Notice>
      </>
    );
  };

  return (
    <ViewShell
      title="Reglas de trafico"
      subtitle="Bloquear, redirigir o mockear requests segun su URL."
      actions={
        <>
          <Button small icon="plus" onClick={() => addRule('block')}>
            Bloqueo
          </Button>
          <Button small icon="plus" onClick={() => addRule('redirect')}>
            Redirect
          </Button>
          <Button small variant="primary" icon="plus" onClick={() => addRule('mock')}>
            Mock
          </Button>
        </>
      }
    >
      <datalist id="bender-content-types">
        {CONTENT_TYPE_PRESETS.map((contentType) => (
          <option key={contentType} value={contentType} />
        ))}
      </datalist>

      {!state.trafficRules.length ? (
        <Card>
          <div className="empty">
            <div className="empty-icon">
              <Icon name="filter" size={20} />
            </div>
            <div className="empty-title">Sin reglas de trafico</div>
            <div className="empty-text">
              Bloquea un endpoint para probar el manejo de errores, redirigi un bundle de produccion a tu localhost o
              devolve un JSON fijo sin tocar el backend.
            </div>
          </div>
        </Card>
      ) : null}

      <div className="list">
        {state.trafficRules.map((rule) => {
          const expanded = expandedId === rule.id;
          return (
            <div key={rule.id} className="item-card" data-expanded={expanded} data-off={!rule.enabled}>
              <div className="item-head" onClick={() => setExpandedId(expanded ? null : rule.id)}>
                <Switch
                  small
                  checked={rule.enabled}
                  onChange={(enabled) => mutateRule(rule.id, (current) => ({ ...current, enabled }))}
                  title="Prender o apagar esta regla"
                />
                <Badge tone={ACTION_TONES[rule.action.kind]}>{ACTION_LABELS[rule.action.kind]}</Badge>
                <span className="item-name">{rule.name}</span>
                <span className="item-preview">{describeScope(rule.scope)}</span>
                <IconButton
                  icon="trash"
                  title="Eliminar regla"
                  tone="danger"
                  small
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      trafficRules: current.trafficRules.filter((candidate) => candidate.id !== rule.id),
                      environments: forgetFromEnvironments(current.environments, rule.id),
                    }))
                  }
                />
                <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />
              </div>

              {expanded ? (
                <div className="item-form">
                  <Field label="Nombre">
                    <TextInput
                      value={rule.name}
                      onChange={(name) => mutateRule(rule.id, (current) => ({ ...current, name }))}
                    />
                  </Field>

                  <ScopeEditor
                    scope={rule.scope}
                    currentHostname={activeTab.hostname}
                    onChange={(scope) => mutateRule(rule.id, (current) => ({ ...current, scope }))}
                  />

                  {renderActionEditor(rule)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ViewShell>
  );
};
