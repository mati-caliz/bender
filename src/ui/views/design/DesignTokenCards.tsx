import type { ReactElement } from "react";
import { isLightColor, parseCssColor } from "@/lib/color";
import { Badge, Card, CopyButton, EmptyState } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import type { ColorUsage, DesignAudit, ValueUsage } from "@/types";

const MAX_VISIBLE_TOKENS = 24;

const ROLE_LABELS: Record<ColorUsage["roles"][number], string> = {
  text: "texto",
  background: "fondo",
  border: "borde",
};

const QUOTE_CHARACTERS = /["']/g;

const sortedNumericValues = (usages: ValueUsage[]): ValueUsage[] =>
  [...usages].sort((left, right) => Number.parseFloat(left.value) - Number.parseFloat(right.value));

interface SwatchProps {
  hex: string;
  caption: string;
  onSelect: () => void;
  title: string;
}

const Swatch = ({ hex, caption, onSelect, title }: SwatchProps): ReactElement => {
  const parsed = parseCssColor(hex);
  return (
    <button type="button" className="swatch-tile" onClick={onSelect} title={title}>
      <span
        className="swatch-color"
        style={{ background: hex }}
        data-light={parsed ? isLightColor(parsed) : false}
      />
      <span className="swatch-hex mono">{hex}</span>
      <span className="swatch-caption">{caption}</span>
    </button>
  );
};

const TokenList = ({ usages, unit }: { usages: ValueUsage[]; unit?: string }): ReactElement => (
  <div className="token-grid">
    {usages.slice(0, MAX_VISIBLE_TOKENS).map((usage) => (
      <span key={usage.value} className="token-chip mono" title={`${usage.count} usos`}>
        {usage.value}
        {hasText(unit) ? <span className="token-unit">{unit}</span> : null}
        <span className="token-count">{usage.count}</span>
      </span>
    ))}
  </div>
);

interface PaletteCardProps {
  audit: DesignAudit | null;
  onCopy: (value: string, message: string) => void;
}

export const PaletteCard = ({ audit, onCopy }: PaletteCardProps): ReactElement => {
  const colors = audit?.colors ?? [];
  return (
    <Card
      title="Paleta de la pagina"
      {...(audit ? { subtitle: `${audit.colors.length} colores detectados` } : {})}
    >
      {colors.length > 0 ? (
        <div className="swatch-grid">
          {colors.map((color) => (
            <Swatch
              key={color.hex}
              hex={color.hex}
              caption={`${color.roles.map((role) => ROLE_LABELS[role]).join(" · ")} · ${color.count}`}
              title="Click para copiar el hex"
              onSelect={() => {
                onCopy(color.hex, `${color.hex} copiado`);
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="droplet"
          title="Sin colores"
          text="Analiza una pagina http(s) para ver su paleta."
        />
      )}
    </Card>
  );
};

const RadiiAndShadows = ({ audit }: { audit: DesignAudit }): ReactElement => (
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
);

const hasShapeTokens = (audit: DesignAudit | null): audit is DesignAudit =>
  audit !== null && (audit.radii.length > 0 || audit.shadows.length > 0);

export const SpacingAndShapeCards = ({ audit }: { audit: DesignAudit | null }): ReactElement => (
  <div className="grid-2">
    <Card title="Espaciados" subtitle="paddings, margins y gaps mas usados">
      {audit !== null && audit.spacings.length > 0 ? (
        <TokenList usages={sortedNumericValues(audit.spacings)} />
      ) : (
        <EmptyState icon="ruler" title="Sin espaciados" />
      )}
    </Card>

    <Card title="Radios y sombras">
      {hasShapeTokens(audit) ? (
        <RadiiAndShadows audit={audit} />
      ) : (
        <EmptyState icon="layers" title="Sin radios ni sombras" />
      )}
    </Card>
  </div>
);

export const TypographyCard = ({ audit }: { audit: DesignAudit | null }): ReactElement => {
  const fonts = audit?.fonts ?? [];
  return (
    <Card title="Tipografia">
      {fonts.length > 0 ? (
        <div className="list">
          {fonts.map((font) => (
            <div key={font.family} className="font-row">
              <div>
                <div className="font-name" style={{ fontFamily: font.family }}>
                  {font.family.split(",")[0]?.replace(QUOTE_CHARACTERS, "")}
                </div>
                <div className="font-meta mono">
                  {font.sizes.map((size) => `${size}px`).join(" · ")} — pesos {font.weights.join(" · ")}
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
  );
};

export const VariablesCard = ({ audit }: { audit: DesignAudit | null }): ReactElement => {
  const variables = audit?.variables ?? [];
  return (
    <Card title="Variables CSS" {...(audit ? { subtitle: `${audit.variables.length} tokens en :root` } : {})}>
      {variables.length > 0 ? (
        <div className="list">
          {variables.map((variable) => (
            <div key={variable.name} className="token-row">
              {parseCssColor(variable.value) ? (
                <span className="swatch-dot" style={{ background: variable.value }} />
              ) : null}
              <span className="mono token-name">{variable.name}</span>
              <span className="mono token-value">{variable.value}</span>
              <div className="spacer" />
              <CopyButton value={`var(${variable.name})`} title="Copiar var()" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="code"
          title="Sin variables en :root"
          text="Puede que la pagina use hojas de estilo cross-origin."
        />
      )}
    </Card>
  );
};
