// Estándar de calidad compartido. Se copia tal cual con `quality/sync.sh`: no se edita en
// el repo. Lo propio de cada repo (preset del framework, excepciones por archivo con su
// motivo) va en su eslint.config.mjs, que llama a `standardConfig`.
import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export const LIMITS = Object.freeze({
  linesPerFile: 400,
  linesPerFunction: 120,
  complexity: 10,
  cognitiveComplexity: 15,
  nestingDepth: 4,
  parameters: 4,
});

// La base descartable de los tests (test-database.mts): corre en Node y no entra en el tsconfig.
const TEST_DATABASE_SETUP = "test-database.mts";

const ALLOWED_BARE_NUMBERS = [-1, 0, 1, 2];

const TEST_FILES = [
  "**/*.test.{ts,tsx,mts,cts}",
  "**/*.spec.{ts,tsx,mts,cts}",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "e2e/**",
];

const JAVASCRIPT_FILES = ["**/*.{js,mjs,cjs}"];

// Los scripts de línea de comandos de cada paquete: hablan por consola y leen o escriben las rutas
// que reciben. Sólo los de la raíz del paquete: un src/scripts/ puede ser código que corre en el
// navegador.
const COMMAND_LINE_SCRIPTS = ["scripts/**"];

const JSON_SHAPE_HELPER = ["src/lib/assume-json-shape.ts"];

// El logger de cada paquete: el único módulo que escribe en la consola. Lo demás lo importa.
const LOG_MODULE = ["**/src/lib/log.ts"];

// Los namespaces XML son URIs que identifican un esquema, no direcciones a las que se conecte:
// los `http://` de un servicio SOAP van todos en este módulo.
const XML_NAMESPACES = ["**/xml-namespaces.ts"];

const NEXT_PLUGIN = "@next/next";

const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.astro/**",
  "**/.turbo/**",
  "**/next-env.d.ts",
  "**/playwright-report/**",
  "**/test-results/**",
];

const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const MODULE_LEVEL_PARENTS = new Set(["Program", "ExportNamedDeclaration"]);

function isModuleConstantInitializer(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTION_NODE_TYPES.has(current.type)) return false;
    if (current.type === "VariableDeclarator") {
      const declaration = current.parent;
      return declaration.kind === "const" && MODULE_LEVEL_PARENTS.has(declaration.parent.type);
    }
  }
  return false;
}

// El número que inicializa una constante de módulo ya tiene nombre (el de la constante o el del campo del
// esquema). Dentro de una función sigue prohibido.
const baseMagicNumbers = tseslint.plugin.rules["no-magic-numbers"];
const magicNumbersOutsideModuleConstants = {
  meta: baseMagicNumbers.meta,
  defaultOptions: baseMagicNumbers.defaultOptions,
  create(context) {
    const filtered = Object.create(context, {
      report: {
        value(descriptor) {
          if (!isModuleConstantInitializer(descriptor.node)) context.report(descriptor);
        },
      },
    });
    return baseMagicNumbers.create(filtered);
  },
};

const standardPlugin = { rules: { "no-magic-numbers": magicNumbersOutsideModuleConstants } };

const typeRules = {
  "@typescript-eslint/explicit-function-return-type": [
    "error",
    { allowExpressions: true, allowTypedFunctionExpressions: true, allowHigherOrderFunctions: true },
  ],
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/consistent-type-assertions": [
    "error",
    { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
  ],
  "@typescript-eslint/no-unsafe-type-assertion": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/strict-boolean-expressions": [
    "error",
    { allowNullableBoolean: true, allowNullableString: false, allowNumber: false },
  ],
  "@typescript-eslint/return-await": ["error", "always"],
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
  "@typescript-eslint/ban-ts-comment": [
    "error",
    { "ts-expect-error": { descriptionFormat: "^ - .{10,}$" }, "ts-ignore": true, "ts-nocheck": true },
  ],
  "standard/no-magic-numbers": [
    "error",
    {
      ignore: ALLOWED_BARE_NUMBERS,
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: true,
      ignoreTypeIndexes: true,
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true,
    },
  ],
};

const styleRules = {
  eqeqeq: ["error", "always"],
  curly: ["error", "all"],
  "no-var": "error",
  "prefer-const": "error",
  "object-shorthand": "error",
  "no-param-reassign": ["error", { props: true }],
  "no-console": "error",
  // La regla sólo acepta rutas literales: no distingue una ruta validada (resolveInside, mkdtemp,
  // una carpeta elegida en un diálogo) de una que llega cruda, así que cada uso real de fs
  // terminaba en una excepción por archivo. Lo que protege es validar la ruta, y eso se revisa.
  "security/detect-non-literal-fs-filename": "off",
  // Los módulos de Nest son clases vacías que existen para llevar @Module().
  "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
  "no-nested-ternary": "error",
  "id-length": ["error", { min: 2, exceptions: ["i", "j", "_"], properties: "never" }],
  "sonarjs/todo-tag": "off",
  // No usa tipos: marca todo `obj[clave]`, incluidos índices de arrays y búsquedas en
  // `Record<UniónDeLiterales, …>` que el compilador ya restringe con noUncheckedIndexedAccess
  // y noPropertyAccessFromIndexSignature. Es falso positivo en todo código TypeScript.
  "security/detect-object-injection": "off",
};

const sizeRules = {
  "max-lines": ["error", { max: LIMITS.linesPerFile, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "error",
    { max: LIMITS.linesPerFunction, skipBlankLines: true, skipComments: true },
  ],
  complexity: ["error", LIMITS.complexity],
  "sonarjs/cognitive-complexity": ["error", LIMITS.cognitiveComplexity],
  "max-depth": ["error", LIMITS.nestingDepth],
  "max-params": ["error", LIMITS.parameters],
  "@typescript-eslint/max-params": "off",
};

const testRelaxations = {
  // Las IP privadas y las URL http son el dato de los tests de validación de URLs.
  "sonarjs/no-hardcoded-ip": "off",
  "sonarjs/no-clear-text-protocols": "off",
  // Playwright exige desestructurar el primer argumento de un fixture aunque no use ninguno: `({}, use)`.
  "no-empty-pattern": "off",
  "max-lines-per-function": "off",
  "standard/no-magic-numbers": "off",
  "sonarjs/no-duplicate-string": "off",
  "@typescript-eslint/explicit-function-return-type": "off",
};

// next/image necesita que su optimizador pueda pedir la imagen: no sirve para un data: o blob: del
// propio navegador ni para lo que sólo sirve el BFF con el token. Esos casos aparecían en todas las
// apps de Next, y el LCP de las imágenes se mide con Web Vitals.
function nextImageDecision(frameworks) {
  const usesNext = frameworks.some((config) => config.plugins?.[NEXT_PLUGIN] !== undefined);
  return usesNext ? [{ rules: { [`${NEXT_PLUGIN}/no-img-element`]: "off" } }] : [];
}

/**
 * @param {{
 *   tsconfigRootDir: string,
 *   frameworks?: import("eslint").Linter.Config[],
 *   ignores?: string[],
 *   allowDefaultProject?: string[],
 *   defaultProject?: string,
 *   untypedFiles?: string[],
 *   trailingConfigs?: import("eslint").Linter.Config[],
 * }} options
 *
 * `defaultProject`: el tsconfig con el que se tipan los archivos de `allowDefaultProject` (los
 * de configuración, que corren en Node y no entran en el tsconfig de la app). Sin él se usan las
 * opciones por defecto de TypeScript, que desde la 6 no cargan ningún paquete de `@types`.
 * `untypedFiles`: archivos que el linter no puede tipar (los `.astro`: de sus tipos se ocupa
 * `astro check`), que corren sin las reglas que necesitan el type checker.
 * `trailingConfigs`: presets que tienen que ir después del parser de TypeScript porque
 * declaran el suyo para sus archivos (eslint-plugin-astro).
 */
export function standardConfig({
  tsconfigRootDir,
  frameworks = [],
  ignores = [],
  allowDefaultProject = [],
  defaultProject,
  untypedFiles = [],
  trailingConfigs = [],
}) {
  return [
    globalIgnores([...DEFAULT_IGNORES, ...ignores]),
    {
      linterOptions: {
        noInlineConfig: true,
        reportUnusedDisableDirectives: "error",
        reportUnusedInlineConfigs: "error",
      },
    },
    js.configs.recommended,
    ...frameworks,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    security.configs.recommended,
    sonarjs.configs.recommended,
    noUnsanitized.configs.recommended,
    {
      plugins: { standard: standardPlugin },
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ["*.mjs", "*.js", TEST_DATABASE_SETUP, ...allowDefaultProject],
            ...(defaultProject === undefined ? {} : { defaultProject }),
          },
          tsconfigRootDir,
        },
      },
      rules: { ...typeRules, ...styleRules, ...sizeRules },
    },
    { files: TEST_FILES, rules: testRelaxations },
    {
      files: COMMAND_LINE_SCRIPTS,
      rules: { "no-console": "off" },
    },
    { files: LOG_MODULE, rules: { "no-console": "off" } },
    { files: XML_NAMESPACES, rules: { "sonarjs/no-clear-text-protocols": "off" } },
    ...nextImageDecision(frameworks),
    {
      files: JSON_SHAPE_HELPER,
      rules: {
        "@typescript-eslint/no-unsafe-type-assertion": "off",
        "@typescript-eslint/no-unnecessary-type-parameters": "off",
      },
    },
    {
      files: [...JAVASCRIPT_FILES, ...untypedFiles],
      ...tseslint.configs.disableTypeChecked,
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "@typescript-eslint/explicit-function-return-type": "off",
        // Sin tipos la regla no ve exactOptionalPropertyTypes: ahí `?: T | undefined` no sobra.
        "sonarjs/no-redundant-optional": "off",
      },
    },
    ...trailingConfigs,
    prettier,
  ];
}
