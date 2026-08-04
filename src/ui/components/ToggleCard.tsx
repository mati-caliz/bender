import type { ReactNode } from 'react';
import { Icon } from '@/ui/components/Icon';
import { Badge, CopyButton, Switch } from '@/ui/components/primitives';

interface ToggleCardProps {
  name: string;
  preview: string;
  off: boolean;
  reappeared: boolean;
  expanded: boolean;
  reappearedTitle: string;
  onToggle: (enabled: boolean) => void;
  onExpand: () => void;
  children?: ReactNode;
}

export const ToggleCard = ({
  name,
  preview,
  off,
  reappeared,
  expanded,
  reappearedTitle,
  onToggle,
  onExpand,
  children,
}: ToggleCardProps) => (
  <div className="item-card" data-off={off} data-expanded={expanded}>
    <div className="item-head" onClick={onExpand}>
      <Switch small checked={!off} onChange={onToggle} title={off ? 'Restaurar' : 'Apagar'} />
      <span className="item-name" title={name}>
        {name}
      </span>
      {reappeared ? (
        <span title={reappearedTitle}>
          <Badge tone="warning">reaparecio</Badge>
        </span>
      ) : null}
      <span className="item-preview">{preview}</span>
      <CopyButton value={preview} title="Copiar valor" />
      <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={13} />
    </div>
    {expanded ? <div className="item-form">{children}</div> : null}
  </div>
);
