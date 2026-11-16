// Estándar de calidad compartido: lo genera `quality/sync.sh` con los umbrales de
// `quality/coverage.conf` y no se edita en el repo. Lee el resumen que deja Vitest
// (`json-summary`) y exige el total y un piso por archivo, para que un módulo sin tests no
// quede escondido detrás del promedio. Con carpetas como argumento, cada una cumple por
// separado y lo que queda afuera se mide sin exigirse. Cada archivo debajo de la vara siguiente lista
// sus líneas y ramas sin cubrir (del reporte `json`), para saber qué probar sin volver a correr.
//
//   node scripts/check-coverage.mjs [carpeta...]
import { existsSync, readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import process from "node:process";

const STANDARD_COPIES = new Set([`scripts${sep}check-coverage.mjs`, `scripts${sep}check-route-js.mjs`]);
const MIN_TOTAL = { lines: 80, branches: 70 };
const MIN_PER_FILE = { lines: 50, branches: 45 };
const NEXT_PER_FILE = { lines: 70, branches: 60 };
const FULL_PERCENT = 100;
const KINDS = ["lines", "branches"];
const KIND_NAMES = { lines: "líneas", branches: "ramas" };

const DETAIL_REPORT = "coverage/coverage-final.json";

const summary = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
const detail = existsSync(DETAIL_REPORT) ? JSON.parse(readFileSync(DETAIL_REPORT, "utf8")) : {};
const files = Object.entries(summary)
  .filter(([name]) => name !== "total")
  .map(([name, metrics]) => ({ name: relative(process.cwd(), name), path: name, metrics }))
  .filter((file) => !STANDARD_COPIES.has(file.name));

const describeLines = (lines) => {
  const ranges = [];
  for (const line of [...new Set(lines)].sort((first, second) => first - second)) {
    const last = ranges.at(-1);
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(", ");
};

const uncoveredOf = (path) => {
  const fileDetail = detail[path];
  if (!fileDetail) {
    return "";
  }
  const lines = Object.entries(fileDetail.s)
    .filter(([, hits]) => hits === 0)
    .flatMap(([id]) => {
      const { start, end } = fileDetail.statementMap[id];
      return Array.from({ length: end.line - start.line + 1 }, (_, offset) => start.line + offset);
    });
  const branches = Object.entries(fileDetail.b)
    .filter(([, hits]) => hits.includes(0))
    .map(([id]) => fileDetail.branchMap[id].loc.start.line);
  const parts = [];
  if (lines.length > 0) {
    parts.push(`líneas ${describeLines(lines)}`);
  }
  if (branches.length > 0) {
    parts.push(`ramas en ${describeLines(branches)}`);
  }
  return parts.join("; ");
};

const percentOf = ({ covered, total }) => (total === 0 ? FULL_PERCENT : (FULL_PERCENT * covered) / total);

const addUp = (selected, kind) =>
  selected.reduce(
    (sum, file) => ({
      covered: sum.covered + file.metrics[kind].covered,
      total: sum.total + file.metrics[kind].total,
    }),
    { covered: 0, total: 0 },
  );

const isInside = (name, scope) => scope === "." || name === scope || name.startsWith(`${scope}${sep}`);

const scopes = process.argv.length > 2 ? process.argv.slice(2) : ["."];
const failures = [];

for (const scope of scopes) {
  const selected = files.filter((file) => isInside(file.name, scope));
  const measured = KINDS.map(
    (kind) => `${percentOf(addUp(selected, kind)).toFixed(1)} % de ${KIND_NAMES[kind]}`,
  );
  process.stdout.write(`cobertura de ${scope}: ${measured.join(", ")}\n`);
  for (const kind of KINDS) {
    const percent = percentOf(addUp(selected, kind));
    if (percent < MIN_TOTAL[kind]) {
      failures.push(`${scope}: ${percent.toFixed(1)} % de ${KIND_NAMES[kind]} (mínimo ${MIN_TOTAL[kind]} %)`);
    }
  }
  for (const file of selected) {
    let belowNext = false;
    for (const kind of KINDS) {
      const percent = percentOf(file.metrics[kind]);
      if (percent < MIN_PER_FILE[kind]) {
        failures.push(
          `${file.name}: ${percent.toFixed(1)} % de ${KIND_NAMES[kind]} (mínimo por archivo ${MIN_PER_FILE[kind]} %)`,
        );
      } else if (percent < NEXT_PER_FILE[kind]) {
        belowNext = true;
        process.stdout.write(
          `vara siguiente (QS-303): ${file.name} con ${percent.toFixed(1)} % de ${KIND_NAMES[kind]}\n`,
        );
      }
    }
    if (belowNext) {
      process.stdout.write(`  sin cubrir: ${uncoveredOf(file.path)}\n`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Cobertura insuficiente:\n${failures.join("\n")}\n`);
  process.exitCode = 1;
}
