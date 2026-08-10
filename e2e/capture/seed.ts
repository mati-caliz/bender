import type { Scope, ToolkitState } from '../../src/types';

/**
 * Datos inventados para las capturas de la Chrome Web Store. Dominios de ejemplo
 * y un JWT armado a mano: nunca se capturan cookies ni tokens de cuentas reales.
 */

const scope = (overrides: Partial<Scope> = {}): Scope => ({
  activeTabOnly: false,
  includeDomains: [],
  excludeDomains: [],
  initiatorDomains: [],
  excludedInitiatorDomains: [],
  urlFilter: '',
  resourceTypes: [],
  requestMethods: [],
  ...overrides,
});

const header = (id: string, name: string, value: string, comment = '') => ({
  id,
  name,
  value,
  variants: [] as string[],
  operation: 'set' as const,
  enabled: true,
  comment,
});

const base64url = (value: string): string =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** JWT sin firmar de mentira, solo para que el decodificador tenga algo que mostrar. */
export const DEMO_JWT = [
  base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  base64url(
    JSON.stringify({
      sub: 'usr_8f21c4',
      name: 'QA Staging',
      role: 'admin',
      tenant: 'acme',
      iat: 1_770_000_000,
      exp: 1_780_000_000,
    })
  ),
  'ZmlybWFfZGVfbWVudGlyYV9wYXJhX2xhc19jYXB0dXJhcw',
].join('.');

export const seedState = (): Partial<ToolkitState> => ({
  globalEnabled: true,
  profiles: [
    {
      id: 'prof-staging',
      name: 'API staging',
      color: '#6366f1',
      enabled: true,
      scope: scope({ includeDomains: ['api.staging.acme.dev', 'panel.staging.acme.dev'] }),
      requestHeaders: [
        header('h-auth', 'Authorization', 'Bearer {{uuid}}', 'token rotativo por request'),
        header('h-tenant', 'X-Acme-Tenant', 'acme-qa'),
        header('h-trace', 'X-Request-Id', '{{uuid}}'),
        header('h-debug', 'X-Debug-Mode', 'verbose'),
      ],
      responseHeaders: [header('h-cache', 'Cache-Control', 'no-store', 'para no pelear con el cache en QA')],
    },
    {
      id: 'prof-mobile',
      name: 'Simular cliente mobile',
      color: '#0ea5e9',
      enabled: false,
      scope: scope({ resourceTypes: ['xmlhttprequest'] }),
      requestHeaders: [header('h-plat', 'X-Client-Platform', 'ios')],
      responseHeaders: [],
    },
    {
      id: 'prof-legacy',
      name: 'Gateway viejo',
      color: '#f59e0b',
      enabled: false,
      scope: scope({ includeDomains: ['legacy.acme.dev'] }),
      requestHeaders: [header('h-api', 'X-Api-Version', '2019-04-01')],
      responseHeaders: [],
    },
  ],
  selectedProfileId: 'prof-staging',
  trafficRules: [
    {
      id: 'rule-flags',
      name: 'Mockear feature flags',
      enabled: true,
      scope: scope({ urlFilter: '/api/feature-flags' }),
      action: {
        kind: 'mock',
        status: 200,
        contentType: 'application/json',
        body: '{\n  "checkout_v2": true,\n  "nuevo_onboarding": true,\n  "pagos_offline": false\n}',
        delayMs: 0,
        headers: [],
      },
    },
    {
      id: 'rule-analytics',
      name: 'Bloquear analytics',
      enabled: true,
      scope: scope({ urlFilter: 'analytics' }),
      action: { kind: 'block' },
    },
    {
      id: 'rule-cdn',
      name: 'CDN al bundle local',
      enabled: false,
      scope: scope({ urlFilter: 'cdn.acme.dev' }),
      action: { kind: 'redirect', target: 'http://localhost:5173/\\1', useRegex: true },
    },
    {
      id: 'rule-chaos',
      name: 'Red lenta e inestable',
      enabled: false,
      scope: scope({ urlFilter: '/api/' }),
      action: { kind: 'chaos', delayMs: 1200, failRate: 15, failStatus: 503 },
    },
  ],
  userScripts: [
    {
      id: 'script-banner',
      name: 'Marcar que estoy en staging',
      description: 'Una franja arriba de todo para no confundir staging con produccion',
      enabled: true,
      language: 'css',
      matches: ['https://*.staging.acme.dev/*'],
      excludeMatches: [],
      runAt: 'document_end',
      world: 'MAIN',
      allFrames: false,
      updatedAt: 1_770_000_000_000,
      code: 'body::before {\n  content: "STAGING";\n  position: fixed;\n  inset: 0 0 auto 0;\n  z-index: 99999;\n  background: #f59e0b;\n  color: #1c1917;\n  font: 600 12px/24px system-ui;\n  text-align: center;\n}',
    },
  ],
  environments: [
    { id: 'env-staging', name: 'Staging completo', profileIds: ['prof-staging'], ruleIds: ['rule-flags', 'rule-analytics'] },
    { id: 'env-mobile', name: 'QA mobile', profileIds: ['prof-mobile'], ruleIds: ['rule-analytics'] },
    { id: 'env-caos', name: 'Probar red mala', profileIds: ['prof-staging'], ruleIds: ['rule-chaos'] },
  ],
  network: { enabled: true, maxEntries: 500, captureBodies: false, onlyModified: false },
  ui: { theme: 'dark', accent: '#6366f1', lastView: 'overview', density: 'comfortable' },
});
