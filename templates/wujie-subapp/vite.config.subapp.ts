/**
 * Vite 配置 - Wujie 微前端子应用
 *
 * 使用方法:
 * 1. 将此文件复制为 vite.config.subapp.ts
 * 2. 根据子应用实际情况修改配置
 * 3. 添加新的 npm 脚本：dev:mf 和 build:mf
 */

import { defineConfig, UserConfig } from 'vite'
import { resolve } from 'path'

// 环境变量
const isDev = process.env.NODE_ENV === 'development'
const isMicroFrontend = process.env.MODE === 'micro-frontend'

// 子应用配置 - 根据实际情况修改
const SUBAPP_CONFIG = {
  // 子应用名称（用于 UMD 输出）
  name: 'OrionSubApp',
  // 子应用路由前缀
  baseRoute: '/subapp',
  // 微前端模式端口
  mfPort: 3001,
  // 独立模式端口
  standalonePort: 5173,
}

/**
 * 基础 Vite 配置
 */
export function createSubAppConfig(
  customConfig: Partial<UserConfig> = {}
): UserConfig {
  return defineConfig({
    // 基础路径
    base: isDev ? '/' : `${SUBAPP_CONFIG.baseRoute}/`,

    // 服务器配置
    server: {
      port: isMicroFrontend ? SUBAPP_CONFIG.mfPort : SUBAPP_CONFIG.standalonePort,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },

    // 构建配置
    build: {
      outDir: isMicroFrontend ? 'dist-mf' : 'dist',
      minify: !isMicroFrontend,
      sourcemap: isMicroFrontend,

      // 微前端模式输出 UMD 格式
      ...(isMicroFrontend && {
        rollupOptions: {
          output: {
            format: 'umd',
            name: SUBAPP_CONFIG.name,
          },
        },
      }),
    },

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    // 自定义配置合并
    ...customConfig,
  })
}

/**
 * Vue 3 子应用配置
 */
export function createVue3SubAppConfig(
  customConfig: Partial<UserConfig> = {}
): UserConfig {
  return createSubAppConfig({
    plugins: [/* vue() */],
    ...customConfig,
  })
}

/**
 * React 子应用配置
 */
export function createReactSubAppConfig(
  customConfig: Partial<UserConfig> = {}
): UserConfig {
  return createSubAppConfig({
    plugins: [/* react() */],
    ...customConfig,
  })
}

// 默认导出
export default createSubAppConfig
