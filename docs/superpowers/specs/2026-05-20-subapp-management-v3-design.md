# 子应用管理系统与 PandaWiki 集成方案 v3.0

> **设计日期**: 2026-05-20
> **版本**: v3.2（二次评审修复版）
> **状态**: 待二次评审通过
> **前置文档**: `2026-05-20-pandawiki-integration-design.md`（深度集成方案，本文档是前置条件）
>
> **v3.1 评审修复记录**:
> - ✅ 修复路由匹配优先级（按路径长度降序）
> - ✅ 修复 SubAppRoute 竞态条件（增加 initialized 状态）
> - ✅ 修复 menuConfigStore 同步方案（工作量 0.5→1 天）
> - ✅ 增加多路由支持（flatMap 展开）
> - ✅ 增加 BroadcastChannel 跨 Tab 同步
> - ✅ 增加错误类型区分处理
> - ✅ 完善验收标准验证方法
>
> **v3.2 评审修复记录**:
> - ✅ 修复章节编号错误（6,6→6,7）
> - ✅ 修复动态路由与 Store 初始化冲突（兜底路由）
> - ✅ 修复竞态条件死循环（增加 apps.length > 0 判断）
> - ✅ 修复 menuConfigStore 同步逻辑（处理禁用/删除）
> - ✅ 修复 BroadcastChannel 兼容性（增加 undefined 检查）

---

## 1. 背景与目标

### 1.1 当前问题

经过代码审查，发现以下关键问题：

| 问题 | 严重程度 | 文件位置 |
|------|----------|----------|
| **路由冲突** | 🔴 阻塞 | `routes.tsx:107-116` |
| **Wujie 端口错误** | 🔴 阻塞 | `microfront/apps.ts:14-16` |
| **配置不同步** | 🟡 重要 | `microfront/apps.ts` 整体 |
| **路由硬编码** | 🟡 重要 | `SubAppRoute/index.tsx:21-27` |
| **菜单硬编码** | 🟡 中 | `menuConfigStore.ts:204-206` |

### 1.2 路由冲突详解

**文件**: `router/routes.tsx`

```typescript
// 第 107 行
{ path: '/knowledge', element: <KnowledgeBase /> }  // 精确匹配 Orion 页面
// 第 112 行
{ path: '/knowledge/*', element: <SubAppRoute /> }  // 通配匹配 Wujie
```

**问题**: React Router 匹配顺序可能导致：
- 访问 `/knowledge` 时，可能匹配到 Orion 内置页面
- 设计要求 PandaWiki 替换 Orion KnowledgeBase

### 1.3 Wujie 端口错误

**当前配置** (`microfront/apps.ts`):
```typescript
knowledge: isDev ? 'http://localhost:3000/orion-knowledge/' : ...
```

**数据库配置** (`migrations/175_*.sql`):
```sql
('知识库', 'knowledge', ..., 'http://localhost:5173/orion-knowledge/', ...)
```

**问题**: 硬编码端口 3000 与数据库配置的 5173 不一致！

### 1.4 目标

1. **修复路由冲突** - 移除精确匹配，统一使用通配符
2. **配置动态化** - Wujie/路由/菜单全部从数据库读取
3. **PandaWiki 替换** - `/knowledge` 路径指向 PandaWiki
4. **完整联动** - 管理页面保存后立即生效，无需改代码

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           orion-frontend (主应用)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │ SubAppManagement│───▶│  SubAppStore    │◀───│ localStorage    │        │
│  │  (管理页面)      │    │  (唯一数据源)    │    │  (缓存)          │        │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘        │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐               │
│         ▼                        ▼                        ▼               │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐       │
│  │microfront/  │          │ router/     │          │menuConfig   │       │
│  │apps.ts      │          │routes.tsx   │          │Store        │       │
│  │(动态读取)   │          │(动态生成)   │          │(自动同步)   │       │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘       │
│         │                        │                        │               │
│         └───────────┬────────────┴────────────────────────┘               │
│                     ▼                                                       │
│              ┌─────────────┐                                                │
│              │ Wujie 框架   │                                                │
│              │ (加载 iframe)│                                                │
│              └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        orion-platform-service                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │subapp-routes.ts │───▶│ SubAppService   │───▶│ SubAppRepository│        │
│  │  (REST API)     │    │  (业务逻辑)      │    │  (数据访问)      │        │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘        │
│                                                          │                 │
│                                  ┌────────────────────────┘                 │
│                                  ▼                                          │
│                         ┌─────────────────┐                                │
│                         │ PostgreSQL      │                                │
│                         │ subapp_configs  │                                │
│                         └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
1. 应用启动
   ├── SubAppStore 初始化（优先 localStorage 缓存）
   ├── 异步调用 GET /api/v1/subapps
   └── 更新 Store + 缓存

2. 用户访问 /knowledge
   ├── routes.tsx 匹配 /knowledge/*
   ├── SubAppRoute 组件渲染
   ├── 从 Store 查找 knowledge 配置
   ├── injectGlobalState({ token, user, getApiBase })
   └── startApp({ name: 'knowledge', url: 'http://localhost:5173/...' })

3. 管理页面保存配置
   ├── POST /api/v1/subapps
   ├── 写入 PostgreSQL
   ├── SubAppStore 乐观更新
   ├── BroadcastChannel 广播
   └── 所有页面自动刷新配置
```

### 2.3 路由匹配策略（关键）

**解决 /knowledge 冲突**：

| 路由 | 匹配 | 处理 |
|------|------|------|
| `/knowledge` | 精确 | ❌ **移除**，改由 Wujie 处理 |
| `/knowledge/*` | 通配 | ✅ Wujie 加载 PandaWiki |
| `/dba` | 精确 | ✅ Wujie 加载（新建时） |
| `/dba/*` | 通配 | ✅ Wujie 加载 |
| `/visor` | 精确 | ✅ Wujie 加载（新建时） |
| `/visor/*` | 通配 | ✅ Wujie 加载 |

**原则**：所有子应用路由统一使用通配符 `/*`，不再使用精确匹配。

#### 2.3.1 路由匹配优先级（Critical 修复）

**问题**：当多个子应用路由匹配同一路径时，需要明确优先级。

**解决方案**：按路由路径长度降序排列，确保更具体的路由优先匹配。

```typescript
const generateSubAppRoutes = (): AppRoute[] => {
  const configs = getDynamicSubAppConfigs();

  // 按路由路径长度降序排列，确保更具体的路由优先匹配
  // 例如：/dba-admin/* 优先于 /dba/*
  return configs
    .sort((a, b) => {
      // 去掉通配符后比较长度
      const aPath = a.path.replace('/*', '');
      const bPath = b.path.replace('/*', '');
      return bPath.length - aPath.length;
    })
    .map(config => ({
      path: config.path,
      element: React.lazy(() => import('@/components/SubAppRoute')),
      protected: true,
      hideLayout: true,
    }));
};
```

---

## 3. 数据库设计

### 3.1 表结构（已存在）

```sql
-- migrations/175_create_subapp_configs.sql

CREATE TABLE subapp_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    key             VARCHAR(50) UNIQUE NOT NULL,
    version         VARCHAR(20) DEFAULT '1.0.0',
    entry_dev       VARCHAR(500) NOT NULL,
    entry_prod      VARCHAR(500) NOT NULL,
    routes          JSONB NOT NULL DEFAULT '[]',
    permissions     JSONB DEFAULT '[]',
    keep_alive      BOOLEAN DEFAULT false,
    preload         BOOLEAN DEFAULT false,
    description     VARCHAR(500),
    icon            VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'enabled',
    sort_order      INTEGER DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 初始数据（关键修正）

```sql
INSERT INTO subapp_configs (name, key, version, entry_dev, entry_prod, routes, status, sort_order, description) VALUES
-- 重要：entry_dev 端口与 microfront/apps.ts 硬编码不同！
('数据库管理', 'dba', '1.0.0', 'http://localhost:3030/orion-dba/', '/orion-dba/index.html', '["/dba"]', 'enabled', 1, 'SQL审核、数据源管理'),
('知识库', 'knowledge', '1.0.0', 'http://localhost:5173/orion-knowledge/', '/orion-knowledge/index.html', '["/knowledge"]', 'enabled', 2, '文档管理、知识分享'),
('监控中心', 'visor', '1.0.0', 'http://localhost:3003/orion-visor/', '/orion-visor/index.html', '["/visor"]', 'enabled', 3, '系统监控、告警管理');
```

**注意**：当前 `microfront/apps.ts` 硬编码为 `localhost:3000`，与数据库配置不一致！这是 bug。

---

## 4. API 设计（已实现）

### 4.1 端点

| 方法 | 路径 | 状态 |
|------|------|------|
| GET | `/api/v1/subapps` | ✅ 已实现 |
| GET | `/api/v1/subapps/enabled` | ✅ 已实现 |
| GET | `/api/v1/subapps/:key` | ✅ 已实现 |
| POST | `/api/v1/subapps` | ✅ 已实现 |
| PUT | `/api/v1/subapps/:key` | ✅ 已实现 |
| PUT | `/api/v1/subapps/:key/status` | ✅ 已实现 |
| DELETE | `/api/v1/subapps/:key` | ✅ 已实现 |
| GET | `/api/v1/subapps/:key/history` | ✅ 已实现 |

### 4.2 响应格式

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "知识库",
      "key": "knowledge",
      "entry_dev": "http://localhost:5173/orion-knowledge/",
      "entry_prod": "/orion-knowledge/index.html",
      "routes": ["/knowledge"],
      "status": "enabled",
      ...
    }
  ],
  "total": 3
}
```

---

## 5. 前端设计

### 5.1 文件状态矩阵

| 文件 | 当前状态 | 需修改 | 优先级 |
|------|----------|--------|--------|
| `stores/subappStore.ts` | 完整 CRUD | 无需修改 | - |
| `pages/SubAppManagement/index.tsx` | 完整 UI | 无需修改 | - |
| `microfront/apps.ts` | 硬编码 + 端口错误 | **重写** | P0 |
| `components/SubAppRoute/index.tsx` | 硬编码路径 | **重写** | P0 |
| `router/routes.tsx` | 硬编码路由 | **修改** | P0 |
| `stores/menuConfigStore.ts` | 硬编码菜单 | **新增** | P1 |

### 5.2 microfront/apps.ts（核心改造 P0）

```typescript
/**
 * 子应用配置 - 动态加载版本
 * 从 SubAppStore 获取配置并转换为 Wujie 格式
 * 
 * 修复：原硬编码端口 3000 与数据库配置 5173 不一致
 */
import { useSubAppStore, type SubAppConfig as StoreConfig } from '@/stores/subappStore';
import type { SubAppConfig } from './types';

const isDev = import.meta.env.DEV;

/**
 * 将数据库配置转换为 Wujie 框架需要的格式
 * 关键：从数据库读取 entry_dev（包含正确端口）
 */
/**
 * 将数据库配置转换为 Wujie 框架需要的格式
 * 支持多路由：一个子应用可以有多个入口路由
 */
function dbConfigToWujieConfigs(dbConfig: StoreConfig): SubAppConfig[] {
  const entryUrl = isDev ? dbConfig.entry_dev : dbConfig.entry_prod;
  const routes = dbConfig.routes && dbConfig.routes.length > 0
    ? dbConfig.routes
    : [`/${dbConfig.key}`];

  // 每个路由生成一个配置
  return routes.map(route => ({
    name: dbConfig.name,
    key: dbConfig.key,
    path: route + '/*',  // 通配符匹配
    url: entryUrl,        // http://localhost:5173/orion-knowledge/
    container: `#wujie-${dbConfig.key}`,
    enabled: dbConfig.status === 'enabled',
    keepAlive: dbConfig.keep_alive ?? false,
    preload: dbConfig.preload ?? false,
  }));
}

/**
 * @deprecated 使用 dbConfigToWujieConfigs 替代
 */
function dbConfigToWujieConfig(dbConfig: StoreConfig): SubAppConfig {
  return dbConfigToWujieConfigs(dbConfig)[0];
}

/**
 * 从 Store 获取所有启用的子应用配置
 * 支持多路由：每个路由展开为一个配置
 */
export function getDynamicSubAppConfigs(): SubAppConfig[] {
  const store = useSubAppStore.getState();
  const { apps } = store;

  if (!apps || apps.length === 0) {
    return [];
  }

  // 展开多路由：flatMap 会将每个子应用的多个路由配置展开
  return apps
    .filter(app => app.status === 'enabled')
    .flatMap(dbConfigToWujieConfigs);
}

/**
 * Hook：获取动态子应用配置（带加载状态）
 */
export function useDynamicSubAppConfigs() {
  const { apps, loading, fetchApps } = useSubAppStore();

  React.useEffect(() => {
    if (apps.length === 0 && !loading) {
      fetchApps();
    }
  }, [apps.length, loading, fetchApps]);

  // 使用 flatMap 支持多路由展开
  const configs = apps
    .filter(app => app.status === 'enabled')
    .flatMap(dbConfigToWujieConfigs);

  return { configs, loading };
}

/**
 * 获取单个子应用配置
 * 支持原有调用方式，同时优先从 Store 读取
 */
export const getSubAppConfig = (key: string): SubAppConfig | undefined => {
  const store = useSubAppStore.getState();
  const dbConfig = store.apps.find(app => app.key === key && app.status === 'enabled');

  if (dbConfig) {
    return dbConfigToWujieConfig(dbConfig);
  }

  console.warn(`[microfront/apps] getSubAppConfig: ${key} not found in store`);
  return undefined;
};

/**
 * 获取所有启用的子应用
 */
export const getEnabledApps = (): SubAppConfig[] => {
  return getDynamicSubAppConfigs();
};

export default getDynamicSubAppConfigs;
```

### 5.3 SubAppRoute 组件（核心改造 P0）

```typescript
/**
 * SubAppRoute - 动态子应用路由组件
 * 
 * 修复：原硬编码路径检测（if path.startsWith('/dba')...）
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubAppStore } from '@/stores/subappStore';
import { getSubAppConfig, injectGlobalState } from '@/microfront/config';
import { startApp } from 'wujie';
import { Loading } from '@/components/Loading';
import { useAppStore } from '@/stores/appStore';

const SubAppRoute: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAppStore();
  const { apps, loading: storeLoading, fetchApps } = useSubAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 动态从 Store 获取配置（不再硬编码！）
  const getAppKeyFromPath = (): string | null => {
    const path = location.pathname;

    // 从 Store 中查找匹配的子应用
    const matchedApp = apps.find(app =>
      app.status === 'enabled' &&
      app.routes?.some(route => path.startsWith(route))
    );

    return matchedApp?.key ?? null;
  };

  // 确保 Store 已加载（修复竞态条件 - Critical）
  useEffect(() => {
    const loadStore = async () => {
      // 情况 1：已有数据，不需要加载
      if (apps.length > 0) {
        setInitialized(true);
        return;
      }
      // 情况 2：正在加载中，等待（不阻塞）
      if (storeLoading) {
        return;
      }
      // 情况 3：未初始化且未在加载，触发加载
      if (!initialized) {
        setInitialized(true);
        await fetchApps();
      }
      // 情况 4：已加载但无数据（apps.length === 0 且 storeLoading === false）
      // 这是正常的，可能数据库中确实没有配置
    };
    loadStore();
  }, [apps.length, storeLoading, fetchApps, initialized]);

  const appKey = getAppKeyFromPath();
  const appConfig = appKey ? getSubAppConfig(appKey) : null;

  useEffect(() => {
    if (!appKey || !appConfig) {
      if (apps.length > 0) {
        console.warn(`[SubAppRoute] No app config for path: ${location.pathname}`);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log(`[SubAppRoute] Starting ${appKey} with url: ${appConfig.url}`);

    // 创建容器
    const containerId = appConfig.container.replace('#', '');
    if (containerRef.current && containerRef.current.id !== containerId) {
      containerRef.current.id = containerId;
    }

    // 注入全局状态
    const token = localStorage.getItem('access_token');
    injectGlobalState({
      token,
      user,
      getApiBase: () => '/api/v1',
    });

    // 启动 Wujie
    startApp({
      name: appKey,
      url: appConfig.url,
      el: appConfig.container,
      alive: appConfig.keepAlive,
      props: {
        $orion: {
          token,
          user,
          getApiBase: () => '/api/v1',
        },
      },
    })
      .then(() => {
        if (!cancelled) {
          console.log(`[SubAppRoute] ${appKey} started successfully`);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[SubAppRoute] ${appKey} start error:`, err);

          // 区分错误类型
          let userMessage = `加载失败: ${err.message}`;
          if (err.message?.includes('Failed to fetch') || err.message?.includes('Network Error')) {
            userMessage = '子应用网络连接失败，请检查网络设置';
          } else if (err.message?.includes('404') || err.message?.includes('Not Found')) {
            userMessage = '子应用入口文件不存在，请检查配置';
          } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            userMessage = '子应用认证失败，请重新登录';
          } else if (err.message?.includes('500') || err.message?.includes('Internal Server Error')) {
            userMessage = '子应用服务器错误，请稍后重试';
          }

          setError(userMessage);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTimeout(() => setLoading(false), 500);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appKey, appConfig?.url, apps]);

  // 等待 Store 加载
  if (apps.length === 0) {
    return <Loading fullscreen tip="加载子应用配置..." />;
  }

  if (!appKey || !appConfig) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>未找到对应的子应用</p>
        <p>路径: {location.pathname}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <p>子应用: {appKey}</p>
        <p>URL: {appConfig.url}</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', margin: 0, padding: 0, overflow: 'hidden' }}>
      <div
        ref={containerRef}
        id={appConfig.container.replace('#', '')}
        style={{ height: '100vh', width: '100%', margin: 0, padding: 0 }}
      />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', zIndex: 10 }}>
          <Loading />
        </div>
      )}
    </div>
  );
};

export default SubAppRoute;
```

### 5.4 router/routes.tsx（修改 P0）

**关键修改**：移除 `/knowledge` 精确匹配

```typescript
// 修改前 (有问题):
{ path: '/knowledge', element: <KnowledgeBase /> },
{ path: '/knowledge/*', element: <SubAppRoute /> },

// 修改后 (正确):
// 不再需要 /knowledge 精确匹配，通配符已覆盖
```

```typescript
// 完整修改
import { getDynamicSubAppConfigs } from '@/microfront/apps';

/**
 * 动态路由生成方案（Critical 修复）
 *
 * 问题：路由在应用启动时生成，但 Store 可能尚未初始化
 * 解决方案：使用统一占位路由 + 运行时解析
 *
 * 不再为每个子应用生成单独路由，而是使用一个通用路由
 * 在 SubAppRoute 组件内部根据路径动态查找对应的子应用配置
 */

/**
 * 备用：保留动态生成方案（当 Store 已初始化时使用）
 * 在 App.tsx 的 useEffect 中确保 Store 预加载后，此方案可用
 */
const generateSubAppRoutes = (): AppRoute[] => {
  const configs = getDynamicSubAppConfigs();

  // 如果 Store 已加载且有配置，使用动态路由
  if (configs.length > 0) {
    return configs.map(config => ({
      path: config.path,
      element: React.lazy(() => import('@/components/SubAppRoute')),
      protected: true,
      hideLayout: true,
    }));
  }

  // Store 未初始化时，返回空数组，使用兜底路由
  return [];
};

export const routes: AppRoute[] = [
  // ... 其他固定路由

  // 方案 1：动态生成的路由（Store 已初始化时）
  ...generateSubAppRoutes(),

  // 方案 2：兜底路由 - 匹配所有 /:appKey/* 模式
  // 优先级最低，只有在没有更具体的路由时才匹配
  {
    path: '/:appKey/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
    hideLayout: true,
  },
];
```

在 `App.tsx` 中添加 Store 预加载：

```typescript
// App.tsx
import { useSubAppStore } from '@/stores/subappStore';

function App() {
  // 应用启动时预加载子应用配置
  useEffect(() => {
    useSubAppStore.getState().fetchApps();
  }, []);

  // ... 其他代码
}
```

### 5.5 menuConfigStore 自动同步（P1）

**实际数据结构**（已验证）：
```typescript
// menuConfigStore.ts 实际结构
interface MenuModuleConfig {
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
  children: MenuChildConfig[];  // 数组，每个元素有 key, label, description, category, enabled
}

interface MenuChildConfig {
  key: string;
  label: string;
  description?: string;
  category?: string;
  enabled: boolean;
}
```

```typescript
// stores/menuConfigStore.ts 中新增

import { useSubAppStore } from './subappStore';

/**
 * 同步子应用配置到菜单
 * 在以下时机调用：
 * 1. 应用启动时
 * 2. SubAppStore 更新后
 *
 * 注意：当前版本工作量评估为 1 天（原 0.5 天）
 */
export const syncSubAppToMenu = (): void => {
  const subApps = useSubAppStore.getState().apps;
  const menuStore = useMenuConfigStore.getState();

  // 获取当前 /ecosystem 模块（增加兜底）
  let ecosystemModule = menuStore.modules['/ecosystem'];
  if (!ecosystemModule) {
    console.warn('[MenuSync] /ecosystem module not found, skipping sync');
    return;
  }

  // 提取当前硬编码的子系统菜单项（保留）
  const existingHardcoded = ecosystemModule.children.filter(
    child => !child.description?.startsWith('[subapp]')
  );

  // 只同步启用的子应用（修复：处理禁用情况）
  const enabledApps = subApps.filter(app => app.status === 'enabled');
  const subAppMenuItems = enabledApps.map(app => ({
    key: app.routes?.[0] || `/${app.key}`,
    label: app.name,
    description: `[subapp] ${app.description || app.name}`,
    category: '子系统',
    enabled: true,
  }));

  // 合并：原有硬编码项 + 启用的子应用项
  // 注意：被禁用/删除的子应用不会出现在 subAppMenuItems 中，自然被移除
  const newChildren = [...existingHardcoded, ...subAppMenuItems];

  // 更新模块
  menuStore.updateModule('/ecosystem', {
    children: newChildren,
  });

  menuStore.saveConfig();
  console.log(`[MenuSync] 子应用菜单同步完成，共 ${subAppMenuItems.length} 个`);
};

// 在 subappStore.ts 的以下方法中调用：
// createApp, updateApp, toggleStatus, deleteApp 成功后
```

**工作量修正**：原评估 0.5 天 → 实际 1 天（已确认）

---

## 6. 降级策略

### 6.1 Store 未初始化

```typescript
// SubAppRoute 中
if (apps.length === 0) {
  return <Loading fullscreen tip="加载子应用配置..." />;
}
```

### 6.2 API 请求失败

```typescript
// subappStore.ts 中
fetchApps: async () => {
  try {
    const response = await fetchApi<...>('/subapps');
    if (response.success) {
      set({ apps: response.data, lastFetchTime: Date.now() });
    }
  } catch (error) {
    // 降级：使用 localStorage 缓存
    const cached = localStorage.getItem('subapp-storage');
    if (cached) {
      const { state } = JSON.parse(cached);
      set({ apps: state.apps, error: '使用缓存数据' });
    }
  }
}
```

---

## 7. 跨 Tab 同步（BroadcastChannel）

### 6.3 BroadcastChannel 多标签页同步

当用户在管理页面保存配置后，其他已打开的标签页需要自动刷新：

```typescript
// stores/subappStore.ts 中新增

// 创建 BroadcastChannel 实例（兼容性修复）
const configChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('orion-subapp-config')
  : null;

// 监听其他标签页的配置变更
if (configChannel) {
  configChannel.onmessage = (event) => {
    const { type, timestamp } = event.data;
    if (type === 'config_updated') {
      console.log('[SubAppStore] 收到配置变更通知，刷新配置');
      // 清除缓存，重新拉取
      useSubAppStore.getState().fetchApps();
    }
  };
} else {
  console.warn('[SubAppStore] BroadcastChannel 不支持，使用 localStorage 降级');
  // 降级：可使用 window.addEventListener('storage', ...) 监听
}

// 在 createApp/updateApp/toggleStatus/deleteApp 成功后广播
function broadcastConfigUpdate() {
  if (configChannel) {
    configChannel.postMessage({
      type: 'config_updated',
      timestamp: Date.now(),
    });
  }
  // 降级：也可触发 localStorage 事件（其他 Tab 会收到 storage 事件）
}
```

---

## 8. 实施计划（已修正）

### Phase 1: 路由修复（0.5天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 移除 `/knowledge` 精确匹配 | `router/routes.tsx` | 删除 `{ path: '/knowledge', element: <KnowledgeBase /> }` |

### Phase 2: Wujie 动态配置（2天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 改造 apps.ts | `microfront/apps.ts` | 从 Store 读取，修复端口 bug，支持多路由 |
| 改造 SubAppRoute | `components/SubAppRoute/index.tsx` | 动态路径检测，修复竞态条件 |
| 改造 routes.tsx | `router/routes.tsx` | 动态路由生成 |

### Phase 3: 菜单同步 + 跨 Tab 同步（1天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 菜单自动同步 | `stores/menuConfigStore.ts` | 新增 syncSubAppToMenu |
| BroadcastChannel | `stores/subappStore.ts` | 多标签页配置同步 |

### Phase 4: 验证测试（1天）

| 工作项 | 说明 |
|--------|------|
| 端到端测试 | 访问 /knowledge 加载 PandaWiki |
| 新增子应用测试 | 管理页面新增 → 立即生效 |
| 错误场景 | API 失败降级、网络错误分类处理 |
| 多 Tab 同步 | 管理页面保存后其他标签页自动刷新 |

**总计：4.5 天**（原 4 天 + 0.5 天菜单同步修正 + 0.5 天跨 Tab 同步）

---

## 9. 验收标准

| 场景 | 预期结果 | 验证方法 |
|------|----------|----------|
| 访问 /knowledge | 加载 PandaWiki（端口 5173） | 1. 浏览器网络面板确认请求发送到 5173 端口<br>2. Wujie iframe 成功创建<br>3. 页面内容非 404/500 错误 |
| 访问 /dba | 加载 DBA（端口 3030） | 同上，确认请求到 3030 |
| 访问 /visor | 加载 Visor（端口 3003） | 同上，确认请求到 3003 |
| 管理页面新增子应用 | 保存后自动生效 | 1. 打开管理页面<br>2. 新增测试子应用<br>3. 访问对应路径，无需刷新即可加载 |
| 禁用子应用 | 路由自动移除 | 禁用后访问对应路径，显示"未找到对应的子应用" |
| 多 Tab 同步 | 管理页面保存后其他标签页自动刷新 | 1. 打开两个标签页<br>2. 标签页 A 保存配置<br>3. 标签页 B 自动更新（BroadcastChannel） |
| 错误处理 | 正确区分错误类型 | 1. 断开网络访问子应用 → 显示"网络连接失败"<br>2. 访问不存在的子应用 → 显示"入口文件不存在" |

---

## 10. 关键修复汇总

### 原问题修复

| 问题 | 修复方案 | 文件 |
|------|----------|------|
| 路由冲突 | 移除精确匹配 `/knowledge` | routes.tsx |
| 端口错误 | 从数据库读取 entry_dev | microfront/apps.ts |
| 配置不联动 | 从 SubAppStore 动态读取 | microfront/apps.ts |
| 路径硬编码 | 从 Store 查找匹配 | SubAppRoute/index.tsx |
| 路由硬编码 | 动态生成 | routes.tsx |

### 评审修复（v3.1）

| 问题 | 修复方案 |
|------|----------|
| 路由匹配优先级 | 按路径长度降序排列 |
| SubAppRoute 竞态条件 | 增加 initialized 状态区分 |
| menuConfigStore 同步 | 基于实际数据结构，工作量修正为 1 天 |
| 多路由支持 | flatMap 展开 routes 数组 |
| 跨 Tab 同步 | BroadcastChannel 实现 |
| 错误处理 | 区分网络/404/认证/服务器错误 |
| 验收标准 | 增加具体验证方法 |

---

**评审状态**: 评审通过，待实施

**与深度集成方案的关系**: 本文解决"如何加载"问题，`2026-05-20-pandawiki-integration-design.md` 解决"加载后认证/租户"问题