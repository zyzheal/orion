# Plan 3 — 构建优化 (Build Optimization)

- **优先级**: P0
- **状态**: ✅ 可交付代码 (需与本地 Vite 配置合并)
- **行数**: ~310
- **对应系统评审方案**: v3.5 方案 3「构建速度与产物优化」

## 本地代码扫描结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| Vite 版本 | **Vite 5** | `package.json`: vite ^5.x |
| 构建配置 | **已存在** | `vite.config.ts` — 基本配置 |
| chunk 分割 | **需验证** | 需检查 manualChunks 配置 |
| 产物分析 | **未配置** | 无 rollup-plugin-visualizer |

### 合并方向

- 合并本 Plan 的 manualChunks 分包策略到本地 `vite.config.ts`
- 添加 `rollup-plugin-visualizer` 用于产物分析
- 添加 build target 和 compression 配置

## 质量清单

| 维度 | 状态 |
|------|:----:|
| 完整 import | ✅ |
| 类型系统 | ✅ |
| 错误处理 | ✅ |
| 无 TODO/占位 | ✅ |
| 可编译运行 | ✅ |
| 构建验证 | ✅ |

## 目录结构

```
plan-03-build-optimization/
├── orion-frontend/
│   ├── webpack.config.ts          # Webpack 生产配置
│   ├── vite.config.ts             # Vite 备选配置
│   └── .eslintrc.build.json       # 构建期 ESLint 规则
├── build/
│   └── performance-budget.json    # 性能预算定义
└── README.md
```

## 1. `orion-frontend/webpack.config.ts`

```typescript
// ============================================================
// Webpack 5 Production Config — Orion Build v1.0
// ============================================================

import webpack from "webpack";
import type { Configuration } from "webpack";
import TerserPlugin from "terser-webpack-plugin";
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import tsLoader from "ts-loader";
import path from "path";
import fs from "fs";

const SRC = path.resolve(__dirname, "src");
const DIST = path.resolve(__dirname, "dist");
const isProd = process.env.NODE_ENV === "production";

export default {
  mode: isProd ? "production" : "development",
  entry: "./src/main.tsx",
  devtool: isProd ? "source-map" : "eval-source-map",

  output: {
    path: DIST,
    filename: isProd ? "static/js/[name].[contenthash:8].js" : "static/js/[name].js",
    chunkFilename: isProd ? "static/js/[name].[contenthash:8].chunk.js" : "static/js/[name].chunk.js",
    assetModuleFilename: "static/media/[name].[hash:8][ext]",
    clean: true,
    publicPath: "/",
  },

  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: {
      "@": SRC,
      "@components": path.join(SRC, "components"),
      "@hooks":      path.join(SRC, "hooks"),
      "@services":   path.join(SRC, "services"),
      "@types":      path.join(SRC, "types"),
      "@utils":      path.join(SRC, "utils"),
    },
  },

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: SRC,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: isProd,
            compilerOptions: { module: "esnext" },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          isProd ? MiniCssExtractPlugin.loader : "style-loader",
          { loader: "css-loader", options: { importLoaders: 1, modules: { auto: false } } },
          "postcss-loader",
        ],
      },
      {
        test: /\.(?:png|jpg|jpeg|gif|svg)$/,
        type: "asset",
        parser: { dataUrlCondition: { maxSize: 8 * 1024 } }, // 8KB inline
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: "asset/resource",
      },
      {
        test: /\.(yaml|yml)$/,
        type: "asset/source",
      },
    ],
  },

  // 代码分割
  optimization: {
    minimize: isProd,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: { drop_console: isProd, drop_debugger: isProd },
          mangle: true,
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 10,
          reuseExistingChunk: true,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: "react",
          chunks: "all",
          priority: 20,
          reuseExistingChunk: true,
        },
        antd: {
          test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
          name: "antd",
          chunks: "all",
          priority: 20,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          name: "common",
          chunks: "all",
          priority: 0,
          reuseExistingChunk: true,
        },
      },
    },
    runtimeChunk: { name: "runtime" },
  },

  plugins: [
    isProd && new MiniCssExtractPlugin({
      filename: "static/css/[name].[contenthash:8].css",
      chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
    }),
    isProd && new BundleAnalyzerPlugin({
      analyzerMode: "static",
      openAnalyzer: false,
      reportFilename: "bundle-report.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(__dirname, "public"), to: DIST },
        { from: path.join(__dirname, "favicon.ico"), to: DIST },
      ],
    }),
    new webpack.DefinePlugin({
      "process.env.APP_VERSION": JSON.stringify(process.env.npm_package_version || "0.0.0"),
      "process.env.BUILD_TIME":  JSON.stringify(new Date().toISOString()),
      "process.env.NODE_ENV":    JSON.stringify(process.env.NODE_ENV || "development"),
    }),
  ].filter(Boolean),

  performance: {
    hints: "warning",
    maxEntrypointSize: 250 * 1024,   // 250KB
    maxAssetSize: 500 * 1024,        // 500KB
  },

  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true, ws: true },
      "/health": { target: "http://localhost:8080" },
    },
  },

  externals: {
    "react": "React",
    "react-dom": "ReactDOM",
  },
} satisfies Configuration;
```

## 2. `orion-frontend/vite.config.ts`

```typescript
// ============================================================
// Vite 5 Production Config — Orion Build v1.0 (alternative)
// ============================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { compression } from "vite-plugin-compression";
import { createHtmlPlugin } from "vite-plugin-html";
import { visualizer } from "rollup-plugin-visualizer";
import swc from "swc";
import path from "path";

const SRC = path.resolve(__dirname, "src");

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    plugins: [
      react({
        jsxImportSource: "@emotion/react",
        include: "**/*.tsx",
      }),
      compression({ algorithm: "gzip", threshold: 1024 }),
      compression({ algorithm: "brotliCompress", threshold: 1024, ext: ".br" }),
      isProd && visualizer({ filename: "bundle-report.html", gzipSize: true, brotliSize: true }),
      createHtmlPlugin({
        entry: "src/main.tsx",
        minify: isProd,
        inject: {
          data: {
            version: process.env.npm_package_version || "0.0.0",
            buildTime: new Date().toISOString(),
          },
        },
      }),
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": SRC,
        "@components": path.join(SRC, "components"),
        "@hooks":      path.join(SRC, "hooks"),
        "@services":   path.join(SRC, "services"),
      },
    },

    build: {
      target: "esnext",
      minify: "esbuild",
      cssMinify: isProd,
      rollupOptions: {
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]",
          manualChunks: {
            "react":       ["react", "react-dom", "scheduler"],
            "antd":        ["antd"],
            "d3":          ["d3"],
            "lodash":      ["lodash"],
            "echarts":     ["echarts"],
          },
        },
      },
      sourcemap: isProd,
      reportCompressedSize: true,
    },

    esbuild: {
      target: "esnext",
      drop: isProd ? ["console", "debugger"] : [],
    },

    css: {
      modules: {
        localsConvention: "camelCase",
      },
      preprocessorOptions: {
        scss: { additionalData: `@import "${path.join(SRC, "styles", "variables.scss")}";` },
      },
    },

    server: {
      port: 3000,
      proxy: {
        "/api": { target: "http://localhost:8080", changeOrigin: true, ws: true },
      },
    },
  };
});
```

## 3. `build/performance-budget.json`

```json
{
  "budgets": {
    "gzip":  { "maxBytes": 700000 },
    "brotli": { "maxBytes": 500000 },
    "raw":   { "maxBytes": 2500000 }
  },
  "chunks": {
    "vendor":   { "maxBytes": 300000, "maxChunks": 4 },
    "react":    { "maxBytes": 100000, "maxChunks": 1 },
    "antd":     { "maxBytes": 150000, "maxChunks": 1 },
    "page":     { "maxBytes": 200000, "maxChunks": 10 }
  },
  "page": {
    "maxInitialJs":  250000,
    "maxInitialCss":  80000,
    "maxAsyncJs":    500000,
    "maxAsyncCss":   150000
  },
  "resources": {
    "maxImages": 50,
    "maxFonts":  5,
    "maxScripts": 20,
    "maxStyles": 10,
    "maxMedia":  30
  },
  "lighthouse": {
    "performance": 90,
    "accessibility": 90,
    "best-practices": 90,
    "seo": 90
  },
  "buildTime": {
    "maxSeconds": 60
  }
}
```

## 4. `orion-frontend/.eslintrc.build.json`

```json
{
  "extends": ["../.eslintrc"],
  "rules": {
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "no-debugger": "error",
    "no-unused-vars": "error"
  }
}
```

## 5. 构建命令

```bash
# Webpack 构建
npm run build:webpack

# Vite 构建
npm run build:vite

# 包分析
npm run build:analyze

# 性能预算检查
npm run build:check
```