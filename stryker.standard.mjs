// Estándar de calidad (QS-402, QS-403, QS-404): la mutación de TypeScript con Stryker. Lo copia
// quality/sync.sh como stryker.standard.mjs y no se edita en el repo: el stryker.config.mjs del repo
// sólo dice con qué config de Vitest corre y, si quiere, qué mutar.
//
// Lo que dejó el piloto de conseguilo: sin mutantes estáticos (cada uno corre la suite entera: eran
// el 33 % de los mutantes y el 93 % del tiempo), incremental para no repetir lo que no cambió, un
// dry run holgado porque el server se comparte, y el tope de tiempo en el script, no acá. Rinde unas
// 20 líneas por minuto, así que en los 75 minutos de la noche entran unas 1.500.
//
// Qué se muta:
// - MUTATION_FILES (separados por espacios o saltos de línea, cada uno archivo o archivo:inicio-fin):
//   sólo esos, o sólo esas líneas. Es la mutación de lo cambiado que corre validate-changes (QS-403).
// - Si no, la lista del repo (mutate) o, sin lista, la lógica con test propio: un .ts versionado que no
//   es test ni declaración y que algún test importa, o que tiene un .test/.spec con su mismo camino
//   (al lado, en tests/ o en src/__tests__/, las tres formas que usan los repos). Mutar código sin
//   tests sólo dice que no hay tests. Esa lista se parte en tandas de SHARD_LINES líneas y MUTATION_ROUND (la nocturna lo pasa:
//   cuántas veces le tocó al paquete) elige cuál, cada una con su informe incremental: con el tiempo
//   se muta toda la lógica testeada.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const CONCURRENCY = 2;
const DRY_RUN_TIMEOUT_MINUTES = 20;
const REPORT_DIR = "reports/mutation";
const SHARD_LINES = 1500;
const TYPESCRIPT_SOURCE = /\.tsx?$/;
const NOT_LOGIC = /\.(test|spec)\.tsx?$|\.d\.ts$|\.stories\.tsx?$|\.config\.ts$/;
const TEST_FILE = /\.(test|spec)\.tsx?$/;
const TEST_FOLDER = /(^|\/)(tests?|__tests__)\//;
const EVERY_TEST_FOLDER = new RegExp(TEST_FOLDER.source, "g");
const UP_TO_SOURCE_FOLDER = /^.*?(^|\/)src\//;
const FILE_LIST_SEPARATOR = /\s+/;
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const SOURCE_ALIAS = "@/";
const RESOLVED_SUFFIXES = ["", ".ts", "/index.ts"];

const versionedFiles = () =>
  spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.ts", "*.tsx"], {
    encoding: "utf8",
  })
    .stdout.split("\n")
    .filter(Boolean);

const keyOf = (file) =>
  file
    .replace(TEST_FILE, "")
    .replace(/\.tsx?$/, "")
    .replace(UP_TO_SOURCE_FOLDER, "")
    .replace(EVERY_TEST_FOLDER, "$1");

const importedBy = (testFile) => {
  const directory = path.dirname(testFile);
  return [...readFileSync(testFile, "utf8").matchAll(IMPORT_SPECIFIER)]
    .map(([, specifier]) => specifier)
    .filter((specifier) => specifier.startsWith(".") || specifier.startsWith(SOURCE_ALIAS))
    .map((specifier) =>
      specifier.startsWith(SOURCE_ALIAS)
        ? path.join("src", specifier.slice(SOURCE_ALIAS.length))
        : path.join(directory, specifier),
    )
    .flatMap((resolved) => RESOLVED_SUFFIXES.map((suffix) => resolved.replace(/\.js$/, "") + suffix));
};

const testedLogicFiles = () => {
  const files = versionedFiles();
  const tests = files.filter((file) => TEST_FILE.test(file));
  const testedKeys = new Set(tests.map(keyOf));
  const imported = new Set(tests.flatMap(importedBy));
  return files
    .filter((file) => file.endsWith(".ts") && !NOT_LOGIC.test(file) && !TEST_FOLDER.test(file))
    .filter((file) => imported.has(file) || testedKeys.has(keyOf(file)))
    .sort();
};

const linesOf = (file) => readFileSync(file, "utf8").split("\n").length;

const shardsOf = (files) => {
  const shards = [[]];
  let linesInShard = 0;
  for (const file of files) {
    const lines = linesOf(file);
    if (linesInShard > 0 && linesInShard + lines > SHARD_LINES) {
      shards.push([]);
      linesInShard = 0;
    }
    shards.at(-1).push(file);
    linesInShard += lines;
  }
  return shards;
};

const LINE_RANGE = /:\d+-\d+$/;

const changedFiles = () =>
  (process.env.MUTATION_FILES ?? "").split(FILE_LIST_SEPARATOR).filter((entry) => {
    const file = entry.replace(LINE_RANGE, "");
    return TYPESCRIPT_SOURCE.test(file) && !NOT_LOGIC.test(file) && existsSync(file);
  });

const selection = (mutate) => {
  if (process.env.MUTATION_FILES !== undefined) {
    return { files: changedFiles(), incrementalName: "incremental-changed.json" };
  }
  const shards = shardsOf(mutate ?? testedLogicFiles());
  const round = Number.parseInt(process.env.MUTATION_ROUND ?? "0", 10) || 0;
  const index = round % shards.length;
  return { files: shards[index], incrementalName: `incremental-${index + 1}-of-${shards.length}.json` };
};

/**
 * @param {{ mutate?: string[], vitestConfig: string }} options
 */
export function standardMutationConfig({ mutate, vitestConfig }) {
  const { files, incrementalName } = selection(mutate);
  return {
    testRunner: "vitest",
    plugins: ["@stryker-mutator/vitest-runner"],
    vitest: { configFile: vitestConfig },
    mutate: files,
    concurrency: CONCURRENCY,
    coverageAnalysis: "perTest",
    ignoreStatic: true,
    incremental: true,
    incrementalFile: `${REPORT_DIR}/${incrementalName}`,
    dryRunTimeoutMinutes: DRY_RUN_TIMEOUT_MINUTES,
    reporters: ["clear-text", "json", "progress"],
    jsonReporter: { fileName: `${REPORT_DIR}/mutation.json` },
    tempDirName: ".stryker-tmp",
    cleanTempDir: "always",
    thresholds: { high: 80, low: 60, break: null },
  };
}
