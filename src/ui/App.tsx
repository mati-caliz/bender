import { useEffect, useMemo, useRef, useState } from 'react';
import { IMPORT_PARAM, SURFACE_PARAM } from '@/lib/constants';
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

const NARROW_BREAKPOINT_PX = 620;

const readSurface = (): 'popup' | 'panel' | 'tab' => {
  const surface = new URLSearchParams(window.location.search).get(SURFACE_PARAM);
  return surface === 'popup' || surface === 'panel' ? surface : 'tab';
};

const VIEW_IDS: ViewId[] = [
  'overview',
  'headers',
  'rules',
  'cors',
  'useragent',
  'network',
  'cookies',
  'storage',
  'scripts',
  'design',
  'settings',
];

const isViewId = (value: string | null): value is ViewId => VIEW_IDS.some((id) => id === value);

const readPendingImportView = (): ViewId | null => {
  const pending = new URLSearchParams(window.location.search).get(IMPORT_PARAM);
  return isViewId(pending) ? pending : null;
};

export const App = () => {
  const { state, ready, update } = useToolkitState();
  const status = useEngineStatus();
  const activeTab = useActiveTab();
  const surface = useMemo(() => readSurface(), []);
  const [view, setView] = useState<ViewId>('overview');
  const [navOpen, setNavOpen] = useState(false);

  // Restaura la ultima vista una sola vez, cuando el estado termina de cargar. El
  // flag evita volver a pisarla cada vez que goTo actualiza lastView.
  const viewRestored = useRef(false);
  useEffect(() => {
    if (!ready || viewRestored.current) return;
    viewRestored.current = true;
    const pendingImportView = readPendingImportView();
    if (pendingImportView) {
      setView(pendingImportView);
      return;
    }
    const stored = state.ui.lastView;
    setView(isViewId(stored) ? stored : 'overview');
  }, [ready, state.ui.lastView]);

  useEffect(() => {
    document.body.dataset.surface = surface;
    document.body.dataset.density = state.ui.density;
  }, [surface, state.ui.density]);

  // El popup y el panel lateral son angostos: el layout pasa a nav colapsado y filas apiladas.
  useEffect(() => {
    if (surface === 'popup') {
      document.body.dataset.narrow = 'true';
      return undefined;
    }
    const media = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT_PX}px)`);
    const apply = () => {
      document.body.dataset.narrow = String(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [surface]);

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
    setNavOpen(false);
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
        <button
          type="button"
          className="nav-toggle"
          aria-label={navOpen ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded={navOpen}
          title="Menu"
          onClick={() => setNavOpen((current) => !current)}
        >
          <Icon name={navOpen ? 'x' : 'menu'} size={16} />
        </button>

        <div className="brand">
          <span className="brand-mark">
            <Icon name="bolt" size={15} />
          </span>
          <span className="brand-name">Bender</span>
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
          <span className="master-toggle-label">{state.globalEnabled ? 'Activo' : 'Apagado'}</span>
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
                void chrome.tabs.create({ url: chrome.runtime.getURL(`index.html?${SURFACE_PARAM}=tab`) });
                window.close();
              }}
            />
          </>
        ) : null}
      </header>

      <div className="layout" data-nav-open={navOpen}>
        <nav className="nav" data-open={navOpen}>
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
                    title={entry.label}
                    onClick={() => goTo(entry.id)}
                    style={{ width: '100%' }}
                  >
                    <Icon name={entry.icon} size={15} className="nav-icon" />
                    <span className="nav-label">{entry.label}</span>
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
              title="Ajustes"
              onClick={() => goTo('settings')}
              style={{ width: '100%' }}
            >
              <Icon name="settings" size={15} className="nav-icon" />
              <span className="nav-label">Ajustes</span>
            </button>
          </div>
        </nav>

        {navOpen ? <button type="button" className="nav-scrim" aria-label="Cerrar menu" onClick={() => setNavOpen(false)} /> : null}

        <main className="content">{renderView()}</main>
      </div>
    </div>
  );
};
