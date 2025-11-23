import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: '.',
  publicDir: path.resolve(__dirname, 'public'),
  server: {
    port: 5173,
    open: false,
    fs: {
      allow: [__dirname, path.resolve(__dirname, '../main/dist/web')]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8082',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: '../main/dist/web-generated',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html')
    }
  }
});
