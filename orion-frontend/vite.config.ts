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
      // CMDB Go 微服务代理（优先于 /api 通用代理）
      '/api/v1/cmdb': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
      // Ops Go 微服务代理
      '/api/v1/ops': {
        target: 'http://localhost:3040',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // DBA 子应用代理 - 解决 wujie 跨域沙箱问题
      '/orion-dba': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // Knowledge 子应用代理
      '/orion-knowledge': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // Visor 子应用代理
      '/orion-visor': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // DBA API 代理 - 转发到 DBA 后端服务（Yearning）
      '/lang': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/fetch': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      // 移除错误的 /login 代理 - 登录页面是前端路由，不需要代理
      '/register': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/ldap': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/oidc': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd'],
        },
      },
    },
  },
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/tests/**',
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 55,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
  esbuild: {
    loader: 'tsx',
  },
});