import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { formatBytes, prettyJson } from "@/lib/format";
import { parseStorageItems } from "@/lib/import";
import { parseJsonTree } from "@/lib/json-tree";
import { ImportDialog } from "@/ui/components/ImportDialog";
import { JsonTree } from "@/ui/components/JsonTree";
import { JwtPanel } from "@/ui/components/JwtPanel";
import { ToggleCard } from "@/ui/components/ToggleCard";
import { ViewShell } from "@/ui/components/ViewShell";
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
} from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import { usePendingImport } from "@/ui/hooks/usePendingImport";
import { useToasts } from "@/ui/hooks/useToasts";
import { useWebStorage, type WebStorageController } from "@/ui/hooks/useWebStorage";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { StorageArea, StoredItem, ToggleRow } from "@/types";

const AREA_OPTIONS: { value: StorageArea; label: string }[] = [
  { value: "local", label: "localStorage" },
  { value: "session", label: "sessionStorage" },
];

type ValueMode = "tree" | "text";

interface ItemFormProps {
  draft: StoredItem;
  onChange: (item: StoredItem) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew: boolean;
}

const VALUE_MODES: { value: ValueMode; label: string }[] = [
  { value: "tree", label: "Arbol" },
  { value: "text", label: "Texto" },
];

const ItemForm = ({ draft, onChange, onSave, onDelete, onCancel, isNew }: ItemFormProps): ReactElement => {
  const [mode, setMode] = useState<ValueMode>("tree");
  // El arbol se recalcula con el valor, asi que editar en Texto y volver muestra lo nuevo.
  const tree = useMemo(() => parseJsonTree(draft.value), [draft.value]);

  return (
    <>
      <Field label="Key">
        <TextInput
          value={draft.key}
          mono
          onChange={(key) => {
            onChange({ ...draft, key });
          }}
        />
      </Field>

      <Field label="Valor" hint={`${formatBytes(new Blob([draft.value]).size)} en disco`}>
        {tree ? (
          <>
            <div className="row" style={{ marginBottom: 6 }}>
              <Segmented value={mode} options={VALUE_MODES} onChange={setMode} />
              <span className="field-hint">El arbol es solo lectura: para editar usa Texto.</span>
            </div>
            {mode === "tree" ? (
              <JsonTree root={tree} />
            ) : (
              <TextArea
                value={draft.value}
                mono
                rows={6}
                onChange={(value) => {
                  onChange({ ...draft, value });
                }}
              />
            )}
          </>
        ) : (
          <TextArea
            value={draft.value}
            mono
            rows={6}
            onChange={(value) => {
              onChange({ ...draft, value });
            }}
          />
        )}
      </Field>

      <JwtPanel value={draft.value} />

      <div className="row wrap">
        <Button variant="primary" icon="check" onClick={onSave} disabled={!draft.key.trim()}>
          Guardar
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onChange({ ...draft, value: prettyJson(draft.value) });
          }}
        >
          Formatear JSON
        </Button>
        <div className="spacer" />
        <Button variant="danger" icon="trash" onClick={onDelete}>
          {isNew ? "Descartar" : "Borrar"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    </>
  );
};

type Notify = ReturnType<typeof useToasts>["notify"];

interface StorageHeaderActionsProps {
  storage: WebStorageController;
  area: StorageArea;
  activeTab: ActiveTab;
  notify: Notify;
  onImport: () => void;
  onClear: () => void;
}

const StorageHeaderActions = ({
  storage,
  area,
  activeTab,
  notify,
  onImport,
  onClear,
}: StorageHeaderActionsProps): ReactElement => (
  <>
    <Button small icon="refresh" variant="ghost" onClick={storage.reload}>
      Recargar
    </Button>
    <Button small icon="upload" onClick={onImport} disabled={!activeTab.injectable}>
      Importar
    </Button>
    <Button
      small
      icon="download"
      disabled={storage.items.length === 0}
      onClick={() => {
        const payload = Object.fromEntries(storage.items.map((item) => [item.key, item.value]));
        downloadJson(`${area}storage-${activeTab.hostname || "export"}.json`, payload);
        notify("Storage exportado", "success");
      }}
    >
      Exportar
    </Button>
    <Button small variant="danger" icon="trash" disabled={storage.rows.length === 0} onClick={onClear}>
      Vaciar
    </Button>
  </>
);

interface NewItemCardProps {
  newItem: StoredItem;
  storage: WebStorageController;
  notify: Notify;
  onChange: (item: StoredItem | null) => void;
}

const NewItemCard = ({ newItem, storage, notify, onChange }: NewItemCardProps): ReactElement => (
  <Card title="Nuevo item">
    <ItemForm
      draft={newItem}
      isNew
      onChange={onChange}
      onCancel={() => {
        onChange(null);
      }}
      onDelete={() => {
        onChange(null);
      }}
      onSave={() => {
        void storage.save(null, newItem, false).then(() => {
          notify("Item creado", "success");
        });
        onChange(null);
      }}
    />
  </Card>
);

interface StorageRowCardProps {
  row: ToggleRow<StoredItem>;
  expanded: boolean;
  draft: StoredItem | null;
  storage: WebStorageController;
  notify: Notify;
  onDraftChange: (item: StoredItem | null) => void;
  onExpandedKeyChange: (key: string | null) => void;
}

const StorageRowCard = ({
  row,
  expanded,
  draft,
  storage,
  notify,
  onDraftChange,
  onExpandedKeyChange,
}: StorageRowCardProps): ReactElement => {
  const current = expanded && draft ? draft : row.item;
  const collapse = (): void => {
    onExpandedKeyChange(null);
    onDraftChange(null);
  };
  return (
    <ToggleCard
      name={row.item.key}
      preview={row.item.value}
      off={row.off}
      reappeared={row.reappeared}
      expanded={expanded}
      reappearedTitle="La pagina volvio a escribir esta key mientras estaba apagada."
      onToggle={(enabled) => void storage.toggle(row, enabled)}
      onExpand={() => {
        onExpandedKeyChange(expanded ? null : row.key);
        onDraftChange(expanded ? null : row.item);
      }}
    >
      <ItemForm
        draft={current}
        isNew={false}
        onChange={onDraftChange}
        onCancel={collapse}
        onDelete={() => {
          void storage.remove(row.item, row.off).then(() => {
            notify("Item borrado");
          });
          collapse();
        }}
        onSave={() => {
          void storage.save(row.item.key, current, row.off).then(() => {
            notify("Item guardado", "success");
          });
          collapse();
        }}
      />
    </ToggleCard>
  );
};

const filterRows = (rows: ToggleRow<StoredItem>[], filter: string): ToggleRow<StoredItem>[] => {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return rows;
  return rows.filter(
    (row) =>
      row.item.key.toLowerCase().includes(normalizedFilter) ||
      row.item.value.toLowerCase().includes(normalizedFilter),
  );
};

interface StorageImportDialogProps {
  area: StorageArea;
  storage: WebStorageController;
  notify: Notify;
  onClose: () => void;
}

const StorageImportDialog = ({ area, storage, notify, onClose }: StorageImportDialogProps): ReactElement => (
  <ImportDialog
    viewId="storage"
    title={`Importar a ${area}Storage`}
    description="Acepta un objeto { key: valor } o un array de { key, value }."
    allowAppend={false}
    onClose={onClose}
    onImport={(text) => {
      const parsed = parseStorageItems(text);
      void storage.importItems(parsed).then((imported) => {
        notify(
          `${imported}/${parsed.length} items importados`,
          imported === parsed.length ? "success" : "error",
        );
      });
    }}
  />
);

export const StorageView = ({ activeTab }: { activeTab: ActiveTab }): ReactElement => {
  const { notify } = useToasts();
  const [area, setArea] = useState<StorageArea>("local");
  const storage = useWebStorage(activeTab, area);
  const [filter, setFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoredItem | null>(null);
  const [newItem, setNewItem] = useState<StoredItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = usePendingImport("storage");

  const visible = filterRows(storage.rows, filter);
  const totalBytes = storage.items.reduce((total, item) => total + item.key.length + item.value.length, 0);

  return (
    <ViewShell
      title="Storage"
      subtitle={
        activeTab.origin ? `${activeTab.origin} · ${formatBytes(totalBytes)}` : "Abri una pagina http(s)"
      }
      actions={
        <StorageHeaderActions
          storage={storage}
          area={area}
          activeTab={activeTab}
          notify={notify}
          onImport={() => {
            setImporting(true);
          }}
          onClear={() => {
            setConfirmClear(true);
          }}
        />
      }
    >
      <div className="toolbar">
        <Segmented value={area} options={AREA_OPTIONS} onChange={setArea} />
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar por key o valor…" />
        <Button
          small
          icon="plus"
          disabled={!activeTab.injectable}
          onClick={() => {
            setNewItem({ key: "", value: "" });
          }}
        >
          Nuevo item
        </Button>
      </div>

      {hasText(storage.error) ? <Notice tone="danger">{storage.error}</Notice> : null}

      {confirmClear ? (
        <ConfirmBar
          message={`Vaciar el ${area}Storage de ${activeTab.origin} (incluidos los apagados)?`}
          confirmLabel="Vaciar"
          onCancel={() => {
            setConfirmClear(false);
          }}
          onConfirm={() => {
            void storage.clear().then(() => {
              notify("Storage vaciado");
            });
            setConfirmClear(false);
          }}
        />
      ) : null}

      {newItem ? (
        <NewItemCard newItem={newItem} storage={storage} notify={notify} onChange={setNewItem} />
      ) : null}

      {visible.length > 0 ? (
        <div className="list">
          {visible.map((row) => (
            <StorageRowCard
              key={row.key}
              row={row}
              expanded={expandedKey === row.key}
              draft={draft}
              storage={storage}
              notify={notify}
              onDraftChange={setDraft}
              onExpandedKeyChange={setExpandedKey}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="database"
          title={
            storage.rows.length > 0 ? "Ningun item coincide con el filtro" : `Sin items en ${area}Storage`
          }
          text="El switch de cada item lo saca de la pagina pero guarda una copia para restaurarlo."
        />
      )}

      {importing ? (
        <StorageImportDialog
          area={area}
          storage={storage}
          notify={notify}
          onClose={() => {
            setImporting(false);
          }}
        />
      ) : null}
    </ViewShell>
  );
};
