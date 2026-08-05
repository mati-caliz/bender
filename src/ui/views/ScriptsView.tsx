import { useEffect, useMemo, useState } from 'react';
import { createUserScript } from '@/lib/factories';
import { isValidMatchPattern, parseMatchPatterns } from '@/lib/match-patterns';
import { sendMessage } from '@/lib/messages';
import { SCRIPT_TEMPLATES, type ScriptTemplate } from '@/lib/script-templates';
import {
  describeHeader,
  headerHasData,
  parseUserScriptHeader,
  type UserScriptHeader,
} from '@/lib/userscript-header';
import { CodeEditor } from '@/ui/components/CodeEditor';
import { Icon } from '@/ui/components/Icon';
import { ViewShell } from '@/ui/components/ViewShell';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Notice,
  Select,
  Switch,
  TextInput,
} from '@/ui/components/primitives';
import { useToasts } from '@/ui/hooks/useToasts';
import type { ViewProps } from '@/ui/views/types';
import type { UserScript, UserScriptRunAt, UserScriptWorld, UserScriptsStatus } from '@/types';

const RUN_AT_OPTIONS = [
  { value: 'document_start', label: 'Al empezar a cargar' },
  { value: 'document_end', label: 'Con el DOM listo' },
  { value: 'document_idle', label: 'Cuando termina de cargar' },
];

const WORLD_OPTIONS = [
  { value: 'MAIN', label: 'Mundo de la pagina' },
  { value: 'USER_SCRIPT', label: 'Mundo aislado' },
];

const isRunAt = (value: string): value is UserScriptRunAt =>
  value === 'document_start' || value === 'document_end' || value === 'document_idle';

const isWorld = (value: string): value is UserScriptWorld => value === 'MAIN' || value === 'USER_SCRIPT';

/**
 * Al pegar un script de Tampermonkey, ofrece cargar lo que dice su header en vez
 * de obligar a copiar los patrones a mano. Se aplica solo si el usuario acepta:
 * el header puede traer patrones mas amplios de los que quiere.
 */
const HeaderImportNotice = ({
  code,
  onApply,
}: {
  code: string;
  onApply: (header: UserScriptHeader) => void;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const header = useMemo(() => parseUserScriptHeader(code), [code]);

  if (dismissed || !headerHasData(header)) return null;

  return (
    <Notice tone="info">
      <div className="row wrap" style={{ width: '100%' }}>
        <span className="truncate">Este script trae header de Tampermonkey: {describeHeader(header)}.</span>
        <div className="spacer" />
        <Button
          small
          onClick={() => {
            onApply(header);
            setDismissed(true);
          }}
        >
          Aplicar
        </Button>
        <Button small variant="ghost" onClick={() => setDismissed(true)}>
          Ignorar
        </Button>
      </div>
    </Notice>
  );
};

const patternForHostname = (hostname: string): string => (hostname ? `https://${hostname}/*` : '');

export const ScriptsView = ({ state, update, activeTab }: ViewProps) => {
  const { notify } = useToasts();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patternDraft, setPatternDraft] = useState('');
  const [status, setStatus] = useState<UserScriptsStatus | null>(null);

  useEffect(() => {
    void sendMessage({ type: 'userscripts/sync' })
      .then(setStatus)
      .catch(() => undefined);
  }, [state.userScripts]);

  const mutateScript = (id: string, mutate: (script: UserScript) => UserScript) => {
    update((current) => ({
      ...current,
      userScripts: current.userScripts.map((script) =>
        script.id === id ? { ...mutate(script), updatedAt: Date.now() } : script
      ),
    }));
  };

  const addFromTemplate = (template: ScriptTemplate) => {
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
            void sendMessage({ type: 'userscripts/sync' }).then((next) => {
              setStatus(next);
              notify(`${next.registeredCount} script(s) registrados`, next.error ? 'error' : 'success');
            });
          }}
        >
          Re-registrar
        </Button>
      }
    >
      {status && !status.supported ? (
        <Notice tone="danger">
          Chrome no expone <code>chrome.userScripts</code>. Entra a <code>chrome://extensions</code>, activa el modo
          desarrollador y recarga Bender.
        </Notice>
      ) : null}
      {status?.error ? <Notice tone="warning">{status.error}</Notice> : null}

      <Card title="Plantillas" subtitle="Arranca de una base y ajustala.">
        <div className="row wrap">
          {SCRIPT_TEMPLATES.map((template) => (
            <button key={template.id} type="button" className="btn small" title={template.description} onClick={() => addFromTemplate(template)}>
              <Icon name={template.language === 'css' ? 'sparkles' : 'code'} size={12} />
              {template.label}
            </button>
          ))}
        </div>
      </Card>

      {!state.userScripts.length ? (
        <EmptyState
          icon="code"
          title="Todavia no hay scripts"
          text="Los scripts corren en las paginas que matcheen su patron. El CSS se inyecta al cargar cada pagina."
        />
      ) : null}

      <div className="list">
        {state.userScripts.map((script) => {
          const expanded = expandedId === script.id;
          const invalidPatterns = script.matches.filter((pattern) => !isValidMatchPattern(pattern));

          return (
            <div key={script.id} className="item-card" data-expanded={expanded} data-off={!script.enabled}>
              <div className="item-head" onClick={() => setExpandedId(expanded ? null : script.id)}>
                <Switch
                  small
                  checked={script.enabled}
                  onChange={(enabled) => mutateScript(script.id, (current) => ({ ...current, enabled }))}
                  title="Prender o apagar este script"
                />
                <Badge tone={script.language === 'css' ? 'accent' : 'info'}>
                  {script.language === 'css' ? 'CSS' : 'JS'}
                </Badge>
                <span className="item-name">{script.name}</span>
                <span className="item-preview">{script.matches.join(', ') || 'sin patrones — no se ejecuta'}</span>
                <IconButton
                  icon="trash"
                  title="Eliminar script"
                  tone="danger"
                  small
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      userScripts: current.userScripts.filter((candidate) => candidate.id !== script.id),
                    }))
                  }
                />
                <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={13} />
              </div>

              {expanded ? (
                <div className="item-form">
                  <div className="grid-2">
                    <Field label="Nombre">
                      <TextInput
                        value={script.name}
                        onChange={(name) => mutateScript(script.id, (current) => ({ ...current, name }))}
                      />
                    </Field>
                    <Field label="Descripcion">
                      <TextInput
                        value={script.description}
                        onChange={(description) => mutateScript(script.id, (current) => ({ ...current, description }))}
                      />
                    </Field>
                  </div>

                  <div className="field">
                    <span className="field-label">Se ejecuta en</span>
                    <div className="row">
                      <TextInput
                        value={patternDraft}
                        mono
                        placeholder="https://*.midominio.com/*"
                        onChange={setPatternDraft}
                      />
                      <Button
                        small
                        disabled={!patternDraft.trim()}
                        onClick={() => {
                          const patterns = parseMatchPatterns(patternDraft);
                          if (patterns.some((pattern) => !isValidMatchPattern(pattern))) {
                            notify('Patron invalido: usa https://dominio.com/*', 'error');
                            return;
                          }
                          mutateScript(script.id, (current) => ({
                            ...current,
                            matches: Array.from(new Set([...current.matches, ...patterns])),
                          }));
                          setPatternDraft('');
                        }}
                      >
                        Agregar
                      </Button>
                      {activeTab.hostname ? (
                        <Button
                          small
                          variant="ghost"
                          icon="plus"
                          onClick={() =>
                            mutateScript(script.id, (current) => ({
                              ...current,
                              matches: Array.from(
                                new Set([...current.matches, patternForHostname(activeTab.hostname)])
                              ),
                            }))
                          }
                        >
                          {activeTab.hostname}
                        </Button>
                      ) : null}
                    </div>
                    <div className="row wrap">
                      {script.matches.map((pattern) => (
                        <Chip
                          key={pattern}
                          label={pattern}
                          onRemove={() =>
                            mutateScript(script.id, (current) => ({
                              ...current,
                              matches: current.matches.filter((candidate) => candidate !== pattern),
                            }))
                          }
                        />
                      ))}
                    </div>
                    {invalidPatterns.length ? (
                      <Notice tone="warning">
                        Patrones invalidos (se ignoran): {invalidPatterns.join(', ')}. El formato es
                        <code> esquema://dominio/ruta</code>, por ejemplo <code>https://*.google.com/*</code>.
                      </Notice>
                    ) : null}
                  </div>

                  <div className="grid-3">
                    <Field label="Momento">
                      <Select
                        value={script.runAt}
                        options={RUN_AT_OPTIONS}
                        onChange={(value) => {
                          if (isRunAt(value)) mutateScript(script.id, (current) => ({ ...current, runAt: value }));
                        }}
                      />
                    </Field>
                    <Field label="Contexto" hint="El mundo de la pagina ve sus variables globales.">
                      <Select
                        value={script.world}
                        options={WORLD_OPTIONS}
                        disabled={script.language === 'css'}
                        onChange={(value) => {
                          if (isWorld(value)) mutateScript(script.id, (current) => ({ ...current, world: value }));
                        }}
                      />
                    </Field>
                    <div className="field" style={{ justifyContent: 'flex-end' }}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={script.allFrames}
                          onChange={(event) => {
                            const allFrames = event.target.checked;
                            mutateScript(script.id, (current) => ({ ...current, allFrames }));
                          }}
                        />
                        Tambien en iframes
                      </label>
                    </div>
                  </div>

                  <HeaderImportNotice
                    code={script.code}
                    onApply={(header) =>
                      mutateScript(script.id, (current) => ({
                        ...current,
                        name: header.name ?? current.name,
                        description: header.description ?? current.description,
                        // Se suman a lo que ya haya, sin repetir, para no pisar lo que el usuario cargo a mano.
                        matches: [...new Set([...current.matches, ...header.matches])],
                        excludeMatches: [...new Set([...current.excludeMatches, ...header.excludeMatches])],
                        runAt: header.runAt ?? current.runAt,
                      }))
                    }
                  />

                  <Field label={script.language === 'css' ? 'CSS' : 'JavaScript'}>
                    <CodeEditor
                      value={script.code}
                      minHeight={200}
                      onChange={(code) => mutateScript(script.id, (current) => ({ ...current, code }))}
                      toolbar={
                        <>
                          <Icon name="code" size={12} />
                          <span>{script.language === 'css' ? 'hoja de estilos' : 'modulo clasico'}</span>
                          <div className="spacer" />
                          <span>{script.code.split('\n').length} lineas</span>
                        </>
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {state.userScripts.length ? (
        <p className="field-hint">
          Los cambios se registran solos. El CSS se aplica al recargar la pagina; el JavaScript, en la proxima carga
          que matchee.
        </p>
      ) : null}
    </ViewShell>
  );
};
