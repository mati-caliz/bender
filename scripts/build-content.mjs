import { context, build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const resolveFromRoot = (relativePath) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const options = {
  entryPoints: [resolveFromRoot('src/content/bridge.ts'), resolveFromRoot('src/content/inject.ts')],
  outdir: resolveFromRoot('dist/content'),
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: true,
  logLevel: 'info',
  alias: { '@': resolveFromRoot('src') },
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
