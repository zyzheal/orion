# 前端路由配置化方案设计（Phase 4）

> 版本：1.0
> 日期：2026-07-04
> 状态：设计草案
> 关联：orion-frontend/src/router/routes.tsx、orion-frontend/src/microfront/

---

## 一、问题概述

### 1.1 当前问题

`orion-frontend/src/router/routes.tsx` 以**硬编码数组**方式维护全部 ~200 个路由条目：

- 新增页面必须手动修改 `routes.tsx`，容易遗漏或出错
- 路由元数据（权限、菜单归属、是否子应用）与组件路径紧耦合
- 微前端 Orion-MF 子应用路由与主应用路由混合定义，缺乏统一抽象
- 不同环境（dev/prod）或租户的路由差异无法动态配置

### 1.2 痛点场景

| 场景 | 问题 |
|------|------|
| 新增页面 | 必须记住在 `routes.tsx` 追加条目，同时保证 `path`、`component`、`permission` 三处一致 |
| 子应用接入 | 子应用路径分散在 `routes.tsx`、`menuConfigStore.ts`、`subappStore.ts` 三处维护 |
| 权限调整 | 修改 `requiredPermission` 需要直接改动路由数组 |
| 菜单与路由同步 | 菜单配置（`menuConfigStore`）与路由配置（`routes.tsx`）分离，容易不一致 |
| A/B 测试 | 无法按环境或用户动态切换路由 |

### 1.3 微前端特殊性

Orion-MF 子应用路由存在以下特殊处理需求：

- 路径通配：`/:subAppKey/*` 动态匹配任意已配置子应用
- 跳过主 Layout：`hideLayout: true`
- 需要从 `subappStore` 验证子应用是否已配置且启用
- 子应用加载逻辑在 `SubAppRouteDynamic` 中独立处理

---

## 二、设计方案

### 2.1 设计目标

| 目标 | 说明 |
|------|------|
| **配置驱动** | 路由元数据从 JSON/后端 API 加载，`routes.tsx` 仅保留消费逻辑 |
| **向后兼容** | Phase 3 前支持 `routes.tsx` 静态数组与 `page-registry` 动态加载并存 |
| **子应用统一** | 子应用路由与普通路由使用同一 PageRegistry 接口定义 |
| **渐进迁移** | 支持逐模块迁移，不强制一次性全量切换 |
| **类型安全** | 完整 TypeScript 类型定义，编译期检查 |

### 2.2 PageRegistry 接口设计

```typescript
/**
 * 页面注册表条目
 * 每个页面/路由对应一个 PageEntry，涵盖主应用页面和子应用
 */
export interface PageEntry {
  /** 路由路径（React Router path），支持参数如 /pipelines/:id */
  path: string;

  /** 页面组件懒加载函数或 React 元素 */
  element: React.ReactNode | (() => Promise<{ default: React.ComponentType }>);

  /** 是否需要登录（默认 true） */
  protected?: boolean;

  /** 细粒度权限要求 */
  requiredPermission?: {
    resource: string;
    action: 'read' | 'write' | 'manage';
  };

  /** 是否跳过主 Layout（用于子应用、全屏页面） */
  hideLayout?: boolean;

  /** 子路由（嵌套路由） */
  children?: PageEntry[];

  /** 是否为微前端子应用（true 时由 SubAppRouteDynamic 处理） */
  microApp?: boolean;

  /** 子应用 key（microApp=true 时必填） */
  subAppKey?: string;

  /** 菜单归属模块 key（用于自动生成菜单） */
  menu?: string;

  /** 路由索引（用于排序） */
  index?: boolean;

  /** 重定向目标（替代 RedirectTo 组件） */
  redirectTo?: string;

  /** 页面标题 */
  title?: string;

  /** 是否需要面包屑 */
  breadcrumb?: boolean;

  /** 是否在菜单中隐藏（仍可访问） */
  hidden?: boolean;
}

/**
 * 页面注册表
 * 支持从本地 JSON 或后端 API 加载
 */
export interface PageRegistry {
  /** 所有页面条目（扁平化列表） */
  pages: PageEntry[];

  /** 元数据 */
  meta?: {
    version: string;
    lastUpdated: string;
    source: 'local' | 'remote';
  };
}
```

### 2.3 两种加载方式

#### 方式 A：本地 JSON 配置文件（静态路由）

```typescript
// src/router/page-registry.local.ts
import type { PageRegistry } from './page-registry-types';

/**
 * 本地页面注册表
 * 由开发者在页面创建/修改时同步更新
 * 对应 Phase 1 静态配置阶段
 */
export const localPageRegistry: PageRegistry = {
  pages: [
    {
      path: '/login',
      element: () => import('@/pages/Login'),
      protected: false,
      hidden: true,
    },
    {
      path: '/dashboard',
      element: () => import('@/pages/DashboardNew'),
      protected: true,
      menu: '/workbench',
      title: '总览看板',
    },
    {
      path: '/pipelines',
      element: () => import('@/pages/PipelineList'),
      protected: true,
      menu: '/delivery',
      title: '流水线',
    },
    {
      path: '/pipelines/new',
      element: () => import('@/pages/PipelineEditor'),
      protected: true,
      menu: '/delivery',
      hidden: true,
    },
    {
      path: '/pipelines/:id',
      element: () => import('@/pages/PipelineDetail'),
      protected: true,
      menu: '/delivery',
      title: '流水线详情',
    },
    // 子应用路由
    {
      path: ':subAppKey/*',
      element: () => import('@/components/SubAppRouteDynamic'),
      protected: true,
      hideLayout: true,
      microApp: true,
      hidden: true,
    },
  ],
  meta: {
    version: '2026-07-04',
    lastUpdated: new Date().toISOString(),
    source: 'local',
  },
};
```

#### 方式 B：后端配置中心 API（动态路由，可选）

```typescript
// src/router/page-registry.remote.ts
import type { PageRegistry, PageEntry } from './page-registry-types';

const API_BASE = '/api/v1';

/**
 * 从后端配置中心加载页面注册表
 * Phase 4 可选启用，支持热更新路由
 */
export async function fetchRemotePageRegistry(): Promise<PageRegistry> {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE}/system/page-registry`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page registry: ${response.status}`);
  }

  const data = await response.json();
  return data as PageRegistry;
}

/**
 * 将后端返回的路径字符串转换为懒加载函数
 * 后端只存路径字符串，前端负责按需加载组件
 */
export function resolvePageEntry(entry: PageEntry): PageEntry {
  if (typeof entry.element === 'string') {
    return {
      ...entry,
      element: () => import(`@/pages/${entry.element}`),
    };
  }
  return entry;
}
```

### 2.4 路由生成器

```typescript
// src/router/route-generator.ts
import type { PageEntry, PageRegistry } from './page-registry-types';
import { Navigate } from 'react-router-dom';
import { type AppRoute } from './routes';

/**
 * 将 PageRegistry 转换为 React Router 配置
 */
export function generateRoutes(registry: PageRegistry): AppRoute[] {
  const routes: AppRoute[] = [];

  for (const entry of registry.pages) {
    // 重定向路由
    if (entry.redirectTo) {
      routes.push({
        path: entry.path,
        element: <Navigate to={entry.redirectTo} replace />,
        protected: entry.protected ?? true,
        requiredPermission: entry.requiredPermission,
        hidden: entry.hidden,
      });
      continue;
    }

    // 子应用路由（委托给 SubAppRouteDynamic）
    if (entry.microApp) {
      routes.push({
        path: entry.path,
        element: entry.element,
        protected: entry.protected ?? true,
        hideLayout: true,
        hidden: entry.hidden,
      });
      continue;
    }

    // 标准路由
    const route: AppRoute = {
      path: entry.path,
      element: entry.element,
      protected: entry.protected ?? true,
      requiredPermission: entry.requiredPermission,
      hideLayout: entry.hideLayout,
      index: entry.index,
      hidden: entry.hidden,
    };

    // 递归处理子路由
    if (entry.children && entry.children.length > 0) {
      route.children = entry.children
        .filter((child) => !child.hidden)
        .map((child) => generateRouteEntry(child));
    }

    routes.push(route);
  }

  // 确保 404 路由始终存在
  if (!routes.some((r) => r.path === '*')) {
    routes.push({
      path: '*',
      element: () => import('@/pages/NotFound'),
      protected: false,
      hidden: true,
    });
  }

  return routes;
}

function generateRouteEntry(entry: PageEntry): AppRoute {
  if (entry.redirectTo) {
    return {
      path: entry.path,
      element: <Navigate to={entry.redirectTo} replace />,
      protected: entry.protected ?? true,
      requiredPermission: entry.requiredPermission,
    };
  }

  return {
    path: entry.path,
    element: entry.element,
    protected: entry.protected ?? true,
    requiredPermission: entry.requiredPermission,
    index: entry.index,
  };
}

/**
 * 合并本地和远程注册表（本地优先）
 */
export function mergeRegistries(
  local: PageRegistry,
  remote?: PageRegistry
): PageRegistry {
  if (!remote) return local;

  const remotePaths = new Set(remote.pages.map((p) => p.path));
  const merged = [
    ...remote.pages,
    ...local.pages.filter((p) => !remotePaths.has(p.path)),
  ];

  return {
    pages: merged,
    meta: {
      version: remote.meta?.version || local.meta?.version || 'unknown',
      lastUpdated: remote.meta?.lastUpdated || local.meta?.lastUpdated || new Date().toISOString(),
      source: 'merged',
    },
  };
}
```

### 2.5 与 Orion-MF 集成点

**当前 Orion-MF 相关文件**：

| 文件 | 职责 | 集成方式 |
|------|------|---------|
| `microfront/apps.ts` | 子应用配置接口 + 动态获取 | PageRegistry 的 `microApp: true` 条目委托给此模块 |
| `microfront/config.ts` | 子应用生命周期管理（init/cleanup/unload） | 无需修改，保持现有职责 |
| `components/SubAppRouteDynamic` | 子应用路由组件 | `page-registry.ts` 中 `microApp: true` 的路由直接引用此组件 |
| `stores/subappStore.ts` | 子应用配置持久化 | 作为 PageRegistry 的**子集**，后端 `/api/v1/subapps` 提供数据 |
| `stores/menuConfigStore.ts` | 菜单配置 | 菜单与路由解耦，通过 `menu` 字段关联 |

**集成策略**：

```
PageRegistry.pages[]
  ├─ microApp: false, hideLayout: false → 标准路由（Layout + ProtectedRoute）
  ├─ microApp: false, hideLayout: true  → 全屏路由（无 Layout，如登录页）
  └─ microApp: true                     → 委托给 SubAppRouteDynamic
       └─ 内部从 subappStore 验证 subAppKey
```

### 2.6 向后兼容策略

**Phase 3 过渡期（双轨并行）**：

```typescript
// src/router/index.tsx
import { routes as staticRoutes } from './routes';
import { localPageRegistry } from './page-registry.local';
import { generateRoutes } from './route-generator';

// 环境变量控制路由来源
const USE_PAGE_REGISTRY = import.meta.env.VITE_USE_PAGE_REGISTRY === 'true';

let appRoutes: AppRoute[];

if (USE_PAGE_REGISTRY) {
  // 从 page-registry 动态生成
  appRoutes = generateRoutes(localPageRegistry);
} else {
  // 使用现有静态路由（默认）
  appRoutes = staticRoutes;
}

// AppRoutes 组件保持不变
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {appRoutes.map((route) => /* 现有渲染逻辑 */)}
    </Routes>
  );
};
```

**弃用计划**：

| 阶段 | 动作 | 时间 |
|------|------|------|
| Phase 3 | `routes.tsx` 为主，`page-registry.local.ts` 可选并行 | 2 周 |
| Phase 4 | 新页面只在 `page-registry.local.ts` 定义，`routes.tsx` 不再新增 | 4 周 |
| Phase 5 | `routes.tsx` 标记 `@deprecated`，全部迁移完成 | 6 周 |
| Phase 6 | 移除 `routes.tsx`，仅保留 `page-registry.*` | 8 周 |

---

## 三、实施步骤

### Phase 1：定义 PageRegistry 接口 + 创建本地配置（1 周）

**Task 1.1：类型定义**

创建 `src/router/page-registry-types.ts`：
- 导出 `PageEntry`、`PageRegistry`、`PageSource` 类型
- 从现有 `AppRoute` 复用 `protected`、`requiredPermission`、`hideLayout` 语义

**Task 1.2：本地配置创建**

创建 `src/router/page-registry.local.ts`：
- 将 `routes.tsx` 中 ~200 条路由**按模块分组**迁移
- 保持原有 `path`、`element`（懒加载函数）、`protected`、`requiredPermission` 不变
- 补充 `menu`、`title`、`hidden` 等元数据

**Task 1.3：类型校验**

```bash
# 确保类型兼容
npx tsc --noEmit
npm run type-check
```

### Phase 2：实现路由生成器（1 周）

**Task 2.1：`route-generator.ts` 实现**

- `generateRoutes(registry)`：PageRegistry → AppRoute[] 转换
- 处理 `redirectTo` → `<Navigate>` 转换
- 处理 `microApp: true` → 委托给 `SubAppRouteDynamic`
- 递归处理 `children` 嵌套路由
- 自动追加 `*` 404 路由

**Task 2.2：合并策略实现**

- `mergeRegistries(local, remote)`：本地优先合并
- `resolvePageEntry(entry)`：后端路径字符串 → 懒加载函数

**Task 2.3：单测覆盖**

```typescript
// src/router/__tests__/route-generator.test.ts
describe('generateRoutes', () => {
  it('converts redirect entries to Navigate elements');
  it('preserves microApp entries with hideLayout');
  it('generates nested children routes');
  it('appends 404 route if missing');
});
```

### Phase 3：迁移部分路由到 page-registry（试点）（1 周）

**Task 3.1：试点模块选择**

选择 2-3 个独立模块作为试点：
- `SubApps` 页面（路由简单，无子路由）
- `PipelineList` + `PipelineDetail`（父子路由结构）
- `AI*` 模块（含权限配置）

**Task 3.2：环境变量开关**

```bash
# .env.development
VITE_USE_PAGE_REGISTRY=true

# .env.production（默认 false）
```

**Task 3.3：试点验证**

- 开发环境启用 `page-registry`，对比路由渲染结果
- 验证 `ProtectedRoute`、权限拦截、`hideLayout` 行为一致
- 验证子应用路由 `:subAppKey/*` 正常加载

### Phase 4：全量迁移 + 弃用 routes.tsx（2 周）

**Task 4.1：全量迁移脚本**

编写脚本将 `routes.tsx` 中所有条目转换为 `page-registry.local.ts` 格式：

```bash
# scripts/migrate-routes-to-registry.ts
# 读取 routes.tsx → 解析 AppRoute[] → 输出 page-registry.local.ts
```

**Task 4.2：全量验证**

- 切换 `VITE_USE_PAGE_REGISTRY=true` 全量运行
- 执行 `npm run test` 确保路由相关测试通过
- 执行 `npm run build` 确保构建正常

**Task 4.3：routes.tsx 弃用**

```typescript
// routes.tsx
/** @deprecated Use page-registry.local.ts instead. Will be removed in Phase 6. */
```

### Phase 5：动态配置中心（可选，2 周）

**Task 5.1：后端 API**

后端新增 `GET /api/v1/system/page-registry` 接口，返回 PageRegistry JSON。

**Task 5.2：热更新**

前端启动时优先从远程加载，变更时重新生成路由：

```typescript
// src/router/page-registry.remote.ts
export async function loadPageRegistry(): Promise<PageRegistry> {
  try {
    const remote = await fetchRemotePageRegistry();
    return mergeRegistries(localPageRegistry, remote);
  } catch {
    return localPageRegistry; // fallback
  }
}
```

---

## 四、风险评估

### 4.1 微前端子应用特殊处理

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `:subAppKey/*` 通配路由与具体路由冲突 | 子应用可能拦截本应命中具体路由的路径 | 保留通配路由在数组末尾，与当前实现一致 |
| 子应用配置变更时路由不同步 | 子应用在 `subappStore` 中禁用后，通配路由仍可访问 | `SubAppRouteDynamic` 已有白名单验证，访问禁用子应用时显示 404 |
| `hideLayout` 与标准路由混合 | 子应用路由错误套用 Layout | `route-generator.ts` 严格按 `microApp` 字段区分 |

### 4.2 权限路由兼容性

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `requiredPermission` 格式变更 | 权限拦截失效 | 保持与现有 `AppRoute` 完全一致的字段结构 |
| 旧路由 `requiredRole` 字段（已废弃） | Phase 3 过渡期仍有遗留 | `route-generator.ts` 兼容读取 `requiredRole` |

### 4.3 性能影响

| 风险点 | 影响 | 缓解措施 |
|--------|------|---------|
| JSON 解析开销 | 启动时增加 ~1-2ms | 本地配置使用 TS 导入（零开销），远程配置异步加载 |
| 路由生成时机 | 阻塞首屏渲染 | 在 `index.tsx` `createRoot` 前同步执行 |
| 热更新重渲染 | 路由变更导致全量 re-render | 使用 `useMemo` 缓存生成结果，仅在 registry 变更时重新生成 |

### 4.4 数据一致性

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 页面组件路径变更但 page-registry 未同步 | 404 | 建立 CI 检查：page-registry 中 `element` 指向的组件必须存在 |
| 菜单配置与 page-registry 脱节 | 菜单项指向不存在的路由 | Phase 4 实现 `menu` 字段与 PageRegistry 自动校验 |

---

## 五、参考实现

### 5.1 qiankun 的 registerMicroApps 模式

qiankun 使用 `registerMicroApps` 集中注册子应用配置：

```typescript
// qiankun pattern
registerMicroApps([
  {
    name: 'subApp',
    entry: '//localhost:8080',
    container: '#subapp',
    activeRule: '/subapp',
  },
]);
```

**Orion-MF 对应实现**：

当前 `apps.ts` + `subappStore.ts` 已实现类似能力，但分散在多个文件。PageRegistry 将其统一抽象：

```typescript
// Orion-MF 统一注册表
{
  path: ':subAppKey/*',
  microApp: true,
  hideLayout: true,
  // 子应用配置委托给 subappStore 动态获取
}
```

### 5.2 现有 Orion-MF 的 microApp 字段复用

`PageEntry.microApp` 字段直接映射到现有 `SubAppRouteDynamic` 组件的职责：

```typescript
// route-generator.ts
if (entry.microApp) {
  return {
    path: entry.path,
    element: <SubAppRouteDynamic />, // 直接复用现有组件
    hideLayout: true,
    protected: entry.protected ?? true,
  };
}
```

`SubAppRouteDynamic` 内部从 `subappStore` 获取 `subAppKey` 对应的配置，无需修改。

### 5.3 菜单与路由关联

现有 `menuConfigStore.ts` 中 `MenuChildConfig.key` 与 `PageEntry.path` 天然对应：

```typescript
// menuConfigStore.ts
{ key: '/pipelines', label: '流水线', enabled: true }

// page-registry.local.ts
{ path: '/pipelines', element: () => import('@/pages/PipelineList'), menu: '/delivery' }
```

Phase 5 可建立自动校验：`menuConfigStore` 中所有 `key` 必须在 `PageRegistry` 中有对应 `path`。

---

## 六、文件结构

```
orion-frontend/src/router/
├── routes.tsx                    # @deprecated 旧静态路由（Phase 6 移除）
├── routes.ts                     # 现有路由类型导出（保留）
├── index.tsx                     # 路由消费层（改动最小）
├── page-registry-types.ts        # 新增：PageEntry / PageRegistry 类型
├── page-registry.local.ts        # 新增：本地页面注册表
├── page-registry.remote.ts       # 新增：远程配置加载（可选）
├── route-generator.ts            # 新增：路由生成器
└── __tests__/
    └── route-generator.test.ts   # 新增：路由生成器单测

orion-frontend/src/microfront/
├── apps.ts                       # 已有：SubAppConfig 接口
├── config.ts                     # 已有：子应用生命周期
└── types.ts                      # 已有：类型定义
```

---

## 七、验收标准

| 验收项 | 标准 |
|--------|------|
| 类型兼容 | `page-registry.local.ts` 生成的路由与现有 `routes.tsx` 完全等价 |
| 权限拦截 | `requiredPermission` 路由在 page-registry 模式下正常拦截 |
| 子应用加载 | `microApp: true` 路由正常加载子应用，hideLayout 生效 |
| 菜单同步 | menuConfigStore 的菜单项与 page-registry 路由一一对应 |
| 性能 | 路由生成时间 < 5ms，首屏无额外延迟 |
| 构建产物 | `npm run build` 产物大小无显著变化 |
| 回滚 | `VITE_USE_PAGE_REGISTRY=false` 立即回退到旧路由 |
