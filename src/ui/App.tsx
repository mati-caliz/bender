import { useState, type ReactElement } from "react";
import { AppNav } from "@/ui/components/AppNav";
import { AppTopbar } from "@/ui/components/AppTopbar";
import { isViewId, readPendingImportView, readSurface, type ViewId } from "@/ui/components/app-navigation";
import { useActiveTab, type ActiveTab } from "@/ui/hooks/useActiveTab";
import { useDocumentAppearance } from "@/ui/hooks/useDocumentAppearance";
import { useEngineStatus } from "@/ui/hooks/useEngineStatus";
import { useToolkitState } from "@/ui/hooks/useToolkitState";
import { CookiesView } from "@/ui/views/CookiesView";
import { CorsView } from "@/ui/views/CorsView";
import { DesignView } from "@/ui/views/DesignView";
import { HeadersView } from "@/ui/views/HeadersView";
import { NetworkView } from "@/ui/views/NetworkView";
import { OverviewView } from "@/ui/views/OverviewView";
import { RulesView } from "@/ui/views/RulesView";
import { ScriptsView } from "@/ui/views/ScriptsView";
import { SettingsView } from "@/ui/views/SettingsView";
import { StorageView } from "@/ui/views/StorageView";
import { UserAgentView } from "@/ui/views/UserAgentView";
import type { UpdateState } from "@/ui/views/types";
import type { EngineStatus, ToolkitState } from "@/types";

export type { ViewId } from "@/ui/components/app-navigation";

interface ViewContext {
  state: ToolkitState;
  update: UpdateState;
  status: EngineStatus;
  activeTab: ActiveTab;
  goTo: (next: ViewId) => void;
}

const VIEW_RENDERERS: Record<ViewId, (context: ViewContext) => ReactElement> = {
  overview: ({ state, update, status, activeTab, goTo }) => (
    <OverviewView state={state} update={update} status={status} activeTab={activeTab} onNavigate={goTo} />
  ),
  headers: ({ state, update, activeTab }) => (
    <HeadersView state={state} update={update} activeTab={activeTab} />
  ),
  rules: ({ state, update, activeTab }) => <RulesView state={state} update={update} activeTab={activeTab} />,
  cors: ({ state, update, activeTab }) => <CorsView state={state} update={update} activeTab={activeTab} />,
  useragent: ({ state, update, activeTab }) => (
    <UserAgentView state={state} update={update} activeTab={activeTab} />
  ),
  network: ({ state, update, goTo }) => <NetworkView state={state} update={update} onNavigate={goTo} />,
  cookies: ({ activeTab }) => <CookiesView activeTab={activeTab} />,
  storage: ({ activeTab }) => <StorageView activeTab={activeTab} />,
  scripts: ({ state, update, activeTab }) => (
    <ScriptsView state={state} update={update} activeTab={activeTab} />
  ),
  design: ({ activeTab }) => <DesignView activeTab={activeTab} />,
  settings: ({ state, update, status }) => <SettingsView state={state} update={update} status={status} />,
};

const initialViewFor = (lastView: string): ViewId => {
  const pendingImportView = readPendingImportView();
  if (pendingImportView !== null) return pendingImportView;
  return isViewId(lastView) ? lastView : "overview";
};

export const App = (): ReactElement => {
  const { state, ready, update } = useToolkitState();
  const status = useEngineStatus();
  const activeTab = useActiveTab();
  const [surface] = useState(readSurface);
  const [view, setView] = useState<ViewId>("overview");
  const [navOpen, setNavOpen] = useState(false);

  // Restaura la ultima vista una sola vez, cuando el estado termina de cargar: despues
  // goTo actualiza lastView y no hay que volver a pisar la vista elegida.
  const [viewRestored, setViewRestored] = useState(false);
  if (ready && !viewRestored) {
    setViewRestored(true);
    setView(initialViewFor(state.ui.lastView));
  }

  useDocumentAppearance(surface, state.ui);

  const goTo = (next: ViewId): void => {
    setView(next);
    setNavOpen(false);
    update((current) => ({ ...current, ui: { ...current.ui, lastView: next } }));
  };

  const errorCount = status.diagnostics.filter((diagnostic) => diagnostic.level === "error").length;

  return (
    <div className="app">
      <AppTopbar
        navOpen={navOpen}
        onToggleNav={() => {
          setNavOpen((current) => !current);
        }}
        activeTab={activeTab}
        errorCount={errorCount}
        store={{ state, update }}
        surface={surface}
      />

      <div className="layout" data-nav-open={navOpen}>
        <AppNav navOpen={navOpen} view={view} state={state} onNavigate={goTo} />

        {navOpen ? (
          <button
            type="button"
            className="nav-scrim"
            aria-label="Cerrar menu"
            onClick={() => {
              setNavOpen(false);
            }}
          />
        ) : null}

        <main className="content">{VIEW_RENDERERS[view]({ state, update, status, activeTab, goTo })}</main>
      </div>
    </div>
  );
};
