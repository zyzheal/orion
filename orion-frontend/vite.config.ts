import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Force UTC timezone for consistent test results
process.env.TZ = 'UTC';

// PandaWiki Go 后端地址 — 通过 API Gateway 转发（端口 9000），由 Gateway 处理 token 交换
const PANDAWIKI_API = process.env.PANDAWIKI_API_TARGET || 'http://127.0.0.1:9000';

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
      // PandaWiki Go 后端 API 代理 — 网关层按路径前缀分发
      // 子应用保持原 API 路径，不做 URL 重写
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
      '/api/v1/code-repo': { target: 'http://localhost:3010', changeOrigin: true },
      '/api/v1/build': { target: 'http://localhost:3010', changeOrigin: true },
      '/api/v1/test-reports': { target: 'http://localhost:3010', changeOrigin: true },
      '/api/v1/feature-flags': { target: 'http://localhost:8080', changeOrigin: true },
      '/api/v1/federation': { target: 'http://localhost:3017', changeOrigin: true },
      '/api/v1/federation-advanced': { target: 'http://localhost:3017', changeOrigin: true },
      '/api/v1/multi-cloud': { target: 'http://localhost:3017', changeOrigin: true },
      '/api/v1/multi-cloud-advanced': { target: 'http://localhost:3017', changeOrigin: true },
      '/api/v1/dba': { target: 'http://localhost:3030', changeOrigin: true },
      '/api/v1/visor': { target: 'http://localhost:3003', changeOrigin: true },
      // AI 服务 (orion-ai-service Python) — 端口 8000
      '/api/v1/ai': { target: 'http://localhost:8000', changeOrigin: true },

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
    fileParallelism: false,
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