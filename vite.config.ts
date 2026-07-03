import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/frontend',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    port: 5173
  }
})
