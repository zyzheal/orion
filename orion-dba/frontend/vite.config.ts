import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import * as path from 'path';

export default defineConfig(({ mode }) => {
  const isMicroFrontend = mode === 'micro-frontend';
  const isDev = mode === 'development';

  return {
    // 微前端模式使用独立端口
    base: isMicroFrontend ? '/orion-dba/' : isDev ? '/' : '/front/',

    build: {
      // 微前端模式：输出为 UMD 格式
      ...(isMicroFrontend && {
        lib: {
          entry: path.resolve(__dirname, 'src/main.ts'),
          name: 'OrionDbaApp',
          fileName: () => 'orion-dba-app.js',
          formats: ['umd'],
        },
        // 微前端：关闭 CSS 代码分割
        cssCodeSplit: false,
        // 微前端：生成 sourcemap 便于调试
        sourcemap: true,
      }),

      // 通用配置
      minify: 'esbuild',

      rollupOptions: {
        // 微前端模式：配置外部依赖
        ...(isMicroFrontend && {
          external: ['vue', 'ant-design-vue'],
          output: {
            globals: {
              vue: 'Vue',
              'ant-design-vue': 'antd',
            },
          },
        }),
      },

      // 输出目录
      outDir: isMicroFrontend ? 'dist-mf' : 'dist',
    },

    server: {
      // 微前端模式使用不同端口
      port: isMicroFrontend ? 3001 : 3010,
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

    plugins: [vue()],

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
