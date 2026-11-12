// Estándar de calidad: lo copia quality/sync.sh como knip.standard.mjs y no se edita en el repo.
// knip revisa archivos, exports y dependencias sin usar. La config del paquete (knip.config.js) lo
// arma con standardKnipConfig() y le suma sólo lo propio: las entradas que knip no descubre solo y
// lo generado.

import { existsSync } from "node:fs";

// eslint.standard.mjs exporta los límites del estándar para quien los quiera leer, aunque el paquete
// no los use: sin esto knip los marca, y con --fix les sacaría el export a una copia que no se edita.
// El extractor de identificadores lo lanza scripts/check_identifiers.py, no un import ni un script
// del package.json. Sólo existe en la raíz del repo.
const IDENTIFIERS_EXTRACTOR = "scripts/identifiers.mjs";
const STANDARD_COPIES = [
  "eslint.standard.mjs",
  ...(existsSync(IDENTIFIERS_EXTRACTOR) ? [IDENTIFIERS_EXTRACTOR] : []),
];

// El navegador pide el service worker de una PWA al registrarlo: nadie lo importa. Va sólo si el
// paquete tiene uno: una entrada sin coincidencias es un aviso de knip.
const SERVICE_WORKER = "public/sw.js";
const BROWSER_ENTRIES = existsSync(SERVICE_WORKER) ? [SERVICE_WORKER] : [];

/**
 * @param {{ entry?: string[], ignore?: string[], ignoreDependencies?: string[] }} options
 */
export function standardKnipConfig({
  entry = [],
  ignore = [],
  ignoreDependencies = [],
} = {}) {
  return {
    entry: [...BROWSER_ENTRIES, ...entry],
    ignore: [...STANDARD_COPIES, ...ignore],
    ignoreDependencies,
  };
}
