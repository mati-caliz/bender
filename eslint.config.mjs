import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { standardConfig } from "./eslint.standard.mjs";

export default defineConfig([
  ...standardConfig({
    tsconfigRootDir: import.meta.dirname,
    frameworks: [reactHooks.configs.flat.recommended],
  }),
  {
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    files: ["**/*.js", "**/*.mjs", "tests/**/*.ts", "e2e/**/*.ts", "*.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // Son herramientas de línea de comandos: escribir en stdout es su salida.
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  {
    // zip.mjs recorre dist/ con rutas armadas desde la raíz del repo, sin entrada externa:
    // la regla sólo acepta literales y no hay forma de listar un directorio con uno.
    files: ["scripts/zip.mjs"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
  {
    // Un fallo inesperado del motor no tiene otro destino que la consola del service worker:
    // se permite sólo console.error, que es el mensaje interno para depurar.
    files: ["src/background/service-worker.ts"],
    rules: { "no-console": ["error", { allow: ["error"] }] },
  },
  {
    // El bridge sólo acepta mensajes cuyo event.source es su propia ventana, que ya fija el
    // origen; la regla sólo reconoce una comparación explícita de event.origin.
    files: ["src/content/bridge.ts"],
    rules: { "sonarjs/post-message": "off" },
  },
  {
    // El perfil de Chrome de cada test sale de mkdtemp: la ruta es temporal y propia.
    files: ["e2e/fixtures.ts"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
  {
    // No es un test sino el generador de capturas de la Store: las pausas dejan que la UI
    // y el overlay terminen de dibujarse antes de la foto, no sincronizan aserciones.
    files: ["e2e/capture/screenshots.spec.ts"],
    rules: { "sonarjs/no-fixed-wait-in-tests": "off" },
  },
  {
    // Compilar las regex que el usuario escribe en sus reglas es la función de la extensión;
    // regexp.ts es el único lugar que lo hace, y corre en el navegador de quien las escribió.
    files: ["src/lib/regexp.ts"],
    rules: { "security/detect-non-literal-regexp": "off" },
  },
  {
    // inject.ts parchea fetch y XMLHttpRequest: guardar el método original suelto y
    // reinvocarlo con `.call`/`.apply` es el patrón, no un `this` perdido.
    files: ["src/content/inject.ts"],
    rules: { "@typescript-eslint/unbound-method": "off" },
  },
  {
    // Los fixtures de Playwright reciben `use` como argumento y declaran fixtures sin
    // dependencias con `({}, use)`: el plugin de React confunde ese `use` con un hook.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-empty-pattern": "off",
    },
  },
  {
    // Los tests del spoof de navigator evalúan código a propósito para ver qué ve la
    // página, y comparan contra literales sin importar el enum de Chrome.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
    },
  },
]);
