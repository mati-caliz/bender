import type { ReactElement } from "react";
import { JwtPanel } from "@/ui/components/JwtPanel";
import { Button, Field, Select, TextArea, TextInput } from "@/ui/components/primitives";
import type { CookieSnapshot } from "@/types";

const SAME_SITE_OPTIONS = [
  { value: "lax", label: "SameSite: Lax" },
  { value: "strict", label: "SameSite: Strict" },
  { value: "no_restriction", label: "SameSite: None" },
  { value: "unspecified", label: "SameSite: sin especificar" },
];

const SECONDS_PER_YEAR = 365 * 24 * 3600;
const MILLISECONDS_PER_SECOND = 1000;

const isSameSite = (value: string): value is chrome.cookies.SameSiteStatus =>
  value === "lax" || value === "strict" || value === "no_restriction" || value === "unspecified";

const toInputValue = (epochSeconds: number): string => {
  const date = new Date(epochSeconds * MILLISECONDS_PER_SECOND);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromInputValue = (value: string): number =>
  Math.floor(new Date(value).getTime() / MILLISECONDS_PER_SECOND);

interface CookieFormProps {
  draft: CookieSnapshot;
  onChange: (cookie: CookieSnapshot) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew: boolean;
}

interface CookieFlagsProps {
  draft: CookieSnapshot;
  onChange: (cookie: CookieSnapshot) => void;
}

const CookieFlags = ({ draft, onChange }: CookieFlagsProps): ReactElement => (
  <div className="row wrap">
    <label className="checkbox">
      <input
        type="checkbox"
        checked={draft.secure}
        onChange={(event) => {
          onChange({ ...draft, secure: event.target.checked });
        }}
      />
      Secure
    </label>
    <label className="checkbox">
      <input
        type="checkbox"
        checked={draft.httpOnly}
        onChange={(event) => {
          onChange({ ...draft, httpOnly: event.target.checked });
        }}
      />
      HttpOnly
    </label>
    <label className="checkbox">
      <input
        type="checkbox"
        checked={draft.hostOnly}
        onChange={(event) => {
          onChange({ ...draft, hostOnly: event.target.checked });
        }}
      />
      Solo este host
    </label>
    <label className="checkbox">
      <input
        type="checkbox"
        checked={draft.expirationDate === null}
        onChange={(event) => {
          onChange({
            ...draft,
            expirationDate: event.target.checked
              ? null
              : Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + SECONDS_PER_YEAR,
          });
        }}
      />
      Cookie de sesion
    </label>
  </div>
);

export const CookieForm = ({
  draft,
  onChange,
  onSave,
  onDelete,
  onCancel,
  isNew,
}: CookieFormProps): ReactElement => (
  <>
    <div className="grid-2">
      <Field label="Nombre">
        <TextInput
          value={draft.name}
          mono
          onChange={(name) => {
            onChange({ ...draft, name });
          }}
        />
      </Field>
      <Field label="Dominio">
        <TextInput
          value={draft.domain}
          mono
          onChange={(domain) => {
            onChange({ ...draft, domain });
          }}
        />
      </Field>
    </div>

    <Field label="Valor">
      <TextArea
        value={draft.value}
        mono
        rows={3}
        onChange={(value) => {
          onChange({ ...draft, value });
        }}
      />
    </Field>

    <JwtPanel value={draft.value} />

    <div className="grid-2">
      <Field label="Path">
        <TextInput
          value={draft.path}
          mono
          onChange={(path) => {
            onChange({ ...draft, path });
          }}
        />
      </Field>
      <Field label="SameSite">
        <Select
          value={draft.sameSite}
          options={SAME_SITE_OPTIONS}
          onChange={(value) => {
            if (isSameSite(value)) onChange({ ...draft, sameSite: value });
          }}
        />
      </Field>
    </div>

    <CookieFlags draft={draft} onChange={onChange} />

    {draft.expirationDate !== null ? (
      <Field label="Expira">
        <TextInput
          type="datetime-local"
          value={toInputValue(draft.expirationDate)}
          onChange={(value) => {
            onChange({ ...draft, expirationDate: fromInputValue(value) });
          }}
        />
      </Field>
    ) : null}

    <div className="row">
      <Button variant="primary" icon="check" onClick={onSave} disabled={!draft.name.trim()}>
        Guardar
      </Button>
      <Button variant="danger" icon="trash" onClick={onDelete}>
        {isNew ? "Descartar" : "Borrar"}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cerrar
      </Button>
    </div>
  </>
);
