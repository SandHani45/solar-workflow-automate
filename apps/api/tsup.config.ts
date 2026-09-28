import { defineConfig } from 'tsup';

/**
 * Bundles the API and the seed script. `@solar/shared` is TypeScript source in the
 * workspace, so it is bundled in (noExternal). Every other dependency stays external
 * and is installed in the runtime image with `pnpm deploy --prod`.
 */
export default defineConfig({
  entry: { index: 'src/index.ts', seed: 'src/seed.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: ['@solar/shared'],
});
