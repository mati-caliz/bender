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

// Mismo criterio que `ignoreFieldDeclaration` del MagicNumber de Checkstyle: el número que
// inicializa una constante de módulo ya tiene nombre (el de la constante o el del campo del
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
  "max-lines-per-function": "off",
  "standard/no-magic-numbers": "off",
  "sonarjs/no-duplicate-string": "off",
  "@typescript-eslint/explicit-function-return-type": "off",
};

/**
 * @param {{
 *   tsconfigRootDir: string,
 *   frameworks?: import("eslint").Linter.Config[],
 *   ignores?: string[],
 *   allowDefaultProject?: string[],
 *   untypedFiles?: string[],
 *   trailingConfigs?: import("eslint").Linter.Config[],
 * }} options
 *
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
          projectService: { allowDefaultProject: ["*.mjs", "*.js", ...allowDefaultProject] },
          tsconfigRootDir,
        },
      },
      rules: { ...typeRules, ...styleRules, ...sizeRules },
    },
    { files: TEST_FILES, rules: testRelaxations },
    {
      files: [...JAVASCRIPT_FILES, ...untypedFiles],
      ...tseslint.configs.disableTypeChecked,
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        "@typescript-eslint/explicit-function-return-type": "off",
      },
    },
    ...trailingConfigs,
    prettier,
  ];
}
