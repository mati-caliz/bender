import { createEmptyScope } from '../src/lib/constants';
import type { Profile, TrafficRule } from '../src/types';
import { expect, expectPoll, test } from './fixtures';

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'p-e2e',
  name: 'Perfil e2e',
  color: '#6366f1',
  enabled: true,
  scope: createEmptyScope(),
  requestHeaders: [],
  responseHeaders: [],
  ...overrides,
});

const rule = (action: TrafficRule['action'], overrides: Partial<TrafficRule> = {}): TrafficRule => ({
  id: 'r-e2e',
  name: 'Regla e2e',
  enabled: true,
  scope: createEmptyScope(),
  action,
  ...overrides,
});

/**
 * Estas son las reglas que compila el motor a declarativeNetRequest y que ningun
 * test unitario puede cubrir: hay que ver el trafico real salir modificado.
 */
test('un perfil activo agrega el header a la request', async ({ context, server, applyState }) => {
  await applyState({
    globalEnabled: true,
    profiles: [
      profile({
        requestHeaders: [
          { id: 'h1', name: 'X-Bender', value: 'anduvo', variants: [], operation: 'set', enabled: true, comment: '' },
        ],
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/api/datos`);

  const request = server.requests.find((entry) => entry.url === '/api/datos');
  expect(request?.headers['x-bender']).toBe('anduvo');
});

test('con Bender apagado el header no se agrega', async ({ context, server, applyState }) => {
  await applyState({
    globalEnabled: false,
    profiles: [
      profile({
        requestHeaders: [
          { id: 'h1', name: 'X-Bender', value: 'anduvo', variants: [], operation: 'set', enabled: true, comment: '' },
        ],
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/api/apagado`);

  const request = server.requests.find((entry) => entry.url === '/api/apagado');
  expect(request?.headers['x-bender']).toBeUndefined();
});

test('un perfil apagado no aplica', async ({ context, server, applyState }) => {
  await applyState({
    globalEnabled: true,
    profiles: [
      profile({
        enabled: false,
        requestHeaders: [
          { id: 'h1', name: 'X-Bender', value: 'anduvo', variants: [], operation: 'set', enabled: true, comment: '' },
        ],
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/api/perfil-apagado`);

  expect(server.requests.find((entry) => entry.url === '/api/perfil-apagado')?.headers['x-bender']).toBeUndefined();
});

test('el alcance por filtro de URL limita a que requests se aplica', async ({ context, server, applyState }) => {
  await applyState({
    globalEnabled: true,
    profiles: [
      profile({
        scope: { ...createEmptyScope(), urlFilter: '/api/si' },
        requestHeaders: [
          { id: 'h1', name: 'X-Bender', value: 'solo-aca', variants: [], operation: 'set', enabled: true, comment: '' },
        ],
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/api/si`);
  await page.goto(`${server.origin}/api/no`);

  expect(server.requests.find((entry) => entry.url === '/api/si')?.headers['x-bender']).toBe('solo-aca');
  expect(server.requests.find((entry) => entry.url === '/api/no')?.headers['x-bender']).toBeUndefined();
});

test('una regla de bloqueo corta la request antes de llegar al servidor', async ({
  context,
  server,
  applyState,
}) => {
  await applyState({
    globalEnabled: true,
    profiles: [],
    trafficRules: [rule({ kind: 'block' }, { scope: { ...createEmptyScope(), urlFilter: '/api/bloqueada' } })],
  });

  const page = await context.newPage();
  const response = await page.goto(`${server.origin}/api/bloqueada`).catch(() => null);

  // Chrome corta la navegacion: la respuesta no llega y el servidor nunca la ve.
  expect(response).toBeNull();
  expect(server.requests.some((entry) => entry.url === '/api/bloqueada')).toBe(false);
});

test('una regla de redirect manda la request a otra URL', async ({ context, server, applyState }) => {
  await applyState({
    globalEnabled: true,
    profiles: [],
    trafficRules: [
      rule(
        { kind: 'redirect', target: `${server.origin}/api/destino`, useRegex: false },
        { scope: { ...createEmptyScope(), urlFilter: '/api/origen' } }
      ),
    ],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/api/origen`);

  await expectPoll(() => server.requests.some((entry) => entry.url === '/api/destino'));
  expect(server.requests.some((entry) => entry.url === '/api/origen')).toBe(false);
});
