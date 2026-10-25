import type { ReactElement } from "react";
import { formatDuration, prettyJson } from "@/lib/format";
import { Badge, Button } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import type { NetworkEntry } from "@/types";

const BODY_PREVIEW_LIMIT = 4000;

const HeaderTable = ({ headers }: { headers: { name: string; value: string }[] }): ReactElement =>
  headers.length > 0 ? (
    <div className="kv-table">
      {headers.map((header, index) => (
        <div key={`${header.name}-${index}`} style={{ display: "contents" }}>
          <span className="kv-key">{header.name}</span>
          <span className="kv-value">{header.value}</span>
        </div>
      ))}
    </div>
  ) : (
    <span className="field-hint">Sin datos capturados.</span>
  );

const BodyBlock = ({
  label,
  body,
  truncated,
}: {
  label: string;
  body: string;
  truncated: boolean;
}): ReactElement => (
  <div>
    <div className="field-label">
      {label}
      {truncated ? <span className="text-muted"> · truncado</span> : null}
    </div>
    <pre className="code-block">{prettyJson(body).slice(0, BODY_PREVIEW_LIMIT)}</pre>
  </div>
);

const hasFinished = (finishedAt: number | null): finishedAt is number =>
  finishedAt !== null && finishedAt !== 0;

const EntryBadges = ({ entry }: { entry: NetworkEntry }): ReactElement => (
  <div className="row wrap">
    <Badge>{entry.resourceType}</Badge>
    {entry.fromCache ? <Badge tone="info">cache</Badge> : null}
    {hasFinished(entry.finishedAt) ? (
      <Badge>{formatDuration(entry.finishedAt - entry.startedAt)}</Badge>
    ) : null}
    {hasText(entry.error) ? <Badge tone="danger">{entry.error}</Badge> : null}
  </div>
);

const MatchedRules = ({ labels }: { labels: string[] }): ReactElement | null =>
  labels.length > 0 ? (
    <div>
      <div className="field-label">Reglas aplicadas</div>
      <div className="row wrap">
        {labels.map((label, index) => (
          <Badge key={`${label}-${index}`} tone="accent">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  ) : null;

const EntryBodies = ({
  entry,
  captureBodies,
}: {
  entry: NetworkEntry;
  captureBodies: boolean;
}): ReactElement => (
  <>
    {hasText(entry.requestBody) ? (
      <BodyBlock label="Cuerpo enviado" body={entry.requestBody} truncated={entry.bodyTruncated} />
    ) : null}

    {hasText(entry.responseBody) ? (
      <BodyBlock label="Cuerpo recibido" body={entry.responseBody} truncated={entry.bodyTruncated} />
    ) : null}

    {captureBodies || entry.source === "mock" ? null : (
      <span className="field-hint">
        Los cuerpos no se estan capturando: prendelo en Ajustes para verlos aca.
      </span>
    )}
  </>
);

interface NetworkEntryDetailProps {
  entry: NetworkEntry;
  captureBodies: boolean;
  onCopyCurl: () => void;
  onCopyFetch: () => void;
  onCreateMock: () => void;
}

export const NetworkEntryDetail = ({
  entry,
  captureBodies,
  onCopyCurl,
  onCopyFetch,
  onCreateMock,
}: NetworkEntryDetailProps): ReactElement => (
  <div className="net-detail">
    <EntryBadges entry={entry} />
    <div className="kv-value">{entry.url}</div>

    <MatchedRules labels={entry.matchedRuleLabels} />

    <div>
      <div className="field-label">Headers enviados</div>
      <HeaderTable headers={entry.requestHeaders} />
    </div>

    <div>
      <div className="field-label">Headers recibidos</div>
      <HeaderTable headers={entry.responseHeaders} />
    </div>

    <EntryBodies entry={entry} captureBodies={captureBodies} />

    <div className="row wrap">
      <Button small icon="copy" onClick={onCopyCurl}>
        Copiar cURL
      </Button>
      <Button small icon="copy" variant="ghost" onClick={onCopyFetch}>
        Copiar fetch
      </Button>
      <Button small variant="ghost" icon="plus" onClick={onCreateMock}>
        Convertir en mock
      </Button>
    </div>
  </div>
);
