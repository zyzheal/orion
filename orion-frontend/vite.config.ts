import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Force UTC timezone for consistent test results
process.env.TZ = 'UTC';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  esbuild: {
    loader: 'tsx',
  },
});
