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
    // chrome.tabs.Tab exige `selected` (deprecado desde Chrome 33, reemplazado por
    // `highlighted`): la única fábrica de pestañas de los tests tiene que escribirlo.
    files: ["tests/support/chrome-tab.ts"],
    rules: { "@typescript-eslint/no-deprecated": "off" },
  },
]);
