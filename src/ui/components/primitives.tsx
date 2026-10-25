import { useEffect, useState, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { Icon, type IconName } from "@/ui/components/Icon";
import { hasRenderableNode, hasText, joinClassNames } from "@/ui/components/render-guards";

const COPY_FEEDBACK_MS = 1200;
const SMALL_ICON_SIZE = 12;
const REGULAR_ICON_SIZE = 14;
const NOTICE_ICON_SIZE = 14;
const EMPTY_STATE_ICON_SIZE = 20;
const SEARCH_ICON_SIZE = 13;
const CHIP_ICON_SIZE = 10;

const iconSizeFor = (small: boolean | undefined): number =>
  small === true ? SMALL_ICON_SIZE : REGULAR_ICON_SIZE;

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  small?: boolean;
}

export const Switch = ({ checked, onChange, title, small }: SwitchProps): ReactElement => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    data-on={checked}
    className={small === true ? "switch small" : "switch"}
    onClick={(event) => {
      event.stopPropagation();
      onChange(!checked);
    }}
  />
);

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  title?: string;
}

export const Button = ({
  children,
  onClick,
  variant = "default",
  icon,
  small,
  disabled,
  title,
}: ButtonProps): ReactElement => (
  <button
    type="button"
    className={joinClassNames("btn", variant !== "default" && variant, small === true && "small")}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {icon === undefined ? null : <Icon name={icon} size={iconSizeFor(small)} />}
    {children}
  </button>
);

interface IconButtonProps {
  icon: IconName;
  title: string;
  onClick: () => void;
  tone?: "default" | "danger";
  small?: boolean;
  disabled?: boolean;
}

export const IconButton = ({
  icon,
  title,
  onClick,
  tone = "default",
  small,
  disabled,
}: IconButtonProps): ReactElement => (
  <button
    type="button"
    className={joinClassNames("icon-btn", tone === "danger" && "danger", small === true && "small")}
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <Icon name={icon} size={iconSizeFor(small)} />
  </button>
);

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export const Field = ({ label, hint, children }: FieldProps): ReactElement => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hasText(hint) ? <span className="field-hint">{hint}</span> : null}
  </label>
);

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  title?: string;
  type?: "text" | "number" | "datetime-local" | "color";
}

export const TextInput = ({
  value,
  onChange,
  placeholder,
  mono,
  disabled,
  title,
  type = "text",
}: TextInputProps): ReactElement => (
  <input
    className={joinClassNames("input", mono === true && "mono")}
    type={type}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    title={title}
    onChange={(event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    }}
  />
);

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  rows?: number;
}

export const TextArea = ({ value, onChange, placeholder, mono, rows = 4 }: TextAreaProps): ReactElement => (
  <textarea
    className={joinClassNames("textarea", mono === true && "mono")}
    value={value}
    rows={rows}
    placeholder={placeholder}
    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    }}
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

export const Select = ({ value, onChange, options, disabled, title }: SelectProps): ReactElement => (
  <select
    className="select"
    value={value}
    disabled={disabled}
    title={title}
    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
      onChange(event.target.value);
    }}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

interface CardProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

export const Card = ({ title, subtitle, actions, children, flush }: CardProps): ReactElement => (
  <section className="card">
    {hasText(title) ? (
      <header className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {hasText(subtitle) ? <div className="card-subtitle">{subtitle}</div> : null}
        </div>
        {hasRenderableNode(actions) ? <div className="view-actions">{actions}</div> : null}
      </header>
    ) : null}
    <div className={flush === true ? "card-body flush" : "card-body"}>{children}</div>
  </section>
);

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export const Badge = ({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }): ReactElement => (
  <span className={tone === "neutral" ? "badge" : `badge ${tone}`}>{children}</span>
);

export const Notice = ({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}): ReactElement => (
  <div className={tone === "neutral" ? "notice" : `notice ${tone}`}>
    {tone === "danger" || tone === "warning" ? (
      <Icon name="alert" size={NOTICE_ICON_SIZE} />
    ) : (
      <Icon name="info" size={NOTICE_ICON_SIZE} />
    )}
    <div>{children}</div>
  </div>
);

interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, text, action }: EmptyStateProps): ReactElement => (
  <div className="empty">
    <div className="empty-icon">
      <Icon name={icon} size={EMPTY_STATE_ICON_SIZE} />
    </div>
    <div className="empty-title">{title}</div>
    {hasText(text) ? <div className="empty-text">{text}</div> : null}
    {action}
  </div>
);

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const SearchInput = ({ value, onChange, placeholder }: SearchInputProps): ReactElement => (
  <div className="search">
    <Icon name="search" size={SEARCH_ICON_SIZE} />
    <input
      className="input"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </div>
);

export const CopyButton = ({ value, title = "Copiar" }: { value: string; title?: string }): ReactElement => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const handle = window.setTimeout(() => {
      setCopied(false);
    }, COPY_FEEDBACK_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [copied]);

  return (
    <IconButton
      icon={copied ? "check" : "copy"}
      title={copied ? "Copiado" : title}
      small
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
        });
      }}
    />
  );
};

interface SegmentedProps<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: { value: TValue; label: string }[];
}

export const Segmented = <TValue extends string>({
  value,
  onChange,
  options,
}: SegmentedProps<TValue>): ReactElement => (
  <div className="segmented">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => {
          onChange(option.value);
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }): ReactElement => (
  <span className="chip">
    {label}
    <button type="button" onClick={onRemove} aria-label={`Quitar ${label}`}>
      <Icon name="x" size={CHIP_ICON_SIZE} />
    </button>
  </span>
);

export const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactElement => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {hasText(hint) ? <span className="stat-hint">{hint}</span> : null}
  </div>
);

interface ConfirmBarProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "danger" | "primary";
}

export const ConfirmBar = ({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = "danger",
}: ConfirmBarProps): ReactElement => (
  <div className="confirm-bar">
    <Icon name="alert" size={NOTICE_ICON_SIZE} />
    <span>{message}</span>
    <div className="spacer" />
    <Button small variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
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

export const Dialog = ({ title, children, footer, onClose }: DialogProps): ReactElement => (
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
      {hasRenderableNode(footer) ? <footer className="dialog-footer">{footer}</footer> : null}
    </div>
  </div>
);
