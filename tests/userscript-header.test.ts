import { describe, expect, it } from 'vitest';
import { describeHeader, headerHasData, parseUserScriptHeader } from '@/lib/userscript-header';

const wrap = (lines: string[]): string =>
  ['// ==UserScript==', ...lines, '// ==/UserScript==', '', "console.log('hola');"].join('\n');

describe('parseUserScriptHeader', () => {
  it('no encuentra nada en un script sin header', () => {
    const header = parseUserScriptHeader("console.log('hola');");

    expect(header.name).toBeNull();
    expect(header.matches).toEqual([]);
    expect(headerHasData(header)).toBe(false);
  });

  it('lee un header tipico de Tampermonkey', () => {
    const header = parseUserScriptHeader(
      wrap([
        '// @name         Mi script',
        '// @description  Hace cosas',
        '// @match        https://example.com/*',
        '// @match        https://otro.com/*',
        '// @exclude      https://example.com/admin/*',
        '// @run-at       document-start',
        '// @grant        none',
      ])
    );

    expect(header.name).toBe('Mi script');
    expect(header.description).toBe('Hace cosas');
    expect(header.matches).toEqual(['https://example.com/*', 'https://otro.com/*']);
    expect(header.excludeMatches).toEqual(['https://example.com/admin/*']);
    expect(header.runAt).toBe('document_start');
  });

  it('traduce los run-at de Tampermonkey al formato de chrome.userScripts', () => {
    const runAt = (value: string) => parseUserScriptHeader(wrap([`// @run-at ${value}`])).runAt;

    expect(runAt('document-start')).toBe('document_start');
    expect(runAt('document-end')).toBe('document_end');
    expect(runAt('document-idle')).toBe('document_idle');
    expect(runAt('document-body')).toBe('document_end');
  });

  it('ignora un run-at que no conoce en vez de inventar uno', () => {
    expect(parseUserScriptHeader(wrap(['// @run-at context-menu'])).runAt).toBeNull();
  });

  it('acepta @include y @exclude de Greasemonkey', () => {
    const header = parseUserScriptHeader(wrap(['// @include http://a.com/*', '// @exclude-match http://a.com/x']));

    expect(header.matches).toEqual(['http://a.com/*']);
    expect(header.excludeMatches).toEqual(['http://a.com/x']);
  });

  it('se queda con el primer @name cuando esta repetido', () => {
    expect(parseUserScriptHeader(wrap(['// @name Uno', '// @name Dos'])).name).toBe('Uno');
  });

  it('ignora las etiquetas sin valor', () => {
    expect(parseUserScriptHeader(wrap(['// @name', '// @match'])).name).toBeNull();
  });

  it('tolera espacios raros y mayusculas en la etiqueta', () => {
    const header = parseUserScriptHeader(wrap(['//   @NAME    Con espacios   ', '//@match   https://a.com/*']));

    expect(header.name).toBe('Con espacios');
    expect(header.matches).toEqual(['https://a.com/*']);
  });

  it('no lee etiquetas que estan fuera del bloque', () => {
    const code = ['// @name Afuera', '// ==UserScript==', '// @match https://a.com/*', '// ==/UserScript=='].join('\n');

    expect(parseUserScriptHeader(code).name).toBeNull();
    expect(parseUserScriptHeader(code).matches).toEqual(['https://a.com/*']);
  });

  it('no rompe con un bloque abierto sin cerrar', () => {
    const header = parseUserScriptHeader('// ==UserScript==\n// @name Roto\n');

    expect(header.name).toBeNull();
    expect(headerHasData(header)).toBe(false);
  });
});

describe('headerHasData', () => {
  it('alcanza con que traiga un solo dato', () => {
    expect(headerHasData(parseUserScriptHeader(wrap(['// @match https://a.com/*'])))).toBe(true);
    expect(headerHasData(parseUserScriptHeader(wrap(['// @grant none'])))).toBe(false);
  });
});

describe('describeHeader', () => {
  it('resume lo que se va a aplicar', () => {
    const header = parseUserScriptHeader(
      wrap(['// @name Mi script', '// @match https://a.com/*', '// @run-at document-start'])
    );

    expect(describeHeader(header)).toBe('nombre "Mi script" · 1 patron(es) · run-at document_start');
  });
});
