import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Force UTC timezone for consistent test results
process.env.TZ = 'UTC';

// PandaWiki Go 后端地址（Docker 默认 8090，开发模式可设为 3020）
const PANDAWIKI_API = process.env.PANDAWIKI_API_TARGET || 'http://localhost:8090';

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
      // CMDB Service - Go 版本 (3030)
      '/api/v1/cmdb': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
      // Pipeline Runs - 平台服务
      '/api/v1/pipeline-runs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v1/pipelines': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Orion 认证 - 指向平台服务
      '/api/v1/auth': { target: 'http://localhost:3001', changeOrigin: true },
      // PandaWiki Go 后端 API 代理（必须在 '/api' 通配之前，优先匹配）
      // 子应用模式下，这些 PandaWiki 专属 API 需转发到 Go 后端
      '/api/v1/knowledge_base': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/knowledge': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/nav': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/node': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/user': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/model': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/stat': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/app': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/file': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/chat': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/conversation': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/comment': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/crawler': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/setting': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/license': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/share': { target: PANDAWIKI_API, changeOrigin: true },
      '/api/v1/health': { target: PANDAWIKI_API, changeOrigin: true },
      '/share': { target: PANDAWIKI_API, changeOrigin: true },
      '/static-file': { target: PANDAWIKI_API, changeOrigin: true },

      // SubApp API proxies — 按域分发
      '/api/v1/dba': { target: 'http://localhost:3030', changeOrigin: true },
      '/api/v1/visor': { target: 'http://localhost:3003', changeOrigin: true },

      // 其他 API 请求到 platform-service (3001)
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