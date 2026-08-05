import { effectiveHeadersFor } from '@/lib/effective';
import { sendMessage } from '@/lib/messages';
import { Icon, type IconName } from '@/ui/components/Icon';
import { Badge, Button, Card, EmptyState, Notice, Stat, Switch } from '@/ui/components/primitives';
import { ViewShell } from '@/ui/components/ViewShell';
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
