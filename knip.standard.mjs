// Estándar de calidad: lo copia quality/sync.sh como knip.standard.mjs y no se edita en el repo.
// knip revisa archivos, exports y dependencias sin usar. La config del paquete (knip.config.js) lo
// arma con standardKnipConfig() y le suma sólo lo propio: las entradas que knip no descubre solo y
// lo generado.

// eslint.standard.mjs exporta los límites del estándar para quien los quiera leer, aunque el paquete
// no los use: sin esto knip los marca, y con --fix les sacaría el export a una copia que no se edita.
const STANDARD_COPIES = ["eslint.standard.mjs"];

/**
 * @param {{ entry?: string[], ignore?: string[], ignoreDependencies?: string[] }} options
 */
export function standardKnipConfig({ entry = [], ignore = [], ignoreDependencies = [] } = {}) {
  return {
    entry,
    ignore: [...STANDARD_COPIES, ...ignore],
    ignoreDependencies,
  };
}
