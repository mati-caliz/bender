// Estándar de calidad: lo copia quality/sync.sh como knip.standard.mjs y no se edita en el repo.
// knip revisa archivos, exports y dependencias sin usar. La config del paquete (knip.config.js) lo
// arma con standardKnipConfig() y le suma sólo lo propio: las entradas que knip no descubre solo y
// lo generado.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// eslint.standard.mjs exporta los límites del estándar para quien los quiera leer, aunque el paquete
// no los use: sin esto knip los marca, y con --fix les sacaría el export a una copia que no se edita.
// El extractor de identificadores lo lanza scripts/check_identifiers.py, no un import ni un script
// del package.json. Sólo existe en la raíz del repo.
const IDENTIFIERS_EXTRACTOR = "scripts/identifiers.mjs";
// El tope de JS por ruta (QS-602) lo corre el Dockerfile después de next build. Sólo en apps de Next.
const ROUTE_JS_CHECK = "scripts/check-route-js.mjs";
const STANDARD_COPIES = [
  "eslint.standard.mjs",
  ...[IDENTIFIERS_EXTRACTOR, ROUTE_JS_CHECK].filter((copy) => existsSync(copy)),
];

// El navegador pide el service worker de una PWA al registrarlo: nadie lo importa. Va sólo si el
// paquete tiene uno: una entrada sin coincidencias es un aviso de knip.
const SERVICE_WORKER = "public/sw.js";
const BROWSER_ENTRIES = existsSync(SERVICE_WORKER) ? [SERVICE_WORKER] : [];

// Los tipos que genera quality/openapi/generate-types.sh desde la spec (QS-501): se exportan todos
// aunque el front use una parte. Va sólo si el paquete los tiene: un ignore sin coincidencias es un aviso.
const OPENAPI_GENERATED = "src/lib/api/generated";
const GENERATED = existsSync(OPENAPI_GENERATED) ? [`${OPENAPI_GENERATED}/**`] : [];
// Ese script corre `pnpm exec openapi-typescript` desde el front: la dependencia es del paquete
// aunque ningún archivo suyo la importe.
const GENERATOR_DEPENDENCIES = existsSync(OPENAPI_GENERATED) ? ["openapi-typescript"] : [];

// QS-209: el gate corre knip también con --production, que no cuenta los tests como uso: un archivo o
// export que sólo usa su test está muerto. En ese modo knip sólo mira los archivos de project marcados
// con «!», así que el patrón lleva el sufijo (vale en los dos modos), y suma las extensiones que compila
// algún plugin del paquete para seguir sus imports. Quedan afuera de producción, con «!…!», las
// carpetas de apoyo de los tests, los scripts, las copias del estándar y las configs de la raíz; lo
// propio de cada repo (scripts a mano, evals) va en nonProduction.
const PACKAGE_MANIFEST = "package.json";
const COMPILED_EXTENSIONS = {
  css: ["tailwindcss"],
  astro: ["astro"],
  mdx: ["@astrojs/mdx", "@mdx-js/react", "@next/mdx"],
  prisma: ["prisma", "@prisma/client"],
};
const CODE_EXTENSIONS = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const declaredIn = (manifestPath) => {
  if (!existsSync(manifestPath)) {
    return [];
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
};
const workspaceManifests = () =>
  workspaceGlobs().flatMap((glob) => {
    const parent = glob.replace(/\/\*$/, "");
    if (parent === glob) {
      return [path.join(glob, PACKAGE_MANIFEST)];
    }
    return existsSync(parent)
      ? readdirSync(parent, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(parent, entry.name, PACKAGE_MANIFEST))
      : [];
  });
const projectExtensions = (directory) => {
  const declared = new Set(declaredIn(path.join(directory, PACKAGE_MANIFEST)));
  const compiled = Object.entries(COMPILED_EXTENSIONS)
    .filter(([, compilers]) => compilers.some((compiler) => declared.has(compiler)))
    .map(([extension]) => extension);
  return [...CODE_EXTENSIONS, ...compiled];
};
const NOT_PRODUCTION = [
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/__fixtures__/**",
  "**/testing/**",
  "**/test-doubles/**",
  "**/test-support.*",
  "**/*-fixtures.*",
  "**/*.fixture.*",
  "**/*.fixtures.*",
  "test-*.*",
  "e2e/**",
  "scripts/**",
  "**/tenant-leak.*",
  "*.standard.*",
  "vitest.setup.*",
];
const productionOnlyExclusion = (pattern) => `!${pattern}!`;
// En producción knip no toma como entrada la que descubre solo (src/index.ts de una app de Node): va
// marcada con «!». En modo normal sí la descubre y la misma línea es un aviso de entrada redundante, así
// que sólo se agrega cuando corre con --production.
const PRODUCTION_FLAG = "--production";
const NODE_ENTRY_CANDIDATES = ["src/index.ts", "src/main.ts", "src/server.ts", "index.ts", "main.ts"];
// En producción se busca código muerto: un export que también se usa en su archivo corre en la app
// aunque sólo el test lo importe de afuera. El modo normal sigue marcando los exports que no usa nadie.
const isProductionRun = () => process.argv.includes(PRODUCTION_FLAG);
const productionEntries = (directory = ".") =>
  isProductionRun()
    ? NODE_ENTRY_CANDIDATES.filter((candidate) => existsSync(path.join(directory, candidate))).map(
        (candidate) => `${candidate}!`,
      )
    : [];

// Un paquete que es raíz de un workspace de pnpm (atlas) corre knip una vez para todos: ahí el project
// va por workspace, no arriba, o knip avisa que el de arriba no lo usa nadie.
const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const WORKSPACE_PACKAGE_LINE = /^\s+-\s+["']?([^"'\s]+)["']?\s*$/;
const workspaceGlobs = () => {
  if (!existsSync(WORKSPACE_MANIFEST)) {
    return [];
  }
  const globs = [];
  let inPackages = false;
  for (const line of readFileSync(WORKSPACE_MANIFEST, "utf8").split("\n")) {
    if (/^\S/.test(line)) {
      inPackages = line.startsWith("packages:");
      continue;
    }
    const match = inPackages ? WORKSPACE_PACKAGE_LINE.exec(line) : null;
    if (match !== null) {
      globs.push(match[1]);
    }
  }
  return globs;
};

/**
 * productionEntry son entradas que en modo normal knip ya descubre (un script del package.json) pero que en
 * producción hay que marcar: sólo se suman con --production, para no dejar un aviso de redundante.
 *
 * @param {{ entry?: string[], productionEntry?: string[], ignore?: string[], ignoreDependencies?: string[], nonProduction?: string[] }} options
 */
export function standardKnipConfig({
  entry = [],
  productionEntry = [],
  ignore = [],
  ignoreDependencies = [],
  nonProduction = [],
} = {}) {
  const workspaceDirectories = workspaceManifests()
    .filter((manifest) => existsSync(manifest))
    .map((manifest) => path.dirname(manifest))
    .filter((directory) => directory !== ".");
  // Los patrones del repo van con la ruta desde la raíz; en un workspace cada uno pasa al suyo.
  const ownerOf = (pattern) =>
    workspaceDirectories.find((directory) => pattern.replace(/^!/, "").startsWith(`${directory}/`)) ?? ".";
  const within = (patterns, directory) =>
    patterns
      .filter((pattern) => ownerOf(pattern) === directory)
      .map((pattern) => (directory === "." ? pattern : pattern.replace(`${directory}/`, "")));
  const projectOf = (directory) => [
    `**/*.{${projectExtensions(directory).join(",")}}!`,
    ...[...NOT_PRODUCTION, ...within(nonProduction, directory)].map(productionOnlyExclusion),
  ];
  const productionOnly = isProductionRun() ? productionEntry.map((pattern) => `${pattern}!`) : [];
  const entriesOf = (directory) => [
    ...(directory === "." ? BROWSER_ENTRIES : []),
    ...productionEntries(directory),
    ...within([...productionOnly, ...entry], directory),
  ];
  const scopeOf = (directory) => {
    const entries = entriesOf(directory);
    return { ...(entries.length > 0 ? { entry: entries } : {}), project: projectOf(directory) };
  };
  const scope =
    workspaceDirectories.length === 0
      ? scopeOf(".")
      : {
          workspaces: Object.fromEntries(
            [".", ...workspaceDirectories].map((directory) => [directory, scopeOf(directory)]),
          ),
        };
  return {
    ...scope,
    ignoreExportsUsedInFile: isProductionRun(),
    ignore: [...STANDARD_COPIES, ...GENERATED, ...ignore],
    ignoreDependencies: [...GENERATOR_DEPENDENCIES, ...ignoreDependencies],
  };
}
