import { DEFAULT_CORS_CONFIG } from '@/lib/constants';
import { ScopeEditor } from '@/ui/components/ScopeEditor';
import { ViewShell } from '@/ui/components/ViewShell';
import { Button, Card, Field, Notice, Segmented, Switch, TextInput } from '@/ui/components/primitives';
import type { ViewProps } from '@/ui/views/types';
import type { CorsAllowOrigin, CorsConfig } from '@/types';

const ORIGIN_OPTIONS: Array<{ value: CorsAllowOrigin; label: string }> = [
  { value: 'reflect', label: 'Reflejar origen' },
  { value: 'wildcard', label: 'Comodin *' },
  { value: 'custom', label: 'Fijo' },
];

const DEFAULT_MAX_AGE = 600;

export const CorsView = ({ state, update, activeTab }: ViewProps) => {
  const cors = state.cors;

  const mutateCors = (mutate: (config: CorsConfig) => CorsConfig) => {
    update((current) => ({ ...current, cors: mutate(current.cors) }));
  };

  const credentialsConflict = cors.allowOrigin === 'wildcard' && cors.allowCredentials;

  return (
    <ViewShell
      title="CORS"
      subtitle="Un switch para dejar de pelear con Access-Control-Allow-Origin mientras desarrollas."
      actions={
        <Button small variant="ghost" icon="refresh" onClick={() => mutateCors(() => ({ ...DEFAULT_CORS_CONFIG, enabled: cors.enabled }))}>
          Restaurar valores
        </Button>
      }
    >
      <div className="quick-toggle" data-on={cors.enabled}>
        <span className="quick-toggle-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <div className="quick-toggle-title">Reescribir headers de CORS</div>
          <div className="quick-toggle-hint">
            {cors.enabled ? 'Las respuestas llegan con los permisos de abajo.' : 'El navegador aplica el CORS real del servidor.'}
          </div>
        </div>
        <div className="spacer" />
        <Switch checked={cors.enabled} onChange={(enabled) => mutateCors((config) => ({ ...config, enabled }))} />
      </div>

      {credentialsConflict ? (
        <Notice tone="warning">
          El navegador rechaza <code>Access-Control-Allow-Origin: *</code> cuando la request manda cookies. Usa
          «Reflejar origen» si necesitas credenciales.
        </Notice>
      ) : null}

      <Card title="Permisos">
        <Field label="Origen permitido" hint="Reflejar copia el origen exacto de la pestaña, que es lo unico valido con credenciales.">
          <Segmented
            value={cors.allowOrigin}
            options={ORIGIN_OPTIONS}
            onChange={(allowOrigin) => mutateCors((config) => ({ ...config, allowOrigin }))}
          />
        </Field>

        {cors.allowOrigin === 'custom' ? (
          <Field label="Origen fijo">
            <TextInput
              value={cors.customOrigin}
              mono
              placeholder="https://app.midominio.com"
              onChange={(customOrigin) => mutateCors((config) => ({ ...config, customOrigin }))}
            />
          </Field>
        ) : null}

        <label className="checkbox">
          <input
            type="checkbox"
            checked={cors.allowCredentials}
            onChange={(event) => {
              const allowCredentials = event.target.checked;
              mutateCors((config) => ({ ...config, allowCredentials }));
            }}
          />
          Permitir credenciales (cookies y auth headers)
        </label>

        <div className="grid-2">
          <Field label="Metodos permitidos">
            <TextInput
              value={cors.allowMethods}
              mono
              onChange={(allowMethods) => mutateCors((config) => ({ ...config, allowMethods }))}
            />
          </Field>
          <Field label="Headers permitidos">
            <TextInput
              value={cors.allowHeaders}
              mono
              onChange={(allowHeaders) => mutateCors((config) => ({ ...config, allowHeaders }))}
            />
          </Field>
          <Field label="Headers expuestos">
            <TextInput
              value={cors.exposeHeaders}
              mono
              onChange={(exposeHeaders) => mutateCors((config) => ({ ...config, exposeHeaders }))}
            />
          </Field>
          <Field label="Max-Age (segundos)" hint="Cuanto cachea el navegador el preflight.">
            <TextInput
              type="number"
              value={String(cors.maxAgeSeconds)}
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                const maxAgeSeconds = Number.isNaN(parsed) || parsed < 0 ? DEFAULT_MAX_AGE : parsed;
                mutateCors((config) => ({ ...config, maxAgeSeconds }));
              }}
            />
          </Field>
        </div>
      </Card>

      <Card title="Politicas de seguridad" subtitle="Solo para desarrollo: bajan defensas reales del sitio.">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={cors.removeContentSecurityPolicy}
            onChange={(event) => {
              const removeContentSecurityPolicy = event.target.checked;
              mutateCors((config) => ({ ...config, removeContentSecurityPolicy }));
            }}
          />
          Eliminar Content-Security-Policy
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={cors.removeFrameOptions}
            onChange={(event) => {
              const removeFrameOptions = event.target.checked;
              mutateCors((config) => ({ ...config, removeFrameOptions }));
            }}
          />
          Eliminar X-Frame-Options (para embeber el sitio en un iframe)
        </label>
      </Card>

      <Card title="Alcance">
        <ScopeEditor
          scope={cors.scope}
          currentHostname={activeTab.hostname}
          onChange={(scope) => mutateCors((config) => ({ ...config, scope }))}
        />
      </Card>
    </ViewShell>
  );
};
