import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { execSync } from 'child_process';
import federation from '@originjs/vite-plugin-federation';

// 创建路由生成插件
function generateRoutesPlugin(): Plugin {
  return {
    name: 'generate-routes',
    buildStart() {
      // 构建开始时生成路由
      try {
        execSync('node scripts/generate-routes.js', { stdio: 'inherit' });
      } catch (error) {
        console.error('生成路由失败:', error);
      }
    },
    handleHotUpdate({ file, server }) {
      // 开发模式下监听路由文件变化
      const routerPath = path.resolve(__dirname, 'src/router.tsx');
      if (file === routerPath) {
        console.log('🔄 检测到路由文件变化，正在更新路由列表...');
        try {
          execSync('node scripts/generate-routes.js', { stdio: 'inherit' });
          // 触发 HMR 更新
          server.ws.send({
            type: 'update',
            updates: [
              {
                type: 'js-update',
                path: '/index.html',
                acceptedPath: '/index.html',
                timestamp: Date.now(),
              },
            ],
          });
        } catch (error) {
          console.error('❌ 更新路由列表失败:', error);
        }
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const shouldAnalyze =
    process.argv.includes('--analyze') || env.ANALYZE === 'true';
  const isMicroFrontend = mode === 'micro-frontend';

  return {
    // Use '/' base so chunk imports work when served directly from localhost:5173
    // In production, the nginx reverse proxy handles the /orion-knowledge/ prefix
    base: '/',

    build: {
      assetsDir: 'orion-knowledge-admin-assets',
      target: 'esnext',

      // MF 模式：输出到 dist-mf 目录，避免覆盖 SPA 构建产物
      ...(isMicroFrontend && {
        outDir: 'dist-mf',
        cssCodeSplit: false,
        sourcemap: true,
      }),

      // 通用配置：代码分割
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': [
              'react',
              'react-dom',
              'react-router-dom',
              'react-redux',
              '@reduxjs/toolkit',
            ],
            'vendor-mui': ['@mui/material'],
            'vendor-echarts': ['echarts'],
            'vendor-editor': [
              'highlight.js',
              'lowlight',
              'katex',
              'prosemirror-state',
            ],
            'vendor-markdown': [
              'react-markdown',
              'remark-gfm',
              'remark-math',
              'remark-breaks',
              'rehype-katex',
              'rehype-raw',
              'rehype-sanitize',
            ],
            'vendor-yjs': ['yjs', 'y-websocket'],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.TARGET,
          secure: false,
          changeOrigin: true,
        },
        '/static-file': {
          target: env.STATIC_FILE_TARGET,
          secure: false,
          changeOrigin: true,
        },
        '/share': {
          target: env.SHARE_TARGET,
          secure: false,
          changeOrigin: true,
        },
      },
      host: '0.0.0.0',
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*', // wujie 需要
      },
    },
    esbuild: {
      // 保留函数和类名
      keepNames: true,
    },
    plugins: [
      // Module Federation 插件（仅在微前端模式下启用）
      ...(isMicroFrontend
        ? [
            federation({
              name: 'orion_knowledge',
              filename: 'remoteEntry.js',
              exposes: {
                './index': './src/main.tsx',
              },
              // 默认无 shared：子应用打包自己的依赖，支持独立运行
              // 如需共享主应用依赖（性能优化），在 SubAppStore 中设置 use_shared: true
            }),
          ]
        : []),
      react(),
      generateRoutesPlugin(),
      ...(command === 'build' && shouldAnalyze
        ? [
            visualizer({
              open: true,
              gzipSize: true,
              brotliSize: true,
              filename: 'dist/stats.html',
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
