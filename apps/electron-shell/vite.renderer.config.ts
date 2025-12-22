import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  root: './src/renderer',
  resolve: {
    alias: {
      'packages-ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src/index.ts'),
    },
  },
  optimizeDeps: {
    // P5 (Performance budgets): Exclude monaco-editor from pre-bundling to enable lazy-loading
    // Monaco will be dynamically imported when editor component first renders
    exclude: ['packages-ui-kit', 'packages-api-contracts', 'monaco-editor'],
  },
  worker: {
    // P5 (Performance budgets): Configure worker bundling for Monaco
    // Monaco requires Web Workers for language services (TypeScript, JSON, CSS, HTML)
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // P5 (Performance budgets): Manual chunks to ensure Monaco is code-split
        // This keeps monaco-editor out of the initial renderer bundle
        manualChunks: (id) => {
          if (id.includes('node_modules/monaco-editor')) {
            return 'monaco-editor';
          }
        },
      },
    },
  },
});
