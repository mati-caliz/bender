import { useState } from "react";
import type { ReactElement } from "react";
import { createHeaderEntry } from "@/lib/factories";
import { HeaderValueField } from "@/ui/components/HeaderValueField";
import { Icon } from "@/ui/components/Icon";
import { Button, EmptyState, IconButton, Select, Switch, TextInput } from "@/ui/components/primitives";
import type { HeaderEntry } from "@/types";

export type HeaderDirection = "requestHeaders" | "responseHeaders";
export type MutateHeaders = (mutate: (headers: HeaderEntry[]) => HeaderEntry[]) => void;

const OPERATION_OPTIONS = [
  { value: "set", label: "set" },
  { value: "append", label: "append" },
  { value: "remove", label: "remove" },
];

const isHeaderOperation = (value: string): value is HeaderEntry["operation"] =>
  value === "set" || value === "append" || value === "remove";

const moveHeader = (headers: HeaderEntry[], from: number, to: number): HeaderEntry[] => {
  const next = [...headers];
  const [moved] = next.splice(from, 1);
  if (!moved) return headers;
  next.splice(to > from ? to - 1 : to, 0, moved);
  return next;
};

const insertDisabledCopy = (headers: HeaderEntry[], index: number, header: HeaderEntry): HeaderEntry[] => {
  const next = [...headers];
  next.splice(
    index + 1,
    0,
    createHeaderEntry({
      name: header.name,
      value: header.value,
      variants: [...header.variants],
      operation: header.operation,
      comment: header.comment,
      enabled: false,
    }),
  );
  return next;
};

interface DragState {
  dragIndex: number | null;
  dropIndex: number | null;
  setDragIndex: (index: number | null) => void;
  setDropIndex: (index: number | null) => void;
}

interface HeaderRowProps {
  header: HeaderEntry;
  index: number;
  drag: DragState;
  mutateHeaders: MutateHeaders;
}

const HeaderRow = ({ header, index, drag, mutateHeaders }: HeaderRowProps): ReactElement => {
  const replaceHeader = (updated: HeaderEntry): void => {
    mutateHeaders((current) => current.map((entry) => (entry.id === header.id ? updated : entry)));
  };
  const patchHeader = (patch: Partial<HeaderEntry>): void => {
    mutateHeaders((current) =>
      current.map((entry) => (entry.id === header.id ? { ...entry, ...patch } : entry)),
    );
  };
  const endDrag = (): void => {
    drag.setDragIndex(null);
    drag.setDropIndex(null);
  };
  return (
    <div
      className="header-row"
      data-enabled={header.enabled}
      data-dragging={drag.dragIndex === index}
      data-drop={drag.dropIndex === index && drag.dragIndex !== index}
      draggable
      onDragStart={() => {
        drag.setDragIndex(index);
      }}
      onDragEnd={endDrag}
      onDragOver={(event) => {
        event.preventDefault();
        drag.setDropIndex(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const from = drag.dragIndex;
        if (from !== null && from !== index) {
          mutateHeaders((current) => moveHeader(current, from, index));
        }
        endDrag();
      }}
    >
      <span className="drag-handle" title="Arrastrar para reordenar">
        <Icon name="grip" size={13} />
      </span>
      <Switch
        small
        checked={header.enabled}
        onChange={(enabled) => {
          patchHeader({ enabled });
        }}
        title="Prender o apagar este header"
      />
      <TextInput
        value={header.name}
        mono
        placeholder="X-Mi-Header"
        onChange={(name) => {
          patchHeader({ name });
        }}
      />
      <HeaderValueField entry={header} onChange={replaceHeader} />
      <Select
        value={header.operation}
        options={OPERATION_OPTIONS}
        title="set reemplaza, append suma otro valor, remove lo saca"
        onChange={(operation) => {
          if (!isHeaderOperation(operation)) return;
          patchHeader({ operation });
        }}
      />
      <div className="row" style={{ gap: 2 }}>
        <IconButton
          icon="copy"
          title="Duplicar (la copia queda apagada)"
          small
          onClick={() => {
            mutateHeaders((current) => insertDisabledCopy(current, index, header));
          }}
        />
        <IconButton
          icon="trash"
          title="Eliminar header"
          tone="danger"
          small
          onClick={() => {
            mutateHeaders((current) => current.filter((entry) => entry.id !== header.id));
          }}
        />
      </div>
    </div>
  );
};

interface HeaderTableProps {
  headers: HeaderEntry[];
  direction: HeaderDirection;
  mutateHeaders: MutateHeaders;
}

export const HeaderTable = ({ headers, direction, mutateHeaders }: HeaderTableProps): ReactElement => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const drag: DragState = { dragIndex, dropIndex, setDragIndex, setDropIndex };

  return (
    <div className="header-table">
      <div className="table-head">
        <span />
        <span />
        <span>Header</span>
        <span>Valor</span>
        <span>Operacion</span>
        <span />
      </div>

      {headers.map((header, index) => (
        <HeaderRow key={header.id} header={header} index={index} drag={drag} mutateHeaders={mutateHeaders} />
      ))}

      {headers.length === 0 ? (
        <EmptyState
          icon="layers"
          title={direction === "requestHeaders" ? "Sin headers de request" : "Sin headers de response"}
          text="Agregá uno para empezar a modificar el trafico."
        />
      ) : null}

      <div style={{ padding: 8 }}>
        <Button
          small
          icon="plus"
          onClick={() => {
            mutateHeaders((current) => [...current, createHeaderEntry()]);
          }}
        >
          Agregar header
        </Button>
      </div>
    </div>
  );
};
