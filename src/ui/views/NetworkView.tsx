import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { createMockRuleFromEntry } from "@/lib/factories";
import { formatTime, shortUrl } from "@/lib/format";
import { toHar } from "@/lib/har";
import { sendMessage } from "@/lib/messages";
import { toCurl, toFetchSnippet } from "@/lib/request-snippets";
import { Icon } from "@/ui/components/Icon";
import { ViewShell } from "@/ui/components/ViewShell";
import { Badge, Button, Card, EmptyState, Notice, SearchInput, Switch } from "@/ui/components/primitives";
import { useToasts } from "@/ui/hooks/useToasts";
import type { ViewId } from "@/ui/App";
import { NetworkEntryDetail } from "@/ui/views/network/NetworkEntryDetail";
import type { UpdateState } from "@/ui/views/types";
import type { NetworkEntry, ToolkitState } from "@/types";

const POLL_INTERVAL_MS = 1000;
const CLIENT_ERROR_STATUS = 400;
const REDIRECT_STATUS = 300;
const ISO_DATE_LENGTH = 10;
const ROW_RULE_LABEL_LIMIT = 2;

const statusTone = (entry: NetworkEntry): "neutral" | "success" | "warning" | "danger" | "info" => {
  if (entry.phase === "blocked") return "danger";
  if (entry.phase === "mocked") return "info";
  if (entry.phase === "error") return "danger";
  if (entry.statusCode === null) return "neutral";
  if (entry.statusCode >= CLIENT_ERROR_STATUS) return "danger";
  if (entry.statusCode >= REDIRECT_STATUS) return "warning";
  return "success";
};

const statusLabel = (entry: NetworkEntry): string => {
  if (entry.phase === "blocked") return "block";
  if (entry.phase === "mocked") return "mock";
  if (entry.phase === "error") return "error";
  return entry.statusCode === null ? "···" : String(entry.statusCode);
};

const useNetworkEntries = (): [NetworkEntry[], (entries: NetworkEntry[]) => void] => {
  const [entries, setEntries] = useState<NetworkEntry[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      void sendMessage({ type: "network/list" })
        .then((list) => {
          if (active && Array.isArray(list)) setEntries(list);
        })
        .catch(() => undefined);
    };
    refresh();
    const handle = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, []);

  return [entries, setEntries];
};

const filterEntries = (entries: NetworkEntry[], filter: string): NetworkEntry[] => {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return entries;
  return entries.filter(
    (entry) =>
      entry.url.toLowerCase().includes(normalizedFilter) ||
      entry.matchedRuleLabels.some((label) => label.toLowerCase().includes(normalizedFilter)),
  );
};

const copyToClipboard = (value: string, message: string, notify: Notify): void => {
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      notify(message, "success");
    })
    .catch(() => {
      notify("No se pudo copiar al portapapeles", "error");
    });
};

type Notify = ReturnType<typeof useToasts>["notify"];

interface NetworkEntryRowProps {
  entry: NetworkEntry;
  selected: boolean;
  onSelect: () => void;
}

const NetworkEntryRow = ({ entry, selected, onSelect }: NetworkEntryRowProps): ReactElement => (
  <div className="net-row log-row" data-selected={selected} onClick={onSelect}>
    <Badge tone={statusTone(entry)}>{statusLabel(entry)}</Badge>
    <span className="text-muted mono" style={{ fontSize: 10.5 }}>
      {entry.method}
    </span>
    <span className="net-url" title={entry.url}>
      {shortUrl(entry.url)}
    </span>
    <div className="row" style={{ gap: 4 }}>
      {entry.matchedRuleLabels.slice(0, ROW_RULE_LABEL_LIMIT).map((label, index) => (
        <Badge key={`${label}-${index}`} tone="accent">
          {label}
        </Badge>
      ))}
      <span className="text-muted" style={{ fontSize: 10.5 }}>
        {formatTime(entry.startedAt)}
      </span>
    </div>
  </div>
);

const NetworkEmptyState = ({ enabled }: { enabled: boolean }): ReactElement => (
  <EmptyState
    icon="activity"
    title={enabled ? "Todavia no se capturo nada" : "Captura apagada"}
    text={
      enabled
        ? "Recarga la pagina que estas debuggeando y las requests van a aparecer aca."
        : "Prende la captura para ver el trafico y que reglas se aplicaron."
    }
  />
);

interface NetworkViewProps {
  state: ToolkitState;
  update: UpdateState;
  onNavigate: (view: ViewId) => void;
}

export const NetworkView = ({ state, update, onNavigate }: NetworkViewProps): ReactElement => {
  const { notify } = useToasts();
  const [entries, setEntries] = useNetworkEntries();
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = filterEntries(entries, filter);
  const selected = visible.find((entry) => entry.id === selectedId) ?? null;

  const exportHar = (): void => {
    if (visible.length === 0) {
      notify("No hay requests para exportar");
      return;
    }
    const fileName = `bender-${new Date().toISOString().slice(0, ISO_DATE_LENGTH)}.har`;
    downloadJson(fileName, toHar(visible, chrome.runtime.getManifest().version));
    notify("HAR exportado", "success");
  };

  const createMockFrom = (entry: NetworkEntry): void => {
    update((current) => ({
      ...current,
      trafficRules: [...current.trafficRules, createMockRuleFromEntry(entry, current.trafficRules.length)],
    }));
    notify("Mock creado desde la response", "success");
    onNavigate("rules");
  };

  return (
    <ViewShell
      title="Trafico"
      subtitle="Que request salio, con que headers finales y que regla de Bender la toco."
      actions={
        <>
          <Button small icon="download" variant="ghost" onClick={exportHar}>
            HAR
          </Button>
          <Button
            small
            icon="trash"
            variant="ghost"
            onClick={() => {
              void sendMessage({ type: "network/clear" });
              setEntries([]);
            }}
          >
            Limpiar
          </Button>
          <Switch
            checked={state.network.enabled}
            onChange={(enabled) => {
              update((current) => ({ ...current, network: { ...current.network, enabled } }));
            }}
            title="Prender o apagar la captura"
          />
        </>
      }
    >
      {!state.network.enabled ? (
        <Notice tone="warning">
          La captura esta apagada. Prendela con el switch de arriba: mientras esta apagada Bender no escucha
          ningun evento de red, asi que no agrega overhead.
        </Notice>
      ) : null}

      <div className="toolbar">
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar por URL o regla…" />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={state.network.onlyModified}
            onChange={(event) => {
              const onlyModified = event.target.checked;
              update((current) => ({ ...current, network: { ...current.network, onlyModified } }));
            }}
          />
          Solo modificadas
        </label>
      </div>

      <Card flush>
        {visible.length > 0 ? (
          <div>
            {visible.map((entry) => (
              <div key={entry.id}>
                <NetworkEntryRow
                  entry={entry}
                  selected={entry.id === selectedId}
                  onSelect={() => {
                    setSelectedId(entry.id === selectedId ? null : entry.id);
                  }}
                />

                {entry.id === selectedId ? (
                  <NetworkEntryDetail
                    entry={entry}
                    captureBodies={state.network.captureBodies}
                    onCopyCurl={() => {
                      copyToClipboard(toCurl(entry), "cURL copiado", notify);
                    }}
                    onCopyFetch={() => {
                      copyToClipboard(toFetchSnippet(entry), "fetch copiado", notify);
                    }}
                    onCreateMock={() => {
                      createMockFrom(entry);
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <NetworkEmptyState enabled={state.network.enabled} />
        )}
      </Card>

      {selected ? null : (
        <p className="field-hint">
          <Icon name="info" size={11} /> Se guardan las ultimas {state.network.maxEntries} requests en memoria
          de la sesion.
        </p>
      )}
    </ViewShell>
  );
};
