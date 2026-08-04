import { useEffect, useState } from 'react';
import { formatDuration, formatTime, shortUrl } from '@/lib/format';
import { sendMessage } from '@/lib/messages';
import { Icon } from '@/ui/components/Icon';
import { ViewShell } from '@/ui/components/ViewShell';
import { Badge, Button, Card, EmptyState, Notice, SearchInput, Switch } from '@/ui/components/primitives';
import type { UpdateState } from '@/ui/views/types';
import type { NetworkEntry, ToolkitState } from '@/types';

const POLL_INTERVAL_MS = 1000;
const CLIENT_ERROR_STATUS = 400;
const REDIRECT_STATUS = 300;

const statusTone = (entry: NetworkEntry): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  if (entry.phase === 'blocked') return 'danger';
  if (entry.phase === 'mocked') return 'info';
  if (entry.phase === 'error') return 'danger';
  if (entry.statusCode === null) return 'neutral';
  if (entry.statusCode >= CLIENT_ERROR_STATUS) return 'danger';
  if (entry.statusCode >= REDIRECT_STATUS) return 'warning';
  return 'success';
};

const statusLabel = (entry: NetworkEntry): string => {
  if (entry.phase === 'blocked') return 'block';
  if (entry.phase === 'mocked') return 'mock';
  if (entry.phase === 'error') return 'error';
  return entry.statusCode === null ? '···' : String(entry.statusCode);
};

const HeaderTable = ({ headers }: { headers: Array<{ name: string; value: string }> }) =>
  headers.length ? (
    <div className="kv-table">
      {headers.map((header, index) => (
        <div key={`${header.name}-${index}`} style={{ display: 'contents' }}>
          <span className="kv-key">{header.name}</span>
          <span className="kv-value">{header.value}</span>
        </div>
      ))}
    </div>
  ) : (
    <span className="field-hint">Sin datos capturados.</span>
  );

interface NetworkViewProps {
  state: ToolkitState;
  update: UpdateState;
}

export const NetworkView = ({ state, update }: NetworkViewProps) => {
  const [entries, setEntries] = useState<NetworkEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void sendMessage({ type: 'network/list' })
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

  const normalizedFilter = filter.trim().toLowerCase();
  const visible = normalizedFilter
    ? entries.filter(
        (entry) =>
          entry.url.toLowerCase().includes(normalizedFilter) ||
          entry.matchedRuleLabels.some((label) => label.toLowerCase().includes(normalizedFilter))
      )
    : entries;

  const selected = visible.find((entry) => entry.id === selectedId) ?? null;

  return (
    <ViewShell
      title="Trafico"
      subtitle="Que request salio, con que headers finales y que regla de Bender la toco."
      actions={
        <>
          <Button
            small
            icon="trash"
            variant="ghost"
            onClick={() => {
              void sendMessage({ type: 'network/clear' });
              setEntries([]);
            }}
          >
            Limpiar
          </Button>
          <Switch
            checked={state.network.enabled}
            onChange={(enabled) => update((current) => ({ ...current, network: { ...current.network, enabled } }))}
            title="Prender o apagar la captura"
          />
        </>
      }
    >
      {!state.network.enabled ? (
        <Notice tone="warning">
          La captura esta apagada. Prendela con el switch de arriba: mientras esta apagada Bender no escucha ningun
          evento de red, asi que no agrega overhead.
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
        {visible.length ? (
          <div>
            {visible.map((entry) => (
              <div key={entry.id}>
                <div
                  className="net-row"
                  data-selected={entry.id === selectedId}
                  onClick={() => setSelectedId(entry.id === selectedId ? null : entry.id)}
                >
                  <Badge tone={statusTone(entry)}>{statusLabel(entry)}</Badge>
                  <span className="text-muted mono" style={{ fontSize: 10.5 }}>
                    {entry.method}
                  </span>
                  <span className="net-url" title={entry.url}>
                    {shortUrl(entry.url)}
                  </span>
                  <div className="row" style={{ gap: 4 }}>
                    {entry.matchedRuleLabels.slice(0, 2).map((label, index) => (
                      <Badge key={`${label}-${index}`} tone="accent">
                        {label}
                      </Badge>
                    ))}
                    <span className="text-muted" style={{ fontSize: 10.5 }}>
                      {formatTime(entry.startedAt)}
                    </span>
                  </div>
                </div>

                {entry.id === selectedId ? (
                  <div className="net-detail">
                    <div className="row wrap">
                      <Badge>{entry.resourceType}</Badge>
                      {entry.fromCache ? <Badge tone="info">cache</Badge> : null}
                      {entry.finishedAt ? <Badge>{formatDuration(entry.finishedAt - entry.startedAt)}</Badge> : null}
                      {entry.error ? <Badge tone="danger">{entry.error}</Badge> : null}
                    </div>
                    <div className="kv-value">{entry.url}</div>

                    {entry.matchedRuleLabels.length ? (
                      <div>
                        <div className="field-label">Reglas aplicadas</div>
                        <div className="row wrap">
                          {entry.matchedRuleLabels.map((label, index) => (
                            <Badge key={`${label}-${index}`} tone="accent">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="field-label">Headers enviados</div>
                      <HeaderTable headers={entry.requestHeaders} />
                    </div>

                    <div>
                      <div className="field-label">Headers recibidos</div>
                      <HeaderTable headers={entry.responseHeaders} />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="activity"
            title={state.network.enabled ? 'Todavia no se capturo nada' : 'Captura apagada'}
            text={
              state.network.enabled
                ? 'Recarga la pagina que estas debuggeando y las requests van a aparecer aca.'
                : 'Prende la captura para ver el trafico y que reglas se aplicaron.'
            }
          />
        )}
      </Card>

      {selected ? null : (
        <p className="field-hint">
          <Icon name="info" size={11} /> Se guardan las ultimas {state.network.maxEntries} requests en memoria de la
          sesion.
        </p>
      )}
    </ViewShell>
  );
};
