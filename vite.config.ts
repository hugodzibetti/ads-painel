import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/frontend',
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
