import { useState } from 'react';
import { downloadJson } from '@/lib/download';
import { parseCookies } from '@/lib/import';
import { ImportDialog } from '@/ui/components/ImportDialog';
import { JwtPanel } from '@/ui/components/JwtPanel';
import { ToggleCard } from '@/ui/components/ToggleCard';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Button,
  Card,
  ConfirmBar,
  EmptyState,
  Field,
  Notice,
  SearchInput,
  Select,
  TextArea,
  TextInput,
} from '@/ui/components/primitives';
import { cookieKeyOf, useCookies, type CookieSnapshot } from '@/ui/hooks/useCookies';
import { useToasts } from '@/ui/hooks/useToasts';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';

const SAME_SITE_OPTIONS = [
  { value: 'lax', label: 'SameSite: Lax' },
  { value: 'strict', label: 'SameSite: Strict' },
  { value: 'no_restriction', label: 'SameSite: None' },
  { value: 'unspecified', label: 'SameSite: sin especificar' },
];

const SECONDS_PER_YEAR = 365 * 24 * 3600;
const MILLISECONDS_PER_SECOND = 1000;

const isSameSite = (value: string): value is chrome.cookies.SameSiteStatus =>
  value === 'lax' || value === 'strict' || value === 'no_restriction' || value === 'unspecified';

const toInputValue = (epochSeconds: number): string => {
  const date = new Date(epochSeconds * MILLISECONDS_PER_SECOND);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromInputValue = (value: string): number => Math.floor(new Date(value).getTime() / MILLISECONDS_PER_SECOND);

const blankCookie = (hostname: string, secure: boolean): CookieSnapshot => ({
  name: '',
  value: '',
  domain: hostname,
  path: '/',
  secure,
  httpOnly: false,
  sameSite: 'lax',
  hostOnly: true,
  expirationDate: null,
});

interface CookieFormProps {
  draft: CookieSnapshot;
  onChange: (cookie: CookieSnapshot) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isNew: boolean;
}

const CookieForm = ({ draft, onChange, onSave, onDelete, onCancel, isNew }: CookieFormProps) => (
  <>
    <div className="grid-2">
      <Field label="Nombre">
        <TextInput value={draft.name} mono onChange={(name) => onChange({ ...draft, name })} />
      </Field>
      <Field label="Dominio">
        <TextInput value={draft.domain} mono onChange={(domain) => onChange({ ...draft, domain })} />
      </Field>
    </div>

    <Field label="Valor">
      <TextArea value={draft.value} mono rows={3} onChange={(value) => onChange({ ...draft, value })} />
    </Field>

    <JwtPanel value={draft.value} />

    <div className="grid-2">
      <Field label="Path">
        <TextInput value={draft.path} mono onChange={(path) => onChange({ ...draft, path })} />
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

    <div className="row wrap">
      <label className="checkbox">
        <input type="checkbox" checked={draft.secure} onChange={(event) => onChange({ ...draft, secure: event.target.checked })} />
        Secure
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={draft.httpOnly}
          onChange={(event) => onChange({ ...draft, httpOnly: event.target.checked })}
        />
        HttpOnly
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={draft.hostOnly}
          onChange={(event) => onChange({ ...draft, hostOnly: event.target.checked })}
        />
        Solo este host
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={draft.expirationDate === null}
          onChange={(event) =>
            onChange({
              ...draft,
              expirationDate: event.target.checked ? null : Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + SECONDS_PER_YEAR,
            })
          }
        />
        Cookie de sesion
      </label>
    </div>

    {draft.expirationDate !== null ? (
      <Field label="Expira">
        <TextInput
          type="datetime-local"
          value={toInputValue(draft.expirationDate)}
          onChange={(value) => onChange({ ...draft, expirationDate: fromInputValue(value) })}
        />
      </Field>
    ) : null}

    <div className="row">
      <Button variant="primary" icon="check" onClick={onSave} disabled={!draft.name.trim()}>
        Guardar
      </Button>
      <Button variant="danger" icon="trash" onClick={onDelete}>
        {isNew ? 'Descartar' : 'Borrar'}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cerrar
      </Button>
    </div>
  </>
);

export const CookiesView = ({ activeTab }: { activeTab: ActiveTab }) => {
  const { notify } = useToasts();
  const cookies = useCookies(activeTab);
  const [filter, setFilter] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CookieSnapshot | null>(null);
  const [newCookie, setNewCookie] = useState<CookieSnapshot | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();
  const visible = normalizedFilter
    ? cookies.rows.filter(
        (row) =>
          row.item.name.toLowerCase().includes(normalizedFilter) ||
          row.item.value.toLowerCase().includes(normalizedFilter)
      )
    : cookies.rows;

  return (
    <ViewShell
      title="Cookies"
      subtitle={activeTab.hostname ? `Cookies de ${activeTab.hostname}` : 'Abri una pagina http(s)'}
      actions={
        <>
          <Button small icon="refresh" variant="ghost" onClick={cookies.reload} title="Recargar">
            Recargar
          </Button>
          <Button small icon="upload" onClick={() => setImporting(true)} disabled={!activeTab.injectable}>
            Importar
          </Button>
          <Button
            small
            icon="download"
            disabled={!cookies.liveCookies.length}
            onClick={() => {
              downloadJson(`cookies-${activeTab.hostname || 'export'}.json`, cookies.liveCookies);
              notify('Cookies exportadas', 'success');
            }}
          >
            Exportar
          </Button>
          <Button small variant="danger" icon="trash" disabled={!cookies.rows.length} onClick={() => setConfirmClear(true)}>
            Borrar todas
          </Button>
        </>
      }
    >
      {cookies.error ? <Notice tone="danger">{cookies.error}</Notice> : null}

      {confirmClear ? (
        <ConfirmBar
          message={`Borrar las ${cookies.rows.length} cookies de ${activeTab.hostname} (incluidas las apagadas)?`}
          confirmLabel="Borrar todas"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            void cookies.removeAll().then(() => notify('Cookies borradas'));
            setConfirmClear(false);
          }}
        />
      ) : null}

      <div className="toolbar">
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar por nombre o valor…" />
        <Button
          small
          icon="plus"
          disabled={!activeTab.injectable}
          onClick={() => setNewCookie(blankCookie(activeTab.hostname, activeTab.url.startsWith('https')))}
        >
          Nueva cookie
        </Button>
      </div>

      {newCookie ? (
        <Card title="Nueva cookie">
          <CookieForm
            draft={newCookie}
            isNew
            onChange={setNewCookie}
            onCancel={() => setNewCookie(null)}
            onDelete={() => setNewCookie(null)}
            onSave={() => {
              void cookies.save(null, newCookie, false).then(() => notify('Cookie creada', 'success'));
              setNewCookie(null);
            }}
          />
        </Card>
      ) : null}

      {visible.length ? (
        <div className="list">
          {visible.map((row) => {
            const expanded = expandedKey === row.key;
            const current = expanded && draft ? draft : row.item;
            return (
              <ToggleCard
                key={row.key}
                name={row.item.name || '(sin nombre)'}
                preview={row.item.value}
                off={row.off}
                reappeared={row.reappeared}
                expanded={expanded}
                reappearedTitle="El sitio volvio a crear esta cookie mientras estaba apagada."
                onToggle={(enabled) => void cookies.toggle(row, enabled)}
                onExpand={() => {
                  setExpandedKey(expanded ? null : row.key);
                  setDraft(expanded ? null : row.item);
                }}
              >
                <CookieForm
                  draft={current}
                  isNew={false}
                  onChange={setDraft}
                  onCancel={() => {
                    setExpandedKey(null);
                    setDraft(null);
                  }}
                  onDelete={() => {
                    void cookies.remove(row.item, row.off).then(() => notify('Cookie borrada'));
                    setExpandedKey(null);
                    setDraft(null);
                  }}
                  onSave={() => {
                    void cookies.save(row.item, current, row.off).then(() => notify('Cookie guardada', 'success'));
                    setExpandedKey(cookieKeyOf(current) === row.key ? row.key : null);
                    setDraft(null);
                  }}
                />
              </ToggleCard>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="cookie"
          title={cookies.rows.length ? 'Ninguna cookie coincide con el filtro' : 'No hay cookies para este dominio'}
        />
      )}

      {importing ? (
        <ImportDialog
          title="Importar cookies"
          description="Acepta el formato de chrome.cookies.getAll y los exports de Cookie-Editor."
          allowAppend={false}
          onClose={() => setImporting(false)}
          onImport={(text) => {
            const parsed = parseCookies(text, activeTab.hostname);
            void cookies.importCookies(parsed).then((imported) => {
              notify(`${imported}/${parsed.length} cookies importadas`, imported === parsed.length ? 'success' : 'error');
            });
          }}
        />
      ) : null}
    </ViewShell>
  );
};
