import { createUserScript } from '../src/lib/factories';
import type { UserScript } from '../src/types';
import { expect, expectPoll, test } from './fixtures';

const script = (overrides: Partial<UserScript> = {}): UserScript => ({
  ...createUserScript('javascript', 0),
  id: 's-e2e',
  ...overrides,
});

/**
 * `chrome.userScripts` solo existe con el modo desarrollador prendido. Chrome
 * lanzado por Playwright con --load-extension no siempre lo habilita, asi que los
 * tests se saltean con un motivo visible en vez de fallar por algo del entorno.
 */
const requireUserScripts = async (serviceWorker: { evaluate: <T>(fn: () => T) => Promise<T> }): Promise<void> => {
  const supported = await serviceWorker.evaluate(() => typeof chrome.userScripts !== 'undefined');
  test.skip(!supported, 'este Chrome no expone chrome.userScripts (hace falta modo desarrollador)');
};

test('un userscript activo corre en la pagina que matchea', async ({
  context,
  server,
  serviceWorker,
  applyState,
}) => {
  await requireUserScripts(serviceWorker);

  await applyState({
    globalEnabled: true,
    userScripts: [
      script({
        matches: ['http://127.0.0.1/*'],
        runAt: 'document_end',
        world: 'MAIN',
        code: "document.title = 'tocado por bender';",
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(server.origin);

  await expectPoll(async () => (await page.title()) === 'tocado por bender');
});

test('un userscript apagado no corre', async ({ context, server, serviceWorker, applyState }) => {
  await requireUserScripts(serviceWorker);

  await applyState({
    globalEnabled: true,
    userScripts: [
      script({
        enabled: false,
        matches: ['http://127.0.0.1/*'],
        runAt: 'document_end',
        world: 'MAIN',
        code: "document.title = 'no deberia';",
      }),
    ],
  });

  const page = await context.newPage();
  await page.goto(server.origin);

  expect(await page.title()).toBe('bender e2e');
});

test('el registro reporta cuantos scripts quedaron activos', async ({ serviceWorker, applyState }) => {
  await requireUserScripts(serviceWorker);

  await applyState({
    globalEnabled: true,
    userScripts: [
      script({ id: 's1', matches: ['http://127.0.0.1/*'], code: 'void 0;' }),
      script({ id: 's2', matches: ['http://127.0.0.1/*'], code: 'void 0;' }),
    ],
  });

  const registered = await serviceWorker.evaluate(async () => {
    const scripts = await chrome.userScripts.getScripts();
    return scripts.filter((entry) => entry.id.startsWith('bender-')).length;
  });

  expect(registered).toBe(2);
});
