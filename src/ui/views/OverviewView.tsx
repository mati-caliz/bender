import { useState } from 'react';
import { effectiveHeadersFor } from '@/lib/effective';
import {
  applyEnvironment,
  captureEnvironment,
  describeEnvironment,
  findActiveEnvironment,
} from '@/lib/environments';
import { sendMessage } from '@/lib/messages';
import { Icon, type IconName } from '@/ui/components/Icon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Notice,
  Stat,
  Switch,
  TextInput,
} from '@/ui/components/primitives';
import { ViewShell } from '@/ui/components/ViewShell';
import { useToasts } from '@/ui/hooks/useToasts';
import type { ViewId } from '@/ui/App';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { UpdateState } from '@/ui/views/types';
import type { EngineStatus, ToolkitState } from '@/types';

interface QuickToggleProps {
  icon: IconName;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpen: () => void;
}

const QuickToggle = ({ icon, title, hint, checked, onChange, onOpen }: QuickToggleProps) => (
  <div className="quick-toggle" data-on={checked}>
    <span className="quick-toggle-icon">
      <Icon name={icon} size={15} />
    </span>
    <div style={{ minWidth: 0 }}>
      <div className="quick-toggle-title">{title}</div>
      <div className="quick-toggle-hint truncate">{hint}</div>
    </div>
    <div className="spacer" />
    <button type="button" className="icon-btn" title="Configurar" onClick={onOpen}>
      <Icon name="settings" size={13} />
    </button>
    <Switch checked={checked} onChange={onChange} title={title} />
  </div>
);

const EnvironmentsCard = ({ state, update }: { state: ToolkitState; update: UpdateState }) => {
  const { notify } = useToasts();
  const [draftName, setDraftName] = useState('');
  const [naming, setNaming] = useState(false);
  const active = findActiveEnvironment(state);
  const hasSomethingToSave = state.profiles.length > 0 || state.trafficRules.length > 0;

  const save = () => {
    const name = draftName.trim();
    if (!name) return;
    update((current) => {
      const captured = captureEnvironment(current, name);
      // Guardar con un nombre que ya existe lo pisa, igual que los snapshots de cookies.
      const existing = current.environments.find((environment) => environment.name === name);
      const environments = existing
        ? current.environments.map((environment) =>
            environment.id === existing.id ? { ...captured, id: existing.id } : environment
          )
        : [...current.environments, captured];
      return { ...current, environments };
    });
    setDraftName('');
    setNaming(false);
    notify(`Entorno "${name}" guardado`, 'success');
  };

  return (
    <Card
      title="Entornos"
      subtitle="Prende y apaga un conjunto de perfiles y reglas de una"
      actions={
        <Button
          small
          icon="plus"
          disabled={!hasSomethingToSave}
          title={
            hasSomethingToSave
              ? 'Guardar lo que esta prendido ahora como un entorno'
              : 'Crea al menos un perfil o una regla primero'
          }
          onClick={() => setNaming((current) => !current)}
        >
          Guardar actual
        </Button>
      }
    >
      {naming ? (
        <div className="row wrap domain-input">
          <TextInput
            value={draftName}
            onChange={setDraftName}
            placeholder="dev, staging, prod…"
            title="Nombre del entorno"
          />
          <Button small variant="primary" disabled={!draftName.trim()} onClick={save}>
            Guardar
          </Button>
          <IconButton
            icon="x"
            small
            title="Cancelar"
            onClick={() => {
              setNaming(false);
              setDraftName('');
            }}
          />
        </div>
      ) : null}

      {state.environments.length ? (
        <div className="list">
          {state.environments.map((environment) => {
            const isActive = active?.id === environment.id;
            return (
              <div key={environment.id} className="env-row" data-active={isActive}>
                <button
                  type="button"
                  className="env-apply"
                  title={isActive ? 'Ya es el estado actual' : `Aplicar "${environment.name}"`}
                  onClick={() => {
                    update((current) => applyEnvironment(current, environment.id));
                    notify(`Entorno "${environment.name}" aplicado`, 'success');
                  }}
                >
                  <Icon name={isActive ? 'check' : 'layers'} size={14} />
                  <span className="env-name truncate">{environment.name}</span>
                  <span className="env-detail truncate">{describeEnvironment(environment, state)}</span>
                </button>
                {isActive ? <Badge tone="success">activo</Badge> : null}
                <IconButton
                  icon="trash"
                  tone="danger"
                  small
                  title="Eliminar entorno"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      environments: current.environments.filter((candidate) => candidate.id !== environment.id),
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-small text-muted" style={{ margin: 0 }}>
          Prende los perfiles y reglas que uses para un entorno y guardalos con un nombre. Despues los volves a dejar
          asi de un click.
        </p>
      )}
    </Card>
  );
};

interface OverviewViewProps {
  state: ToolkitState;
  update: UpdateState;
  status: EngineStatus;
  activeTab: ActiveTab;
  onNavigate: (view: ViewId) => void;
}

export const OverviewView = ({ state, update, status, activeTab, onNavigate }: OverviewViewProps) => {
  const effective = effectiveHeadersFor(state, activeTab.url);
  const enabledProfiles = state.profiles.filter((profile) => profile.enabled);
  const enabledRules = state.trafficRules.filter((rule) => rule.enabled);
  const mockCount = enabledRules.filter((rule) => rule.action.kind === 'mock').length;

  return (
    <ViewShell
      title="Resumen"
      subtitle={activeTab.hostname ? `Estado actual sobre ${activeTab.hostname}` : 'Abri una pagina http(s) para ver el detalle'}
      actions={
        <Button icon="refresh" small onClick={() => void sendMessage({ type: 'engine/refresh' })}>
          Reaplicar
        </Button>
      }
    >
      {!state.globalEnabled ? (
        <Notice tone="warning">
          Bender esta apagado: no se modifica ninguna request. Prendelo desde el switch de arriba o con Alt+Shift+T.
        </Notice>
      ) : null}

      {status.diagnostics.map((diagnostic, index) => (
        <Notice key={`${diagnostic.message}-${index}`} tone={diagnostic.level === 'error' ? 'danger' : 'warning'}>
          {diagnostic.message}
        </Notice>
      ))}

      <div className="stat-grid">
        <Stat label="Reglas activas" value={String(status.appliedRuleCount)} hint="compiladas en el navegador" />
        <Stat
          label="Headers efectivos"
          value={String(effective.length)}
          hint={activeTab.hostname ? `sobre ${activeTab.hostname}` : 'sin pestaña http(s)'}
        />
        <Stat label="Perfiles activos" value={`${enabledProfiles.length}/${state.profiles.length}`} />
        <Stat label="Mocks activos" value={String(mockCount)} hint="interceptan fetch y XHR" />
      </div>

      <EnvironmentsCard state={state} update={update} />

      <div className="grid-2 quick-grid">
        <QuickToggle
          icon="shield"
          title="CORS abierto"
          hint={state.cors.enabled ? 'Respuestas con Access-Control-Allow-*' : 'Sin tocar los headers de CORS'}
          checked={state.cors.enabled}
          onChange={(enabled) => update((current) => ({ ...current, cors: { ...current.cors, enabled } }))}
          onOpen={() => onNavigate('cors')}
        />
        <QuickToggle
          icon="smartphone"
          title="User-Agent"
          hint={state.userAgent.enabled ? state.userAgent.value.slice(0, 46) : 'Usando el del navegador'}
          checked={state.userAgent.enabled}
          onChange={(enabled) => update((current) => ({ ...current, userAgent: { ...current.userAgent, enabled } }))}
          onOpen={() => onNavigate('useragent')}
        />
        <QuickToggle
          icon="activity"
          title="Logger de trafico"
          hint={state.network.enabled ? 'Grabando requests y reglas aplicadas' : 'Apagado (cero overhead)'}
          checked={state.network.enabled}
          onChange={(enabled) => update((current) => ({ ...current, network: { ...current.network, enabled } }))}
          onOpen={() => onNavigate('network')}
        />
        <QuickToggle
          icon="code"
          title="Userscripts"
          hint={`${state.userScripts.filter((script) => script.enabled).length} activo(s) de ${state.userScripts.length}`}
          checked={state.userScripts.some((script) => script.enabled)}
          onChange={(enabled) =>
            update((current) => ({
              ...current,
              userScripts: current.userScripts.map((script) => ({ ...script, enabled })),
            }))
          }
          onOpen={() => onNavigate('scripts')}
        />
      </div>

      <Card
        title="Headers que aplican a esta pestaña"
        subtitle={activeTab.url ? activeTab.url : 'sin URL'}
        actions={<Button small variant="ghost" icon="layers" onClick={() => onNavigate('headers')}>Editar</Button>}
        flush
      >
        {effective.length ? (
          <div className="list" style={{ gap: 0 }}>
            {effective.map((header, index) => (
              <div key={`${header.name}-${index}`} className="net-row effective-row">
                <Badge tone={header.direction === 'request' ? 'accent' : 'info'}>
                  {header.direction === 'request' ? 'request' : 'response'}
                </Badge>
                <span className="net-url">
                  <strong style={{ color: 'var(--text)' }}>{header.name}</strong>
                  {header.operation === 'remove' ? ' — eliminado' : `: ${header.value}`}
                </span>
                <Badge>{header.source}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="layers"
            title="Ningun header aplica aca"
            text="Creá un perfil o revisá que su alcance incluya este dominio."
            action={
              <Button small variant="primary" icon="plus" onClick={() => onNavigate('headers')}>
                Ir a Headers
              </Button>
            }
          />
        )}
      </Card>
    </ViewShell>
  );
};
