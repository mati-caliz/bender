import type { ReactElement } from "react";
import { describeScope } from "@/lib/scope";
import { Icon } from "@/ui/components/Icon";
import type { Profile } from "@/types";

const MAX_INITIALS = 2;
const WHITESPACE = /\s+/;

const initialsOf = (profile: Profile): string =>
  profile.name
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase() || "?";

interface ProfileRailProps {
  profiles: Profile[];
  selectedId: string;
  onSelect: (profileId: string) => void;
  onAdd: () => void;
}

export const ProfileRail = ({ profiles, selectedId, onSelect, onAdd }: ProfileRailProps): ReactElement => (
  <div className="profile-rail">
    {profiles.map((profile) => (
      <button
        key={profile.id}
        type="button"
        className="profile-avatar"
        style={{ background: profile.color }}
        data-selected={profile.id === selectedId}
        data-enabled={profile.enabled}
        title={`${profile.name} · ${describeScope(profile.scope)}`}
        onClick={() => {
          onSelect(profile.id);
        }}
      >
        {initialsOf(profile)}
        {profile.enabled ? <span className="avatar-dot" /> : null}
      </button>
    ))}
    <button
      type="button"
      className="profile-avatar"
      style={{ background: "var(--surface-active)", color: "var(--text-secondary)" }}
      title="Nuevo perfil"
      onClick={onAdd}
    >
      <Icon name="plus" size={16} />
    </button>
  </div>
);
