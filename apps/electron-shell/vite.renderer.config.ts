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
  },
  optimizeDeps: {
    exclude: ['packages-ui-kit', 'packages-api-contracts'],
  },
});
