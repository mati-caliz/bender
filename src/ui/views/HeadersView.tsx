import { useState } from 'react';
import { PROFILE_COLORS } from '@/lib/constants';
import { downloadJson } from '@/lib/download';
import { createHeaderEntry, createProfile } from '@/lib/factories';
import { createId } from '@/lib/ids';
import { parseProfiles } from '@/lib/import';
import { PLACEHOLDERS } from '@/lib/placeholders';
import { describeScope } from '@/lib/scope';
import { Icon } from '@/ui/components/Icon';
import { ImportDialog } from '@/ui/components/ImportDialog';
import { ScopeEditor } from '@/ui/components/ScopeEditor';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Badge,
  Button,
  ConfirmBar,
  EmptyState,
  IconButton,
  Select,
  Switch,
  TextInput,
} from '@/ui/components/primitives';
import { useToasts } from '@/ui/hooks/useToasts';
import type { ViewProps } from '@/ui/views/types';
import type { HeaderEntry, Profile } from '@/types';

type HeaderDirection = 'requestHeaders' | 'responseHeaders';

const OPERATION_OPTIONS = [
  { value: 'set', label: 'set' },
  { value: 'append', label: 'append' },
  { value: 'remove', label: 'remove' },
];

const initialsOf = (profile: Profile): string =>
  profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase() || '?';

const isHeaderOperation = (value: string): value is HeaderEntry['operation'] =>
  value === 'set' || value === 'append' || value === 'remove';

export const HeadersView = ({ state, update, activeTab }: ViewProps) => {
  const { notify } = useToasts();
  const [direction, setDirection] = useState<HeaderDirection>('requestHeaders');
  const [showScope, setShowScope] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const selected = state.profiles.find((profile) => profile.id === state.selectedProfileId) ?? state.profiles[0] ?? null;

  const mutateProfile = (mutate: (profile: Profile) => Profile) => {
    if (!selected) return;
    update((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === selected.id ? mutate(profile) : profile)),
    }));
  };

  const mutateHeaders = (mutate: (headers: HeaderEntry[]) => HeaderEntry[]) => {
    mutateProfile((profile) => ({ ...profile, [direction]: mutate(profile[direction]) }));
  };

  const addProfile = () => {
    update((current) => {
      const profile = createProfile(current.profiles.length);
      return { ...current, profiles: [...current.profiles, profile], selectedProfileId: profile.id };
    });
  };

  const headers = selected ? selected[direction] : [];

  const reorder = (from: number, to: number) => {
    mutateHeaders((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to > from ? to - 1 : to, 0, moved);
      return next;
    });
  };

  return (
    <ViewShell
      title="Headers"
      subtitle="Perfiles de headers de request y response, con alcance por dominio o pestaña."
      actions={
        <>
          <Button small icon="upload" onClick={() => setImporting(true)}>
            Importar
          </Button>
          <Button
            small
            icon="download"
            disabled={!state.profiles.length}
            onClick={() => {
              downloadJson('bender-perfiles.json', state.profiles);
              notify('Perfiles exportados', 'success');
            }}
          >
            Exportar
          </Button>
        </>
      }
    >
      {!state.profiles.length ? (
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
        <div className="headers-layout" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="profile-rail">
            {state.profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="profile-avatar"
                style={{ background: profile.color }}
                data-selected={profile.id === selected.id}
                data-enabled={profile.enabled}
                title={`${profile.name} · ${describeScope(profile.scope)}`}
                onClick={() => update((current) => ({ ...current, selectedProfileId: profile.id }))}
              >
                {initialsOf(profile)}
                {profile.enabled ? <span className="avatar-dot" /> : null}
              </button>
            ))}
            <button type="button" className="profile-avatar" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }} title="Nuevo perfil" onClick={addProfile}>
              <Icon name="plus" size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              className="card-header"
              style={{
                background: selected.enabled ? selected.color : 'var(--bg-elevated)',
                color: selected.enabled ? 'white' : 'var(--text)',
              }}
            >
              <Switch
                checked={selected.enabled}
                onChange={(enabled) => mutateProfile((profile) => ({ ...profile, enabled }))}
                title="Prender o apagar este perfil"
              />
              <input
                className="input"
                value={selected.name}
                style={{ background: 'transparent', border: 0, fontWeight: 600, color: 'inherit', maxWidth: 200 }}
                onChange={(event) => {
                  const name = event.target.value;
                  mutateProfile((profile) => ({ ...profile, name }));
                }}
              />
              <div className="spacer" />
              <input
                type="color"
                value={selected.color}
                title="Color del perfil"
                style={{ width: 26, height: 26, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                onChange={(event) => {
                  const color = event.target.value;
                  mutateProfile((profile) => ({ ...profile, color }));
                }}
                list="bender-profile-colors"
              />
              <datalist id="bender-profile-colors">
                {PROFILE_COLORS.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
              <IconButton
                icon="copy"
                title="Duplicar perfil"
                onClick={() =>
                  update((current) => {
                    const clone: Profile = { ...selected, id: createId(), name: `${selected.name} (copia)` };
                    return { ...current, profiles: [...current.profiles, clone], selectedProfileId: clone.id };
                  })
                }
              />
              <IconButton icon="trash" title="Eliminar perfil" tone="danger" onClick={() => setConfirmDelete(true)} />
            </div>

            {confirmDelete ? (
              <div style={{ padding: 10 }}>
                <ConfirmBar
                  message={`Eliminar el perfil "${selected.name}" y sus headers?`}
                  confirmLabel="Eliminar"
                  onCancel={() => setConfirmDelete(false)}
                  onConfirm={() => {
                    update((current) => {
                      const profiles = current.profiles.filter((profile) => profile.id !== selected.id);
                      return { ...current, profiles, selectedProfileId: profiles[0]?.id ?? null };
                    });
                    setConfirmDelete(false);
                    notify('Perfil eliminado');
                  }}
                />
              </div>
            ) : null}

            <div className="toolbar" style={{ padding: '10px 10px 6px' }}>
              <div className="segmented">
                <button
                  type="button"
                  aria-pressed={direction === 'requestHeaders'}
                  onClick={() => setDirection('requestHeaders')}
                >
                  Request ({selected.requestHeaders.length})
                </button>
                <button
                  type="button"
                  aria-pressed={direction === 'responseHeaders'}
                  onClick={() => setDirection('responseHeaders')}
                >
                  Response ({selected.responseHeaders.length})
                </button>
              </div>
              <div className="spacer" />
              <Button
                small
                variant="ghost"
                icon={showScope ? 'chevron-down' : 'chevron-right'}
                onClick={() => setShowScope((current) => !current)}
              >
                Alcance
              </Button>
              <Badge tone={selected.scope.activeTabOnly ? 'accent' : 'neutral'}>{describeScope(selected.scope)}</Badge>
            </div>

            {showScope ? (
              <div style={{ padding: '0 10px 10px' }}>
                <div className="card" style={{ padding: 12 }}>
                  <ScopeEditor
                    scope={selected.scope}
                    currentHostname={activeTab.hostname}
                    onChange={(scope) => mutateProfile((profile) => ({ ...profile, scope }))}
                  />
                </div>
              </div>
            ) : null}

            <div className="header-table">
              <div className="table-head">
                <span />
                <span />
                <span>Header</span>
                <span>Valor</span>
                <span>Operacion</span>
                <span />
              </div>

              {headers.map((header, index) => (
                <div
                  key={header.id}
                  className="header-row"
                  data-enabled={header.enabled}
                  data-dragging={dragIndex === index}
                  data-drop={dropIndex === index && dragIndex !== index}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropIndex(index);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                >
                  <span className="drag-handle" title="Arrastrar para reordenar">
                    <Icon name="grip" size={13} />
                  </span>
                  <Switch
                    small
                    checked={header.enabled}
                    onChange={(enabled) =>
                      mutateHeaders((current) =>
                        current.map((entry) => (entry.id === header.id ? { ...entry, enabled } : entry))
                      )
                    }
                    title="Prender o apagar este header"
                  />
                  <TextInput
                    value={header.name}
                    mono
                    placeholder="X-Mi-Header"
                    onChange={(name) =>
                      mutateHeaders((current) =>
                        current.map((entry) => (entry.id === header.id ? { ...entry, name } : entry))
                      )
                    }
                  />
                  <TextInput
                    value={header.value}
                    mono
                    placeholder={header.operation === 'remove' ? '(no aplica)' : 'valor'}
                    disabled={header.operation === 'remove'}
                    onChange={(value) =>
                      mutateHeaders((current) =>
                        current.map((entry) => (entry.id === header.id ? { ...entry, value } : entry))
                      )
                    }
                  />
                  <Select
                    value={header.operation}
                    options={OPERATION_OPTIONS}
                    title="set reemplaza, append suma otro valor, remove lo saca"
                    onChange={(operation) => {
                      if (!isHeaderOperation(operation)) return;
                      mutateHeaders((current) =>
                        current.map((entry) => (entry.id === header.id ? { ...entry, operation } : entry))
                      );
                    }}
                  />
                  <div className="row" style={{ gap: 2 }}>
                    <IconButton
                      icon="copy"
                      title="Duplicar (la copia queda apagada)"
                      small
                      onClick={() =>
                        mutateHeaders((current) => {
                          const next = [...current];
                          next.splice(
                            index + 1,
                            0,
                            createHeaderEntry({
                              name: header.name,
                              value: header.value,
                              operation: header.operation,
                              comment: header.comment,
                              enabled: false,
                            })
                          );
                          return next;
                        })
                      }
                    />
                    <IconButton
                      icon="trash"
                      title="Eliminar header"
                      tone="danger"
                      small
                      onClick={() => mutateHeaders((current) => current.filter((entry) => entry.id !== header.id))}
                    />
                  </div>
                </div>
              ))}

              {!headers.length ? (
                <EmptyState
                  icon="layers"
                  title={direction === 'requestHeaders' ? 'Sin headers de request' : 'Sin headers de response'}
                  text="Agregá uno para empezar a modificar el trafico."
                />
              ) : null}

              <div style={{ padding: 8 }}>
                <Button
                  small
                  icon="plus"
                  onClick={() => mutateHeaders((current) => [...current, createHeaderEntry()])}
                >
                  Agregar header
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <details className="hint-card">
          <summary>
            <Icon name="info" size={13} />
            Valores dinamicos
          </summary>
          <div className="hint-body">
            <p className="text-small text-muted" style={{ margin: '0 0 8px' }}>
              En el valor de un header podes escribir estos marcadores. Se resuelven cuando el motor recompila las
              reglas (al guardar un cambio, al cambiar de pestaña o al arrancar el navegador), no en cada request.
            </p>
            <div style={{ display: 'grid', gap: 4 }}>
              {PLACEHOLDERS.map((placeholder) => (
                <div key={placeholder.name} className="row" style={{ gap: 8 }}>
                  <code className="text-small">{`{{${placeholder.name}}}`}</code>
                  <span className="text-small text-muted">{placeholder.description}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      {selected ? (
        <details className="hint-card">
          <summary>
            <Icon name="info" size={13} />
            Como se resuelven los conflictos
          </summary>
          <p className="text-small text-muted" style={{ margin: 0 }}>
            Si dos perfiles activos tocan el mismo header, gana el que este mas abajo en la lista de perfiles. Los
            headers de la pestaña User-Agent y de CORS tienen prioridad sobre los perfiles.
          </p>
        </details>
      ) : null}

      {importing ? (
        <ImportDialog
          title="Importar perfiles"
          description="Acepta exports de Bender, de ModHeader y del dev-toolkit viejo."
          onClose={() => setImporting(false)}
          onImport={(text, mode) => {
            const imported = parseProfiles(text);
            update((current) => ({
              ...current,
              profiles: mode === 'replace' ? imported : [...current.profiles, ...imported],
              selectedProfileId: imported[0]?.id ?? current.selectedProfileId,
            }));
            notify(`${imported.length} perfil(es) importado(s)`, 'success');
          }}
        />
      ) : null}
    </ViewShell>
  );
};
