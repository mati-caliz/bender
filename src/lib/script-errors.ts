/**
 * Los userscripts corren en el mundo de la pagina (o en el aislado), donde no hay
 * APIs de extension para avisar que algo reventó. En vez de abrir un canal nuevo
 * por `window.postMessage` —que es justo lo que cerro 0.5— se le pega al codigo un
 * `//# sourceURL` propio: los errores no atrapados salen igual por el evento
 * `error` de window, que el bridge (mundo aislado) ya puede escuchar, y el
 * filename alcanza para saber de que script vinieron.
 *
 * Limitacion asumida: la pagina puede declarar el mismo sourceURL y tirar un error
 * falso. Lo peor que consigue es ensuciar la lista de errores de la UI, no ejecutar
 * nada; por eso se prefiere esto antes que reabrir el canal de mensajes.
 */

const SOURCE_PREFIX = 'bender-script-';
const SOURCE_SUFFIX = '.js';

/** Ids con algo raro romperian el parseo de vuelta, asi que se acotan. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export const sourceUrlFor = (scriptId: string): string | null =>
  SAFE_ID.test(scriptId) ? `${SOURCE_PREFIX}${scriptId}${SOURCE_SUFFIX}` : null;

/**
 * Devuelve el codigo listo para registrar. Si el id no es apto para el marcador,
 * se registra igual sin el: perder el reporte de errores es preferible a no correr.
 */
export const withSourceUrl = (code: string, scriptId: string): string => {
  const sourceUrl = sourceUrlFor(scriptId);
  if (!sourceUrl) return code;
  return `${code}\n//# sourceURL=${sourceUrl}`;
};

/** El id del script al que pertenece un filename de error, o null si no es nuestro. */
export const scriptIdFromSource = (filename: string): string | null => {
  // El navegador puede reportar el sourceURL resuelto contra el origen de la pagina.
  const name = filename.split('/').pop() ?? '';
  if (!name.startsWith(SOURCE_PREFIX) || !name.endsWith(SOURCE_SUFFIX)) return null;

  const id = name.slice(SOURCE_PREFIX.length, name.length - SOURCE_SUFFIX.length);
  return id && SAFE_ID.test(id) ? id : null;
};

export interface ScriptError {
  scriptId: string;
  message: string;
  line: number;
  tabUrl: string;
  at: number;
}
