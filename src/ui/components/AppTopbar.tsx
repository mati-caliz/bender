import type { ReactElement } from "react";
import { SURFACE_PARAM } from "@/lib/constants";
import type { Surface } from "@/ui/components/app-navigation";
import { Icon } from "@/ui/components/Icon";
import { Badge, IconButton, Switch } from "@/ui/components/primitives";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { ToolkitStore } from "@/ui/hooks/useToolkitState";

interface AppTopbarProps {
  navOpen: boolean;
  onToggleNav: () => void;
  activeTab: ActiveTab;
  errorCount: number;
  store: Pick<ToolkitStore, "state" | "update">;
  surface: Surface;
}

const PopupShortcuts = (): ReactElement => (
  <>
    <IconButton
      icon="panel"
      title="Abrir en el panel lateral"
      onClick={() => {
        void chrome.windows.getCurrent().then((current) => {
          if (typeof current.id === "number") void chrome.sidePanel.open({ windowId: current.id });
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
);

const MasterToggle = ({ store }: Pick<AppTopbarProps, "store">): ReactElement => {
  const { state, update } = store;
  const toggleGlobal = (): void => {
    update((current) => ({ ...current, globalEnabled: !current.globalEnabled }));
  };
  return (
    <button
      type="button"
      className="master-toggle"
      data-on={state.globalEnabled}
      onClick={toggleGlobal}
      title="Prender o apagar todas las reglas (Alt+Shift+T)"
    >
      <Switch checked={state.globalEnabled} onChange={toggleGlobal} small />
      <span className="master-toggle-label">{state.globalEnabled ? "Activo" : "Apagado"}</span>
    </button>
  );
};

export const AppTopbar = ({
  navOpen,
  onToggleNav,
  activeTab,
  errorCount,
  store,
  surface,
}: AppTopbarProps): ReactElement => (
  <header className="topbar">
    <button
      type="button"
      className="nav-toggle"
      aria-label={navOpen ? "Cerrar menu" : "Abrir menu"}
      aria-expanded={navOpen}
      title="Menu"
      onClick={onToggleNav}
    >
      <Icon name={navOpen ? "x" : "menu"} size={16} />
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

    {errorCount > 0 ? <Badge tone="danger">{errorCount} error(es)</Badge> : null}

    <MasterToggle store={store} />

    {surface === "popup" ? <PopupShortcuts /> : null}
  </header>
);
