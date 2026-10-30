// Estándar de calidad: los entornos de los tests, iguales en todos los repos. Lo copia
// quality/sync.sh como vitest.standard.mts y no se edita en el repo.
//
// Todo test corre en node, salvo los que usan el DOM: esos son *.tsx aunque no tengan JSX y corren
// en jsdom, en todos los repos. La config de cada repo lo arma con standardTestConfig() y le suma con
// mergeConfig sólo lo propio (alias, cobertura, workers), nunca un `environment`.
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
