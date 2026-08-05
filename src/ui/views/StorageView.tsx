import { useMemo, useState } from 'react';
import { downloadJson } from '@/lib/download';
import { formatBytes, prettyJson } from '@/lib/format';
import { parseStorageItems } from '@/lib/import';
import { parseJsonTree } from '@/lib/json-tree';
import { ImportDialog } from '@/ui/components/ImportDialog';
import { JsonTree } from '@/ui/components/JsonTree';
import { JwtPanel } from '@/ui/components/JwtPanel';
import { ToggleCard } from '@/ui/components/ToggleCard';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Button,
  Card,
  ConfirmBar,
  EmptyState,
  Field,
  Notice,
  SearchInput,
  Segmented,
  TextArea,
  TextInput,
} from '@/ui/components/primitives';
import { useToasts } from '@/ui/hooks/useToasts';
import { useWebStorage } from '@/ui/hooks/useWebStorage';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { StorageArea, StoredItem } from '@/types';

const AREA_OPTIONS: Array<{ value: StorageArea; label: string }> = [
  { value: 'local', label: 'localStorage' },
  { value: 'session', label: 'sessionStorage' },
];

type ValueMode = 'tree' | 'text';

interface ItemFormProps {
  draft: StoredItem;
  onChange: (item: StoredItem) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew: boolean;
}

const VALUE_MODES: Array<{ value: ValueMode; label: string }> = [
  { value: 'tree', label: 'Arbol' },
  { value: 'text', label: 'Texto' },
];

const ItemForm = ({ draft, onChange, onSave, onDelete, onCancel, isNew }: ItemFormProps) => {
  const [mode, setMode] = useState<ValueMode>('tree');
  // El arbol se recalcula con el valor, asi que editar en Texto y volver muestra lo nuevo.
  const tree = useMemo(() => parseJsonTree(draft.value), [draft.value]);

  return (
    <>
      <Field label="Key">
        <TextInput value={draft.key} mono onChange={(key) => onChange({ ...draft, key })} />
      </Field>

      <Field label="Valor" hint={`${formatBytes(new Blob([draft.value]).size)} en disco`}>
        {tree ? (
          <>
            <div className="row" style={{ marginBottom: 6 }}>
              <Segmented value={mode} options={VALUE_MODES} onChange={setMode} />
              <span className="field-hint">El arbol es solo lectura: para editar usa Texto.</span>
            </div>
            {mode === 'tree' ? (
              <JsonTree root={tree} />
            ) : (
              <TextArea value={draft.value} mono rows={6} onChange={(value) => onChange({ ...draft, value })} />
            )}
          </>
        ) : (
          <TextArea value={draft.value} mono rows={6} onChange={(value) => onChange({ ...draft, value })} />
        )}
      </Field>

      <JwtPanel value={draft.value} />

      <div className="row wrap">
        <Button variant="primary" icon="check" onClick={onSave} disabled={!draft.key.trim()}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={() => onChange({ ...draft, value: prettyJson(draft.value) })}>
          Formatear JSON
        </Button>
        <div className="spacer" />
        <Button variant="danger" icon="trash" onClick={onDelete}>
          {isNew ? 'Descartar' : 'Borrar'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    </>
  );
};

export const StorageView = ({ activeTab }: { activeTab: ActiveTab }) => {
  const { notify } = useToasts();
  const [area, setArea] = useState<StorageArea>('local');
  const storage = useWebStorage(activeTab, area);
  const [filter, setFilter] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoredItem | null>(null);
  const [newItem, setNewItem] = useState<StoredItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();
  const visible = normalizedFilter
    ? storage.rows.filter(
        (row) =>
          row.item.key.toLowerCase().includes(normalizedFilter) ||
          row.item.value.toLowerCase().includes(normalizedFilter)
      )
    : storage.rows;

  const totalBytes = storage.items.reduce((total, item) => total + item.key.length + item.value.length, 0);

  return (
    <ViewShell
      title="Storage"
      subtitle={activeTab.origin ? `${activeTab.origin} · ${formatBytes(totalBytes)}` : 'Abri una pagina http(s)'}
      actions={
        <>
          <Button small icon="refresh" variant="ghost" onClick={storage.reload}>
            Recargar
          </Button>
          <Button small icon="upload" onClick={() => setImporting(true)} disabled={!activeTab.injectable}>
            Importar
          </Button>
          <Button
            small
            icon="download"
            disabled={!storage.items.length}
            onClick={() => {
              const payload = Object.fromEntries(storage.items.map((item) => [item.key, item.value]));
              downloadJson(`${area}storage-${activeTab.hostname || 'export'}.json`, payload);
              notify('Storage exportado', 'success');
            }}
          >
            Exportar
          </Button>
          <Button small variant="danger" icon="trash" disabled={!storage.rows.length} onClick={() => setConfirmClear(true)}>
            Vaciar
          </Button>
        </>
      }
    >
      <div className="toolbar">
        <Segmented value={area} options={AREA_OPTIONS} onChange={setArea} />
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar por key o valor…" />
        <Button small icon="plus" disabled={!activeTab.injectable} onClick={() => setNewItem({ key: '', value: '' })}>
          Nuevo item
        </Button>
      </div>

      {storage.error ? <Notice tone="danger">{storage.error}</Notice> : null}

      {confirmClear ? (
        <ConfirmBar
          message={`Vaciar el ${area}Storage de ${activeTab.origin} (incluidos los apagados)?`}
          confirmLabel="Vaciar"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            void storage.clear().then(() => notify('Storage vaciado'));
            setConfirmClear(false);
          }}
        />
      ) : null}

      {newItem ? (
        <Card title="Nuevo item">
          <ItemForm
            draft={newItem}
            isNew
            onChange={setNewItem}
            onCancel={() => setNewItem(null)}
            onDelete={() => setNewItem(null)}
            onSave={() => {
              void storage.save(null, newItem, false).then(() => notify('Item creado', 'success'));
              setNewItem(null);
            }}
          />
        </Card>
      ) : null}

      {visible.length ? (
        <div className="list">
          {visible.map((row) => {
            const expanded = expandedKey === row.key;
            const current = expanded && draft ? draft : row.item;
            return (
              <ToggleCard
                key={row.key}
                name={row.item.key}
                preview={row.item.value}
                off={row.off}
                reappeared={row.reappeared}
                expanded={expanded}
                reappearedTitle="La pagina volvio a escribir esta key mientras estaba apagada."
                onToggle={(enabled) => void storage.toggle(row, enabled)}
                onExpand={() => {
                  setExpandedKey(expanded ? null : row.key);
                  setDraft(expanded ? null : row.item);
                }}
              >
                <ItemForm
                  draft={current}
                  isNew={false}
                  onChange={setDraft}
                  onCancel={() => {
                    setExpandedKey(null);
                    setDraft(null);
                  }}
                  onDelete={() => {
                    void storage.remove(row.item, row.off).then(() => notify('Item borrado'));
                    setExpandedKey(null);
                    setDraft(null);
                  }}
                  onSave={() => {
                    void storage.save(row.item.key, current, row.off).then(() => notify('Item guardado', 'success'));
                    setExpandedKey(null);
                    setDraft(null);
                  }}
                />
              </ToggleCard>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="database"
          title={storage.rows.length ? 'Ningun item coincide con el filtro' : `Sin items en ${area}Storage`}
          text="El switch de cada item lo saca de la pagina pero guarda una copia para restaurarlo."
        />
      )}

      {importing ? (
        <ImportDialog
          title={`Importar a ${area}Storage`}
          description="Acepta un objeto { key: valor } o un array de { key, value }."
          allowAppend={false}
          onClose={() => setImporting(false)}
          onImport={(text) => {
            const parsed = parseStorageItems(text);
            void storage.importItems(parsed).then((imported) => {
              notify(`${imported}/${parsed.length} items importados`, imported === parsed.length ? 'success' : 'error');
            });
          }}
        />
      ) : null}
    </ViewShell>
  );
};
