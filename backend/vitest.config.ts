import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata, which Nest dependency injection needs.
  // tsconfigPaths resolves aliases declared in tsconfig.json (e.g. from `nest g library`).
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
