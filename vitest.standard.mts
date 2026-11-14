// Estándar de calidad: los entornos de los tests, iguales en todos los repos. Lo copia
// quality/sync.sh como vitest.standard.mts y no se edita en el repo.
//
// Todo test corre en node, salvo los que usan el DOM: esos son *.tsx aunque no tengan JSX y corren
// en jsdom, en todos los repos. La config de cada repo lo arma con standardTestConfig() y le suma con
// mergeConfig sólo lo propio (alias, setup), nunca un `environment`, los workers ni la cobertura:
// lo que la cobertura mide o deja afuera de más se pasa con coverageInclude y coverageExclude.
import path from "node:path";

import {
  configDefaults,
  defineConfig,
  type Plugin,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from "vitest/config";

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
  /** Lo que mide la cobertura, si no es el TypeScript de src (paquetes con scripts o varias fuentes). */
  readonly coverageInclude?: readonly string[];
  /**
   * Lo que la cobertura deja afuera además de los tests, los `.d.ts`, `src/test` y los tipos
   * generados: fixtures o un punto de entrada que sólo monta la app.
   */
  readonly coverageExclude?: readonly string[];
  /**
   * La base descartable de los tests `*.db.test.ts`: la imagen de Postgres de la app, el comando que
   * la migra con `DATABASE_URL` del dueño y, si la app lo usa en producción, el script de
   * `docker-entrypoint-initdb.d` (extensiones). Ver test-database.mts.
   */
  readonly database?: {
    readonly image: string;
    readonly migrate: string;
    readonly initScript?: string;
  };
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
const DATABASE_PROJECT = "database";
const DATABASE_SETUP = "./test-database.mts";

const COVERAGE_PROVIDER = "v8";
const COVERAGE_REPORTERS = ["text-summary", "json-summary"];
const COVERAGE_SOURCES = ["src/**/*.{ts,tsx}"];
const COVERAGE_ALWAYS_EXCLUDED = [
  "**/*.{test,spec}.{ts,tsx,mts}",
  "**/*.d.ts",
  "src/test/**",
  "**/lib/api/generated/**",
  "**/scripts/check-coverage.mjs",
];

// "server-only" sólo deja importarse con la condición react-server, la del bundle de servidor de Next.
// Los tests corren en Node y prueban justamente esos módulos: ahí es un módulo vacío.
const SERVER_ONLY_MODULE = "server-only";
const EMPTY_SERVER_ONLY = "\0server-only";

function serverOnlyInTests(): Plugin {
  return {
    name: "standard:server-only-in-tests",
    enforce: "pre",
    resolveId: (source) => (source === SERVER_ONLY_MODULE ? EMPTY_SERVER_ONLY : null),
    load: (id) => (id === EMPTY_SERVER_ONLY ? "export {};" : null),
  };
}

// oxc emite la metadata de los decoradores (la que usa la inyección de NestJS) como
// `typeof X === "undefined" ? Object : X`, y uno de los dos brazos nunca corre: no es código del repo
// pero contaba como rama sin cubrir. Cada guarda pasa a una función al final del módulo, fuera del
// mapa de fuentes, y en su lugar queda la llamada rellena con espacios hasta el mismo largo: el mapa
// sigue exacto, el código que corre es el mismo y la cobertura la ignora como al resto de lo generado.
// @vitest/coverage-v8 sólo reconoce los decoradores de SWC (`_ts_decorate`).
const DESIGN_TYPE_GUARD = /typeof (\w+) === "undefined" \? Object : \1/gu;
const DECORATOR_METADATA_CALL = "_decorateMetadata(";
const DESIGN_TYPE_HELPER = "__standardDesignType";

function unmappedDecoratorMetadata(): Plugin {
  return {
    name: "standard:unmapped-decorator-metadata",
    enforce: "post",
    transform: (code) => {
      if (!code.includes(DECORATOR_METADATA_CALL)) {
        return null;
      }
      const helpers: string[] = [];
      const rewritten = code.replace(DESIGN_TYPE_GUARD, (guard) => {
        const helper = `${DESIGN_TYPE_HELPER}${String(helpers.length)}`;
        helpers.push(`function ${helper}() { return ${guard}; }`);
        return `${helper}()`.padEnd(guard.length);
      });
      return { code: `${rewritten}\n${helpers.join("\n")}\n`, map: null };
    },
  };
}

function testFiles(roots: readonly string[], pattern: string): string[] {
  return roots.map((root) => `${root}/**/${pattern}`);
}

function databaseProjects(
  options: StandardTestOptions,
  roots: readonly string[],
  suffix: string,
): TestProjectInlineConfiguration[] {
  if (options.database === undefined) {
    return [];
  }
  return [
    {
      extends: true,
      test: {
        name: DATABASE_PROJECT,
        environment: "node",
        include: testFiles(roots, `*.db.${suffix}.ts`),
        setupFiles: [...(options.sharedSetupFiles ?? [])],
        globalSetup: [DATABASE_SETUP],
        provide: {
          testDatabaseImage: options.database.image,
          testDatabaseMigrate: options.database.migrate,
          testDatabaseInit:
            options.database.initScript === undefined ? "" : path.resolve(options.database.initScript),
        },
      },
    },
  ];
}

export function standardTestConfig(options: StandardTestOptions = {}): ViteUserConfig {
  const testRoots = options.testRoots ?? ["src"];
  const testSuffix = options.testSuffix ?? "test";
  const sharedSetupFiles = [...(options.sharedSetupFiles ?? [])];
  const databaseTests = testFiles(testRoots, `*.db.${testSuffix}.ts`);
  return defineConfig({
    plugins: [serverOnlyInTests(), unmappedDecoratorMetadata()],
    test: {
      globals: options.globals ?? false,
      pool: TEST_POOL,
      maxWorkers: TEST_WORKERS,
      testTimeout: TEST_TIMEOUT_MS,
      deps: { optimizer: { client: { enabled: true } } },
      coverage: {
        provider: COVERAGE_PROVIDER,
        include: [...(options.coverageInclude ?? COVERAGE_SOURCES)],
        exclude: [...COVERAGE_ALWAYS_EXCLUDED, ...(options.coverageExclude ?? [])],
        reporter: COVERAGE_REPORTERS,
      },
      projects: [
        {
          extends: true,
          test: {
            name: NODE_PROJECT,
            environment: "node",
            include: testFiles(testRoots, `*.${testSuffix}.{ts,mjs}`),
            exclude: [...configDefaults.exclude, ...databaseTests],
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
        ...databaseProjects(options, testRoots, testSuffix),
      ],
    },
  });
}
