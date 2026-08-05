import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Las capturas de la Store viven aparte: se generan con playwright.capture.config.ts.
  testIgnore: '**/capture/**',
  // Cada test levanta su propio Chrome con la extension: en paralelo se pisan.
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: process.env.CI ? 'list' : 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
