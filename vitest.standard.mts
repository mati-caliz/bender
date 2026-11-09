// Estándar de calidad: los entornos de los tests, iguales en todos los repos. Lo copia
// quality/sync.sh como vitest.standard.mts y no se edita en el repo.
//
// Todo test corre en node, salvo los que usan el DOM: esos son *.tsx aunque no tengan JSX y corren
// en jsdom, en todos los repos. La config de cada repo lo arma con standardTestConfig() y le suma con
// mergeConfig sólo lo propio (alias, cobertura, setup), nunca un `environment` ni los workers.
import { defineConfig, type ViteUserConfig } from "vitest/config";

export interface StandardTestOptions {
  /** Las carpetas donde viven los tests: `src` (al lado del código), `tests` o varias. */
  readonly testRoots?: readonly string[];
  /** `test` (`a.test.ts`) o `spec` (`a.spec.ts`, el de NestJS). */
  readonly testSuffix?: "test" | "spec";
  /** Setup sólo de los tests de componentes (matchers de Testing Library, polyfills del DOM). */
  readonly domSetupFiles?: readonly string[];
  /** Setup de todos los tests. */
  readonly sharedSetupFiles?: readonly string[];
  /** `describe`/`it` globales, para los repos que los usan sin importarlos. */
  readonly globals?: boolean;
}

// Medido el 2026-11-09 en la web de gastronova (6.004 tests): con 2 workers la suite tarda la mitad
// por un 18 % más de RAM, y threads con el optimizador de dependencias saca otro 10 %. Con 3 workers
// se ocupaban 3 de los 4 núcleos que comparten los contenedores de producción. happy-dom fue 4 veces
// más lento y rompió 50 tests. El tope por test cubre una corrida con el servidor cargado.
const TEST_WORKERS = 2;
const TEST_TIMEOUT_MS = 10_000;
const TEST_POOL = "threads";

const NODE_PROJECT = "node";
const DOM_PROJECT = "dom";
const DOM_ENVIRONMENT = "jsdom";

function testFiles(roots: readonly string[], pattern: string): string[] {
  return roots.map((root) => `${root}/**/${pattern}`);
}

export function standardTestConfig(options: StandardTestOptions = {}): ViteUserConfig {
  const testRoots = options.testRoots ?? ["src"];
  const testSuffix = options.testSuffix ?? "test";
  const sharedSetupFiles = [...(options.sharedSetupFiles ?? [])];
  return defineConfig({
    test: {
      globals: options.globals ?? false,
      pool: TEST_POOL,
      maxWorkers: TEST_WORKERS,
      testTimeout: TEST_TIMEOUT_MS,
      deps: { optimizer: { client: { enabled: true } } },
      projects: [
        {
          extends: true,
          test: {
            name: NODE_PROJECT,
            environment: "node",
            include: testFiles(testRoots, `*.${testSuffix}.{ts,mjs}`),
            setupFiles: sharedSetupFiles,
          },
        },
        {
          extends: true,
          test: {
            name: DOM_PROJECT,
            environment: DOM_ENVIRONMENT,
            include: testFiles(testRoots, `*.${testSuffix}.tsx`),
            setupFiles: [...sharedSetupFiles, ...(options.domSetupFiles ?? [])],
          },
        },
      ],
    },
  });
}
