import { CUSTOM_USER_AGENT_PRESET_ID, USER_AGENT_PRESETS } from '@/lib/constants';
import { ScopeEditor } from '@/ui/components/ScopeEditor';
import { ViewShell } from '@/ui/components/ViewShell';
import { Badge, Card, Notice, Switch, TextArea } from '@/ui/components/primitives';
import type { ViewProps } from '@/ui/views/types';
import type { UserAgentConfig } from '@/types';

export const UserAgentView = ({ state, update, activeTab }: ViewProps) => {
  const userAgent = state.userAgent;

  const mutate = (mutateConfig: (config: UserAgentConfig) => UserAgentConfig) => {
    update((current) => ({ ...current, userAgent: mutateConfig(current.userAgent) }));
  };

  const groups = USER_AGENT_PRESETS.reduce<Map<string, typeof USER_AGENT_PRESETS>>((accumulator, preset) => {
    accumulator.set(preset.group, [...(accumulator.get(preset.group) ?? []), preset]);
    return accumulator;
  }, new Map());

  return (
    <ViewShell title="User-Agent" subtitle="Suplantar el navegador y sus client hints por dominio o pestaña.">
      <div className="quick-toggle" data-on={userAgent.enabled}>
        <span className="quick-toggle-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" strokeLinecap="round" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="quick-toggle-title">Suplantar User-Agent</div>
          <div className="quick-toggle-hint truncate">
            {userAgent.enabled ? userAgent.value : 'Se manda el User-Agent real del navegador'}
          </div>
        </div>
        <div className="spacer" />
        <Switch checked={userAgent.enabled} onChange={(enabled) => mutate((config) => ({ ...config, enabled }))} />
      </div>

      <Card title="Presets">
        {Array.from(groups.entries()).map(([group, presets]) => (
          <div key={group} className="field">
            <span className="field-label">{group}</span>
            <div className="row wrap">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={preset.id === userAgent.presetId ? 'btn primary small' : 'btn small'}
                  onClick={() => mutate((config) => ({ ...config, presetId: preset.id, value: preset.value }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card
        title="Valor enviado"
        actions={
          userAgent.presetId === CUSTOM_USER_AGENT_PRESET_ID ? <Badge tone="accent">personalizado</Badge> : null
        }
      >
        <TextArea
          value={userAgent.value}
          mono
          rows={3}
          placeholder="Mozilla/5.0 …"
          onChange={(value) => mutate((config) => ({ ...config, value, presetId: CUSTOM_USER_AGENT_PRESET_ID }))}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={userAgent.spoofClientHints}
            onChange={(event) => {
              const spoofClientHints = event.target.checked;
              mutate((config) => ({ ...config, spoofClientHints }));
            }}
          />
          Ajustar tambien los client hints (Sec-CH-UA-Mobile y Sec-CH-UA-Platform)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={userAgent.spoofNavigator}
            onChange={(event) => {
              const spoofNavigator = event.target.checked;
              mutate((config) => ({ ...config, spoofNavigator }));
            }}
          />
          Pisar tambien <code>navigator</code> dentro de la pagina (userAgent, platform, touch y client hints)
        </label>
        {userAgent.spoofNavigator ? (
          <Notice>
            El spoof de <code>navigator</code> se registra como userscript en <code>document_start</code>, asi que
            necesita el modo desarrollador. Se aplica por dominio: ignora el filtro de URL y "solo la pestaña activa".
          </Notice>
        ) : (
          <Notice>
            El User-Agent viaja en la request, pero <code>navigator.userAgent</code> dentro de la pagina sigue siendo el
            real. Prendé la opcion de arriba si el sitio detecta el dispositivo por JavaScript.
          </Notice>
        )}
      </Card>

      <Card title="Alcance">
        <ScopeEditor
          scope={userAgent.scope}
          currentHostname={activeTab.hostname}
          onChange={(scope) => mutate((config) => ({ ...config, scope }))}
        />
      </Card>
    </ViewShell>
  );
};
