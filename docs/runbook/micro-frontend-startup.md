# 微前端启动 Runbook

> 主应用 (orion-frontend) + 子应用 (knowledge/dba/visor) 的完整启动流程、已知问题与排查方法。

## 服务总览

| 服务 | 端口 | 启动命令 | 依赖 |
|------|------|----------|------|
| KB API 后端 | 8090 | `cd orion-knowledge && docker compose up -d` | Docker |
| KB 子应用前端 | 5173 | `cd orion-knowledge/web/admin && npx serve dist-mf -l 5173` | 需先 `npm run build:mf` |
| API Gateway | 9000 | `cd orion-api-gateway && npm run dev` | :8090 |
| 平台后端 | 3001 | `cd orion-platform-service && npm run dev` | PostgreSQL |
| 主应用前端 | 3000 | `cd orion-frontend && npm run dev` | :9000, :5173 |

## 启动顺序（严格）

```
1. KB API Docker (:8090)    ← 最底层依赖
2. KB 子应用前端 (:5173)     ← MF remoteEntry 需可访问
3. API Gateway (:9000)      ← 依赖 :8090（转发 KB API）
4. 平台后端 (:3001)          ← 提供 /api/v1/subapps 配置
5. 主应用前端 (:3000)        ← 依赖 Gateway 和子应用 remoteEntry
```

## 启动快速命令

```bash
# === ORION 微前端一键启动（建议新开终端执行） ===

# Terminal 1: KB API 后端
cd orion-knowledge && docker compose up -d

# Terminal 2: KB 子应用前端（MF build 产物）
# 方式 A：构建后静态服务（推荐，稳定）
cd orion-knowledge/web/admin
npm run build:mf
npx serve dist-mf -l 5173

# 方式 B：Vite dev 模式（支持热更新）
cd orion-knowledge/web/admin
npm run dev:mf

# Terminal 3: API Gateway
cd orion-api-gateway && npm run dev

# Terminal 4: 平台后端
cd orion-platform-service && npm run dev

# Terminal 5: 主应用前端
cd orion-frontend && npm run dev
```

## 流量路径

**注意**：不同 API 路径经过不同的代理目标，并非所有 `/api/v1/*` 都经过 Gateway。

```
浏览器 → localhost:3000

  # ── 知识库 API → 经过 Gateway token 交换 ──
  /api/v1/knowledge_base/*    ─┐
  /api/v1/knowledge/*          ├→ Vite 代理 (PANDAWIKI_API)
  /api/v1/nav/*                │   → localhost:9000 (Gateway)
  /api/v1/node/*              ─┘   → token 交换 (Orion JWT → KB session)
       → localhost:8090 (KB API)

  # ── 平台 API → 直连平台后端 ──
  /api/v1/subapps              ─┐
  /api/v1/auth/*                ├→ Vite 代理 (catch-all /api)
  /api/v1/pipelines/*           │   → localhost:3001 (平台后端)
  /api/v1/pipeline-runs/*      ─┘

  # ── 子应用加载 ──
  /knowledge → SubAppRouteMF → import('localhost:5173/remoteEntry.js')
    → Orion-MF 沙箱 → Shadow DOM → 子应用渲染
```

## 已知问题与修复

### P1: Gateway 启动在 3000 而非 9000

**现象**：Gateway 日志显示 `Address: http://0.0.0.0:3000`

**根因**：`.env` 中 `PORT=9000`，但 ESM `import` hoisting 导致 .env 加载代码在模块导入之后才执行，`config/index.ts` 读取 `process.env.PORT` 时尚未被写入。

**修复**（2026-05-23）：将项目模块的静态 `import` 改为 `main()` 内部动态 `await import()`。

```typescript
// ❌ 旧代码：静态 import 被 hoisting，.env 加载太晚
import { createApp } from './app';
import { getConfig } from './config';

// ✅ 新代码：动态 import，在 .env 加载后执行
async function main() {
  const { createApp } = await import('./app');
  const { getConfig } = await import('./config');
}
```

**验证**：直接 `cd orion-api-gateway && npm run dev`，无需 `PORT=9000` 前缀。

---

### P2: 子应用页面 "Sub-app mounted (default)"

#### P2a: Chunk 404

**现象**：浏览器控制台显示 chunk 文件 404，页面显示 "Sub-app mounted (default)"

**根因**：MF build 的 `vite.config.ts` 中 `base: '/orion-knowledge/'`，导致 remoteEntry.js 内 chunk 路径硬编码为 `/orion-knowledge/assets/chunk-xxx.js`。但 `serve dist-mf` 从 `/` 提供服务，chunk 路径不匹配。

**修复**：MF build 时 `base: '/'`，或确保服务路径与 base 一致。

```typescript
// orion-knowledge/web/admin/vite.config.ts
base: mode === 'micro-frontend' ? '/' : '/',
```

#### P2b: `get()` 未 await

**现象**：无 404 错误，但仍显示 "Sub-app mounted (default)"

**根因**：`MFSandboxBridge.simulateMFLoad()` 中 `remoteEntryModule.get(remoteName)` 返回 `Promise<factory>`，未 `await` 导致 `typeof factory === 'function'` 为 `false`，走入 fallback 逻辑。

**修复**（`packages/orion-mf/src/core/MFSandboxBridge.ts`）：

```typescript
// ❌ 旧代码
const factory = remoteEntryModule.get(remoteName);

// ✅ 新代码
const factory = await remoteEntryModule.get(remoteName);
```

---

### P3: KB API 返回 401

**现象**：子应用加载正常，但所有 API 请求返回 401

**根因**：Vite 代理目标设为了 `:8090`（直连 KB API），跳过了 API Gateway 的 token 交换。KB API 不认识 Orion JWT。

**修复**：代理目标改回 `:9000`，确保 Gateway 运行中。

```typescript
// orion-frontend/vite.config.ts
const PANDAWIKI_API = process.env.PANDAWIKI_API_TARGET || 'http://127.0.0.1:9000';
```

---

### P4: SubAppRouteMF `cssIsolation` 参数不匹配 + 配置映射缺失

**现象**：样式隔离可能不符合预期，TypeScript 无法捕获此错误

**根因**：涉及两层问题：

1. `SubAppRouteMF/index.tsx` 第 1 行使用 `// @ts-nocheck` 跳过了类型检查
2. `cssIsolation: 'shadow'` 传值拼写错误，应为 `'shadow-dom'`（`CSSIsolationMode` 只接受 `'shadow-dom' | 'scoped-css' | 'none'`）
3. `microfront/apps.ts` 的 `SubAppConfig` 接口没有 `cssIsolation` 字段，`convertToConfig()` 也未从 store 的 `css_isolation` 映射，导致 `SubAppRouteMF` 只能硬编码而非使用后端配置值

**修复**（三步）：

```typescript
// Step 1: apps.ts 暴露 cssIsolation 字段
export interface SubAppConfig {
  key: string;
  name: string;
  path: string;
  url: string;
  container: string;
  cssIsolation: string;          // ← 新增
  enabled: boolean;
  keepAlive: boolean;
  preload: boolean;
}

// Step 2: apps.ts convertToConfig 中映射 store 值
function convertToConfig(storeConfig: StoreSubAppConfig): SubAppConfig {
  return {
    ...
    cssIsolation: storeConfig.css_isolation || 'shadow-dom',  // ← 映射
  };
}

// Step 3: SubAppRouteMF/index.tsx 使用配置中的值而非硬编码
const instance = await loadSubApp({
  key: appKey,
  name: mfConfig.name,
  remoteEntry: mfConfig.remoteEntry,
  cssIsolation: mfConfig.cssIsolation,  // ← 从配置读取
  errorBoundary: true,
});
```


---

### P5: Docker healthcheck 端口错误

**现象**：Docker 容器状态为 unhealthy，但 API 正常响应

**根因**：`orion-knowledge/deploy/docker-compose.yaml` 中 healthcheck 使用端口 8000，实际 API 监听 3020

**修复**：同步 healthcheck 端口

---

## 排查流程

### 白屏 / "Sub-app mounted (default)"

```
第一步：打开浏览器控制台 Network 标签
  ├─ remoteEntry.js 是否 200？
  │   └─ 否 → 子应用前端是否在 5173 运行？→ serve dist-mf -l 5173
  ├─ chunk 文件是否 200？
  │   └─ 否 → MF build 的 base 配置与服务路径是否一致？
  │             ├─ serve 模式 → base: '/'
  │             └─ nginx 代理 → base: '/orion-knowledge/'
  └─ 以上都正常 → MFSandboxBridge 中 get() 是否有 await？
```

### API 401

```
第一步：检查浏览器请求的代理目标
  ├─ 请求路径 → Network 中查看请求头 Host
  ├─ Vite 代理配置 → vite.config.ts 中 PANDAWIKI_API
  │   └─ 应指向 :9000 (Gateway)
  └─ Gateway 是否运行在 9000？
      └─ lsof -i :9000 确认
```

### 服务端口检查

```bash
# 一键检查所有服务端口
for port in 3000 3001 5173 8090 9000; do
  if lsof -i :$port >/dev/null 2>&1; then
    echo "✅ :$port 运行中"
  else
    echo "❌ :$port 未启动"
  fi
done
```

## 关键文件索引

| 文件 | 作用 |
|------|------|
| `orion-frontend/vite.config.ts` | Vite 代理配置，PANDAWIKI_API 目标 |
| `orion-frontend/src/components/SubAppRouteMF/index.tsx` | 子应用路由渲染容器 |
| `orion-frontend/src/microfront/apps.ts` | 子应用配置适配层 |
| `orion-frontend/src/stores/subappStore.ts` | 子应用配置 Store（Zustand + persist） |
| `packages/orion-mf/src/core/MFSandboxBridge.ts` | 微前端核心加载器 |
| `orion-knowledge/web/admin/src/main.tsx` | 子应用生命周期（bootstrap/mount/unmount） |
| `orion-knowledge/web/admin/vite.config.ts` | 子应用 MF build 配置 |
| `orion-api-gateway/src/index.ts` | Gateway 入口（.env 加载 + 动态 import） |
| `orion-api-gateway/.env` | Gateway 环境变量（PORT=9000） |
