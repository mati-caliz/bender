import { useState } from 'react';
import { ACCENT_COLORS, createDefaultState } from '@/lib/constants';
import { downloadJson } from '@/lib/download';
import { sendMessage } from '@/lib/messages';
import { normalizeState } from '@/lib/state';
import { ImportDialog } from '@/ui/components/ImportDialog';
import { ViewShell } from '@/ui/components/ViewShell';
import { Button, Card, ConfirmBar, Field, Notice, Segmented, Select } from '@/ui/components/primitives';
import { useToasts } from '@/ui/hooks/useToasts';
import type { UpdateState } from '@/ui/views/types';
import type { EngineStatus, ThemeMode, ToolkitState, UiConfig } from '@/types';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
];

const DENSITY_OPTIONS: Array<{ value: UiConfig['density']; label: string }> = [
  { value: 'comfortable', label: 'Comoda' },
  { value: 'compact', label: 'Compacta' },
];

const BUFFER_OPTIONS = [
  { value: '200', label: '200 requests' },
  { value: '500', label: '500 requests' },
  { value: '1000', label: '1000 requests' },
  { value: '2000', label: '2000 requests' },
];

const DEFAULT_BUFFER_SIZE = 500;

interface SettingsViewProps {
  state: ToolkitState;
  update: UpdateState;
  status: EngineStatus;
}

export const SettingsView = ({ state, update, status }: SettingsViewProps) => {
  const { notify } = useToasts();
  const [importing, setImporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <ViewShell title="Ajustes" subtitle="Apariencia, backups y estado del motor.">
      <Card title="Apariencia">
        <Field label="Tema">
          <Segmented
            value={state.ui.theme}
            options={THEME_OPTIONS}
            onChange={(theme) => update((current) => ({ ...current, ui: { ...current.ui, theme } }))}
          />
        </Field>
        <Field label="Densidad">
          <Segmented
            value={state.ui.density}
            options={DENSITY_OPTIONS}
            onChange={(density) => update((current) => ({ ...current, ui: { ...current.ui, density } }))}
          />
        </Field>
        <Field label="Color de acento">
          <div className="row wrap">
            {ACCENT_COLORS.map((accent) => (
              <button
                key={accent}
                type="button"
                aria-label={`Acento ${accent}`}
                onClick={() => update((current) => ({ ...current, ui: { ...current.ui, accent } }))}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  background: accent,
                  border: state.ui.accent === accent ? '2px solid var(--text)' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </Field>
      </Card>

      <Card title="Captura de trafico">
        <Field label="Tamaño del buffer" hint="Las requests viven solo en la sesion del navegador.">
          <Select
            value={String(state.network.maxEntries)}
            options={BUFFER_OPTIONS}
            onChange={(value) => {
              const parsed = Number.parseInt(value, 10);
              const maxEntries = Number.isNaN(parsed) ? DEFAULT_BUFFER_SIZE : parsed;
              update((current) => ({ ...current, network: { ...current.network, maxEntries } }));
            }}
          />
        </Field>
      </Card>

      <Card title="Backup">
        <p className="text-small text-muted" style={{ margin: 0 }}>
          El backup incluye perfiles, reglas, mocks, scripts y preferencias. No incluye cookies ni storage de los
          sitios.
        </p>
        <div className="row">
          <Button
            icon="download"
            onClick={() => {
              downloadJson(`bender-backup-${new Date().toISOString().slice(0, 10)}.json`, state);
              notify('Backup exportado', 'success');
            }}
          >
            Exportar todo
          </Button>
          <Button icon="upload" onClick={() => setImporting(true)}>
            Importar backup
          </Button>
          <div className="spacer" />
          <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
            Restablecer
          </Button>
        </div>

        {confirmReset ? (
          <ConfirmBar
            message="Esto borra perfiles, reglas y scripts. No se puede deshacer."
            confirmLabel="Restablecer todo"
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => {
              update(() => createDefaultState());
              setConfirmReset(false);
              notify('Configuracion restablecida');
            }}
          />
        ) : null}
      </Card>

      <Card title="Atajos de teclado">
        <div className="kv-table">
          <span className="kv-key">Alt+Shift+T</span>
          <span className="kv-value">Prender o apagar todas las reglas</span>
          <span className="kv-key">Alt+Shift+P</span>
          <span className="kv-value">Abrir Bender en el panel lateral</span>
        </div>
        <Button
          small
          variant="ghost"
          icon="external"
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Cambiar atajos
        </Button>
      </Card>

      <Card
        title="Motor"
        subtitle={status.updatedAt ? `Ultima aplicacion: ${new Date(status.updatedAt).toLocaleTimeString('es-AR')}` : 'Sin aplicar todavia'}
        actions={
          <Button
            small
            icon="refresh"
            onClick={() => {
              void sendMessage({ type: 'engine/refresh' }).then(() => notify('Reglas reaplicadas', 'success'));
            }}
          >
            Reaplicar
          </Button>
        }
      >
        <div className="kv-table">
          <span className="kv-key">Reglas activas</span>
          <span className="kv-value">{status.appliedRuleCount}</span>
          <span className="kv-key">Perfiles activos</span>
          <span className="kv-value">{status.activeProfileCount}</span>
        </div>
        {status.diagnostics.length ? (
          status.diagnostics.map((diagnostic, index) => (
            <Notice key={`${diagnostic.message}-${index}`} tone={diagnostic.level === 'error' ? 'danger' : 'warning'}>
              {diagnostic.message}
            </Notice>
          ))
        ) : (
          <Notice>Sin advertencias: todo lo configurado se esta aplicando.</Notice>
        )}
      </Card>

      {importing ? (
        <ImportDialog
          title="Importar backup"
          description="Pega un backup completo de Bender. Reemplaza toda la configuracion actual."
          allowAppend={false}
          onClose={() => setImporting(false)}
          onImport={(text) => {
            const parsed: unknown = JSON.parse(text);
            update(() => normalizeState(parsed));
            notify('Backup importado', 'success');
          }}
        />
      ) : null}
    </ViewShell>
  );
};
