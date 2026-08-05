import { describe, expect, it } from 'vitest';
import { DEFAULT_CORS_CONFIG, DEFAULT_USER_AGENT_CONFIG, createDefaultState, createEmptyScope } from '@/lib/constants';
import { type CompileContext, compileRules } from '@/lib/dnr';
import { createHeaderEntry } from '@/lib/factories';
import type { HeaderEntry, Profile, ToolkitState, TrafficRule, TrafficRuleAction } from '@/types';

const EMPTY_CONTEXT: CompileContext = { activeTabId: null, tabs: [] };

const profileWith = (overrides: Partial<Profile>): Profile => ({
  id: 'profile-1',
  name: 'Test',
  color: '#000000',
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
  ...overrides,
});

const trafficRuleWith = (action: TrafficRuleAction, overrides: Partial<TrafficRule> = {}): TrafficRule => ({
  id: 'rule-1',
  name: 'Regla',
  enabled: true,
  scope: createEmptyScope(),
  action,
  ...overrides,
});

const stateWith = (overrides: Partial<ToolkitState>): ToolkitState => ({ ...createDefaultState(), ...overrides });

const header = (name: string, value: string, overrides: Partial<HeaderEntry> = {}): HeaderEntry =>
  createHeaderEntry({ name, value, ...overrides });

const errorMessages = (state: ToolkitState, context: CompileContext = EMPTY_CONTEXT): string[] =>
  compileRules(state, context)
    .diagnostics.filter((diagnostic) => diagnostic.level === 'error')
    .map((diagnostic) => diagnostic.message);

describe('compileRules con el motor apagado', () => {
  it('no genera ninguna regla', () => {
    const state = stateWith({
      globalEnabled: false,
      profiles: [profileWith({ requestHeaders: [header('x-test', '1')] })],
    });
    expect(compileRules(state, EMPTY_CONTEXT).rules).toEqual([]);
  });
});

describe('compileRules con perfiles', () => {
  it('ignora perfiles apagados y cuenta los activos', () => {
    const state = stateWith({
      profiles: [
        profileWith({ id: 'a', requestHeaders: [header('x-uno', '1')] }),
        profileWith({ id: 'b', enabled: false, requestHeaders: [header('x-dos', '2')] }),
      ],
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    expect(compiled.activeProfileCount).toBe(1);
    expect(compiled.rules).toHaveLength(1);
  });

  it('ignora perfiles sin headers utiles', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header('  ', 'x'), header('x-off', '1', { enabled: false })] })],
    });
    expect(compileRules(state, EMPTY_CONTEXT).rules).toEqual([]);
  });

  it('da mas prioridad al perfil que esta mas abajo en la lista', () => {
    const state = stateWith({
      profiles: [
        profileWith({ id: 'a', requestHeaders: [header('x-uno', '1')] }),
        profileWith({ id: 'b', requestHeaders: [header('x-dos', '2')] }),
      ],
    });
    const [first, second] = compileRules(state, EMPTY_CONTEXT).rules;
    expect(second?.priority).toBeGreaterThan(first?.priority ?? 0);
  });

  it('descarta un nombre de header invalido y lo reporta', () => {
    const state = stateWith({ profiles: [profileWith({ requestHeaders: [header('x test', '1')] })] });
    expect(errorMessages(state)[0]).toContain('x test');
  });

  it('omite el valor en la operacion remove', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header('x-borrar', 'ignorado', { operation: 'remove' })] })],
    });
    const [rule] = compileRules(state, EMPTY_CONTEXT).rules;
    expect(rule?.action.requestHeaders).toEqual([{ header: 'x-borrar', operation: 'remove' }]);
  });

  it('deduplica un set repetido avisando, pero conserva todos los append', () => {
    const state = stateWith({
      profiles: [
        profileWith({
          requestHeaders: [
            header('x-uno', 'a'),
            header('X-Uno', 'b'),
            header('x-dos', 'c', { operation: 'append' }),
            header('x-dos', 'd', { operation: 'append' }),
          ],
        }),
      ],
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    const requestHeaders = compiled.rules[0]?.action.requestHeaders ?? [];
    expect(requestHeaders.filter((entry) => entry.header.toLowerCase() === 'x-uno')).toEqual([
      { header: 'X-Uno', operation: 'set', value: 'b' },
    ]);
    expect(requestHeaders.filter((entry) => entry.header === 'x-dos')).toHaveLength(2);
    expect(compiled.diagnostics.some((diagnostic) => diagnostic.level === 'warning')).toBe(true);
  });

  it('saltea el perfil cuando pide la pestaña activa y no hay ninguna', () => {
    const state = stateWith({
      profiles: [
        profileWith({
          scope: { ...createEmptyScope(), activeTabOnly: true },
          requestHeaders: [header('x-test', '1')],
        }),
      ],
    });
    expect(compileRules(state, EMPTY_CONTEXT).rules).toEqual([]);
  });
});

describe('compileRules con CORS', () => {
  it('genera una regla por pestaña cuando refleja el origen', () => {
    const state = stateWith({ cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: 'reflect' } });
    const compiled = compileRules(state, {
      activeTabId: 1,
      tabs: [
        { id: 1, origin: 'https://uno.com' },
        { id: 2, origin: 'https://dos.com' },
      ],
    });
    expect(compiled.rules).toHaveLength(2);
    expect(compiled.rules[0]?.condition.tabIds).toEqual([1]);
    expect(compiled.rules[1]?.action.responseHeaders?.[0]).toEqual({
      header: 'access-control-allow-origin',
      operation: 'set',
      value: 'https://dos.com',
    });
  });

  it('avisa cuando refleja el origen y no hay pestañas', () => {
    const state = stateWith({ cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: 'reflect' } });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    expect(compiled.rules).toEqual([]);
    expect(compiled.diagnostics[0]?.level).toBe('warning');
  });

  it('avisa que el comodin no convive con credenciales', () => {
    const state = stateWith({
      cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: 'wildcard', allowCredentials: true },
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    expect(compiled.diagnostics.some((diagnostic) => diagnostic.message.includes('credenciales'))).toBe(true);
    expect(compiled.rules).toHaveLength(1);
  });

  it('falla cuando el origen a medida esta vacio', () => {
    const state = stateWith({
      cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: 'custom', customOrigin: '   ' },
    });
    expect(errorMessages(state)[0]).toContain('origen permitido');
  });

  it('saca credenciales, CSP y x-frame-options cuando corresponde', () => {
    const state = stateWith({
      cors: {
        ...DEFAULT_CORS_CONFIG,
        enabled: true,
        allowOrigin: 'wildcard',
        allowCredentials: false,
        removeContentSecurityPolicy: true,
        removeFrameOptions: true,
      },
    });
    const removed = (compileRules(state, EMPTY_CONTEXT).rules[0]?.action.responseHeaders ?? [])
      .filter((entry) => entry.operation === 'remove')
      .map((entry) => entry.header);
    expect(removed).toEqual([
      'access-control-allow-credentials',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
    ]);
  });
});

describe('compileRules con User-Agent', () => {
  it('le gana en prioridad a los perfiles', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header('user-agent', 'a mano')] })],
      userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: 'curl/8.7.1' },
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    const [profileRule, userAgentRule] = compiled.rules;
    expect(userAgentRule?.priority).toBeGreaterThan(profileRule?.priority ?? 0);
  });

  it('deriva los client hints de un user agent mobile', () => {
    const state = stateWith({
      userAgent: {
        ...DEFAULT_USER_AGENT_CONFIG,
        enabled: true,
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0.0.0 Mobile Safari/537.36',
        spoofClientHints: true,
      },
    });
    const requestHeaders = compileRules(state, EMPTY_CONTEXT).rules[0]?.action.requestHeaders ?? [];
    expect(requestHeaders).toContainEqual({ header: 'sec-ch-ua-mobile', operation: 'set', value: '?1' });
    expect(requestHeaders).toContainEqual({ header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' });
    expect(requestHeaders.some((entry) => entry.header === 'sec-ch-ua')).toBe(false);
  });

  it('borra los client hints de marca cuando el user agent no es chromium', () => {
    const state = stateWith({
      userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: 'curl/8.7.1', spoofClientHints: true },
    });
    const requestHeaders = compileRules(state, EMPTY_CONTEXT).rules[0]?.action.requestHeaders ?? [];
    expect(requestHeaders).toContainEqual({ header: 'sec-ch-ua', operation: 'remove' });
    expect(requestHeaders).toContainEqual({ header: 'sec-ch-ua-mobile', operation: 'set', value: '?0' });
  });

  it('no toca los client hints cuando esta desactivado', () => {
    const state = stateWith({
      userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: 'curl/8.7.1', spoofClientHints: false },
    });
    const requestHeaders = compileRules(state, EMPTY_CONTEXT).rules[0]?.action.requestHeaders ?? [];
    expect(requestHeaders).toEqual([{ header: 'user-agent', operation: 'set', value: 'curl/8.7.1' }]);
  });

  it('falla cuando el valor esta vacio', () => {
    const state = stateWith({ userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: '  ' } });
    expect(errorMessages(state)[0]).toContain('User-Agent');
  });
});

describe('compileRules con reglas de trafico', () => {
  it('ignora los mocks porque no pasan por DNR', () => {
    const state = stateWith({
      trafficRules: [
        trafficRuleWith({ kind: 'mock', status: 200, contentType: 'application/json', body: '{}', delayMs: 0, headers: [] }),
      ],
    });
    expect(compileRules(state, EMPTY_CONTEXT).rules).toEqual([]);
  });

  it('el bloqueo le gana al redirect', () => {
    const state = stateWith({
      trafficRules: [
        trafficRuleWith({ kind: 'redirect', target: 'https://destino.com/', useRegex: false }, { id: 'r' }),
        trafficRuleWith({ kind: 'block' }, { id: 'b' }),
      ],
    });
    const [redirect, block] = compileRules(state, EMPTY_CONTEXT).rules;
    expect(block?.priority).toBeGreaterThan(redirect?.priority ?? 0);
  });

  it('cambia urlFilter por regexFilter cuando el redirect usa regex', () => {
    const state = stateWith({
      trafficRules: [
        trafficRuleWith(
          { kind: 'redirect', target: 'https://local.test/\\1', useRegex: true },
          { scope: { ...createEmptyScope(), urlFilter: '^https://api\\.com/(.*)$' } }
        ),
      ],
    });
    const [rule] = compileRules(state, EMPTY_CONTEXT).rules;
    expect(rule?.condition.regexFilter).toBe('^https://api\\.com/(.*)$');
    expect(rule?.condition.urlFilter).toBeUndefined();
    expect(rule?.action.redirect).toEqual({ regexSubstitution: 'https://local.test/\\1' });
  });

  it('falla con regex invalida, patron vacio, destino vacio o destino relativo', () => {
    const regexInvalida = stateWith({
      trafficRules: [
        trafficRuleWith(
          { kind: 'redirect', target: 'https://destino.com/', useRegex: true },
          { scope: { ...createEmptyScope(), urlFilter: '([' } }
        ),
      ],
    });
    const patronVacio = stateWith({
      trafficRules: [trafficRuleWith({ kind: 'redirect', target: 'https://destino.com/', useRegex: true })],
    });
    const destinoVacio = stateWith({
      trafficRules: [trafficRuleWith({ kind: 'redirect', target: '  ', useRegex: false })],
    });
    const destinoRelativo = stateWith({
      trafficRules: [trafficRuleWith({ kind: 'redirect', target: '/local', useRegex: false })],
    });

    expect(errorMessages(regexInvalida)[0]).toContain('regex');
    expect(errorMessages(patronVacio)[0]).toContain('patron de URL');
    expect(errorMessages(destinoVacio)[0]).toContain('destino');
    expect(errorMessages(destinoRelativo)[0]).toContain('URL absoluta');
  });
});

describe('compileRules en conjunto', () => {
  it('numera las reglas sin repetir y etiqueta cada una', () => {
    const state = stateWith({
      profiles: [profileWith({ requestHeaders: [header('x-test', '1')] })],
      cors: { ...DEFAULT_CORS_CONFIG, enabled: true, allowOrigin: 'wildcard', allowCredentials: false },
      userAgent: { ...DEFAULT_USER_AGENT_CONFIG, enabled: true, value: 'curl/8.7.1' },
      trafficRules: [trafficRuleWith({ kind: 'block' })],
    });
    const compiled = compileRules(state, EMPTY_CONTEXT);
    const ids = compiled.rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => compiled.labels[id] !== undefined)).toBe(true);
  });
});
