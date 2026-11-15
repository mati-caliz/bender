import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { formatBytes, prettyJson } from "@/lib/format";
import { parseJsonTree } from "@/lib/json-tree";
import { JsonTree } from "@/ui/components/JsonTree";
import { JwtPanel } from "@/ui/components/JwtPanel";
import { Button, Field, Segmented, TextArea, TextInput } from "@/ui/components/primitives";
import type { StoredItem } from "@/types";

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

export const ItemForm = ({
  draft,
  onChange,
  onSave,
  onDelete,
  onCancel,
  isNew,
}: ItemFormProps): ReactElement => {
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
