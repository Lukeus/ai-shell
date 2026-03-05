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
      'packages-api-contracts': path.resolve(__dirname, '../../packages/api-contracts/src/index.ts'),
    },
    // Force a single React instance across the monorepo.
    // Without this, ui-kit source (resolved via alias) imports React from
    // node_modules/react while the renderer uses apps/electron-shell/node_modules/react,
    // causing "Cannot read properties of null (reading 'useRef')" hook errors.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: {
    // P5 (Performance budgets): Exclude monaco-editor from pre-bundling to enable lazy-loading
    // Monaco will be dynamically imported when editor component first renders
    exclude: ['packages-ui-kit', 'packages-api-contracts', 'monaco-editor'],
    // Skip automatic dependency discovery (dep-scan). The esbuild-based scan
    // fails when the Vite server restarts mid-scan (race with Forge building
    // main/preload in parallel). Instead, list all deps explicitly below.
    noDiscovery: true,
    include: [
      // React core
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      // Direct renderer deps
      'react-markdown',
      'remark-gfm',
      'ajv',
      // Transitive deps via ui-kit source alias
      '@headlessui/react',
      '@heroicons/react/20/solid',
      '@heroicons/react/24/outline',
      '@tanstack/react-virtual',
      // Transitive deps via api-contracts source alias
      'zod',
    ],
  },
  server: {
    watch: {
      // Prevent Vite restart when sibling packages rebuild their dist output.
      // Without this, ui-kit/api-contracts builds trigger a server restart that
      // aborts the in-progress dep-scan, causing "server is being restarted" errors.
      ignored: ['**/packages/*/dist/**'],
    },
  },
  worker: {
    // P5 (Performance budgets): Configure worker bundling for Monaco
    // Monaco requires Web Workers for language services (TypeScript, JSON, CSS, HTML)
    format: 'es',
  },
  build: {
    // Keep renderer output in app-root .vite so packaged main can load
    // `app.asar/.vite/renderer/main_window/index.html`.
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
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
