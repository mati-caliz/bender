import { useEffect, useRef, useState, type ReactElement } from "react";
import { Icon } from "@/ui/components/Icon";
import { IconButton } from "@/ui/components/primitives";
import type { HeaderEntry } from "@/types";

interface HeaderValueFieldProps {
  entry: HeaderEntry;
  onChange: (entry: HeaderEntry) => void;
}

interface VariantRowProps {
  variant: string;
  onActivate: () => void;
  onRemove: () => void;
}

const VariantRow = ({ variant, onActivate, onRemove }: VariantRowProps): ReactElement => (
  <div className="header-value-option-row">
    <button type="button" className="header-value-option" onClick={onActivate}>
      <span className="header-value-bullet" />
      <span className="mono">{variant.trim() || "(vacio)"}</span>
    </button>
    <IconButton icon="trash" title="Borrar este valor" tone="danger" small onClick={onRemove} />
  </div>
);

export const HeaderValueField = ({ entry, onChange }: HeaderValueFieldProps): ReactElement => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const disabled = entry.operation === "remove";
  const trimmedValue = entry.value.trim();
  const canStoreValue = trimmedValue.length > 0 && !entry.variants.includes(entry.value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent): void => {
      const target = event.target;
      const clickedInside = target instanceof Node && containerRef.current?.contains(target) === true;
      if (!clickedInside) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const activate = (index: number): void => {
    const chosen = entry.variants[index];
    if (chosen === undefined) return;
    const variants = [...entry.variants];
    variants[index] = entry.value;
    onChange({
      ...entry,
      value: chosen,
      variants: trimmedValue !== "" ? variants : variants.filter((_, position) => position !== index),
    });
    setOpen(false);
  };

  const removeVariant = (index: number): void => {
    onChange({ ...entry, variants: entry.variants.filter((_, position) => position !== index) });
  };

  return (
    <div className="header-value" ref={containerRef}>
      <input
        className="input mono"
        value={entry.value}
        placeholder={disabled ? "(no aplica)" : "valor"}
        disabled={disabled}
        onChange={(event) => {
          onChange({ ...entry, value: event.target.value });
        }}
      />
      <button
        type="button"
        className="header-value-toggle"
        disabled={disabled}
        data-open={open}
        title={
          entry.variants.length > 0
            ? "Cambiar entre los valores guardados"
            : "Guardar varios valores para este header"
        }
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {entry.variants.length > 0 ? (
          <span className="header-value-count">{entry.variants.length + 1}</span>
        ) : null}
        <Icon name="chevron-down" size={12} />
      </button>

      {open ? (
        <div className="header-value-menu">
          <button
            type="button"
            className="header-value-option"
            data-active="true"
            onClick={() => {
              setOpen(false);
            }}
          >
            <Icon name="check" size={12} />
            <span className="mono">{trimmedValue || "(vacio)"}</span>
          </button>
          {entry.variants.map((variant, index) => (
            <VariantRow
              key={`${variant}-${index}`}
              variant={variant}
              onActivate={() => {
                activate(index);
              }}
              onRemove={() => {
                removeVariant(index);
              }}
            />
          ))}
          <button
            type="button"
            className="header-value-add"
            disabled={!canStoreValue}
            title={
              canStoreValue
                ? "Deja el valor actual guardado para volver a usarlo"
                : "Escribi un valor nuevo primero"
            }
            onClick={() => {
              onChange({ ...entry, variants: [...entry.variants, entry.value] });
            }}
          >
            <Icon name="plus" size={12} />
            Guardar el valor actual
          </button>
        </div>
      ) : null}
    </div>
  );
};
