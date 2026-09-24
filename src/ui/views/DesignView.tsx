import type { ReactElement } from "react";
import { downloadJson } from "@/lib/download";
import { ViewShell } from "@/ui/components/ViewShell";
import { Button, Card, Notice, Segmented } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import { useDesignInspector, type DesignInspectorController } from "@/ui/hooks/useDesignInspector";
import { useDesignPicks } from "@/ui/hooks/useDesignPicks";
import { useToasts } from "@/ui/hooks/useToasts";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { ContrastCard } from "@/ui/views/design/ContrastCard";
import {
  PaletteCard,
  SpacingAndShapeCards,
  TypographyCard,
  VariablesCard,
} from "@/ui/views/design/DesignTokenCards";
import { SavedPicksCard } from "@/ui/views/design/SavedPicksCard";
import { useDesignViewState } from "@/ui/views/design/useDesignViewState";
import type { DesignTool } from "@/types";

const TOOL_OPTIONS: { value: DesignTool; label: string }[] = [
  { value: "inspect", label: "Inspector" },
  { value: "ruler", label: "Regla" },
  { value: "spacing", label: "Espaciado" },
];

const TOOL_HINTS: Record<DesignTool, string> = {
  inspect:
    "Pasá el mouse por la pagina para ver el box model. Click congela el elemento y copia su selector.",
  ruler: "Arrastrá sobre la pagina para medir cualquier distancia, con guias en todo el viewport.",
  spacing: "Click fija un elemento base y al pasar por otro te muestra el gap horizontal y vertical.",
};

interface InspectorCardProps {
  inspector: DesignInspectorController;
  activeTab: ActiveTab;
  tool: DesignTool;
  onToolChange: (tool: DesignTool) => void;
}

const InspectorCard = ({ inspector, activeTab, tool, onToolChange }: InspectorCardProps): ReactElement => (
  <Card
    title="Inspector en la pagina"
    subtitle={inspector.overlay.active ? "Activo · Esc en la pagina lo cierra" : "Inactivo"}
    actions={
      inspector.overlay.active ? (
        <Button small variant="danger" icon="x" onClick={() => void inspector.close()}>
          Desactivar
        </Button>
      ) : null
    }
  >
    <div className="toolbar">
      <Segmented value={tool} options={TOOL_OPTIONS} onChange={onToolChange} />
      <Button
        variant="primary"
        icon="crosshair"
        disabled={!activeTab.injectable}
        onClick={() => void inspector.activate(tool)}
      >
        {inspector.overlay.active ? "Cambiar herramienta" : "Activar"}
      </Button>
    </div>
    <p className="view-subtitle">{TOOL_HINTS[tool]}</p>
    <p className="view-subtitle">
      En la pagina tenés una barra flotante con el cuentagotas (guarda el color y lo copia) y el boton de
      guardar. Las teclas 1, 2 y 3 cambian de herramienta.
    </p>
  </Card>
);

interface DesignHeaderActionsProps {
  inspector: DesignInspectorController;
  activeTab: ActiveTab;
  onExported: () => void;
}

const DesignHeaderActions = ({
  inspector,
  activeTab,
  onExported,
}: DesignHeaderActionsProps): ReactElement => {
  const audit = inspector.audit;
  return (
    <>
      <Button small icon="refresh" variant="ghost" onClick={inspector.runAudit} disabled={inspector.loading}>
        {inspector.loading ? "Analizando…" : "Reanalizar"}
      </Button>
      <Button
        small
        icon="download"
        disabled={!audit}
        onClick={() => {
          if (!audit) return;
          downloadJson(`tokens-${activeTab.hostname || "pagina"}.json`, audit);
          onExported();
        }}
      >
        Exportar tokens
      </Button>
    </>
  );
};

export const DesignView = ({ activeTab }: { activeTab: ActiveTab }): ReactElement => {
  const { notify } = useToasts();
  const inspector = useDesignInspector(activeTab);
  const { picks, remove, clear } = useDesignPicks();
  const audit = inspector.audit;
  const { tool, setTool, foreground, setForeground, background, setBackground } = useDesignViewState(
    inspector.overlay,
    audit,
  );

  const copyValue = (value: string, message: string): void => {
    void navigator.clipboard.writeText(value).then(() => {
      notify(message, "success");
    });
  };

  return (
    <ViewShell
      title="Diseño"
      subtitle={
        audit
          ? `${activeTab.hostname} · ${audit.elementCount} elementos · raiz ${audit.rootFontSize}px`
          : "Inspector visual, regla y tokens de la pagina"
      }
      actions={
        <DesignHeaderActions
          inspector={inspector}
          activeTab={activeTab}
          onExported={() => {
            notify("Tokens exportados", "success");
          }}
        />
      }
    >
      {hasText(inspector.error) ? <Notice tone="danger">{inspector.error}</Notice> : null}

      <InspectorCard inspector={inspector} activeTab={activeTab} tool={tool} onToolChange={setTool} />

      <PaletteCard audit={audit} onCopy={copyValue} />

      <ContrastCard
        foreground={foreground}
        background={background}
        onForegroundChange={setForeground}
        onBackgroundChange={setBackground}
      />

      <SpacingAndShapeCards audit={audit} />

      <TypographyCard audit={audit} />

      <VariablesCard audit={audit} />

      <SavedPicksCard picks={picks} onRemove={remove} onClear={clear} />
    </ViewShell>
  );
};
