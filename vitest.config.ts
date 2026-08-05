import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': resolveFromRoot('src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
