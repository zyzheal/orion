import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig(({ mode }) => {
  const isMicroFrontend = mode === 'micro-frontend';
  const isDev = mode === 'development';
  const isMfBuild = process.env.VITE_MF_BUILD === 'true';

  return {
    // 微前端模式使用独立端口
    base: isMicroFrontend ? '/orion-dba/' : isDev ? '/' : '/front/',

    build: {
      // 微前端：关闭 CSS 代码分割
      ...(isMicroFrontend && {
        cssCodeSplit: false,
        // 微前端：生成 sourcemap 便于调试
        sourcemap: true,
        rollupOptions: {
          external: ['vue', 'ant-design-vue'],
          output: {
            globals: {
              vue: 'Vue',
              'ant-design-vue': 'antd',
            },
          },
        },
      }),

      // 输出目录
      outDir: isMfBuild ? 'dist-mf' : isMicroFrontend ? 'dist-mf' : 'dist',

      // MF 模式必须使用 esnext
      target: isMfBuild ? 'esnext' : undefined,
    },

    server: {
      // 微前端模式使用不同端口
      port: isMicroFrontend ? 3030 : 3010,
      cors: true, // 微前端：允许跨域
      headers: {
        'Access-Control-Allow-Origin': '*', // wujie 需要
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
        '/login': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
        '/fetch': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
        '/register': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
        '/lang': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
        '/ldap': {
          target: 'http://127.0.0.1:8090',
          changeOrigin: true,
        },
      },
    },

    plugins: [
      vue(),
      // Module Federation 配置（用于 Orion-MF 远程加载）
      // 在 micro-frontend 模式下启用 federation 插件
      ...(isMicroFrontend
        ? [
            federation({
              name: 'orion_dba',
              filename: 'remoteEntry.js',
              exposes: {
                './index': './src/main.ts',
              },
              // 默认无 shared：子应用打包自己的依赖，支持独立运行
              // 如需共享主应用依赖（性能优化），在 SubAppStore 中设置 use_shared: true
            }),
          ]
        : []),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/'),
      },
    },

    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    },
  };
});
