import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/ui/components/Icon';
import { IconButton } from '@/ui/components/primitives';
import type { HeaderEntry } from '@/types';

interface HeaderValueFieldProps {
  entry: HeaderEntry;
  onChange: (entry: HeaderEntry) => void;
}

export const HeaderValueField = ({ entry, onChange }: HeaderValueFieldProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const disabled = entry.operation === 'remove';
  const trimmedValue = entry.value.trim();
  const canStoreValue = trimmedValue.length > 0 && !entry.variants.includes(entry.value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const activate = (index: number) => {
    const chosen = entry.variants[index];
    if (chosen === undefined) return;
    const variants = [...entry.variants];
    variants[index] = entry.value;
    onChange({ ...entry, value: chosen, variants: trimmedValue ? variants : variants.filter((_, position) => position !== index) });
    setOpen(false);
  };

  const removeVariant = (index: number) => {
    onChange({ ...entry, variants: entry.variants.filter((_, position) => position !== index) });
  };

  return (
    <div className="header-value" ref={containerRef}>
      <input
        className="input mono"
        value={entry.value}
        placeholder={disabled ? '(no aplica)' : 'valor'}
        disabled={disabled}
        onChange={(event) => onChange({ ...entry, value: event.target.value })}
      />
      <button
        type="button"
        className="header-value-toggle"
        disabled={disabled}
        data-open={open}
        title={entry.variants.length ? 'Cambiar entre los valores guardados' : 'Guardar varios valores para este header'}
        onClick={() => setOpen((current) => !current)}
      >
        {entry.variants.length ? <span className="header-value-count">{entry.variants.length + 1}</span> : null}
        <Icon name="chevron-down" size={12} />
      </button>

      {open ? (
        <div className="header-value-menu">
          <button type="button" className="header-value-option" data-active="true" onClick={() => setOpen(false)}>
            <Icon name="check" size={12} />
            <span className="mono">{trimmedValue || '(vacio)'}</span>
          </button>
          {entry.variants.map((variant, index) => (
            <div key={`${variant}-${index}`} className="header-value-option-row">
              <button type="button" className="header-value-option" onClick={() => activate(index)}>
                <span className="header-value-bullet" />
                <span className="mono">{variant.trim() || '(vacio)'}</span>
              </button>
              <IconButton icon="trash" title="Borrar este valor" tone="danger" small onClick={() => removeVariant(index)} />
            </div>
          ))}
          <button
            type="button"
            className="header-value-add"
            disabled={!canStoreValue}
            title={canStoreValue ? 'Deja el valor actual guardado para volver a usarlo' : 'Escribi un valor nuevo primero'}
            onClick={() => onChange({ ...entry, variants: [...entry.variants, entry.value] })}
          >
            <Icon name="plus" size={12} />
            Guardar el valor actual
          </button>
        </div>
      ) : null}
    </div>
  );
};
