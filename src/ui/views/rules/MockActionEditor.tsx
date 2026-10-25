import type { ReactElement } from "react";
import { createHeaderEntry } from "@/lib/factories";
import { prettyJson } from "@/lib/format";
import { CodeEditor } from "@/ui/components/CodeEditor";
import { Icon } from "@/ui/components/Icon";
import { Button, Field, IconButton, Notice, TextInput } from "@/ui/components/primitives";
import {
  clamp,
  mockMutator,
  parseDecimal,
  type MockAction,
  type MutateBoundRule,
} from "@/ui/views/rules/rule-actions";
import type { HeaderEntry } from "@/types";

const MIN_STATUS = 100;
const MAX_STATUS = 599;
const DEFAULT_STATUS = 200;
const BODY_EDITOR_MIN_HEIGHT = 150;

const parseStatus = (value: string): number => {
  const parsed = parseDecimal(value);
  return Number.isNaN(parsed) ? DEFAULT_STATUS : clamp(parsed, MIN_STATUS, MAX_STATUS);
};

const parseMockDelay = (value: string): number => {
  const parsed = parseDecimal(value);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

type MutateMock = (mutate: (action: MockAction) => MockAction) => void;

const MockHeaderRow = ({
  header,
  mutateMock,
}: {
  header: HeaderEntry;
  mutateMock: MutateMock;
}): ReactElement => {
  const patchHeader = (patch: Partial<HeaderEntry>): void => {
    mutateMock((action) => ({
      ...action,
      headers: action.headers.map((entry) => (entry.id === header.id ? { ...entry, ...patch } : entry)),
    }));
  };
  return (
    <div className="row">
      <TextInput
        value={header.name}
        mono
        placeholder="X-Mock"
        onChange={(name) => {
          patchHeader({ name });
        }}
      />
      <TextInput
        value={header.value}
        mono
        placeholder="valor"
        onChange={(value) => {
          patchHeader({ value });
        }}
      />
      <IconButton
        icon="trash"
        title="Quitar header"
        tone="danger"
        small
        onClick={() => {
          mutateMock((action) => ({
            ...action,
            headers: action.headers.filter((entry) => entry.id !== header.id),
          }));
        }}
      />
    </div>
  );
};

const MockHeaders = ({
  action,
  mutateMock,
}: {
  action: MockAction;
  mutateMock: MutateMock;
}): ReactElement => (
  <div className="field">
    <span className="field-label">Headers extra de la respuesta</span>
    {action.headers.map((header) => (
      <MockHeaderRow key={header.id} header={header} mutateMock={mutateMock} />
    ))}
    <Button
      small
      variant="ghost"
      icon="plus"
      onClick={() => {
        mutateMock((current) => ({ ...current, headers: [...current.headers, createHeaderEntry()] }));
      }}
    >
      Agregar header
    </Button>
  </div>
);

const MockResponseFields = ({
  action,
  mutateMock,
}: {
  action: MockAction;
  mutateMock: MutateMock;
}): ReactElement => (
  <div className="grid-3">
    <Field label="Status">
      <TextInput
        type="number"
        value={String(action.status)}
        onChange={(value) => {
          const status = parseStatus(value);
          mutateMock((current) => ({ ...current, status }));
        }}
      />
    </Field>
    <Field label="Content-Type">
      <input
        className="input mono"
        list="bender-content-types"
        value={action.contentType}
        onChange={(event) => {
          const contentType = event.target.value;
          mutateMock((current) => ({ ...current, contentType }));
        }}
      />
    </Field>
    <Field label="Delay (ms)" hint="Para simular latencia">
      <TextInput
        type="number"
        value={String(action.delayMs)}
        onChange={(value) => {
          const delayMs = parseMockDelay(value);
          mutateMock((current) => ({ ...current, delayMs }));
        }}
      />
    </Field>
  </div>
);

interface MockActionEditorProps {
  action: MockAction;
  mutateRule: MutateBoundRule;
}

export const MockActionEditor = ({ action, mutateRule }: MockActionEditorProps): ReactElement => {
  const mutateMock = mockMutator(mutateRule);
  return (
    <>
      <MockResponseFields action={action} mutateMock={mutateMock} />

      <Field label="Cuerpo de la respuesta">
        <CodeEditor
          value={action.body}
          minHeight={BODY_EDITOR_MIN_HEIGHT}
          onChange={(body) => {
            mutateMock((current) => ({ ...current, body }));
          }}
          toolbar={
            <>
              <Icon name="code" size={12} />
              <span>{action.contentType.includes("json") ? "JSON" : "texto"}</span>
              <div className="spacer" />
              <Button
                small
                variant="ghost"
                onClick={() => {
                  mutateMock((current) => ({ ...current, body: prettyJson(current.body) }));
                }}
              >
                Formatear
              </Button>
            </>
          }
        />
      </Field>

      <MockHeaders action={action} mutateMock={mutateMock} />

      <Notice>
        Los mocks se resuelven en la pagina interceptando <code>fetch</code> y <code>XMLHttpRequest</code>,
        asi que no aplican a navegacion, imagenes ni requests hechas por otras extensiones.
      </Notice>
    </>
  );
};
