// Estándar de calidad compartido: lo genera `quality/sync.sh` con los umbrales de
// `quality/coverage.conf` y no se edita en el repo. Lee el resumen que dejan vitest y jest
// (`json-summary`) y exige el total y un piso por archivo, para que un módulo sin tests no
// quede escondido detrás del promedio. Con carpetas como argumento, cada una cumple por
// separado y lo que queda afuera se mide sin exigirse.
//
//   node scripts/check-coverage.mjs [carpeta...]
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import process from "node:process";

const SELF = `scripts${sep}check-coverage.mjs`;
const MIN_TOTAL = { lines: 80, branches: 70 };
const MIN_PER_FILE = { lines: 50, branches: 45 };
const FULL_PERCENT = 100;
const KINDS = ["lines", "branches"];
const KIND_NAMES = { lines: "líneas", branches: "ramas" };

const summary = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
const files = Object.entries(summary)
  .filter(([name]) => name !== "total")
  .map(([name, metrics]) => ({ name: relative(process.cwd(), name), metrics }))
  .filter((file) => file.name !== SELF);

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
    for (const kind of KINDS) {
      const percent = percentOf(file.metrics[kind]);
      if (percent < MIN_PER_FILE[kind]) {
        failures.push(
          `${file.name}: ${percent.toFixed(1)} % de ${KIND_NAMES[kind]} (mínimo por archivo ${MIN_PER_FILE[kind]} %)`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Cobertura insuficiente:\n${failures.join("\n")}\n`);
  process.exitCode = 1;
}
