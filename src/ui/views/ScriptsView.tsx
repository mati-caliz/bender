import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { createUserScript } from "@/lib/factories";
import { sendMessage } from "@/lib/messages";
import { SCRIPT_TEMPLATES, type ScriptTemplate } from "@/lib/script-templates";
import type { ScriptError } from "@/lib/script-errors";
import { Icon } from "@/ui/components/Icon";
import { ViewShell } from "@/ui/components/ViewShell";
import { Badge, Button, Card, EmptyState, IconButton, Notice, Switch } from "@/ui/components/primitives";
import { hasText } from "@/ui/components/render-guards";
import { useToasts } from "@/ui/hooks/useToasts";
import { ScriptForm, type MutateBoundScript } from "@/ui/views/scripts/ScriptForm";
import { patternForHostname } from "@/ui/views/scripts/script-patterns";
import type { ViewProps } from "@/ui/views/types";
import type { UserScript, UserScriptsStatus } from "@/types";

const ERROR_POLL_INTERVAL_MS = 2000;

const useScriptErrors = (): [ScriptError[], (errors: ScriptError[]) => void] => {
  const [errors, setErrors] = useState<ScriptError[]>([]);

  // Los errores llegan cuando la pagina corre el script, no cuando se registra.
  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      void sendMessage({ type: "scripts/errors" })
        .then((list) => {
          if (active && Array.isArray(list)) setErrors(list);
        })
        .catch(() => undefined);
    };
    refresh();
    const handle = window.setInterval(refresh, ERROR_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, []);

  return [errors, setErrors];
};

const StatusNotices = ({ status }: { status: UserScriptsStatus | null }): ReactElement => (
  <>
    {status && !status.supported ? (
      <Notice tone="danger">
        Chrome no expone <code>chrome.userScripts</code>. Entra a <code>chrome://extensions</code>, activa el
        modo desarrollador y recarga Bender.
      </Notice>
    ) : null}
    {hasText(status?.error) ? <Notice tone="warning">{status.error}</Notice> : null}
  </>
);

const TemplatesCard = ({ onPick }: { onPick: (template: ScriptTemplate) => void }): ReactElement => (
  <Card title="Plantillas" subtitle="Arranca de una base y ajustala.">
    <div className="row wrap">
      {SCRIPT_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className="btn small"
          title={template.description}
          onClick={() => {
            onPick(template);
          }}
        >
          <Icon name={template.language === "css" ? "sparkles" : "code"} size={12} />
          {template.label}
        </button>
      ))}
    </div>
  </Card>
);

interface ScriptHeadProps {
  script: UserScript;
  expanded: boolean;
  hasRuntimeError: boolean;
  mutateScript: MutateBoundScript;
  onToggleExpanded: () => void;
  onDelete: () => void;
}

const ScriptHead = ({
  script,
  expanded,
  hasRuntimeError,
  mutateScript,
  onToggleExpanded,
  onDelete,
}: ScriptHeadProps): ReactElement => (
  <div className="item-head" onClick={onToggleExpanded}>
    <Switch
      small
      checked={script.enabled}
      onChange={(enabled) => {
        mutateScript((current) => ({ ...current, enabled }));
      }}
      title="Prender o apagar este script"
    />
    <Badge tone={script.language === "css" ? "accent" : "info"}>
      {script.language === "css" ? "CSS" : "JS"}
    </Badge>
    <span className="item-name">{script.name}</span>
    <span className="item-preview">{script.matches.join(", ") || "sin patrones — no se ejecuta"}</span>
    {hasRuntimeError ? (
      <span title="Reventó al ejecutarse. Abrilo para ver el detalle.">
        <Badge tone="danger">error</Badge>
      </span>
    ) : null}
    <IconButton icon="trash" title="Eliminar script" tone="danger" small onClick={onDelete} />
    <Icon name={expanded ? "chevron-down" : "chevron-right"} size={13} />
  </div>
);

export const ScriptsView = ({ state, update, activeTab }: ViewProps): ReactElement => {
  const { notify } = useToasts();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patternDraft, setPatternDraft] = useState("");
  const [status, setStatus] = useState<UserScriptsStatus | null>(null);
  const [errors, setErrors] = useScriptErrors();

  useEffect(() => {
    void sendMessage({ type: "userscripts/sync" })
      .then(setStatus)
      .catch(() => undefined);
  }, [state.userScripts]);

  const errorFor = (scriptId: string): ScriptError | undefined =>
    errors.find((error) => error.scriptId === scriptId);

  const mutateScript = (id: string, mutate: (script: UserScript) => UserScript): void => {
    update((current) => ({
      ...current,
      userScripts: current.userScripts.map((script) =>
        script.id === id ? { ...mutate(script), updatedAt: Date.now() } : script,
      ),
    }));
  };

  const addFromTemplate = (template: ScriptTemplate): void => {
    update((current) => {
      const script = createUserScript(template.language, current.userScripts.length, {
        name: template.label,
        description: template.description,
        code: template.code,
        runAt: template.runAt,
        world: template.world,
        matches: activeTab.hostname ? [patternForHostname(activeTab.hostname)] : [],
      });
      setExpandedId(script.id);
      return { ...current, userScripts: [...current.userScripts, script] };
    });
  };

  return (
    <ViewShell
      title="Scripts"
      subtitle="JavaScript y CSS propios por sitio, como Tampermonkey pero adentro de Bender."
      actions={
        <Button
          small
          icon="refresh"
          variant="ghost"
          onClick={() => {
            void sendMessage({ type: "userscripts/sync" }).then((next) => {
              setStatus(next);
              notify(
                `${next.registeredCount} script(s) registrados`,
                hasText(next.error) ? "error" : "success",
              );
            });
          }}
        >
          Re-registrar
        </Button>
      }
    >
      <StatusNotices status={status} />

      <TemplatesCard onPick={addFromTemplate} />

      {state.userScripts.length === 0 ? (
        <EmptyState
          icon="code"
          title="Todavia no hay scripts"
          text="Los scripts corren en las paginas que matcheen su patron. El CSS se inyecta al cargar cada pagina."
        />
      ) : null}

      <div className="list">
        {state.userScripts.map((script) => {
          const expanded = expandedId === script.id;
          const bindMutate: MutateBoundScript = (mutate) => {
            mutateScript(script.id, mutate);
          };
          return (
            <div key={script.id} className="item-card" data-expanded={expanded} data-off={!script.enabled}>
              <ScriptHead
                script={script}
                expanded={expanded}
                hasRuntimeError={errorFor(script.id) !== undefined}
                mutateScript={bindMutate}
                onToggleExpanded={() => {
                  setExpandedId(expanded ? null : script.id);
                }}
                onDelete={() => {
                  update((current) => ({
                    ...current,
                    userScripts: current.userScripts.filter((candidate) => candidate.id !== script.id),
                  }));
                }}
              />

              {expanded ? (
                <ScriptForm
                  script={script}
                  hostname={activeTab.hostname}
                  runtimeError={errorFor(script.id)}
                  patternDraft={patternDraft}
                  onPatternDraftChange={setPatternDraft}
                  mutateScript={bindMutate}
                  onInvalidPattern={() => {
                    notify("Patron invalido: usa https://dominio.com/*", "error");
                  }}
                  onDismissErrors={() => {
                    void sendMessage({ type: "scripts/errors-clear" });
                    setErrors([]);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {state.userScripts.length > 0 ? (
        <p className="field-hint">
          Los cambios se registran solos. El CSS se aplica al recargar la pagina; el JavaScript, en la proxima
          carga que matchee.
        </p>
      ) : null}
    </ViewShell>
  );
};
