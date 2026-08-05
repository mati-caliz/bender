import { describe, expect, it } from 'vitest';
import { createMockRuleFromEntry } from '@/lib/factories';
import { toHar } from '@/lib/har';
import { toCurl, toFetchSnippet } from '@/lib/request-snippets';
import type { NetworkEntry } from '@/types';

const entryWith = (overrides: Partial<NetworkEntry> = {}): NetworkEntry => ({
  id: 'entry-1',
  tabId: 1,
  url: 'https://api.example.com/v1/users?page=2',
  method: 'GET',
  resourceType: 'xmlhttprequest',
  phase: 'complete',
  statusCode: 200,
  statusLine: 'HTTP/1.1 200 OK',
  fromCache: false,
  startedAt: 1_700_000_000_000,
  finishedAt: 1_700_000_000_120,
  error: null,
  requestHeaders: [{ name: 'accept', value: 'application/json' }],
  responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
  matchedRuleIds: [],
  matchedRuleLabels: [],
  source: 'network',
  requestBody: null,
  responseBody: null,
  bodyTruncated: false,
  ...overrides,
});

describe('toCurl', () => {
  it('no escribe -X para un GET y cita cada header', () => {
    const curl = toCurl(entryWith());

    expect(curl).toContain("curl 'https://api.example.com/v1/users?page=2'");
    expect(curl).toContain("-H 'accept: application/json'");
    expect(curl).not.toContain('-X');
  });

  it('agrega metodo y cuerpo cuando corresponde', () => {
    const curl = toCurl(entryWith({ method: 'POST', requestBody: '{"nombre":"Ana"}' }));

    expect(curl).toContain('-X POST');
    expect(curl).toContain('--data-raw \'{"nombre":"Ana"}\'');
  });

  it('escapa las comillas simples del cuerpo', () => {
    const curl = toCurl(entryWith({ method: 'POST', requestBody: "it's" }));

    expect(curl).toContain("--data-raw 'it'\\''s'");
  });
});

describe('toFetchSnippet', () => {
  it('arma un fetch con headers y cuerpo', () => {
    const snippet = toFetchSnippet(entryWith({ method: 'POST', requestBody: '{"ok":true}' }));

    expect(snippet).toContain('await fetch("https://api.example.com/v1/users?page=2"');
    expect(snippet).toContain('"method": "POST"');
    expect(snippet).toContain('"accept": "application/json"');
    expect(snippet).toContain('"body": "{\\"ok\\":true}"');
  });
});

describe('toHar', () => {
  it('arma un log 1.2 ordenado por hora de inicio', () => {
    const har = toHar(
      [entryWith({ id: 'segundo', startedAt: 2_000 }), entryWith({ id: 'primero', startedAt: 1_000 })],
      '1.0.0'
    );

    expect(har.log.version).toBe('1.2');
    expect(har.log.creator).toEqual({ name: 'Bender', version: '1.0.0' });
    expect(har.log.entries[0]?.startedDateTime).toBe(new Date(1_000).toISOString());
  });

  it('lleva el query string y el mime type de la response', () => {
    const [harEntry] = toHar([entryWith()], '1.0.0').log.entries;

    expect(harEntry?.request.queryString).toEqual([{ name: 'page', value: '2' }]);
    expect(harEntry?.response.content.mimeType).toBe('application/json; charset=utf-8');
  });

  it('incluye los cuerpos capturados y avisa si estan truncados', () => {
    const entry = entryWith({ requestBody: '{"a":1}', responseBody: '{"b":2}', bodyTruncated: true });
    const [harEntry] = toHar([entry], '1.0.0').log.entries;

    expect(harEntry?.request.postData?.text).toBe('{"a":1}');
    expect(harEntry?.response.content.text).toBe('{"b":2}');
    expect(harEntry?.comment).toContain('truncado');
  });

  it('deja el contenido vacio cuando no se capturo nada', () => {
    const [harEntry] = toHar([entryWith()], '1.0.0').log.entries;

    expect(harEntry?.request.postData).toBeUndefined();
    expect(harEntry?.response.content.text).toBeUndefined();
  });
});

describe('createMockRuleFromEntry', () => {
  it('ancla la URL exacta y fija el metodo de la entrada', () => {
    const rule = createMockRuleFromEntry(entryWith({ method: 'POST' }), 0);

    expect(rule.scope.urlFilter).toBe('|https://api.example.com/v1/users?page=2|');
    expect(rule.scope.requestMethods).toEqual(['post']);
  });

  it('copia status, content-type y cuerpo capturado', () => {
    const entry = entryWith({ statusCode: 201, responseBody: '{"id":9}' });
    const rule = createMockRuleFromEntry(entry, 0);

    expect(rule.action).toMatchObject({
      kind: 'mock',
      status: 201,
      contentType: 'application/json; charset=utf-8',
      body: '{"id":9}',
    });
  });

  it('deja el cuerpo vacio si no se capturo', () => {
    const rule = createMockRuleFromEntry(entryWith(), 0);

    expect(rule.action).toMatchObject({ kind: 'mock', body: '' });
  });
});
