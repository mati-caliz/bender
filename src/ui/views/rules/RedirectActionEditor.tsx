import type { ReactElement } from "react";
import { Field, TextInput } from "@/ui/components/primitives";
import { redirectPatcher, type MutateBoundRule, type RedirectAction } from "@/ui/views/rules/rule-actions";

interface RedirectActionEditorProps {
  action: RedirectAction;
  mutateRule: MutateBoundRule;
}

export const RedirectActionEditor = ({ action, mutateRule }: RedirectActionEditorProps): ReactElement => {
  const patchAction = redirectPatcher(mutateRule);
  return (
    <>
      <Field
        label="Destino"
        hint={
          action.useRegex
            ? "Podes usar \\1, \\2 para los grupos capturados en el patron de URL."
            : "URL absoluta, por ejemplo http://localhost:3000/bundle.js"
        }
      >
        <TextInput
          value={action.target}
          mono
          placeholder="http://localhost:3000/bundle.js"
          onChange={(target) => {
            patchAction({ target });
          }}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={action.useRegex}
          onChange={(event) => {
            const useRegex = event.target.checked;
            patchAction({ useRegex });
          }}
        />
        Tratar el filtro de URL como expresion regular
      </label>
    </>
  );
};
