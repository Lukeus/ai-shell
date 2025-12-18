import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest configuration for electron-shell renderer tests.
 * 
 * Tests renderer-side logic (hooks, contexts) in a browser-like environment.
 * Does NOT test main process or preload scripts.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/**/*.test.{ts,tsx}',
        'src/renderer/test-setup.ts',
        'src/renderer/index.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      'packages-api-contracts': resolve(__dirname, '../../packages/api-contracts/src'),
      'packages-ui-kit': resolve(__dirname, '../../packages/ui-kit/src'),
    },
  },
});
