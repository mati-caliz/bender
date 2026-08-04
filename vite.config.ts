import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolveFromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  root: resolveFromRoot('src/ui'),
  publicDir: resolveFromRoot('public'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': resolveFromRoot('src') },
  },
  build: {
    outDir: resolveFromRoot('dist'),
    emptyOutDir: false,
    target: 'chrome120',
    sourcemap: true,
    rollupOptions: {
      input: {
        app: resolveFromRoot('src/ui/index.html'),
        'service-worker': resolveFromRoot('src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
