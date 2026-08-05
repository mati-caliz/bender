import { useState, type KeyboardEvent } from 'react';
import {
  ALL_REQUEST_METHODS,
  ALL_RESOURCE_TYPES,
  REQUEST_METHOD_LABELS,
  RESOURCE_TYPE_LABELS,
} from '@/lib/constants';
import { parseDomainList } from '@/lib/scope';
import { Icon } from '@/ui/components/Icon';
import { Button, Chip, Field, Switch, TextInput } from '@/ui/components/primitives';
import type { RequestMethod, ResourceType, Scope } from '@/types';

interface DomainInputProps {
  label: string;
  hint: string;
  domains: string[];
  onChange: (domains: string[]) => void;
  suggestion?: string;
}

const DomainInput = ({ label, hint, domains, onChange, suggestion }: DomainInputProps) => {
  const [draft, setDraft] = useState('');

  const commit = (value: string) => {
    const parsed = parseDomainList(value);
    if (!parsed.length) return;
    onChange(Array.from(new Set([...domains, ...parsed])));
    setDraft('');
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="row wrap domain-input">
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="ejemplo.com"
          mono
        />
        <Button small onClick={() => commit(draft)} disabled={!draft.trim()}>
          Agregar
        </Button>
        {suggestion && !domains.includes(suggestion) ? (
          <Button small variant="ghost" icon="plus" onClick={() => commit(suggestion)} title="Usar el dominio actual">
            {suggestion}
          </Button>
        ) : null}
      </div>
      {domains.length ? (
        <div className="row wrap">
          {domains.map((domain) => (
            <Chip
              key={domain}
              label={domain}
              onRemove={() => onChange(domains.filter((candidate) => candidate !== domain))}
            />
          ))}
        </div>
      ) : (
        <span className="field-hint">{hint}</span>
      )}
    </div>
  );
};

interface ScopeEditorProps {
  scope: Scope;
  onChange: (scope: Scope) => void;
  currentHostname?: string;
}

export const ScopeEditor = ({ scope, onChange, currentHostname }: ScopeEditorProps) => {
  const [showResourceTypes, setShowResourceTypes] = useState(scope.resourceTypes.length > 0);

  const toggleRequestMethod = (requestMethod: RequestMethod) => {
    const next = scope.requestMethods.includes(requestMethod)
      ? scope.requestMethods.filter((candidate) => candidate !== requestMethod)
      : [...scope.requestMethods, requestMethod];
    onChange({ ...scope, requestMethods: next });
  };

  const toggleResourceType = (resourceType: ResourceType) => {
    const next = scope.resourceTypes.includes(resourceType)
      ? scope.resourceTypes.filter((candidate) => candidate !== resourceType)
      : [...scope.resourceTypes, resourceType];
    onChange({ ...scope, resourceTypes: next });
  };

  const handleUrlFilterKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onChange({ ...scope, urlFilter: '' });
  };

  return (
    <div className="card-body" style={{ padding: 0, gap: 12 }}>
      <label className="row" style={{ cursor: 'pointer' }}>
        <Switch
          checked={scope.activeTabOnly}
          onChange={(checked) => onChange({ ...scope, activeTabOnly: checked })}
          small
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Solo la pestaña activa</div>
          <div className="field-hint">Las reglas se aplican unicamente a la pestaña que estas mirando.</div>
        </div>
      </label>

      <DomainInput
        label="Dominios incluidos"
        hint="Vacio = todos los dominios. Incluye subdominios automaticamente."
        domains={scope.includeDomains}
        onChange={(domains) => onChange({ ...scope, includeDomains: domains })}
        suggestion={currentHostname}
      />

      <DomainInput
        label="Dominios excluidos"
        hint="Opcional: dominios donde la regla nunca se aplica."
        domains={scope.excludeDomains}
        onChange={(domains) => onChange({ ...scope, excludeDomains: domains })}
      />

      <DomainInput
        label="Sitios que originan la request"
        hint="Vacio = cualquier sitio. Es el dominio de la pagina que pide, no el del destino."
        domains={scope.initiatorDomains}
        onChange={(domains) => onChange({ ...scope, initiatorDomains: domains })}
        suggestion={currentHostname}
      />

      <DomainInput
        label="Sitios de origen excluidos"
        hint="Opcional: paginas desde las que la regla nunca se aplica."
        domains={scope.excludedInitiatorDomains}
        onChange={(domains) => onChange({ ...scope, excludedInitiatorDomains: domains })}
      />

      <div className="field">
        <span className="field-label">Metodos</span>
        <div className="row wrap">
          {ALL_REQUEST_METHODS.map((requestMethod) => (
            <label key={requestMethod} className="checkbox">
              <input
                type="checkbox"
                checked={scope.requestMethods.includes(requestMethod)}
                onChange={() => toggleRequestMethod(requestMethod)}
              />
              {REQUEST_METHOD_LABELS[requestMethod]}
            </label>
          ))}
        </div>
        {scope.requestMethods.length ? null : <span className="field-hint">Vacio = todos los metodos.</span>}
      </div>

      <div onKeyDown={handleUrlFilterKey}>
        <Field
          label="Filtro de URL"
          hint="Subcadena con comodines: *.json, |https://api. — vacio aplica a todas las URLs."
        >
          <TextInput
            value={scope.urlFilter}
            onChange={(urlFilter) => onChange({ ...scope, urlFilter })}
            placeholder="/api/*"
            mono
          />
        </Field>
      </div>

      <div className="field">
        <button
          type="button"
          className="btn ghost small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setShowResourceTypes((current) => !current)}
        >
          <Icon name={showResourceTypes ? 'chevron-down' : 'chevron-right'} size={12} />
          Tipos de request
          {scope.resourceTypes.length ? ` (${scope.resourceTypes.length})` : ' (todos)'}
        </button>
        {showResourceTypes ? (
          <div className="grid-3">
            {ALL_RESOURCE_TYPES.map((resourceType) => (
              <label key={resourceType} className="checkbox">
                <input
                  type="checkbox"
                  checked={scope.resourceTypes.includes(resourceType)}
                  onChange={() => toggleResourceType(resourceType)}
                />
                {RESOURCE_TYPE_LABELS[resourceType] ?? resourceType}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
