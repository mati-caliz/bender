import { useMemo, useState } from 'react';
import { branchPaths, isBranch, type JsonNode } from '@/lib/json-tree';
import { Icon } from '@/ui/components/Icon';
import { Button, CopyButton } from '@/ui/components/primitives';

/** Cuantos niveles quedan abiertos al entrar, para no tapar la pantalla con un JSON grande. */
const DEFAULT_OPEN_DEPTH = 2;

const pathsUpToDepth = (node: JsonNode, depth: number): string[] => {
  if (!isBranch(node.kind) || depth <= 0) return [];
  return [node.path, ...node.children.flatMap((child) => pathsUpToDepth(child, depth - 1))];
};

interface RowProps {
  node: JsonNode;
  depth: number;
  open: Set<string>;
  onToggle: (path: string) => void;
}

const JsonRow = ({ node, depth, open, onToggle }: RowProps) => {
  const branch = isBranch(node.kind);
  const expanded = branch && open.has(node.path);

  return (
    <>
      <div className="json-row" style={{ paddingLeft: 8 + depth * 12 }}>
        {branch ? (
          <button
            type="button"
            className="json-caret"
            aria-expanded={expanded}
            aria-label={expanded ? `Plegar ${node.label || 'raiz'}` : `Desplegar ${node.label || 'raiz'}`}
            onClick={() => onToggle(node.path)}
          >
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={12} />
          </button>
        ) : (
          <span className="json-caret" />
        )}

        {node.label ? <span className="json-key">{node.label}</span> : null}
        <span className={`json-value json-${node.kind}`}>{node.preview}</span>

        {node.raw !== null ? <CopyButton value={node.raw} title={`Copiar ${node.label || 'valor'}`} /> : null}
      </div>

      {expanded
        ? node.children.map((child) => (
            <JsonRow key={child.path} node={child} depth={depth + 1} open={open} onToggle={onToggle} />
          ))
        : null}
    </>
  );
};

export const JsonTree = ({ root }: { root: JsonNode }) => {
  const [open, setOpen] = useState<Set<string>>(() => new Set(pathsUpToDepth(root, DEFAULT_OPEN_DEPTH)));
  const allBranches = useMemo(() => branchPaths(root), [root]);
  const allOpen = open.size >= allBranches.length;

  const toggle = (path: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="json-tree">
      <div className="json-tree-toolbar">
        <Button
          small
          variant="ghost"
          icon={allOpen ? 'chevron-right' : 'chevron-down'}
          onClick={() => setOpen(allOpen ? new Set() : new Set(allBranches))}
        >
          {allOpen ? 'Plegar todo' : 'Desplegar todo'}
        </Button>
      </div>
      <div className="json-tree-body">
        <JsonRow node={root} depth={0} open={open} onToggle={toggle} />
      </div>
    </div>
  );
};
