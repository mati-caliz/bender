import type { ReactElement } from "react";
import { PROFILE_COLORS } from "@/lib/constants";
import { IconButton, Switch } from "@/ui/components/primitives";
import type { Profile } from "@/types";

interface ProfileHeaderBarProps {
  profile: Profile;
  onChange: (mutate: (profile: Profile) => Profile) => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const ProfileHeaderBar = ({
  profile,
  onChange,
  onExport,
  onDuplicate,
  onDelete,
}: ProfileHeaderBarProps): ReactElement => (
  <div
    className="card-header"
    style={{
      background: profile.enabled ? profile.color : "var(--bg-elevated)",
      color: profile.enabled ? "white" : "var(--text)",
    }}
  >
    <Switch
      checked={profile.enabled}
      onChange={(enabled) => {
        onChange((current) => ({ ...current, enabled }));
      }}
      title="Prender o apagar este perfil"
    />
    <input
      className="input"
      value={profile.name}
      style={{
        background: "transparent",
        border: 0,
        fontWeight: 600,
        color: "inherit",
        maxWidth: 200,
      }}
      onChange={(event) => {
        const name = event.target.value;
        onChange((current) => ({ ...current, name }));
      }}
    />
    <div className="spacer" />
    <input
      type="color"
      value={profile.color}
      title="Color del perfil"
      style={{
        width: 26,
        height: 26,
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
      }}
      onChange={(event) => {
        const color = event.target.value;
        onChange((current) => ({ ...current, color }));
      }}
      list="bender-profile-colors"
    />
    <datalist id="bender-profile-colors">
      {PROFILE_COLORS.map((color) => (
        <option key={color} value={color} />
      ))}
    </datalist>
    <IconButton icon="download" title="Exportar solo este perfil" onClick={onExport} />
    <IconButton icon="copy" title="Duplicar perfil" onClick={onDuplicate} />
    <IconButton icon="trash" title="Eliminar perfil" tone="danger" onClick={onDelete} />
  </div>
);
