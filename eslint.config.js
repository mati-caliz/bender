import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * El proyecto no usa `eslint-disable`: si una regla molesta, se arregla el codigo
 * o se saca la regla de esta config.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.webextensions },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // El codigo ya distingue a proposito entre `??` y `||` segun quiera cubrir
      // solo null/undefined o tambien '' y 0.
      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      // Todo el estado de la extension vive en chrome.storage y en los content
      // scripts: los efectos que lo leen y lo bajan a estado de React son
      // justamente el caso de "sincronizar con un sistema externo". Reescribirlos
      // es un refactor aparte, no algo que deba trabar el linter.
      'react-hooks/set-state-in-effect': 'off',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },

  // Los scripts de build y esta misma config corren en Node y estan fuera del
  // programa de TypeScript, asi que no hay tipos para las reglas type-checked.
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
    // Son herramientas de linea de comandos: escribir en stdout es su salida.
    rules: { ...tseslint.configs.disableTypeChecked.rules, 'no-console': 'off' },
  },

  // inject.ts parchea fetch y XMLHttpRequest: guardar el metodo original suelto y
  // reinvocarlo con `.call`/`.apply` es el patron, no un `this` perdido.
  {
    files: ['src/content/inject.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },

  // Los fixtures de Playwright reciben `use` como argumento y declaran fixtures sin
  // dependencias con `({}, use)`. El plugin de React confunde ese `use` con un hook.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },

  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Los tests del spoof de navigator evaluan codigo a proposito para ver que
      // ve la pagina, y comparan contra literales sin importar el enum de Chrome.
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
    },
  }
);
