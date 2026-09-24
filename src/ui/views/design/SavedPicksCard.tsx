import type { ReactElement } from "react";
import { formatDateTime } from "@/lib/format";
import { Icon } from "@/ui/components/Icon";
import { Button, Card, CopyButton, EmptyState, IconButton } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import type { DesignPick } from "@/types";

const PICK_ICONS: Record<DesignPick["kind"], "eye" | "droplet" | "ruler"> = {
  color: "droplet",
  element: "eye",
  measure: "ruler",
};

const PickRow = ({ pick, onRemove }: { pick: DesignPick; onRemove: () => void }): ReactElement => (
  <div className="token-row">
    {hasText(pick.color) ? (
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
    <IconButton icon="trash" title="Borrar" tone="danger" small onClick={onRemove} />
  </div>
);

interface SavedPicksCardProps {
  picks: DesignPick[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const SavedPicksCard = ({ picks, onRemove, onClear }: SavedPicksCardProps): ReactElement => (
  <Card
    title="Guardados"
    subtitle="colores, elementos y mediciones que capturaste desde la pagina"
    actions={
      picks.length > 0 ? (
        <Button small variant="ghost" icon="trash" onClick={onClear}>
          Limpiar
        </Button>
      ) : null
    }
  >
    {picks.length > 0 ? (
      <div className="list">
        {picks.map((pick) => (
          <PickRow
            key={pick.id}
            pick={pick}
            onRemove={() => {
              onRemove(pick.id);
            }}
          />
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
);
