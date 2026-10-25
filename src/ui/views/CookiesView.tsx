import { useState } from "react";
import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { parseCookies } from "@/lib/import";
import { ImportDialog } from "@/ui/components/ImportDialog";
import { ToggleCard } from "@/ui/components/ToggleCard";
import { ViewShell } from "@/ui/components/ViewShell";
import { Button, Card, ConfirmBar, EmptyState, Notice, SearchInput } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import { cookieKeyOf, useCookies, type CookiesController } from "@/ui/hooks/useCookies";
import { usePendingImport } from "@/ui/hooks/usePendingImport";
import { useToasts } from "@/ui/hooks/useToasts";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { CookieSnapshot, ToggleRow } from "@/types";
import { CookieForm } from "@/ui/views/cookies/CookieForm";
import { CookieSnapshotsCard } from "@/ui/views/cookies/CookieSnapshotsCard";

const blankCookie = (hostname: string, secure: boolean): CookieSnapshot => ({
  name: "",
  value: "",
  domain: hostname,
  path: "/",
  secure,
  httpOnly: false,
  sameSite: "lax",
  hostOnly: true,
  expirationDate: null,
});

type Notify = ReturnType<typeof useToasts>["notify"];

interface CookiesHeaderActionsProps {
  cookies: CookiesController;
  activeTab: ActiveTab;
  notify: Notify;
  onImport: () => void;
  onClear: () => void;
}

const CookiesHeaderActions = ({
  cookies,
  activeTab,
  notify,
  onImport,
  onClear,
}: CookiesHeaderActionsProps): ReactElement => (
  <>
    <Button small icon="refresh" variant="ghost" onClick={cookies.reload} title="Recargar">
      Recargar
    </Button>
    <Button small icon="upload" onClick={onImport} disabled={!activeTab.injectable}>
      Importar
    </Button>
    <Button
      small
      icon="download"
      disabled={cookies.liveCookies.length === 0}
      onClick={() => {
        downloadJson(`cookies-${activeTab.hostname || "export"}.json`, cookies.liveCookies);
        notify("Cookies exportadas", "success");
      }}
    >
      Exportar
    </Button>
    <Button small variant="danger" icon="trash" disabled={cookies.rows.length === 0} onClick={onClear}>
      Borrar todas
    </Button>
  </>
);

interface NewCookieCardProps {
  newCookie: CookieSnapshot;
  cookies: CookiesController;
  notify: Notify;
  onChange: (cookie: CookieSnapshot | null) => void;
}

const NewCookieCard = ({ newCookie, cookies, notify, onChange }: NewCookieCardProps): ReactElement => (
  <Card title="Nueva cookie">
    <CookieForm
      draft={newCookie}
      isNew
      onChange={onChange}
      onCancel={() => {
        onChange(null);
      }}
      onDelete={() => {
        onChange(null);
      }}
      onSave={() => {
        void cookies.save(null, newCookie, false).then(() => {
          notify("Cookie creada", "success");
        });
        onChange(null);
      }}
    />
  </Card>
);

interface CookieRowCardProps {
  row: ToggleRow<CookieSnapshot>;
  expanded: boolean;
  draft: CookieSnapshot | null;
  cookies: CookiesController;
  notify: Notify;
  onDraftChange: (cookie: CookieSnapshot | null) => void;
  onExpandedKeyChange: (key: string | null) => void;
}

const CookieRowCard = ({
  row,
  expanded,
  draft,
  cookies,
  notify,
  onDraftChange,
  onExpandedKeyChange,
}: CookieRowCardProps): ReactElement => {
  const current = expanded && draft ? draft : row.item;
  return (
    <ToggleCard
      name={row.item.name || "(sin nombre)"}
      preview={row.item.value}
      off={row.off}
      reappeared={row.reappeared}
      expanded={expanded}
      reappearedTitle="El sitio volvio a crear esta cookie mientras estaba apagada."
      onToggle={(enabled) => void cookies.toggle(row, enabled)}
      onExpand={() => {
        onExpandedKeyChange(expanded ? null : row.key);
        onDraftChange(expanded ? null : row.item);
      }}
    >
      <CookieForm
        draft={current}
        isNew={false}
        onChange={onDraftChange}
        onCancel={() => {
          onExpandedKeyChange(null);
          onDraftChange(null);
        }}
        onDelete={() => {
          void cookies.remove(row.item, row.off).then(() => {
            notify("Cookie borrada");
          });
          onExpandedKeyChange(null);
          onDraftChange(null);
        }}
        onSave={() => {
          void cookies.save(row.item, current, row.off).then(() => {
            notify("Cookie guardada", "success");
          });
          onExpandedKeyChange(cookieKeyOf(current) === row.key ? row.key : null);
          onDraftChange(null);
        }}
      />
    </ToggleCard>
  );
};

const filterRows = (rows: ToggleRow<CookieSnapshot>[], filter: string): ToggleRow<CookieSnapshot>[] => {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return rows;
  return rows.filter(
    (row) =>
      row.item.name.toLowerCase().includes(normalizedFilter) ||
      row.item.value.toLowerCase().includes(normalizedFilter),
  );
};

interface CookiesImportDialogProps {
  cookies: CookiesController;
  activeTab: ActiveTab;
  notify: Notify;
  onClose: () => void;
}

const CookiesImportDialog = ({
  cookies,
  activeTab,
  notify,
  onClose,
}: CookiesImportDialogProps): ReactElement => (
  <ImportDialog
    viewId="cookies"
    title="Importar cookies"
    description="Acepta el formato de chrome.cookies.getAll y los exports de Cookie-Editor."
    allowAppend={false}
    onClose={onClose}
    onImport={(text) => {
      const parsed = parseCookies(text, activeTab.hostname);
      void cookies.importCookies(parsed).then((imported) => {
        notify(
          `${imported}/${parsed.length} cookies importadas`,
          imported === parsed.length ? "success" : "error",
        );
      });
    }}
  />
);

export const CookiesView = ({ activeTab }: { activeTab: ActiveTab }): ReactElement => {
  const { notify } = useToasts();
  const cookies = useCookies(activeTab);
  const [filter, setFilter] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CookieSnapshot | null>(null);
  const [newCookie, setNewCookie] = useState<CookieSnapshot | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = usePendingImport("cookies");

  const visible = filterRows(cookies.rows, filter);

  return (
    <ViewShell
      title="Cookies"
      subtitle={activeTab.hostname ? `Cookies de ${activeTab.hostname}` : "Abri una pagina http(s)"}
      actions={
        <CookiesHeaderActions
          cookies={cookies}
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
      {hasText(cookies.error) ? <Notice tone="danger">{cookies.error}</Notice> : null}

      {confirmClear ? (
        <ConfirmBar
          message={`Borrar las ${cookies.rows.length} cookies de ${activeTab.hostname} (incluidas las apagadas)?`}
          confirmLabel="Borrar todas"
          onCancel={() => {
            setConfirmClear(false);
          }}
          onConfirm={() => {
            void cookies.removeAll().then(() => {
              notify("Cookies borradas");
            });
            setConfirmClear(false);
          }}
        />
      ) : null}

      <CookieSnapshotsCard cookies={cookies} activeTab={activeTab} notify={notify} />

      <div className="toolbar">
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar por nombre o valor…" />
        <Button
          small
          icon="plus"
          disabled={!activeTab.injectable}
          onClick={() => {
            setNewCookie(blankCookie(activeTab.hostname, activeTab.url.startsWith("https")));
          }}
        >
          Nueva cookie
        </Button>
      </div>

      {newCookie ? (
        <NewCookieCard newCookie={newCookie} cookies={cookies} notify={notify} onChange={setNewCookie} />
      ) : null}

      {visible.length > 0 ? (
        <div className="list">
          {visible.map((row) => (
            <CookieRowCard
              key={row.key}
              row={row}
              expanded={expandedKey === row.key}
              draft={draft}
              cookies={cookies}
              notify={notify}
              onDraftChange={setDraft}
              onExpandedKeyChange={setExpandedKey}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="cookie"
          title={
            cookies.rows.length > 0
              ? "Ninguna cookie coincide con el filtro"
              : "No hay cookies para este dominio"
          }
        />
      )}

      {importing ? (
        <CookiesImportDialog
          cookies={cookies}
          activeTab={activeTab}
          notify={notify}
          onClose={() => {
            setImporting(false);
          }}
        />
      ) : null}
    </ViewShell>
  );
};
