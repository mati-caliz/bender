import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ScriptError } from "@/lib/script-errors";
import {
  describeHeader,
  headerHasData,
  parseUserScriptHeader,
  type UserScriptHeader,
} from "@/lib/userscript-header";
import { Button, Notice } from "@/ui/components/primitives";

/** Lo que reventó al ejecutarse, que es distinto de que falle el registro. */
export const RuntimeErrorNotice = ({
  error,
  onDismiss,
}: {
  error: ScriptError | undefined;
  onDismiss: () => void;
}): ReactElement | null => {
  if (!error) return null;

  return (
    <Notice tone="danger">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", minWidth: 0 }}>
        <div className="row wrap">
          <strong>Reventó al ejecutarse</strong>
          <span className="text-small text-muted">línea {error.line}</span>
          <div className="spacer" />
          <Button small variant="ghost" onClick={onDismiss}>
            Limpiar
          </Button>
        </div>
        <code className="text-small" style={{ wordBreak: "break-word" }}>
          {error.message}
        </code>
        <span className="text-small text-muted truncate" title={error.tabUrl}>
          en {error.tabUrl}
        </span>
      </div>
    </Notice>
  );
};

/**
 * Al pegar un script de Tampermonkey, ofrece cargar lo que dice su header en vez
 * de obligar a copiar los patrones a mano. Se aplica solo si el usuario acepta:
 * el header puede traer patrones mas amplios de los que quiere.
 */
export const HeaderImportNotice = ({
  code,
  onApply,
}: {
  code: string;
  onApply: (header: UserScriptHeader) => void;
}): ReactElement | null => {
  const [dismissed, setDismissed] = useState(false);
  const header = useMemo(() => parseUserScriptHeader(code), [code]);

  if (dismissed || !headerHasData(header)) return null;

  return (
    <Notice tone="info">
      <div className="row wrap" style={{ width: "100%" }}>
        <span className="truncate">Este script trae header de Tampermonkey: {describeHeader(header)}.</span>
        <div className="spacer" />
        <Button
          small
          onClick={() => {
            onApply(header);
            setDismissed(true);
          }}
        >
          Aplicar
        </Button>
        <Button
          small
          variant="ghost"
          onClick={() => {
            setDismissed(true);
          }}
        >
          Ignorar
        </Button>
      </div>
    </Notice>
  );
};
