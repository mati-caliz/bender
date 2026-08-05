// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

interface SentMessage {
  type: string;
  payload?: { scriptId: string; message: string; line: number; tabUrl: string };
}

/**
 * bridge.ts corre en el mundo aislado y se registra al importarse. Lo unico que
 * necesita del entorno es chrome.storage y chrome.runtime.
 *
 * Ojo con el alcance: esto verifica que el bridge reconozca el sourceURL y
 * reenvie el error. Que Chrome propague al mundo aislado los errores de un
 * userscript del mundo principal no se puede probar sin un navegador de verdad;
 * eso es el nivel 2 de 4.3.
 */
/**
 * El bridge se registra al importarse y no expone forma de desregistrarse, asi
 * que se carga una sola vez por archivo y cada test limpia lo capturado. Volver a
 * importarlo por test dejaria un listener por cada carga y los errores se
 * contarian varias veces.
 */
const sent: SentMessage[] = [];

const throwFrom = (filename: string, message = 'algo reventó', lineno = 7): void => {
  window.dispatchEvent(new ErrorEvent('error', { message, filename, lineno }));
};

const scriptErrors = (): SentMessage[] => sent.filter((message) => message.type === 'scripts/error');

beforeAll(async () => {
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: () => Promise.resolve({}) },
      onChanged: { addListener: () => undefined },
    },
    runtime: {
      sendMessage: (message: SentMessage) => {
        sent.push(message);
        return Promise.resolve(null);
      },
    },
  });

  await import('@/content/bridge');
});

beforeEach(() => {
  sent.length = 0;
});

describe('bridge: errores de userscript', () => {
  it('reenvia el error de un script propio con su id', () => {
    throwFrom('bender-script-abc123.js', 'x is not defined', 12);

    expect(scriptErrors()).toHaveLength(1);
    expect(scriptErrors()[0]?.payload).toMatchObject({
      scriptId: 'abc123',
      message: 'x is not defined',
      line: 12,
    });
  });

  it('incluye la URL de la pagina donde reventó', () => {
    throwFrom('bender-script-abc123.js');

    expect(scriptErrors()[0]?.payload?.tabUrl).toBe(window.location.href);
  });

  it('ignora los errores de la propia pagina', () => {
    throwFrom('https://example.com/app.js');
    throwFrom('');

    expect(scriptErrors()).toHaveLength(0);
  });

  it('ignora un filename que se parece pero no tiene id valido', () => {
    throwFrom('bender-script-.js');
    throwFrom('bender-script-con.punto.js');

    expect(scriptErrors()).toHaveLength(0);
  });

  it('reenvia uno por cada error, sin agrupar', () => {
    throwFrom('bender-script-uno.js');
    throwFrom('bender-script-dos.js');
    throwFrom('bender-script-uno.js');

    expect(scriptErrors()).toHaveLength(3);
  });
});
