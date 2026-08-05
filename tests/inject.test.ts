// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyScope } from '@/lib/constants';
import type { ChaosDefinition, MockDefinition, PageConfig } from '@/types';

const mock = (overrides: Partial<MockDefinition> = {}): MockDefinition => ({
  id: 'm1',
  name: 'Mock de prueba',
  scope: createEmptyScope(),
  status: 200,
  contentType: 'application/json',
  body: '{"ok":true}',
  delayMs: 0,
  headers: [],
  ...overrides,
});

const chaos = (overrides: Partial<ChaosDefinition> = {}): ChaosDefinition => ({
  id: 'c1',
  name: 'Chaos de prueba',
  scope: createEmptyScope(),
  delayMs: 0,
  failRate: 0,
  failStatus: 500,
  ...overrides,
});

interface Harness {
  realFetch: ReturnType<typeof vi.fn>;
  realBeacon: ReturnType<typeof vi.fn>;
  hits: Array<{ ruleName: string; status: number; url: string }>;
}

/** La entrega por MessagePort es asincrona: hay que dejar pasar un tick. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * inject.ts parchea los globals al importarse y pide su configuracion por un
 * MessageChannel que transfiere en el handshake.
 *
 * jsdom no implementa transferables: el listener de 'message' recibe el mensaje
 * pero con `ports` vacio. Asi que en vez de escuchar el evento, se intercepta
 * `postMessage` y se toma el port de la lista de transfer. El modulo corre sin
 * modificar; lo unico que cambia es como lo observa el test.
 */
const loadInject = async (config: Partial<PageConfig> = {}): Promise<Harness> => {
  const realFetch = vi.fn(() => Promise.resolve(new Response('real', { status: 200 })));
  window.fetch = realFetch;

  // inject.ts se guarda el original al importarse, asi que va antes del import.
  const realBeacon = vi.fn(() => true);
  navigator.sendBeacon = realBeacon;

  let transferred: MessagePort | null = null;
  const originalPostMessage = window.postMessage.bind(window);
  window.postMessage = ((message: unknown, targetOrigin: string, transfer?: Transferable[]) => {
    const port = transfer?.[0];
    if (port instanceof MessagePort) transferred = port;
    originalPostMessage(message, targetOrigin);
  }) as typeof window.postMessage;

  vi.resetModules();
  await import('@/content/inject');

  window.postMessage = originalPostMessage;
  if (!transferred) throw new Error('inject.ts no transfirio el port del handshake');
  const port: MessagePort = transferred;
  const hits: Harness['hits'] = [];
  port.onmessage = (event: MessageEvent) => {
    const data = event.data as { type: string; ruleName: string; status: number; url: string };
    if (data.type === 'mock-hit') hits.push({ ruleName: data.ruleName, status: data.status, url: data.url });
  };
  port.start();

  port.postMessage({
    type: 'page-config',
    config: { mocks: [], chaos: [], captureBodies: false, ...config },
  });
  // Un tick para que inject.ts procese el page-config antes de la primera request.
  await flush();

  return { realFetch, realBeacon, hits };
};

beforeEach(() => {
  vi.useRealTimers();
});

describe('fetch parcheado', () => {
  it('deja pasar la request cuando no matchea ninguna regla', async () => {
    const { realFetch } = await loadInject();

    const response = await window.fetch('https://api.example.com/v1');

    expect(realFetch).toHaveBeenCalledOnce();
    expect(await response.text()).toBe('real');
  });

  it('responde el mock sin tocar la red', async () => {
    const { realFetch } = await loadInject({ mocks: [mock()] });

    const response = await window.fetch('https://api.example.com/v1');

    expect(realFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('el mock respeta el alcance', async () => {
    const scoped = mock({ scope: { ...createEmptyScope(), includeDomains: ['api.example.com'] } });
    const { realFetch } = await loadInject({ mocks: [scoped] });

    await window.fetch('https://otro.com/v1');

    expect(realFetch).toHaveBeenCalledOnce();
  });

  it('reporta el hit del mock por el puente', async () => {
    const { hits } = await loadInject({ mocks: [mock({ name: 'Perfil QA', status: 201 })] });

    await window.fetch('https://api.example.com/v1');
    await flush();

    expect(hits).toEqual([{ ruleName: 'Perfil QA', status: 201, url: 'https://api.example.com/v1' }]);
  });
});

/** Dispara un XHR y espera a que termine, sea por load o por error. */
const runXhr = (url: string, method = 'GET'): Promise<XMLHttpRequest> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.addEventListener('load', () => resolve(xhr));
    xhr.addEventListener('error', () => resolve(xhr));
    setTimeout(() => reject(new Error('el XHR nunca termino')), 2000);
    xhr.send();
  });

describe('XMLHttpRequest parcheado', () => {
  it('simula la respuesta del mock con status, cuerpo y readyState final', async () => {
    await loadInject({ mocks: [mock({ status: 201, body: '{"creado":true}' })] });

    const xhr = await runXhr('https://api.example.com/v1');

    expect(xhr.status).toBe(201);
    expect(xhr.responseText).toBe('{"creado":true}');
    expect(xhr.readyState).toBe(4);
  });

  it('expone los headers del mock', async () => {
    await loadInject({
      mocks: [mock({ contentType: 'text/plain', headers: [{ name: 'X-Origen', value: 'bender' }] })],
    });

    const xhr = await runXhr('https://api.example.com/v1');

    expect(xhr.getResponseHeader('content-type')).toBe('text/plain');
    expect(xhr.getResponseHeader('x-origen')).toBe('bender');
    expect(xhr.getAllResponseHeaders()).toContain('X-Origen: bender');
  });

  it('deja la responseURL apuntando a la URL pedida', async () => {
    await loadInject({ mocks: [mock()] });

    const xhr = await runXhr('https://api.example.com/v1?x=1');

    expect(xhr.responseURL).toBe('https://api.example.com/v1?x=1');
  });

  it('dispara readystatechange y load, en ese orden', async () => {
    await loadInject({ mocks: [mock()] });

    const seen: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.example.com/v1');
      xhr.addEventListener('readystatechange', () => seen.push(`rsc:${xhr.readyState}`));
      xhr.addEventListener('load', () => {
        seen.push('load');
        resolve();
      });
      setTimeout(() => reject(new Error('el XHR nunca termino')), 2000);
      xhr.send();
    });

    expect(seen).toContain('load');
    expect(seen.filter((event) => event.startsWith('rsc:')).length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe('load');
  });

  it('el chaos con status corta el XHR con ese status', async () => {
    await loadInject({ chaos: [chaos({ failRate: 100, failStatus: 429 })] });

    const xhr = await runXhr('https://api.example.com/v1');

    expect(xhr.status).toBe(429);
  });

  it('el chaos como error de red deja status 0 y dispara error', async () => {
    await loadInject({ chaos: [chaos({ failRate: 100, failStatus: 0 })] });

    const errors: string[] = [];
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/v1');
    xhr.addEventListener('error', () => errors.push('error'));
    xhr.send();
    await flush();

    expect(errors).toEqual(['error']);
    expect(xhr.status).toBe(0);
    expect(xhr.readyState).toBe(4);
  });
});

describe('chaos en fetch', () => {
  it('con 0% de fallos deja pasar la request', async () => {
    const { realFetch } = await loadInject({ chaos: [chaos({ failRate: 0 })] });

    await window.fetch('https://api.example.com/v1');

    expect(realFetch).toHaveBeenCalledOnce();
  });

  it('con 100% responde el status de fallo sin llamar a la red', async () => {
    const { realFetch } = await loadInject({ chaos: [chaos({ failRate: 100, failStatus: 503 })] });

    const response = await window.fetch('https://api.example.com/v1');

    expect(realFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
  });

  it('con failStatus 0 rechaza como un error de red', async () => {
    const { realFetch } = await loadInject({ chaos: [chaos({ failRate: 100, failStatus: 0 })] });

    await expect(window.fetch('https://api.example.com/v1')).rejects.toThrow(/Bender/);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('el fallo gana sobre un mock que tambien matchea', async () => {
    const { realFetch } = await loadInject({
      mocks: [mock()],
      chaos: [chaos({ failRate: 100, failStatus: 503 })],
    });

    const response = await window.fetch('https://api.example.com/v1');

    expect(response.status).toBe(503);
    expect(realFetch).not.toHaveBeenCalled();
  });

  it('el delay demora la request pero la deja pasar', async () => {
    const { realFetch } = await loadInject({ chaos: [chaos({ delayMs: 60 })] });

    const started = Date.now();
    await window.fetch('https://api.example.com/v1');

    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(realFetch).toHaveBeenCalledOnce();
  });
});

describe('sendBeacon parcheado', () => {
  it('deja pasar el beacon cuando no matchea nada', async () => {
    const { realBeacon } = await loadInject();

    expect(navigator.sendBeacon('https://analytics.example.com/collect')).toBe(true);
    expect(realBeacon).toHaveBeenCalledOnce();
  });

  it('devuelve false cuando el chaos lo hace fallar, sin tocar la red', async () => {
    const { realBeacon } = await loadInject({ chaos: [chaos({ failRate: 100, failStatus: 500 })] });

    expect(navigator.sendBeacon('https://analytics.example.com/collect')).toBe(false);
    expect(realBeacon).not.toHaveBeenCalled();
  });

  it('corta el beacon cuando matchea un mock y no toca la red', async () => {
    const { realBeacon } = await loadInject({ mocks: [mock()] });

    expect(navigator.sendBeacon('https://analytics.example.com/collect')).toBe(true);
    expect(realBeacon).not.toHaveBeenCalled();
  });
});
