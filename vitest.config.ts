import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolveFromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": resolveFromRoot("src") },
  },
  test: {
    projects: [
      { extends: true, test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"] } },
      { extends: true, test: { name: "dom", environment: "jsdom", include: ["tests/**/*.test.tsx"] } },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // main.tsx sólo monta <App /> en #root: no tiene lógica propia que probar.
      exclude: ["src/ui/main.tsx"],
      reporter: ["text", "json-summary"],
    },
  },
});
