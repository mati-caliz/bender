import type { ReactElement } from "react";
import { isValidMatchPattern, parseMatchPatterns } from "@/lib/match-patterns";
import { Button, Chip, Notice, TextInput } from "@/ui/components/primitives";
import { patternForHostname, uniqueAppend } from "@/ui/views/scripts/script-patterns";
import type { UserScript } from "@/types";

interface ScriptPatternsFieldProps {
  script: UserScript;
  hostname: string;
  patternDraft: string;
  onPatternDraftChange: (draft: string) => void;
  onMatchesChange: (mutate: (matches: string[]) => string[]) => void;
  onInvalidPattern: () => void;
}

export const ScriptPatternsField = ({
  script,
  hostname,
  patternDraft,
  onPatternDraftChange,
  onMatchesChange,
  onInvalidPattern,
}: ScriptPatternsFieldProps): ReactElement => {
  const invalidPatterns = script.matches.filter((pattern) => !isValidMatchPattern(pattern));

  const addDraftPatterns = (): void => {
    const patterns = parseMatchPatterns(patternDraft);
    if (patterns.some((pattern) => !isValidMatchPattern(pattern))) {
      onInvalidPattern();
      return;
    }
    onMatchesChange((matches) => uniqueAppend(matches, patterns));
    onPatternDraftChange("");
  };

  return (
    <div className="field">
      <span className="field-label">Se ejecuta en</span>
      <div className="row">
        <TextInput
          value={patternDraft}
          mono
          placeholder="https://*.midominio.com/*"
          onChange={onPatternDraftChange}
        />
        <Button small disabled={!patternDraft.trim()} onClick={addDraftPatterns}>
          Agregar
        </Button>
        {hostname ? (
          <Button
            small
            variant="ghost"
            icon="plus"
            onClick={() => {
              onMatchesChange((matches) => uniqueAppend(matches, [patternForHostname(hostname)]));
            }}
          >
            {hostname}
          </Button>
        ) : null}
      </div>
      <div className="row wrap">
        {script.matches.map((pattern) => (
          <Chip
            key={pattern}
            label={pattern}
            onRemove={() => {
              onMatchesChange((matches) => matches.filter((candidate) => candidate !== pattern));
            }}
          />
        ))}
      </div>
      {invalidPatterns.length > 0 ? (
        <Notice tone="warning">
          Patrones invalidos (se ignoran): {invalidPatterns.join(", ")}. El formato es
          <code> esquema://dominio/ruta</code>, por ejemplo <code>https://*.google.com/*</code>.
        </Notice>
      ) : null}
    </div>
  );
};
