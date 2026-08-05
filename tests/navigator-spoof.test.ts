import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_AGENT_CONFIG, createDefaultState, createEmptyScope } from '@/lib/constants';
import {
  NAVIGATOR_SPOOF_SCRIPT_ID,
  buildNavigatorSpoofCode,
  navigatorSpoofDiagnostics,
  navigatorSpoofRegistration,
} from '@/lib/navigator-spoof';
import { userAgentTraits } from '@/lib/user-agent-traits';
import type { Scope, ToolkitState, UserAgentConfig } from '@/types';

const IPHONE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const userAgentWith = (overrides: Partial<UserAgentConfig>): UserAgentConfig => ({
  ...DEFAULT_USER_AGENT_CONFIG,
  enabled: true,
  spoofNavigator: true,
  value: IPHONE_USER_AGENT,
  ...overrides,
});

const stateWith = (userAgent: Partial<UserAgentConfig>, overrides: Partial<ToolkitState> = {}): ToolkitState => ({
  ...createDefaultState(),
  userAgent: userAgentWith(userAgent),
  ...overrides,
});

const scopeWith = (overrides: Partial<Scope>): Scope => ({ ...createEmptyScope(), ...overrides });

describe('userAgentTraits', () => {
  it('reconoce un iPhone', () => {
    expect(userAgentTraits(IPHONE_USER_AGENT)).toEqual({
      mobile: true,
      platform: 'iOS',
      navigatorPlatform: 'iPhone',
      maxTouchPoints: 5,
      chromium: false,
    });
  });

  it('reconoce Chrome en Windows', () => {
    expect(userAgentTraits(WINDOWS_CHROME_USER_AGENT)).toEqual({
      mobile: false,
      platform: 'Windows',
      navigatorPlatform: 'Win32',
      maxTouchPoints: 0,
      chromium: true,
    });
  });

  it('trata el iPad como iOS tactil aunque no diga Mobile', () => {
    const traits = userAgentTraits('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Version/17.5 Safari/604.1');
    expect(traits.platform).toBe('iOS');
    expect(traits.navigatorPlatform).toBe('iPad');
    expect(traits.maxTouchPoints).toBe(5);
  });

  it('cae en Linux cuando no reconoce el sistema', () => {
    expect(userAgentTraits('curl/8.7.1').platform).toBe('Linux');
  });
});

describe('navigatorSpoofRegistration', () => {
  it('no registra nada con el motor apagado, el UA apagado, el spoof apagado o el valor vacio', () => {
    expect(navigatorSpoofRegistration(stateWith({}, { globalEnabled: false }))).toBeNull();
    expect(navigatorSpoofRegistration(stateWith({ enabled: false }))).toBeNull();
    expect(navigatorSpoofRegistration(stateWith({ spoofNavigator: false }))).toBeNull();
    expect(navigatorSpoofRegistration(stateWith({ value: '   ' }))).toBeNull();
  });

  it('cubre todas las urls cuando el alcance no tiene dominios', () => {
    const registration = navigatorSpoofRegistration(stateWith({}));
    expect(registration?.id).toBe(NAVIGATOR_SPOOF_SCRIPT_ID);
    expect(registration?.matches).toEqual(['*://*/*']);
    expect(registration?.excludeMatches).toEqual([]);
  });

  it('traduce los dominios del alcance a match patterns', () => {
    const registration = navigatorSpoofRegistration(
      stateWith({ scope: scopeWith({ includeDomains: ['Example.com', 'otro.com'], excludeDomains: ['cdn.example.com'] }) })
    );
    expect(registration?.matches).toEqual(['*://*.example.com/*', '*://*.otro.com/*']);
    expect(registration?.excludeMatches).toEqual(['*://*.cdn.example.com/*']);
  });
});

describe('buildNavigatorSpoofCode', () => {
  it('pisa las propiedades que miran los sitios', () => {
    const code = buildNavigatorSpoofCode(IPHONE_USER_AGENT);
    expect(code).toContain("define(navigator, 'userAgent', userAgent)");
    expect(code).toContain("define(navigator, 'platform', platform)");
    expect(code).toContain("define(navigator, 'maxTouchPoints', maxTouchPoints)");
    expect(code).toContain(JSON.stringify(IPHONE_USER_AGENT));
    expect(code).toContain('const mobile = true;');
    expect(code).toContain('const maxTouchPoints = 5;');
  });

  it('vacia las brands cuando el user agent no es chromium', () => {
    expect(buildNavigatorSpoofCode(IPHONE_USER_AGENT)).toContain('const brands = [];');
    expect(buildNavigatorSpoofCode(WINDOWS_CHROME_USER_AGENT)).toContain('navigator.userAgentData?.brands');
  });

  it('escapa un user agent con comillas para no romper el script', () => {
    const code = buildNavigatorSpoofCode('raro "con comillas" y \\ barra');
    expect(() => new Function(code)).not.toThrow();
  });

  it('genera codigo evaluable', () => {
    expect(() => new Function(buildNavigatorSpoofCode(IPHONE_USER_AGENT))).not.toThrow();
  });
});

describe('navigatorSpoofDiagnostics', () => {
  it('no avisa nada con un alcance por dominio', () => {
    expect(navigatorSpoofDiagnostics(userAgentWith({ scope: scopeWith({ includeDomains: ['example.com'] }) }))).toEqual(
      []
    );
  });

  it('avisa que ignora la pestaña activa y el filtro de url', () => {
    const diagnostics = navigatorSpoofDiagnostics(
      userAgentWith({ scope: scopeWith({ activeTabOnly: true, urlFilter: '/api/' }) })
    );
    expect(diagnostics.map((diagnostic) => diagnostic.level)).toEqual(['warning', 'warning']);
    expect(diagnostics[0]?.message).toContain('pestaña activa');
    expect(diagnostics[1]?.message).toContain('URL');
  });

  it('no avisa nada con el spoof apagado', () => {
    expect(
      navigatorSpoofDiagnostics(userAgentWith({ spoofNavigator: false, scope: scopeWith({ activeTabOnly: true }) }))
    ).toEqual([]);
  });
});
