import type { ReactElement } from "react";
import { groupNavEntries, type NavEntry, type ViewId } from "@/ui/components/app-navigation";
import { Icon } from "@/ui/components/Icon";
import type { ToolkitState } from "@/types";

const NAV_GROUPS = groupNavEntries();

interface AppNavProps {
  navOpen: boolean;
  view: ViewId;
  state: ToolkitState;
  onNavigate: (view: ViewId) => void;
}

interface NavItemProps {
  entry: NavEntry;
  view: ViewId;
  state: ToolkitState;
  onNavigate: (view: ViewId) => void;
}

const NavItem = ({ entry, view, state, onNavigate }: NavItemProps): ReactElement => {
  const count = entry.count?.(state) ?? 0;
  return (
    <button
      type="button"
      className="nav-item"
      aria-current={view === entry.id}
      title={entry.label}
      onClick={() => {
        onNavigate(entry.id);
      }}
      style={{ width: "100%" }}
    >
      <Icon name={entry.icon} size={15} className="nav-icon" />
      <span className="nav-label">{entry.label}</span>
      {count > 0 ? <span className="nav-count">{count}</span> : null}
    </button>
  );
};

export const AppNav = ({ navOpen, view, state, onNavigate }: AppNavProps): ReactElement => (
  <nav className="nav" data-open={navOpen}>
    {NAV_GROUPS.map(([group, entries]) => (
      <div key={group}>
        <div className="nav-group-label">{group}</div>
        {entries.map((entry) => (
          <NavItem key={entry.id} entry={entry} view={view} state={state} onNavigate={onNavigate} />
        ))}
      </div>
    ))}
    <div className="nav-footer">
      <button
        type="button"
        className="nav-item"
        aria-current={view === "settings"}
        title="Ajustes"
        onClick={() => {
          onNavigate("settings");
        }}
        style={{ width: "100%" }}
      >
        <Icon name="settings" size={15} className="nav-icon" />
        <span className="nav-label">Ajustes</span>
      </button>
    </div>
  </nav>
);
