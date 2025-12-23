import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      'packages-api-contracts': path.resolve(__dirname, '../../packages/api-contracts/src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        entryFileNames: 'preload.js',
      },
    },
    outDir: '.vite/build',
    emptyOutDir: false,
  },
});
