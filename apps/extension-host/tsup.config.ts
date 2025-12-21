import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false, // No type declarations needed for executable
  bundle: true,
  platform: 'node',
  external: [
    // Keep Node.js built-ins external
    'fs', 'path', 'readline', 'util', 'events', 'stream', 'buffer',
  ],
  shims: true,
  splitting: false,
  treeshake: true,
});
