import { useEffect, useMemo, useState } from 'react';
import { contrastRatio, isLightColor, parseCssColor, toHslString, toRgbString } from '@/lib/color';
import { downloadJson } from '@/lib/download';
import { formatDateTime } from '@/lib/format';
import { Icon } from '@/ui/components/Icon';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Field,
  IconButton,
  Notice,
  Segmented,
  TextInput,
} from '@/ui/components/primitives';
import { useDesignInspector } from '@/ui/hooks/useDesignInspector';
import { useDesignPicks } from '@/ui/hooks/useDesignPicks';
import { useToasts } from '@/ui/hooks/useToasts';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { ColorUsage, DesignPick, DesignTool, ValueUsage } from '@/types';

const AA_NORMAL_RATIO = 4.5;
const AA_LARGE_RATIO = 3;
const AAA_NORMAL_RATIO = 7;
const CONTRAST_DECIMALS = 2;
const DEFAULT_FOREGROUND = '#111827';
const DEFAULT_BACKGROUND = '#ffffff';
const MAX_VISIBLE_TOKENS = 24;

const TOOL_OPTIONS: Array<{ value: DesignTool; label: string }> = [
  { value: 'inspect', label: 'Inspector' },
  { value: 'ruler', label: 'Regla' },
  { value: 'spacing', label: 'Espaciado' },
];

const TOOL_HINTS: Record<DesignTool, string> = {
  inspect: 'Pasá el mouse por la pagina para ver el box model. Click congela el elemento y copia su selector.',
  ruler: 'Arrastrá sobre la pagina para medir cualquier distancia, con guias en todo el viewport.',
  spacing: 'Click fija un elemento base y al pasar por otro te muestra el gap horizontal y vertical.',
};

const ROLE_LABELS: Record<ColorUsage['roles'][number], string> = {
  text: 'texto',
  background: 'fondo',
  border: 'borde',
};

const PICK_ICONS: Record<DesignPick['kind'], 'eye' | 'droplet' | 'ruler'> = {
  color: 'droplet',
  element: 'eye',
  measure: 'ruler',
};

const sortedNumericValues = (usages: ValueUsage[]): ValueUsage[] =>
  [...usages].sort((left, right) => Number.parseFloat(left.value) - Number.parseFloat(right.value));

interface SwatchProps {
  hex: string;
  caption: string;
  onSelect: () => void;
  title: string;
}

const Swatch = ({ hex, caption, onSelect, title }: SwatchProps) => {
  const parsed = parseCssColor(hex);
  return (
    <button type="button" className="swatch-tile" onClick={onSelect} title={title}>
      <span className="swatch-color" style={{ background: hex }} data-light={parsed ? isLightColor(parsed) : false} />
      <span className="swatch-hex mono">{hex}</span>
      <span className="swatch-caption">{caption}</span>
    </button>
  );
};

const TokenList = ({ usages, unit }: { usages: ValueUsage[]; unit?: string }) => (
  <div className="token-grid">
    {usages.slice(0, MAX_VISIBLE_TOKENS).map((usage) => (
      <span key={usage.value} className="token-chip mono" title={`${usage.count} usos`}>
        {usage.value}
        {unit ? <span className="token-unit">{unit}</span> : null}
        <span className="token-count">{usage.count}</span>
      </span>
    ))}
  </div>
);

export const DesignView = ({ activeTab }: { activeTab: ActiveTab }) => {
  const { notify } = useToasts();
  const inspector = useDesignInspector(activeTab);
  const { picks, remove, clear } = useDesignPicks();
  const [tool, setTool] = useState<DesignTool>('inspect');
  const [foreground, setForeground] = useState(DEFAULT_FOREGROUND);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);

  useEffect(() => {
    if (inspector.overlay.active) setTool(inspector.overlay.tool);
  }, [inspector.overlay.active, inspector.overlay.tool]);

  const audit = inspector.audit;

  useEffect(() => {
    if (!audit) return;
    const textColor = audit.colors.find((color) => color.roles.includes('text'));
    const backgroundColor = audit.colors.find((color) => color.roles.includes('background'));
    if (textColor) setForeground(textColor.hex);
    if (backgroundColor) setBackground(backgroundColor.hex);
  }, [audit]);

  const foregroundColor = useMemo(() => parseCssColor(foreground), [foreground]);
  const backgroundColor = useMemo(() => parseCssColor(background), [background]);
  const contrast =
    foregroundColor && backgroundColor ? contrastRatio(foregroundColor, backgroundColor) : null;

  const copyValue = (value: string, message: string) => {
    void navigator.clipboard.writeText(value).then(() => notify(message, 'success'));
  };

  return (
    <ViewShell
      title="Diseño"
      subtitle={
        audit
          ? `${activeTab.hostname} · ${audit.elementCount} elementos · raiz ${audit.rootFontSize}px`
          : 'Inspector visual, regla y tokens de la pagina'
      }
      actions={
        <>
          <Button small icon="refresh" variant="ghost" onClick={inspector.runAudit} disabled={inspector.loading}>
            {inspector.loading ? 'Analizando…' : 'Reanalizar'}
          </Button>
          <Button
            small
            icon="download"
            disabled={!audit}
            onClick={() => {
              if (!audit) return;
              downloadJson(`tokens-${activeTab.hostname || 'pagina'}.json`, audit);
              notify('Tokens exportados', 'success');
            }}
          >
            Exportar tokens
          </Button>
        </>
      }
    >
      {inspector.error ? <Notice tone="danger">{inspector.error}</Notice> : null}

      <Card
        title="Inspector en la pagina"
        subtitle={inspector.overlay.active ? 'Activo · Esc en la pagina lo cierra' : 'Inactivo'}
        actions={
          inspector.overlay.active ? (
            <Button small variant="danger" icon="x" onClick={() => void inspector.close()}>
              Desactivar
            </Button>
          ) : null
        }
      >
        <div className="toolbar">
          <Segmented value={tool} options={TOOL_OPTIONS} onChange={setTool} />
          <Button
            variant="primary"
            icon="crosshair"
            disabled={!activeTab.injectable}
            onClick={() => void inspector.activate(tool)}
          >
            {inspector.overlay.active ? 'Cambiar herramienta' : 'Activar'}
          </Button>
        </div>
        <p className="view-subtitle">{TOOL_HINTS[tool]}</p>
        <p className="view-subtitle">
          En la pagina tenés una barra flotante con el cuentagotas (guarda el color y lo copia) y el boton de guardar.
          Las teclas 1, 2 y 3 cambian de herramienta.
        </p>
      </Card>

      <Card title="Paleta de la pagina" subtitle={audit ? `${audit.colors.length} colores detectados` : undefined}>
        {audit && audit.colors.length ? (
          <div className="swatch-grid">
            {audit.colors.map((color) => (
              <Swatch
                key={color.hex}
                hex={color.hex}
                caption={`${color.roles.map((role) => ROLE_LABELS[role]).join(' · ')} · ${color.count}`}
                title="Click para copiar el hex"
                onSelect={() => copyValue(color.hex, `${color.hex} copiado`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="droplet" title="Sin colores" text="Analiza una pagina http(s) para ver su paleta." />
        )}
      </Card>

      <Card title="Contraste" subtitle="WCAG 2.1 sobre dos colores de la paleta">
        <div className="grid-2">
          <Field label="Texto">
            <div className="row">
              <TextInput value={foreground} mono onChange={setForeground} />
              <TextInput value={foreground} type="color" onChange={setForeground} />
            </div>
          </Field>
          <Field label="Fondo">
            <div className="row">
              <TextInput value={background} mono onChange={setBackground} />
              <TextInput value={background} type="color" onChange={setBackground} />
            </div>
          </Field>
        </div>

        <div className="contrast-preview" style={{ background, color: foreground }}>
          <span className="contrast-sample">Texto de ejemplo 16px</span>
          <span className="contrast-sample large">Titulo 24px</span>
        </div>

        <div className="row wrap">
          <Badge tone={contrast && contrast >= AA_NORMAL_RATIO ? 'success' : 'danger'}>
            {contrast ? `${contrast.toFixed(CONTRAST_DECIMALS)}:1` : 'color invalido'}
          </Badge>
          <Badge tone={contrast && contrast >= AA_LARGE_RATIO ? 'success' : 'warning'}>AA grande</Badge>
          <Badge tone={contrast && contrast >= AA_NORMAL_RATIO ? 'success' : 'warning'}>AA normal</Badge>
          <Badge tone={contrast && contrast >= AAA_NORMAL_RATIO ? 'success' : 'warning'}>AAA normal</Badge>
          <div className="spacer" />
          {foregroundColor ? (
            <>
              <CopyButton value={toRgbString(foregroundColor)} title="Copiar rgb del texto" />
              <CopyButton value={toHslString(foregroundColor)} title="Copiar hsl del texto" />
            </>
          ) : null}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Espaciados" subtitle="paddings, margins y gaps mas usados">
          {audit && audit.spacings.length ? (
            <TokenList usages={sortedNumericValues(audit.spacings)} />
          ) : (
            <EmptyState icon="ruler" title="Sin espaciados" />
          )}
        </Card>

        <Card title="Radios y sombras">
          {audit && (audit.radii.length || audit.shadows.length) ? (
            <>
              <TokenList usages={sortedNumericValues(audit.radii)} />
              <div className="token-grid">
                {audit.shadows.slice(0, MAX_VISIBLE_TOKENS).map((shadow) => (
                  <span key={shadow.value} className="token-chip mono" title={`${shadow.count} usos`}>
                    {shadow.value}
                    <span className="token-count">{shadow.count}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="layers" title="Sin radios ni sombras" />
          )}
        </Card>
      </div>

      <Card title="Tipografia">
        {audit && audit.fonts.length ? (
          <div className="list">
            {audit.fonts.map((font) => (
              <div key={font.family} className="font-row">
                <div>
                  <div className="font-name" style={{ fontFamily: font.family }}>
                    {font.family.split(',')[0]?.replace(/["']/g, '')}
                  </div>
                  <div className="font-meta mono">
                    {font.sizes.map((size) => `${size}px`).join(' · ')} — pesos {font.weights.join(' · ')}
                  </div>
                </div>
                <div className="spacer" />
                <Badge>{font.count}</Badge>
                <CopyButton value={font.family} title="Copiar font-family" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="type" title="Sin tipografias detectadas" />
        )}
      </Card>

      <Card title="Variables CSS" subtitle={audit ? `${audit.variables.length} tokens en :root` : undefined}>
        {audit && audit.variables.length ? (
          <div className="list">
            {audit.variables.map((variable) => {
              const parsed = parseCssColor(variable.value);
              return (
                <div key={variable.name} className="token-row">
                  {parsed ? <span className="swatch-dot" style={{ background: variable.value }} /> : null}
                  <span className="mono token-name">{variable.name}</span>
                  <span className="mono token-value">{variable.value}</span>
                  <div className="spacer" />
                  <CopyButton value={`var(${variable.name})`} title="Copiar var()" />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="code" title="Sin variables en :root" text="Puede que la pagina use hojas de estilo cross-origin." />
        )}
      </Card>

      <Card
        title="Guardados"
        subtitle="colores, elementos y mediciones que capturaste desde la pagina"
        actions={
          picks.length ? (
            <Button small variant="ghost" icon="trash" onClick={clear}>
              Limpiar
            </Button>
          ) : null
        }
      >
        {picks.length ? (
          <div className="list">
            {picks.map((pick) => (
              <div key={pick.id} className="token-row">
                {pick.color ? (
                  <span className="swatch-dot" style={{ background: pick.color }} />
                ) : (
                  <Icon name={PICK_ICONS[pick.kind]} size={14} />
                )}
                <div className="pick-body">
                  <span className="mono token-name">{pick.label}</span>
                  <span className="pick-detail">{pick.detail}</span>
                  <span className="pick-detail">{`${pick.origin} · ${formatDateTime(pick.createdAt)}`}</span>
                </div>
                <div className="spacer" />
                <CopyButton value={pick.color ?? pick.label} />
                <IconButton icon="trash" title="Borrar" tone="danger" small onClick={() => remove(pick.id)} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="droplet"
            title="Nada guardado todavia"
            text="Usá el cuentagotas o el boton Guardar de la barra flotante mientras inspeccionás."
          />
        )}
      </Card>
    </ViewShell>
  );
};
