import { useState } from "react";
import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { forgetFromEnvironments } from "@/lib/environments";
import { createProfile } from "@/lib/factories";
import { slugify } from "@/lib/format";
import { createId } from "@/lib/ids";
import { mergeProfiles, parseProfiles } from "@/lib/import";
import { describeScope } from "@/lib/scope";
import { ImportDialog } from "@/ui/components/ImportDialog";
import { ScopeEditor } from "@/ui/components/ScopeEditor";
import { ViewShell } from "@/ui/components/ViewShell";
import { Badge, Button, ConfirmBar, EmptyState } from "@/ui/components/primitives";
import { usePendingImport } from "@/ui/hooks/usePendingImport";
import { useToasts } from "@/ui/hooks/useToasts";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { HeaderHints } from "@/ui/views/headers/HeaderHints";
import { HeaderTable, type HeaderDirection, type MutateHeaders } from "@/ui/views/headers/HeaderTable";
import { ProfileHeaderBar } from "@/ui/views/headers/ProfileHeaderBar";
import { ProfileRail } from "@/ui/views/headers/ProfileRail";
import type { UpdateState, ViewProps } from "@/ui/views/types";
import type { Profile, ToolkitState } from "@/types";

type Notify = ReturnType<typeof useToasts>["notify"];

const duplicateProfile = (current: ToolkitState, profile: Profile): ToolkitState => {
  const clone: Profile = { ...profile, id: createId(), name: `${profile.name} (copia)` };
  return { ...current, profiles: [...current.profiles, clone], selectedProfileId: clone.id };
};

const deleteProfile = (current: ToolkitState, profileId: string): ToolkitState => {
  const profiles = current.profiles.filter((profile) => profile.id !== profileId);
  return {
    ...current,
    profiles,
    selectedProfileId: profiles[0]?.id ?? null,
    environments: forgetFromEnvironments(current.environments, profileId),
  };
};

interface DirectionToolbarProps {
  profile: Profile;
  direction: HeaderDirection;
  showScope: boolean;
  onDirectionChange: (direction: HeaderDirection) => void;
  onToggleScope: () => void;
}

const DirectionToolbar = ({
  profile,
  direction,
  showScope,
  onDirectionChange,
  onToggleScope,
}: DirectionToolbarProps): ReactElement => (
  <div className="toolbar" style={{ padding: "10px 10px 6px" }}>
    <div className="segmented">
      <button
        type="button"
        aria-pressed={direction === "requestHeaders"}
        onClick={() => {
          onDirectionChange("requestHeaders");
        }}
      >
        Request ({profile.requestHeaders.length})
      </button>
      <button
        type="button"
        aria-pressed={direction === "responseHeaders"}
        onClick={() => {
          onDirectionChange("responseHeaders");
        }}
      >
        Response ({profile.responseHeaders.length})
      </button>
    </div>
    <div className="spacer" />
    <Button small variant="ghost" icon={showScope ? "chevron-down" : "chevron-right"} onClick={onToggleScope}>
      Alcance
    </Button>
    <Badge tone={profile.scope.activeTabOnly ? "accent" : "neutral"}>{describeScope(profile.scope)}</Badge>
  </div>
);

interface ProfileEditorProps {
  profile: Profile;
  update: UpdateState;
  activeTab: ActiveTab;
  notify: Notify;
  mutateProfile: (mutate: (profile: Profile) => Profile) => void;
}

const ProfileEditor = ({
  profile,
  update,
  activeTab,
  notify,
  mutateProfile,
}: ProfileEditorProps): ReactElement => {
  const [direction, setDirection] = useState<HeaderDirection>("requestHeaders");
  const [showScope, setShowScope] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mutateHeaders: MutateHeaders = (mutate) => {
    mutateProfile((current) => ({ ...current, [direction]: mutate(current[direction]) }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <ProfileHeaderBar
        profile={profile}
        onChange={mutateProfile}
        onExport={() => {
          downloadJson(`bender-perfil-${slugify(profile.name)}.json`, [profile]);
          notify(`Perfil "${profile.name}" exportado`, "success");
        }}
        onDuplicate={() => {
          update((current) => duplicateProfile(current, profile));
        }}
        onDelete={() => {
          setConfirmDelete(true);
        }}
      />

      {confirmDelete ? (
        <div style={{ padding: 10 }}>
          <ConfirmBar
            message={`Eliminar el perfil "${profile.name}" y sus headers?`}
            confirmLabel="Eliminar"
            onCancel={() => {
              setConfirmDelete(false);
            }}
            onConfirm={() => {
              update((current) => deleteProfile(current, profile.id));
              setConfirmDelete(false);
              notify("Perfil eliminado");
            }}
          />
        </div>
      ) : null}

      <DirectionToolbar
        profile={profile}
        direction={direction}
        showScope={showScope}
        onDirectionChange={setDirection}
        onToggleScope={() => {
          setShowScope((current) => !current);
        }}
      />

      {showScope ? (
        <div style={{ padding: "0 10px 10px" }}>
          <div className="card" style={{ padding: 12 }}>
            <ScopeEditor
              scope={profile.scope}
              currentHostname={activeTab.hostname}
              onChange={(scope) => {
                mutateProfile((current) => ({ ...current, scope }));
              }}
            />
          </div>
        </div>
      ) : null}

      <HeaderTable headers={profile[direction]} direction={direction} mutateHeaders={mutateHeaders} />
    </div>
  );
};

interface HeadersImportDialogProps {
  update: UpdateState;
  notify: Notify;
  onClose: () => void;
}

const HeadersImportDialog = ({ update, notify, onClose }: HeadersImportDialogProps): ReactElement => (
  <ImportDialog
    viewId="headers"
    title="Importar perfiles"
    description="Acepta exports de Bender, de ModHeader y del dev-toolkit viejo. Al agregar, un perfil que ya exista se actualiza en su lugar y el resto queda intacto."
    onClose={onClose}
    onImport={(text, mode) => {
      const imported = parseProfiles(text);
      update((current) => ({
        ...current,
        profiles: mode === "replace" ? imported : mergeProfiles(current.profiles, imported),
        selectedProfileId: imported[0]?.id ?? current.selectedProfileId,
      }));
      notify(`${imported.length} perfil(es) importado(s)`, "success");
    }}
  />
);

export const HeadersView = ({ state, update, activeTab }: ViewProps): ReactElement => {
  const { notify } = useToasts();
  const [importing, setImporting] = usePendingImport("headers");

  const selected =
    state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? state.profiles[0] ?? null;

  const mutateProfile = (mutate: (profile: Profile) => Profile): void => {
    if (!selected) return;
    update((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === selected.id ? mutate(profile) : profile)),
    }));
  };

  const addProfile = (): void => {
    update((current) => {
      const profile = createProfile(current.profiles.length);
      return { ...current, profiles: [...current.profiles, profile], selectedProfileId: profile.id };
    });
  };

  return (
    <ViewShell
      title="Headers"
      subtitle="Perfiles de headers de request y response, con alcance por dominio o pestaña."
      actions={
        <>
          <Button
            small
            icon="upload"
            onClick={() => {
              setImporting(true);
            }}
          >
            Importar
          </Button>
          <Button
            small
            icon="download"
            disabled={state.profiles.length === 0}
            onClick={() => {
              downloadJson("bender-perfiles.json", state.profiles);
              notify("Perfiles exportados", "success");
            }}
          >
            Exportar todos
          </Button>
        </>
      }
    >
      {state.profiles.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Todavia no hay perfiles"
          text="Un perfil agrupa headers que se prenden y apagan juntos, con su propio alcance."
          action={
            <Button variant="primary" icon="plus" onClick={addProfile}>
              Crear el primero
            </Button>
          }
        />
      ) : null}

      {selected ? (
        <div
          className="headers-layout"
          style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}
        >
          <ProfileRail
            profiles={state.profiles}
            selectedId={selected.id}
            onSelect={(profileId) => {
              update((current) => ({ ...current, selectedProfileId: profileId }));
            }}
            onAdd={addProfile}
          />
          <ProfileEditor
            profile={selected}
            update={update}
            activeTab={activeTab}
            notify={notify}
            mutateProfile={mutateProfile}
          />
        </div>
      ) : null}

      {selected ? <HeaderHints /> : null}

      {importing ? (
        <HeadersImportDialog
          update={update}
          notify={notify}
          onClose={() => {
            setImporting(false);
          }}
        />
      ) : null}
    </ViewShell>
  );
};
