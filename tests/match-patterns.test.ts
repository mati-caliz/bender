import { describe, expect, it } from 'vitest';
import {
  isValidMatchPattern,
  matchPatternToRegExp,
  parseMatchPatterns,
  sanitizeMatchPatterns,
  urlMatchesPatterns,
} from '@/lib/match-patterns';

describe('isValidMatchPattern', () => {
  it('acepta los patrones que usa Chrome', () => {
    expect(isValidMatchPattern('<all_urls>')).toBe(true);
    expect(isValidMatchPattern('*://*/*')).toBe(true);
    expect(isValidMatchPattern('https://*.example.com/*')).toBe(true);
    expect(isValidMatchPattern('file:///home/*')).toBe(true);
  });

  it('rechaza patrones sin path o con esquema no soportado', () => {
    expect(isValidMatchPattern('https://example.com')).toBe(false);
    expect(isValidMatchPattern('ftp://example.com/*')).toBe(false);
    expect(isValidMatchPattern('')).toBe(false);
  });
});

describe('sanitizeMatchPatterns', () => {
  it('limpia espacios, descarta invalidos y deduplica', () => {
    expect(sanitizeMatchPatterns([' https://example.com/* ', 'https://example.com/*', 'no valido'])).toEqual([
      'https://example.com/*',
    ]);
  });
});

describe('parseMatchPatterns', () => {
  it('separa por espacios, saltos de linea y comas', () => {
    expect(parseMatchPatterns('https://uno.com/*,  https://dos.com/*\nhttps://tres.com/*')).toEqual([
      'https://uno.com/*',
      'https://dos.com/*',
      'https://tres.com/*',
    ]);
  });
});

describe('matchPatternToRegExp', () => {
  it('limita <all_urls> a esquemas soportados', () => {
    const pattern = matchPatternToRegExp('<all_urls>');
    expect(pattern?.test('https://example.com/x')).toBe(true);
    expect(pattern?.test('chrome://extensions')).toBe(false);
  });

  it('expande el comodin de esquema solo a http y https', () => {
    const pattern = matchPatternToRegExp('*://example.com/*');
    expect(pattern?.test('http://example.com/')).toBe(true);
    expect(pattern?.test('https://example.com/')).toBe(true);
    expect(pattern?.test('file://example.com/')).toBe(false);
  });

  it('hace opcional el subdominio con *.', () => {
    const pattern = matchPatternToRegExp('https://*.example.com/*');
    expect(pattern?.test('https://example.com/')).toBe(true);
    expect(pattern?.test('https://api.example.com/x')).toBe(true);
    expect(pattern?.test('https://notexample.com/')).toBe(false);
  });

  it('respeta el path exacto cuando no tiene comodin', () => {
    const pattern = matchPatternToRegExp('https://example.com/api');
    expect(pattern?.test('https://example.com/api')).toBe(true);
    expect(pattern?.test('https://example.com/api/users')).toBe(false);
  });

  it('devuelve null con un patron invalido', () => {
    expect(matchPatternToRegExp('ftp://example.com/*')).toBeNull();
  });
});

describe('urlMatchesPatterns', () => {
  it('exige al menos un patron que matchee', () => {
    expect(urlMatchesPatterns('https://example.com/x', [])).toBe(false);
    expect(urlMatchesPatterns('https://example.com/x', ['https://example.com/*'])).toBe(true);
  });

  it('las exclusiones le ganan a las inclusiones', () => {
    expect(
      urlMatchesPatterns('https://admin.example.com/x', ['https://*.example.com/*'], ['https://admin.example.com/*'])
    ).toBe(false);
  });

  it('ignora patrones invalidos en vez de romper', () => {
    expect(urlMatchesPatterns('https://example.com/x', ['ftp://x/*', 'https://example.com/*'])).toBe(true);
  });
});
