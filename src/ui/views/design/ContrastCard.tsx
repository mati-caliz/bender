import { useMemo } from "react";
import type { ReactElement } from "react";
import { contrastRatio, parseCssColor, toHslString, toRgbString } from "@/lib/color";
import { Badge, Card, CopyButton, Field, TextInput } from "@/ui/components/primitives";

const AA_NORMAL_RATIO = 4.5;
const AA_LARGE_RATIO = 3;
const AAA_NORMAL_RATIO = 7;
const CONTRAST_DECIMALS = 2;

const meets = (contrast: number | null, ratio: number): boolean => contrast !== null && contrast >= ratio;

interface ContrastCardProps {
  foreground: string;
  background: string;
  onForegroundChange: (color: string) => void;
  onBackgroundChange: (color: string) => void;
}

export const ContrastCard = ({
  foreground,
  background,
  onForegroundChange,
  onBackgroundChange,
}: ContrastCardProps): ReactElement => {
  const foregroundColor = useMemo(() => parseCssColor(foreground), [foreground]);
  const backgroundColor = useMemo(() => parseCssColor(background), [background]);
  const contrast =
    foregroundColor && backgroundColor ? contrastRatio(foregroundColor, backgroundColor) : null;

  return (
    <Card title="Contraste" subtitle="WCAG 2.1 sobre dos colores de la paleta">
      <div className="grid-2">
        <Field label="Texto">
          <div className="row">
            <TextInput value={foreground} mono onChange={onForegroundChange} />
            <TextInput value={foreground} type="color" onChange={onForegroundChange} />
          </div>
        </Field>
        <Field label="Fondo">
          <div className="row">
            <TextInput value={background} mono onChange={onBackgroundChange} />
            <TextInput value={background} type="color" onChange={onBackgroundChange} />
          </div>
        </Field>
      </div>

      <div className="contrast-preview" style={{ background, color: foreground }}>
        <span className="contrast-sample">Texto de ejemplo 16px</span>
        <span className="contrast-sample large">Titulo 24px</span>
      </div>

      <div className="row wrap">
        <Badge tone={meets(contrast, AA_NORMAL_RATIO) ? "success" : "danger"}>
          {contrast === null ? "color invalido" : `${contrast.toFixed(CONTRAST_DECIMALS)}:1`}
        </Badge>
        <Badge tone={meets(contrast, AA_LARGE_RATIO) ? "success" : "warning"}>AA grande</Badge>
        <Badge tone={meets(contrast, AA_NORMAL_RATIO) ? "success" : "warning"}>AA normal</Badge>
        <Badge tone={meets(contrast, AAA_NORMAL_RATIO) ? "success" : "warning"}>AAA normal</Badge>
        <div className="spacer" />
        {foregroundColor ? (
          <>
            <CopyButton value={toRgbString(foregroundColor)} title="Copiar rgb del texto" />
            <CopyButton value={toHslString(foregroundColor)} title="Copiar hsl del texto" />
          </>
        ) : null}
      </div>
    </Card>
  );
};
