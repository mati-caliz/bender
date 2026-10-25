import type { ReactElement } from "react";
import type { ScriptError } from "@/lib/script-errors";
import type { UserScriptHeader } from "@/lib/userscript-header";
import { CodeEditor } from "@/ui/components/CodeEditor";
import { Icon } from "@/ui/components/Icon";
import { Field, Select, TextInput } from "@/ui/components/primitives";
import { HeaderImportNotice, RuntimeErrorNotice } from "@/ui/views/scripts/ScriptNotices";
import { ScriptPatternsField } from "@/ui/views/scripts/ScriptPatternsField";
import type { UserScript, UserScriptRunAt, UserScriptWorld } from "@/types";

const RUN_AT_OPTIONS = [
  { value: "document_start", label: "Al empezar a cargar" },
  { value: "document_end", label: "Con el DOM listo" },
  { value: "document_idle", label: "Cuando termina de cargar" },
];

const WORLD_OPTIONS = [
  { value: "MAIN", label: "Mundo de la pagina" },
  { value: "USER_SCRIPT", label: "Mundo aislado" },
];

const CODE_EDITOR_MIN_HEIGHT = 200;

const isRunAt = (value: string): value is UserScriptRunAt =>
  value === "document_start" || value === "document_end" || value === "document_idle";

const isWorld = (value: string): value is UserScriptWorld => value === "MAIN" || value === "USER_SCRIPT";

export type MutateBoundScript = (mutate: (script: UserScript) => UserScript) => void;

const applyHeader = (current: UserScript, header: UserScriptHeader): UserScript => ({
  ...current,
  name: header.name ?? current.name,
  description: header.description ?? current.description,
  // Se suman a lo que ya haya, sin repetir, para no pisar lo que el usuario cargo a mano.
  matches: [...new Set([...current.matches, ...header.matches])],
  excludeMatches: [...new Set([...current.excludeMatches, ...header.excludeMatches])],
  runAt: header.runAt ?? current.runAt,
});

const ScriptExecutionFields = ({
  script,
  mutateScript,
}: {
  script: UserScript;
  mutateScript: MutateBoundScript;
}): ReactElement => (
  <div className="grid-3">
    <Field label="Momento">
      <Select
        value={script.runAt}
        options={RUN_AT_OPTIONS}
        onChange={(value) => {
          if (isRunAt(value)) mutateScript((current) => ({ ...current, runAt: value }));
        }}
      />
    </Field>
    <Field label="Contexto" hint="El mundo de la pagina ve sus variables globales.">
      <Select
        value={script.world}
        options={WORLD_OPTIONS}
        disabled={script.language === "css"}
        onChange={(value) => {
          if (isWorld(value)) mutateScript((current) => ({ ...current, world: value }));
        }}
      />
    </Field>
    <div className="field" style={{ justifyContent: "flex-end" }}>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={script.allFrames}
          onChange={(event) => {
            const allFrames = event.target.checked;
            mutateScript((current) => ({ ...current, allFrames }));
          }}
        />
        Tambien en iframes
      </label>
    </div>
  </div>
);

const ScriptCodeField = ({
  script,
  mutateScript,
}: {
  script: UserScript;
  mutateScript: MutateBoundScript;
}): ReactElement => {
  const isCss = script.language === "css";
  return (
    <Field label={isCss ? "CSS" : "JavaScript"}>
      <CodeEditor
        value={script.code}
        language={isCss ? "css" : "javascript"}
        minHeight={CODE_EDITOR_MIN_HEIGHT}
        onChange={(code) => {
          mutateScript((current) => ({ ...current, code }));
        }}
        toolbar={
          <>
            <Icon name="code" size={12} />
            <span>{isCss ? "hoja de estilos" : "modulo clasico"}</span>
            <div className="spacer" />
            <span>{script.code.split("\n").length} lineas</span>
          </>
        }
      />
    </Field>
  );
};

interface ScriptFormProps {
  script: UserScript;
  hostname: string;
  runtimeError: ScriptError | undefined;
  patternDraft: string;
  onPatternDraftChange: (draft: string) => void;
  mutateScript: MutateBoundScript;
  onInvalidPattern: () => void;
  onDismissErrors: () => void;
}

export const ScriptForm = ({
  script,
  hostname,
  runtimeError,
  patternDraft,
  onPatternDraftChange,
  mutateScript,
  onInvalidPattern,
  onDismissErrors,
}: ScriptFormProps): ReactElement => (
  <div className="item-form">
    <div className="grid-2">
      <Field label="Nombre">
        <TextInput
          value={script.name}
          onChange={(name) => {
            mutateScript((current) => ({ ...current, name }));
          }}
        />
      </Field>
      <Field label="Descripcion">
        <TextInput
          value={script.description}
          onChange={(description) => {
            mutateScript((current) => ({ ...current, description }));
          }}
        />
      </Field>
    </div>

    <ScriptPatternsField
      script={script}
      hostname={hostname}
      patternDraft={patternDraft}
      onPatternDraftChange={onPatternDraftChange}
      onMatchesChange={(mutate) => {
        mutateScript((current) => ({ ...current, matches: mutate(current.matches) }));
      }}
      onInvalidPattern={onInvalidPattern}
    />

    <ScriptExecutionFields script={script} mutateScript={mutateScript} />

    <RuntimeErrorNotice error={runtimeError} onDismiss={onDismissErrors} />

    <HeaderImportNotice
      code={script.code}
      onApply={(header) => {
        mutateScript((current) => applyHeader(current, header));
      }}
    />

    <ScriptCodeField script={script} mutateScript={mutateScript} />
  </div>
);
