import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import { standardTestConfig } from "./vitest.standard.mjs";

const resolveFromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default mergeConfig(
  standardTestConfig({
    // main.tsx sólo monta <App /> en #root: no tiene lógica propia que probar.
    coverageExclude: ["src/ui/main.tsx"],
    testRoots: ["tests"],
  }),
  defineConfig({
    resolve: {
      alias: { "@": resolveFromRoot("src") },
    },
  }),
);
