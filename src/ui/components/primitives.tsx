import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '@/ui/components/Icon';

const COPY_FEEDBACK_MS = 1200;

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  small?: boolean;
}

export const Switch = ({ checked, onChange, title, small }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    data-on={checked}
    className={small ? 'switch small' : 'switch'}
    onClick={(event) => {
      event.stopPropagation();
      onChange(!checked);
    }}
  />
);

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  title?: string;
}

export const Button = ({ children, onClick, variant = 'default', icon, small, disabled, title }: ButtonProps) => (
  <button
    type="button"
    className={`btn${variant === 'default' ? '' : ` ${variant}`}${small ? ' small' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {icon ? <Icon name={icon} size={small ? 12 : 14} /> : null}
    {children}
  </button>
);

interface IconButtonProps {
  icon: IconName;
  title: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  small?: boolean;
  disabled?: boolean;
}

export const IconButton = ({ icon, title, onClick, tone = 'default', small, disabled }: IconButtonProps) => (
  <button
    type="button"
    className={`icon-btn${tone === 'danger' ? ' danger' : ''}${small ? ' small' : ''}`}
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <Icon name={icon} size={small ? 12 : 14} />
  </button>
);

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export const Field = ({ label, hint, children }: FieldProps) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  title?: string;
  type?: 'text' | 'number' | 'datetime-local' | 'color';
}

export const TextInput = ({ value, onChange, placeholder, mono, disabled, title, type = 'text' }: TextInputProps) => (
  <input
    className={`input${mono ? ' mono' : ''}`}
    type={type}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    title={title}
    onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
  />
);

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  rows?: number;
}

export const TextArea = ({ value, onChange, placeholder, mono, rows = 4 }: TextAreaProps) => (
  <textarea
    className={`textarea${mono ? ' mono' : ''}`}
    value={value}
    rows={rows}
    placeholder={placeholder}
    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
  />
);

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  title?: string;
}

export const Select = ({ value, onChange, options, disabled, title }: SelectProps) => (
  <select
    className="select"
    value={value}
    disabled={disabled}
    title={title}
    onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

export const Card = ({ title, subtitle, actions, children, flush }: CardProps) => (
  <section className="card">
    {title ? (
      <header className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="view-actions">{actions}</div> : null}
      </header>
    ) : null}
    <div className={flush ? 'card-body flush' : 'card-body'}>{children}</div>
  </section>
);

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const Badge = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={tone === 'neutral' ? 'badge' : `badge ${tone}`}>{children}</span>
);

export const Notice = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => (
  <div className={tone === 'neutral' ? 'notice' : `notice ${tone}`}>
    {tone === 'danger' || tone === 'warning' ? <Icon name="alert" size={14} /> : <Icon name="info" size={14} />}
    <div>{children}</div>
  </div>
);

interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, text, action }: EmptyStateProps) => (
  <div className="empty">
    <div className="empty-icon">
      <Icon name={icon} size={20} />
    </div>
    <div className="empty-title">{title}</div>
    {text ? <div className="empty-text">{text}</div> : null}
    {action}
  </div>
);

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const SearchInput = ({ value, onChange, placeholder }: SearchInputProps) => (
  <div className="search">
    <Icon name="search" size={13} />
    <input
      className="input"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

export const CopyButton = ({ value, title = 'Copiar' }: { value: string; title?: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const handle = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(handle);
  }, [copied]);

  return (
    <IconButton
      icon={copied ? 'check' : 'copy'}
      title={copied ? 'Copiado' : title}
      small
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    />
  );
};

interface SegmentedProps<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: Array<{ value: TValue; label: string }>;
}

export const Segmented = <TValue extends string>({ value, onChange, options }: SegmentedProps<TValue>) => (
  <div className="segmented">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="chip">
    {label}
    <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`}>
      <Icon name="x" size={10} />
    </button>
  </span>
);

export const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {hint ? <span className="stat-hint">{hint}</span> : null}
  </div>
);

interface ConfirmBarProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'danger' | 'primary';
}

export const ConfirmBar = ({ message, confirmLabel, onConfirm, onCancel, tone = 'danger' }: ConfirmBarProps) => (
  <div className="confirm-bar">
    <Icon name="alert" size={14} />
    <span>{message}</span>
    <div className="spacer" />
    <Button small variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
      {confirmLabel}
    </Button>
    <Button small variant="ghost" onClick={onCancel}>
      Cancelar
    </Button>
  </div>
);

interface DialogProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export const Dialog = ({ title, children, footer, onClose }: DialogProps) => (
  <div
    className="dialog-backdrop"
    role="presentation"
    onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="dialog" role="dialog" aria-label={title}>
      <header className="dialog-header">
        <span>{title}</span>
        <div className="spacer" />
        <IconButton icon="x" title="Cerrar" onClick={onClose} />
      </header>
      <div className="dialog-body">{children}</div>
      {footer ? <footer className="dialog-footer">{footer}</footer> : null}
    </div>
  </div>
);
