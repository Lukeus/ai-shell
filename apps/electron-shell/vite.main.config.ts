import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
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
