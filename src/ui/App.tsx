import { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '@/ui/components/Icon';
import { Badge, IconButton, Switch } from '@/ui/components/primitives';
import { useActiveTab } from '@/ui/hooks/useActiveTab';
import { useEngineStatus } from '@/ui/hooks/useEngineStatus';
import { useToolkitState } from '@/ui/hooks/useToolkitState';
import { CookiesView } from '@/ui/views/CookiesView';
import { CorsView } from '@/ui/views/CorsView';
import { DesignView } from '@/ui/views/DesignView';
import { HeadersView } from '@/ui/views/HeadersView';
import { NetworkView } from '@/ui/views/NetworkView';
import { OverviewView } from '@/ui/views/OverviewView';
import { RulesView } from '@/ui/views/RulesView';
import { ScriptsView } from '@/ui/views/ScriptsView';
import { SettingsView } from '@/ui/views/SettingsView';
import { StorageView } from '@/ui/views/StorageView';
import { UserAgentView } from '@/ui/views/UserAgentView';
import type { ToolkitState } from '@/types';

export type ViewId =
  | 'overview'
  | 'headers'
  | 'rules'
  | 'cors'
  | 'useragent'
  | 'network'
  | 'cookies'
  | 'storage'
  | 'scripts'
  | 'design'
  | 'settings';

interface NavEntry {
  id: ViewId;
  label: string;
  icon: IconName;
  group: string;
  count?: (state: ToolkitState) => number;
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'overview', label: 'Resumen', icon: 'bolt', group: 'General' },
  {
    id: 'headers',
    label: 'Headers',
    icon: 'layers',
    group: 'Red',
    count: (state) =>
      state.profiles
        .filter((profile) => profile.enabled)
        .reduce(
          (total, profile) =>
            total +
            profile.requestHeaders.filter((header) => header.enabled && header.name.trim()).length +
            profile.responseHeaders.filter((header) => header.enabled && header.name.trim()).length,
          0
        ),
  },
  {
    id: 'rules',
    label: 'Reglas',
    icon: 'filter',
    group: 'Red',
    count: (state) => state.trafficRules.filter((rule) => rule.enabled).length,
  },
  { id: 'cors', label: 'CORS', icon: 'shield', group: 'Red' },
  { id: 'useragent', label: 'User-Agent', icon: 'smartphone', group: 'Red' },
  { id: 'network', label: 'Trafico', icon: 'activity', group: 'Red' },
  { id: 'cookies', label: 'Cookies', icon: 'cookie', group: 'Sitio' },
  { id: 'storage', label: 'Storage', icon: 'database', group: 'Sitio' },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: 'code',
    group: 'Sitio',
    count: (state) => state.userScripts.filter((script) => script.enabled).length,
  },
  { id: 'design', label: 'Diseño', icon: 'ruler', group: 'Diseño' },
];

const SURFACE_PARAM = 'surface';

const readSurface = (): 'popup' | 'panel' | 'tab' => {
  const surface = new URLSearchParams(window.location.search).get(SURFACE_PARAM);
  return surface === 'popup' || surface === 'panel' ? surface : 'tab';
};

export const App = () => {
  const { state, ready, update } = useToolkitState();
  const status = useEngineStatus();
  const activeTab = useActiveTab();
  const surface = useMemo(readSurface, []);
  const [view, setView] = useState<ViewId>('overview');

  useEffect(() => {
    if (ready) setView(NAV_ENTRIES.some((entry) => entry.id === state.ui.lastView) ? (state.ui.lastView as ViewId) : 'overview');
  }, [ready]);

  useEffect(() => {
    document.body.dataset.surface = surface;
    document.body.dataset.density = state.ui.density;
  }, [surface, state.ui.density]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', state.ui.accent);
    if (state.ui.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const apply = () => root.setAttribute('data-theme', media.matches ? 'light' : 'dark');
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    root.setAttribute('data-theme', state.ui.theme);
    return undefined;
  }, [state.ui.theme, state.ui.accent]);

  const goTo = (next: ViewId) => {
    setView(next);
    update((current) => ({ ...current, ui: { ...current.ui, lastView: next } }));
  };

  const groups = useMemo(() => {
    const map = new Map<string, NavEntry[]>();
    for (const entry of NAV_ENTRIES) {
      map.set(entry.group, [...(map.get(entry.group) ?? []), entry]);
    }
    return Array.from(map.entries());
  }, []);

  const errorCount = status.diagnostics.filter((diagnostic) => diagnostic.level === 'error').length;

  const renderView = () => {
    switch (view) {
      case 'overview':
        return <OverviewView state={state} update={update} status={status} activeTab={activeTab} onNavigate={goTo} />;
      case 'headers':
        return <HeadersView state={state} update={update} activeTab={activeTab} />;
      case 'rules':
        return <RulesView state={state} update={update} activeTab={activeTab} />;
      case 'cors':
        return <CorsView state={state} update={update} activeTab={activeTab} />;
      case 'useragent':
        return <UserAgentView state={state} update={update} activeTab={activeTab} />;
      case 'network':
        return <NetworkView state={state} update={update} onNavigate={goTo} />;
      case 'cookies':
        return <CookiesView activeTab={activeTab} />;
      case 'storage':
        return <StorageView activeTab={activeTab} />;
      case 'scripts':
        return <ScriptsView state={state} update={update} activeTab={activeTab} />;
      case 'design':
        return <DesignView activeTab={activeTab} />;
      case 'settings':
        return <SettingsView state={state} update={update} status={status} />;
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="bolt" size={15} />
          </span>
          Bender
          <span className="brand-tag">v1.0</span>
        </div>

        {activeTab.hostname ? (
          <span className="topbar-domain" title={activeTab.url}>
            <span className="dot" />
            <span className="truncate">{activeTab.hostname}</span>
          </span>
        ) : null}

        <div className="topbar-spacer" />

        {errorCount ? <Badge tone="danger">{errorCount} error(es)</Badge> : null}

        <button
          type="button"
          className="master-toggle"
          data-on={state.globalEnabled}
          onClick={() => update((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
          title="Prender o apagar todas las reglas (Alt+Shift+T)"
        >
          <Switch
            checked={state.globalEnabled}
            onChange={() => update((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
            small
          />
          {state.globalEnabled ? 'Activo' : 'Apagado'}
        </button>

        {surface === 'popup' ? (
          <>
            <IconButton
              icon="panel"
              title="Abrir en el panel lateral"
              onClick={() => {
                void chrome.windows.getCurrent().then((current) => {
                  if (typeof current.id === 'number') void chrome.sidePanel.open({ windowId: current.id });
                  window.close();
                });
              }}
            />
            <IconButton
              icon="external"
              title="Abrir en una pestaña"
              onClick={() => {
                void chrome.tabs.create({ url: chrome.runtime.getURL('index.html?surface=tab') });
                window.close();
              }}
            />
          </>
        ) : null}
      </header>

      <div className="layout">
        <nav className="nav">
          {groups.map(([group, entries]) => (
            <div key={group}>
              <div className="nav-group-label">{group}</div>
              {entries.map((entry) => {
                const count = entry.count?.(state) ?? 0;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="nav-item"
                    aria-current={view === entry.id}
                    onClick={() => goTo(entry.id)}
                    style={{ width: '100%' }}
                  >
                    <Icon name={entry.icon} size={15} className="nav-icon" />
                    {entry.label}
                    {count ? <span className="nav-count">{count}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="nav-footer">
            <button
              type="button"
              className="nav-item"
              aria-current={view === 'settings'}
              onClick={() => goTo('settings')}
              style={{ width: '100%' }}
            >
              <Icon name="settings" size={15} className="nav-icon" />
              Ajustes
            </button>
          </div>
        </nav>

        <main className="content">{renderView()}</main>
      </div>
    </div>
  );
};
