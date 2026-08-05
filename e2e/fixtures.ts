import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import type { ToolkitState } from '../src/types';

const EXTENSION_PATH = fileURLToPath(new URL('../dist', import.meta.url));

export interface TestServer {
  origin: string;
  /** Lo que el servidor recibio, para comprobar que la extension toco la request. */
  requests: Array<{ url: string; headers: Record<string, string> }>;
}

/**
 * Un servidor real en vez de `route.fulfill` de Playwright: las reglas DNR actuan
 * sobre trafico de verdad, y un mock de Playwright lo cortaria antes.
 */
const startServer = async (): Promise<{ server: Server; test: TestServer }> => {
  const state: TestServer = { origin: '', requests: [] };

  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    state.requests.push({
      url,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : (value ?? '')])
      ),
    });

    if (url.startsWith('/api/')) {
      response.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      response.end(JSON.stringify({ ok: true, url }));
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>bender e2e</title></head><body><h1 id="titulo">hola</h1></body></html>');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('el servidor de prueba no expuso un puerto');
  state.origin = `http://127.0.0.1:${address.port}`;

  return { server, test: state };
};

/** `updatedAt` del ultimo status publicado por el motor, o 0 si todavia no hubo. */
export const readAppliedAt = async (serviceWorker: Worker): Promise<number> =>
  serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.session.get('benderEngineStatus');
    const status = stored.benderEngineStatus as { updatedAt?: number } | undefined;
    return status?.updatedAt ?? 0;
  });

const POLL_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 100;

/** Espera a que una condicion se cumpla, sin depender del reloj del motor. */
export const expectPoll = async (condition: () => boolean | Promise<boolean>): Promise<void> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (await condition()) return;
    if (Date.now() > deadline) throw new Error('la condicion no se cumplio a tiempo');
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

export interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  server: TestServer;
  /** Escribe el estado de Bender y espera a que el motor lo aplique. */
  applyState: (state: Partial<ToolkitState>) => Promise<void>;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'bender-e2e-'));
    // chrome.userScripts solo existe con el modo desarrollador prendido, y no hay
    // flag de linea de comandos: se siembra la preferencia en el perfil.
    await mkdir(join(userDataDir, 'Default'), { recursive: true });
    await writeFile(
      join(userDataDir, 'Default', 'Preferences'),
      JSON.stringify({ extensions: { ui: { developer_mode: true } } })
    );

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  server: async ({}, use) => {
    const { server, test: state } = await startServer();
    await use(state);
    // Chrome deja conexiones keep-alive abiertas: sin cerrarlas, close() nunca vuelve.
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  },

  applyState: async ({ serviceWorker }, use) => {
    await use(async (partial) => {
      // Escribir el estado ya dispara scheduleApply por el listener de
      // storage.onChanged; mandarle un mensaje al propio service worker no
      // funciona, porque no se entrega a si mismo.
      const before = await readAppliedAt(serviceWorker);

      await serviceWorker.evaluate(async (incoming) => {
        const key = 'benderState';
        const stored = await chrome.storage.local.get(key);
        const current: unknown = stored[key];
        const base = typeof current === 'object' && current !== null ? current : {};
        await chrome.storage.local.set({ [key]: { ...base, ...incoming } });
      }, partial);

      // El motor compila con debounce: hay que esperar a que publique un status nuevo.
      await expectPoll(async () => (await readAppliedAt(serviceWorker)) > before);
    });
  },
});

export const expect = test.expect;
