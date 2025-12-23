import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      'packages-api-contracts': path.resolve(__dirname, '../../packages/api-contracts/src/index.ts'),
    },
    // Prefer Node.js compatible module resolution
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      // Externalize native addons - they cannot be bundled
      external: [
        'electron',
        'electron-squirrel-startup',
        'node-pty', // Native addon - must be loaded at runtime from node_modules
        'packages-broker-main',
        'packages-agent-tools',
      ],
    },
  },
});
