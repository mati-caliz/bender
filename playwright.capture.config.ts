import { defineConfig } from '@playwright/test';

/** Config aparte: generar las capturas de la Store no es parte de la suite e2e. */
export default defineConfig({
  testDir: './e2e/capture',
  workers: 1,
  fullyParallel: false,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: 'list',
});
