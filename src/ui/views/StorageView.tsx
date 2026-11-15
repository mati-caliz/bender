import { useState } from "react";
import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { parseStorageItems } from "@/lib/import";
import { ImportDialog } from "@/ui/components/ImportDialog";
import { ToggleCard } from "@/ui/components/ToggleCard";
import { ViewShell } from "@/ui/components/ViewShell";
import {
  Button,
  Card,
  ConfirmBar,
  EmptyState,
  Notice,
  SearchInput,
  Segmented,
} from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import { usePendingImport } from "@/ui/hooks/usePendingImport";
import { useToasts, type Notify } from "@/ui/hooks/useToasts";
import { useWebStorage, type WebStorageController } from "@/ui/hooks/useWebStorage";
import { ItemForm } from "@/ui/views/storage/StorageItemForm";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { StorageArea, StoredItem, ToggleRow } from "@/types";

const AREA_OPTIONS: { value: StorageArea; label: string }[] = [
  { value: "local", label: "localStorage" },
  { value: "session", label: "sessionStorage" },
];

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

interface ClearStorageBarProps {
  storage: WebStorageController;
  label: string;
  notify: Notify;
  onDone: () => void;
}

const ClearStorageBar = ({ storage, label, notify, onDone }: ClearStorageBarProps): ReactElement => (
  <ConfirmBar
    message={`Vaciar el ${label} (incluidos los apagados)?`}
    confirmLabel="Vaciar"
    onCancel={onDone}
    onConfirm={() => {
      void storage.clear().then(() => {
        notify("Storage vaciado");
      });
      onDone();
    }}
  />
);

interface StorageListProps {
  rows: WebStorageController["rows"];
  area: StorageArea;
  anyItem: boolean;
  expandedKey: string | null;
  draft: StoredItem | null;
  storage: WebStorageController;
  notify: Notify;
  onDraftChange: (draft: StoredItem | null) => void;
  onExpandedKeyChange: (key: string | null) => void;
}

const StorageList = ({ rows, area, anyItem, expandedKey, ...rowProps }: StorageListProps): ReactElement =>
  rows.length > 0 ? (
    <div className="list">
      {rows.map((row) => (
        <StorageRowCard key={row.key} row={row} expanded={expandedKey === row.key} {...rowProps} />
      ))}
    </div>
  ) : (
    <EmptyState
      icon="database"
      title={anyItem ? "Ningun item coincide con el filtro" : `Sin items en ${area}Storage`}
      text="El switch de cada item lo saca de la pagina pero guarda una copia para restaurarlo."
    />
  );

/** El origen y cuánto ocupa lo guardado, contando claves y valores. */
const storageSubtitle = (origin: string, items: StoredItem[]): string => {
  if (!origin) return "Abri una pagina http(s)";
  const totalBytes = items.reduce((total, item) => total + item.key.length + item.value.length, 0);
  return `${origin} · ${formatBytes(totalBytes)}`;
};

interface StorageToolbarProps {
  area: StorageArea;
  onArea: (area: StorageArea) => void;
  filter: string;
  onFilter: (filter: string) => void;
  canAdd: boolean;
  onAdd: () => void;
}

const StorageToolbar = ({
  area,
  onArea,
  filter,
  onFilter,
  canAdd,
  onAdd,
}: StorageToolbarProps): ReactElement => (
  <div className="toolbar">
    <Segmented value={area} options={AREA_OPTIONS} onChange={onArea} />
    <SearchInput value={filter} onChange={onFilter} placeholder="Filtrar por key o valor…" />
    <Button small icon="plus" disabled={!canAdd} onClick={onAdd}>
      Nuevo item
    </Button>
  </div>
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

  return (
    <ViewShell
      title="Storage"
      subtitle={storageSubtitle(activeTab.origin, storage.items)}
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
      <StorageToolbar
        area={area}
        onArea={setArea}
        filter={filter}
        onFilter={setFilter}
        canAdd={activeTab.injectable}
        onAdd={() => {
          setNewItem({ key: "", value: "" });
        }}
      />

      {hasText(storage.error) ? <Notice tone="danger">{storage.error}</Notice> : null}

      {confirmClear ? (
        <ClearStorageBar
          storage={storage}
          label={`${area}Storage de ${activeTab.origin}`}
          notify={notify}
          onDone={() => {
            setConfirmClear(false);
          }}
        />
      ) : null}

      {newItem ? (
        <NewItemCard newItem={newItem} storage={storage} notify={notify} onChange={setNewItem} />
      ) : null}

      <StorageList
        rows={visible}
        area={area}
        anyItem={storage.rows.length > 0}
        expandedKey={expandedKey}
        draft={draft}
        storage={storage}
        notify={notify}
        onDraftChange={setDraft}
        onExpandedKeyChange={setExpandedKey}
      />

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
