import { describe, expect, it } from 'vitest';
import { createEmptyScope } from '@/lib/constants';
import {
  matchesDomain,
  parseDomainList,
  sanitizeDomain,
  sanitizeDomainList,
  scopeToCondition,
  urlFilterToRegExp,
  urlMatchesScope,
} from '@/lib/scope';
import type { Scope } from '@/types';

const scopeWith = (overrides: Partial<Scope>): Scope => ({ ...createEmptyScope(), ...overrides });

describe('sanitizeDomain', () => {
  it('saca esquema, puerto, path y comodin', () => {
    expect(sanitizeDomain('https://Api.Example.com:8443/v1/users')).toBe('api.example.com');
    expect(sanitizeDomain('*.example.com')).toBe('example.com');
    expect(sanitizeDomain('.example.com')).toBe('example.com');
  });

  it('rechaza dominios vacios o con caracteres invalidos', () => {
    expect(sanitizeDomain('   ')).toBeNull();
    expect(sanitizeDomain('exa mple.com')).toBeNull();
    expect(sanitizeDomain('http://')).toBeNull();
  });
});

describe('sanitizeDomainList', () => {
  it('descarta invalidos y deduplica lo que normaliza al mismo dominio', () => {
    expect(sanitizeDomainList(['*.example.com', 'https://example.com/path', 'no valido', ''])).toEqual([
      'example.com',
    ]);
  });
});

describe('parseDomainList', () => {
  it('separa por espacios, comas y punto y coma', () => {
    expect(parseDomainList('example.com, api.example.com;  cdn.example.com')).toEqual([
      'example.com',
      'api.example.com',
      'cdn.example.com',
    ]);
  });
});

describe('matchesDomain', () => {
  it('matchea el dominio exacto y sus subdominios', () => {
    expect(matchesDomain('example.com', 'example.com')).toBe(true);
    expect(matchesDomain('api.example.com', 'example.com')).toBe(true);
  });

  it('no matchea un dominio que solo termina parecido', () => {
    expect(matchesDomain('notexample.com', 'example.com')).toBe(false);
  });
});

describe('urlFilterToRegExp', () => {
  it('trata el comodin como cualquier cosa', () => {
    expect(urlFilterToRegExp('/api/*/users').test('https://example.com/api/v2/users')).toBe(true);
  });

  it('ancla el final con la barra vertical', () => {
    const pattern = urlFilterToRegExp('/users|');
    expect(pattern.test('https://example.com/users')).toBe(true);
    expect(pattern.test('https://example.com/users/1')).toBe(false);
  });

  it('traduce el separador ^ a un caracter no alfanumerico', () => {
    const pattern = urlFilterToRegExp('/api^');
    expect(pattern.test('https://example.com/api?x=1')).toBe(true);
    expect(pattern.test('https://example.com/apix')).toBe(false);
  });
});

describe('urlMatchesScope', () => {
  it('acepta cualquier url cuando el alcance esta vacio', () => {
    expect(urlMatchesScope(createEmptyScope(), 'https://example.com/')).toBe(true);
  });

  it('rechaza una url invalida', () => {
    expect(urlMatchesScope(createEmptyScope(), 'no es una url')).toBe(false);
  });

  it('respeta dominios incluidos y excluidos', () => {
    const scope = scopeWith({ includeDomains: ['example.com'], excludeDomains: ['cdn.example.com'] });
    expect(urlMatchesScope(scope, 'https://api.example.com/data')).toBe(true);
    expect(urlMatchesScope(scope, 'https://cdn.example.com/logo.png')).toBe(false);
    expect(urlMatchesScope(scope, 'https://otro.com/data')).toBe(false);
  });

  it('aplica el filtro de url ademas del dominio', () => {
    const scope = scopeWith({ includeDomains: ['example.com'], urlFilter: '/api/' });
    expect(urlMatchesScope(scope, 'https://example.com/api/users')).toBe(true);
    expect(urlMatchesScope(scope, 'https://example.com/home')).toBe(false);
  });
});

describe('scopeToCondition', () => {
  it('devuelve null cuando pide solo la pestaña activa y no hay ninguna', () => {
    expect(scopeToCondition(scopeWith({ activeTabOnly: true }), { activeTabId: null })).toBeNull();
  });

  it('limita a la pestaña activa cuando existe', () => {
    const condition = scopeToCondition(scopeWith({ activeTabOnly: true }), { activeTabId: 7 });
    expect(condition?.tabIds).toEqual([7]);
  });

  it('completa todos los tipos de recurso cuando no se eligio ninguno', () => {
    const condition = scopeToCondition(createEmptyScope(), { activeTabId: null });
    expect(condition?.resourceTypes).toContain('xmlhttprequest');
    expect(condition?.resourceTypes.length).toBeGreaterThan(1);
  });

  it('omite dominios y filtro cuando estan vacios', () => {
    const condition = scopeToCondition(createEmptyScope(), { activeTabId: null });
    expect(condition?.requestDomains).toBeUndefined();
    expect(condition?.excludedRequestDomains).toBeUndefined();
    expect(condition?.urlFilter).toBeUndefined();
  });

  it('normaliza los dominios que van a la condicion', () => {
    const condition = scopeToCondition(
      scopeWith({ includeDomains: ['*.Example.com'], excludeDomains: ['https://cdn.example.com/'] }),
      { activeTabId: null }
    );
    expect(condition?.requestDomains).toEqual(['example.com']);
    expect(condition?.excludedRequestDomains).toEqual(['cdn.example.com']);
  });
});
