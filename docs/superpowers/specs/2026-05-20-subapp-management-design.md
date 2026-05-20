# 子应用管理系统设计方案

> **设计日期**: 2026-05-20
> **修订日期**: 2026-05-20（前端架构师评审后修订 v3.1）
> **状态**: 评审修订版，待实施

---

## 1. 背景与目标

### 1.1 背景

当前系统使用 Wujie 微前端框架，子应用配置分散在三处：

| 文件 | 用途 | 问题 |
|------|------|------|
| `microfront/apps.ts` | Wujie 框架加载配置 | 硬编码 3 个子应用，新增需改代码 |
| `stores/menuConfigStore.ts` | 菜单配置 | 与子应用配置重复 |
| `stores/subappStore.ts` | 管理页面 CRUD | 已与 API 对接但运行时未联动 |

**根本问题**：
- 新增子应用需要修改 `microfront/apps.ts` + `routes.tsx` + `vite.config.ts`
- `stores/subappStore.ts` 和 `pages/SubAppManagement/index.tsx` 已存在，但与管理页面联动的运行时逻辑缺失
- `microfront/apps.ts` 仍然硬编码，管理页面的配置无法传递给 Wujie 框架

### 1.2 目标

实现 **配置统一 + 运行时联动** 的完整闭环：
- **配置统一**：`SubAppStore` 作为唯一数据源，`microfront/apps.ts` 从 Store 动态读取
- **页面化管理**：在 `/console/subapps` 页面新增子应用，保存即生效
- **运行时联动**：配置变更后，路由注册和 Wujie 框架自动感知

### 1.3 范围界定

- **已存在无需修改**：`stores/subappStore.ts`（已有完整 CRUD）、`pages/SubAppManagement/index.tsx`（已有完整 UI）
- **本次需要新建/改造**：
  1. `microfront/apps.ts` 改造为从 Store 动态读取
  2. `microfront/config.ts` 增加动态路由注册
  3. `router/routes.tsx` 中子应用路由改为动态生成
  4. 后端 API 实现（`subapp-routes.ts` + `services/subapp/`）
  5. 数据库迁移

---

## 2. 总体架构

### 2.1 架构图

```
┌───────────────────────────────────────────────────────────────────────┐
│                         orion-frontend (主应用)                        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐    ┌──────────────────┐                        │
│  │ 管理页面(已有)    │───▶│  SubAppStore     │◀─── 持久化(localStorage)│
│  │ SubAppManagement │    │  (已有)          │                        │
│  └──────────────────┘    └────────┬─────────┘                        │
│                                   │                                   │
│              ┌────────────────────┼────────────────────┐              │
│              ▼                    ▼                    ▼              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│  │ microfront/      │ │ router/          │ │ SubAppLauncher   │     │
│  │ apps.ts (改造)   │ │ routes.tsx(改造) │ │ (已有)           │     │
│  │ → 从Store读配置   │ │ → 动态注册路由    │ │ → 从Store读列表   │     │
│  └────────┬─────────┘ └────────┬─────────┘ └──────────────────┘     │
│           │                    │                                     │
│           └────────┬───────────┘                                     │
│                    ▼                                                 │
│           ┌──────────────────┐                                       │
│           │ Wujie 框架        │                                       │
│           │ (加载子应用iframe) │                                       │
│           └──────────────────┘                                       │
└───────────────────────────┬──────────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        orion-platform-service                         │
├───────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                        │
│  │ /api/v1/subapps  │───▶│ subapp_configs   │                        │
│  │ (后端CRUD)        │    │ (PostgreSQL)     │                        │
│  └──────────────────┘    └──────────────────┘                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
应用启动 ──▶ SubAppStore.fetchApps() ──▶ API GET /subapps ──▶ 返回配置列表
                                              │
                                              ▼
                                     localStorage 缓存
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                         microfront/       router/       SubAppLauncher
                         apps.ts读配置     动态注册路由   显示子系统列表
                              │               │               │
                              ▼               ▼               ▼
                         Wujie加载       路由跳转          点击跳转
```

### 2.3 与现有代码的关系

| 现有文件 | 状态 | 说明 |
|----------|------|------|
| `stores/subappStore.ts` | **保留，无需修改** | 已有完整 CRUD + 持久化 |
| `pages/SubAppManagement/index.tsx` | **保留，无需修改** | 已有完整管理页面 UI |
| `microfront/apps.ts` | **改造** | 从硬编码改为从 SubAppStore 动态读取 |
| `microfront/config.ts` | **改造** | 增加动态路由注册能力 |
| `stores/menuConfigStore.ts` | **保留** | 菜单配置，未来可考虑与 SubAppStore 合并 |
| `router/routes.tsx` | **微调** | 子应用路由改为动态生成 |

---

## 3. 数据库设计

### 3.1 子应用配置表 (subapp_configs)

```sql
CREATE TABLE subapp_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,              -- 显示名称
    key             VARCHAR(50) UNIQUE NOT NULL,        -- 唯一标识
    version         VARCHAR(20) DEFAULT '1.0.0',        -- 语义化版本号
    entry_dev       VARCHAR(500) NOT NULL,              -- 开发环境入口 (http/https URL)
    entry_prod      VARCHAR(500) NOT NULL,              -- 生产环境入口 (相对路径或 http/https URL)
    routes          JSONB NOT NULL DEFAULT '[]',        -- 路由路径数组，例如 ["/dba", "/dba/*"]
    permissions     JSONB DEFAULT '[]',                 -- 权限标识数组
    keep_alive      BOOLEAN DEFAULT false,              -- 切换时是否保持存活（不销毁 iframe）
    preload         BOOLEAN DEFAULT false,              -- 是否预加载
    description     VARCHAR(500),                       -- 描述信息
    icon            VARCHAR(50),                        -- 图标名称（Ant Design Icon 名）
    status          VARCHAR(20) DEFAULT 'enabled',      -- enabled/disabled
    sort_order      INTEGER DEFAULT 0,                  -- 排序权重
    created_by      UUID REFERENCES users(id),          -- 创建人
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 路由唯一性约束触发器：防止两个子应用配置相同的路由
CREATE OR REPLACE FUNCTION check_route_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    existing_key VARCHAR(50);
    route TEXT;
BEGIN
    FOR route IN SELECT jsonb_array_elements_text(NEW.routes) LOOP
        SELECT key INTO existing_key
        FROM subapp_configs
        WHERE key != COALESCE(NEW.key, '')
          AND routes @> jsonb_build_array(route)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'Route conflict: "%" is already used by subapp "%"', route, existing_key;
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_route_uniqueness
    BEFORE INSERT OR UPDATE ON subapp_configs
    FOR EACH ROW EXECUTE FUNCTION check_route_uniqueness();
```

### 3.2 配置变更历史表 (subapp_config_history)

```sql
CREATE TABLE subapp_config_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subapp_key      VARCHAR(50) NOT NULL REFERENCES subapp_configs(key) ON DELETE CASCADE,
    action          VARCHAR(20) NOT NULL,             -- created/updated/deleted/status_changed
    old_value       JSONB,                            -- 变更前的完整配置
    new_value       JSONB,                            -- 变更后的完整配置
    changed_by      UUID REFERENCES users(id),        -- 操作人
    change_summary  VARCHAR(500),                     -- 变更摘要
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_history_subapp_key ON subapp_config_history(subapp_key);
CREATE INDEX idx_history_created_at ON subapp_config_history(created_at DESC);
```

### 3.3 初始数据

```sql
INSERT INTO subapp_configs (name, key, version, entry_dev, entry_prod, routes, status, icon, description) VALUES
('数据库管理', 'dba', '1.0.0', 'http://localhost:3030/orion-dba/', '/orion-dba/index.html', '["/dba"]', 'enabled', 'DatabaseOutlined', 'SQL 执行、数据建模、性能监控'),
('知识库', 'knowledge', '1.0.0', 'http://localhost:5173/orion-knowledge/', '/orion-knowledge/index.html', '["/knowledge"]', 'enabled', 'BookOutlined', '文档管理、知识沉淀、经验分享'),
('监控中心', 'visor', '1.0.0', 'http://localhost:3003/orion-visor/', '/orion-visor/index.html', '["/visor"]', 'enabled', 'DashboardOutlined', '系统监控、告警管理、日志查询');
```

### 3.4 字段约束说明

| 字段 | 校验规则 |
|------|----------|
| `key` | `^[a-z][a-z0-9-]*$`，小写字母开头，只包含小写字母、数字、中划线 |
| `entry_dev` | 必须是 `http://` 或 `https://` 开头的绝对 URL |
| `entry_prod` | 相对路径以 `/` 开头，或 `http/https` 绝对 URL |
| `routes[]` | 每个路由必须以 `/` 开头 |
| `version` | 语义化版本格式 `^\d+\.\d+\.\d+$` |

---

## 4. API 设计

### 4.1 RESTful 端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/subapps` | 获取所有子应用配置 | 已认证 |
| GET | `/api/v1/subapps/enabled` | 获取已启用的子应用 | 已认证 |
| GET | `/api/v1/subapps/:key` | 获取单个配置详情 | 已认证 |
| POST | `/api/v1/subapps` | 创建子应用 | `subapp:manage` |
| PUT | `/api/v1/subapps/:key` | 更新配置 | `subapp:manage` |
| PUT | `/api/v1/subapps/:key/status` | 切换启用/禁用状态 | `subapp:manage` |
| DELETE | `/api/v1/subapps/:key` | 软删除配置 | `subapp:manage` |
| GET | `/api/v1/subapps/:key/history` | 获取变更历史（分页） | `subapp:manage` |

### 4.2 响应格式

**与 orion-platform-service 统一格式**：`{ data: ..., total: N }`（无 success/code/message 包裹）

**POST /api/v1/subapps**
```json
// Request
{
  "name": "数据库管理",
  "key": "dba",
  "version": "1.0.0",
  "entry_dev": "http://localhost:3030/orion-dba/",
  "entry_prod": "/orion-dba/index.html",
  "routes": ["/dba"],
  "keep_alive": false,
  "preload": false,
  "description": "SQL审核、数据源管理",
  "icon": "DatabaseOutlined"
}

// Response (201 Created)
{
  "data": {
    "id": "uuid",
    "name": "数据库管理",
    "key": "dba",
    "version": "1.0.0",
    "entry_dev": "http://localhost:3030/orion-dba/",
    "entry_prod": "/orion-dba/index.html",
    "routes": ["/dba"],
    "permissions": [],
    "keep_alive": false,
    "preload": false,
    "description": "SQL审核、数据源管理",
    "icon": "DatabaseOutlined",
    "status": "enabled",
    "sort_order": 0,
    "created_by": null,
    "created_at": "2026-05-20T10:00:00Z",
    "updated_at": "2026-05-20T10:00:00Z"
  }
}
```

**GET /api/v1/subapps**
```json
// Response (200 OK)
{
  "data": [
    { "id": "...", "key": "dba", "name": "数据库管理", ... }
  ],
  "total": 1
}
```

### 4.3 错误响应

```json
{
  "error": "VALIDATION_ERROR",
  "code": "40000",
  "message": "Invalid subapp key format. Must match ^[a-z][a-z0-9-]*$",
  "details": { "field": "key", "value": "DBA" }
}
```

### 4.4 安全控制

- **URL 协议校验**：`entry_dev` 和 `entry_prod`（绝对路径时）只允许 `http://` 和 `https://` 开头
- **SSRF 防护**：`entry_dev` 只允许 `localhost` 和明确配置的子应用域名，拒绝 `169.254.169.254` 等内网地址
- **删除前引用检查**：删除时检查是否有活跃引用（如菜单配置中引用了该 key），有引用时拒绝删除并返回引用信息
- **软删除**：状态变更为 `deleted` 而非物理删除，保留 `deleted_at` 时间戳

---

## 5. 前端设计

### 5.1 管理页面（已有，无需修改）

`pages/SubAppManagement/index.tsx` 已实现以下功能：
- 列表展示 + 分页
- 创建/编辑/删除操作
- 状态切换开关
- 历史记录抽屉
- 复制链接功能
- 表单校验（key 格式正则）

**与 API 响应格式的差异处理**：当前 `subappStore.ts` 期望 `{ success: boolean, data: T }` 格式，后端将返回 `{ data: T }` 格式。需要 **修改 `subappStore.ts` 的响应解析逻辑**。

### 5.2 SubAppStore 改造（需修改）

**修改点**：响应格式适配 + 非阻塞初始化

当前 `subappStore.ts` 期望 `{ success: boolean, data: T }` 格式，后端将返回 `{ data: T }` 格式。需要 **修改所有 7 个 API 方法的响应解析逻辑**：

```typescript
// 修改清单（全部 7 个方法）：

// 1. fetchApps — 列表查询
// 修改前: if (response.success) { set({ apps: response.data }) }
// 修改后: set({ apps: response.data, lastFetchTime: Date.now() });

// 2. fetchEnabledApps — 已启用列表
// 修改前: if (response.success) { set({ apps: response.data }) }
// 修改后: set({ apps: response.data, lastFetchTime: Date.now() });

// 3. createApp — 创建
// 修改前: if (response.success) { set({ apps: [...state.apps, response.data] }) }
// 修改后: set((state) => ({ apps: [...state.apps, response.data] }));

// 4. updateApp — 更新
// 修改前: if (response.success) { apps: state.apps.map(...) }
// 修改后: set((state) => ({ apps: state.apps.map((app) => (app.key === key ? response.data : app)) }));

// 5. deleteApp — 删除
// 修改前: if (response.success) { apps: state.apps.filter(...) }
// 修改后: set((state) => ({ apps: state.apps.filter((app) => app.key !== key) }));

// 6. toggleStatus — 状态切换
// 修改前: if (response.success) { apps: state.apps.map(...) }
// 修改后: set((state) => ({ apps: state.apps.map((app) => (app.key === key ? response.data : app)) }));

// 7. getHistory — 历史记录
// 修改前: if (response.success) { return response.data }
// 修改后: return response.data;
```

**类型定义变更**：

```typescript
// 所有 API 方法的泛型类型统一改为：
fetchApi<{ data: SubAppConfig[]; total: number }>('/subapps')       // 列表
fetchApi<{ data: SubAppConfig }>('/subapps/:key')                   // 单个
fetchApi<{ data: SubAppConfigHistory[] }>('/subapps/:key/history')  // 历史
// 删除方法：fetchApi<void>('/subapps/:key', { method: 'DELETE' })
```

**非阻塞初始化（配合 §A.2）**：

```typescript
// 新增方法
initialize: async () => {
  const { apps, lastFetchTime } = get();
  const CACHE_TTL = 5 * 60 * 1000;
  const isCacheValid = apps.length > 0 && (Date.now() - lastFetchTime) < CACHE_TTL;

  if (isCacheValid || apps.length > 0) {
    set({ isInitialized: true });
    get().fetchAppsSilent(); // 后台刷新
    return;
  }
  await get().fetchApps();
  set({ isInitialized: true });
},

fetchAppsSilent: async () => {
  try {
    const response = await fetchApi<{ data: SubAppConfig[]; total: number }>('/subapps');
    set({ apps: response.data, lastFetchTime: Date.now() });
  } catch {
    console.warn('[SubAppStore] Silent refresh failed');
  }
},

getAppsSync: () => get().apps,
```

### 5.3 microfront/apps.ts 改造（核心，需新建动态读取逻辑）

**改造目标**：从硬编码改为从 `SubAppStore` 动态读取配置。

> **关键约束**：此文件是工具模块，不是 React 组件，**不能使用 React Hooks**。改为纯函数，通过 `useSubAppStore.getState().apps` 直接读取。

```typescript
/**
 * 子应用配置 - 动态加载版本
 * 从 SubAppStore 获取配置并转换为 Wujie 框架需要的格式
 */
import { useSubAppStore, getEntryUrl } from '@/stores/subappStore';
import type { SubAppConfig as DbSubAppConfig } from '@/stores/subappStore';

const isDev = import.meta.env.DEV;

/**
 * Wujie 框架需要的子应用配置格式
 */
export interface WujieSubAppConfig {
  name: string;
  key: string;
  path: string;
  url: string;
  container: string;
  enabled: boolean;
  keepAlive: boolean;
  preload: boolean;
}

/**
 * 将数据库配置转换为 Wujie 框架需要的格式
 */
function dbConfigToWujieConfig(dbConfig: DbSubAppConfig): WujieSubAppConfig {
  return {
    name: dbConfig.name,
    key: dbConfig.key,
    path: dbConfig.routes[0] + '/*',  // 取第一个路由作为主路由
    url: getEntryUrl(dbConfig),
    container: `#wujie-${dbConfig.key}`,
    enabled: dbConfig.status === 'enabled',
    keepAlive: dbConfig.keep_alive,
    preload: dbConfig.preload,
  };
}

/**
 * 纯函数：获取动态子应用配置
 * 使用方式：const configs = buildDynamicSubAppConfigs();
 *
 * 注意：这不是 React Hook，可以在任何非组件上下文调用。
 * 它直接读取 Zustand Store 的当前状态（内存 + persist 缓存）。
 */
export function buildDynamicSubAppConfigs(): WujieSubAppConfig[] {
  const apps = useSubAppStore.getState().apps;
  return apps
    .filter((app) => app.status === 'enabled')
    .map(dbConfigToWujieConfig);
}
```

**使用方式**（在 React 组件中）：

```typescript
// 在需要 Wujie 配置的组件中，通过 Zustand 订阅触发重新渲染
const subApps = useSubAppStore((s) => s.apps);
const wujieConfigs = useMemo(
  () => buildDynamicSubAppConfigs(),
  [subApps]
);
```

### 5.4 SubAppRoute 组件改造（核心）

> **关键约束（§5.4 修订 v3.1）**：当前 `SubAppRoute` 组件依赖硬编码的 `getAppKeyFromPath()` 函数，只检查已知 3 个子应用（`/dba`, `/knowledge`, `/visor`）。必须改造为接收 `subAppKey` prop，由父组件（`AppRoutes`）通过路由参数传递。

**组件接口定义**：

```typescript
// components/SubAppRoute/index.tsx

interface SubAppRouteProps {
  subAppKey?: string;  // 可选：由 AppRoutes 显式传递，优先级最高
}

export const SubAppRoute: React.FC<SubAppRouteProps> = ({ subAppKey: explicitKey }) => {
  const { apps } = useSubAppStore();
  const { subAppKey } = useParams<{ subAppKey: string }>();

  // 确定最终的子应用 key：显式 prop > 路由参数
  const resolvedKey = explicitKey || subAppKey;

  // 从 Store 查找匹配的配置
  const appConfig = useMemo(() => {
    if (!resolvedKey) return null;
    // 精确匹配 key
    const byKey = apps.find(a => a.key === resolvedKey);
    if (byKey) return byKey;
    // 前缀匹配路由
    const path = '/' + resolvedKey;
    return apps.find(a =>
      a.status === 'enabled' &&
      a.routes.some(r => path === r || path.startsWith(r + '/'))
    );
  }, [apps, resolvedKey]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 动态容器 DOM 管理
  useEffect(() => {
    if (!appConfig) return;
    const containerId = `wujie-${appConfig.key}`;
    if (!document.getElementById(containerId)) {
      const container = document.createElement('div');
      container.id = containerId;
      container.style.height = '100%';
      document.body.appendChild(container);
    }
    return () => {
      // 仅在当前组件卸载且无其他子应用使用该容器时才清理
      const container = document.getElementById(containerId);
      if (container && !container.hasChildNodes()) {
        container.remove();
      }
    };
  }, [appConfig]);

  // Wujie 加载逻辑
  useEffect(() => {
    if (!appConfig) {
      setError(resolvedKey ? `子应用 "${resolvedKey}" 未找到或已禁用` : '缺少子应用标识');
      setLoading(false);
      return;
    }
    // ... 原有 Wujie 启动逻辑，使用 appConfig.entry_dev / entry_prod
  }, [appConfig]);

  if (loading) return <Spin />;
  if (error) return <ErrorPage message={error} />;
  return <div id={`wujie-${appConfig!.key}`} style={{ height: '100%' }} />;
};
```

**调用方式**（`AppRoutes` 中）：

```typescript
// 通配符路由：subAppKey 从 URL 路径自动提取
<Route path=":subAppKey(/*)" element={<SubAppRoute />} />

// 或显式传递（用于已知子应用的精确路由）
<Route path="/dba/*" element={<SubAppRoute subAppKey="dba" />} />
```

**与 §5.5 的配合**：
- 新增子应用 `finops` → Store 更新 → `AppRoutes` 的 `matchedSubApp` 计算到 `finops` → `<SubAppRoute subAppKey="finops" />` 渲染 → `SubAppRoute` 内部通过 `explicitKey` 精确查找配置

### 5.5 路由动态注册

**当前状态**：`router/routes.tsx` 中子应用路由是硬编码的。

> **关键约束（§5.5 修订 v3.1）**：
> 1. **不能在模块顶层读取 localStorage**：ES Module 在 import 解析阶段执行顶层代码，此时 Zustand persist 中间件的 `onRehydrateStorage` 回调尚未执行完成，导致新增子应用后首次刷新页面路由注册为空。
> 2. **不能在模块顶层调用 Hook**：`useSubAppStore()` 是 React Hook，只能在组件内调用。
> 3. **正确方案**：在 `AppRoutes` 组件内部通过 Zustand 订阅实现动态路由。

**改造方案**：

```typescript
// router/routes.tsx

// 静态路由（不依赖动态配置）
const staticRoutes: AppRoute[] = [
  { path: '/', element: <Navigate to="/dashboard" /> },
  { path: '/dashboard', element: React.lazy(() => import('@/pages/DashboardNew')) },
  { path: '/console', element: React.lazy(() => import('@/pages/Console')) },
  // ... 其他固定路由
];

// 子应用路由统一使用 SubAppRoute 组件
// 不再为每个子应用单独注册路由，而是通过通配符路由处理
const subAppWildcardRoute: AppRoute = {
  path: ':subAppKey(/*)',  // 匹配 /dba, /knowledge, /visor, /finops, 等
  element: React.lazy(() => import('@/components/SubAppRoute')),
};

// 导出路由数组（模块顶层，不包含动态子应用路由）
export const routes: AppRoute[] = [
  ...staticRoutes,
  subAppWildcardRoute,  // 通配符路由放在最后，优先级最低
];

// AppRoutes 组件内：从 Zustand 订阅子应用配置，控制 SubAppRoute 的行为
export const AppRoutes: React.FC = () => {
  const subApps = useSubAppStore((state) => state.apps);
  const location = useLocation();

  // 从当前路径匹配子应用 key
  const matchedSubApp = useMemo(() => {
    const path = location.pathname;
    return subApps.find(
      (app) =>
        app.status === 'enabled' &&
        app.routes.some((route) => path === route || path.startsWith(route + '/'))
    );
  }, [subApps, location.pathname]);

  return (
    <Routes>
      {staticRoutes.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      {/* 通配符路由：仅在 matchedSubApp 存在时渲染 */}
      <Route
        path=":subAppKey(/*)"
        element={matchedSubApp ? <SubAppRoute subAppKey={matchedSubApp.key} /> : <NotFoundPage />}
      />
    </Routes>
  );
};
```

**方案要点**：
- `routes` 数组在模块顶层构建，**不依赖异步数据**，避免 ES Module 执行时序问题
- 使用通配符路由 `:subAppKey(/*)` 匹配所有子应用路径
- `AppRoutes` 组件内通过 `useSubAppStore` 订阅配置，**Zustand persist 已完成 rehydration**
- 新增子应用后，Store 更新 → `subApps` 变化 → `matchedSubApp` 重新计算 → 自动渲染
- 无缓存时，通配符路由匹配但 `matchedSubApp` 为 undefined → 渲染 404 → Store 加载完成后自动重试即可

### 5.6 Vite 代理动态化方案

**问题**：Vite 代理是编译时配置，无法运行时动态添加。

**解决方案**：使用通配符代理 + 子应用路径命名约定。

```typescript
// vite.config.ts
server: {
  proxy: {
    // 已有的固定代理
    '/api/v1': { target: 'http://localhost:3001', changeOrigin: true },

    // 通配符代理：匹配 /orion-* 开头的路径
    '^/orion-[\\w-]+': {
      target: 'http://localhost:3030',  // 默认目标
      changeOrigin: true,
      rewrite: (path) => {
        // 根据路径动态选择目标端口
        // 约定：子应用端口 = 3030 + (key 的 hash % 100)
        // 简化方案：在开发环境约定所有子应用在同一端口，通过路径区分
        return path;
      },
    },
  },
}
```

**更实用的方案**（推荐）：开发环境约定子应用使用统一的端口约定，在管理页面的 `entry_dev` 中配置完整 URL（含端口），Vite 使用 `router` 模式代理：

```typescript
// vite.config.ts - 推荐方案
server: {
  proxy: {
    '/api/v1': { target: 'http://localhost:3001', changeOrigin: true },
    // 开发模式下，entry_dev 直接是完整的 localhost URL
    // Wujie iframe 直接访问该 URL，不需要主应用代理
    // 唯一需要的：子应用自身需要配置 CORS 允许主应用 iframe 嵌入
  },
}
```

**结论**：开发环境 Wujie 使用 iframe 加载 `entry_dev`（完整的 localhost URL），**不需要主应用代理**。子应用自身需配置 CORS 允许 `http://localhost:3000` 嵌入。

---

## 6. 子应用接入规范

### 6.1 完整接入流程

```
步骤 1：子应用独立开发并部署
  └─ 子应用配置 CORS: Access-Control-Allow-Origin: http://localhost:3000
  └─ 子应用构建 output.base = '/orion-{key}/'

步骤 2：在管理页面添加配置
  └─ 访问 /console/subapps
  └─ 填写名称、标识、入口地址、路由
  └─ 保存

步骤 3：运行时自动生效
  └─ SubAppStore 拉取最新配置
  └─ microfront/apps.ts 动态转换为 Wujie 配置
  └─ router/routes.tsx 动态注册路由
  └─ 访问 /{key} 即可进入子应用
```

### 6.2 子应用开发要求

```typescript
// 1. 接收主应用传递的数据（通过 window.$orion 或 URL query）
const orion = (window as any).$orion;
// orion = { token, user, getApiBase, navigateTo, showMessage }

// 2. API 客户端配置
const api = axios.create({
  baseURL: orion?.getApiBase?.() || '/api/v1',
});

api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${orion?.token}`;
  return config;
});

// 3. 构建配置
// vite.config.ts: base: '/orion-{key}/'

// 4. CORS 配置（开发环境）
// 子应用 vite.config.ts:
// server: { cors: { origin: 'http://localhost:3000', credentials: true } }
```

---

## 7. 数据流（完整版）

### 7.1 应用启动流程

```
1. App 启动
2. SubAppStore 初始化
   ├─ 检查 localStorage 缓存
   ├─ 如果缓存有效（< 5 分钟），直接使用
   └─ 如果缓存失效，调用 API GET /api/v1/subapps
3. microfront/apps.ts 读取 Store 配置，转换为 Wujie 格式
4. SubAppRoute 组件为每个子应用创建 #wujie-{key} 容器
5. Wujie 加载子应用 iframe
```

### 7.2 管理页面操作后生效流程

```
1. 用户在 /console/subapps 新增子应用
2. POST /api/v1/subapps → 写入数据库 → 记录 history
3. SubAppStore 乐观更新本地 state
4. 已打开的页面：
   ├─ 路由列表自动更新（SubAppStore 是唯一数据源）
   ├─ SubAppLauncher 侧边栏自动显示新子应用
   └─ Wujie 框架自动加载新子应用（如果访问了对应路由）
5. 其他用户/新标签页：
   └─ 下次启动时 API 拉取最新配置
```

### 7.3 配置变更通知（可选增强）

使用 `BroadcastChannel` API 实现同浏览器多标签页配置同步：

```typescript
// stores/subappStore.ts 中
const configChannel = new BroadcastChannel('orion-subapp-config');

// 更新配置后广播
configChannel.postMessage({ type: 'config_updated', timestamp: Date.now() });

// 其他标签页监听
configChannel.onmessage = (event) => {
  if (event.data.type === 'config_updated') {
    // 清除缓存，重新拉取配置
    useSubAppStore.getState().fetchApps();
  }
};
```

---

## 8. 安全考虑

### 8.1 输入校验

| 字段 | 校验规则 | 错误码 |
|------|----------|--------|
| `key` | `^[a-z][a-z0-9-]*$`，长度 2-50 | 40001 |
| `entry_dev` | `^https?://` 开头，非内网地址 | 40002 |
| `entry_prod` | `^/` 或 `^https?://` 开头 | 40003 |
| `routes[]` | 每项 `^/` 开头 | 40004 |
| `version` | `^\d+\.\d+\.\d+$` | 40005 |
| `name` | 长度 1-100，非空 | 40006 |

### 8.2 权限控制

| 操作 | 权限要求 | 说明 |
|------|----------|------|
| 查看列表 | 已认证 | 所有登录用户可查看 |
| 查看已启用列表 | 已认证 | 用于运行时加载 |
| 创建/更新/删除 | `subapp:manage` | 需要平台管理员权限 |
| 状态切换 | `subapp:manage` | 同上 |
| 查看历史 | `subapp:manage` | 同上 |

后端中间件集成现有权限系统：
```typescript
// api/subapp-routes.ts
app.get('/api/v1/subapps', authMiddleware(), subappController.list);
app.get('/api/v1/subapps/enabled', authMiddleware(), subappController.listEnabled);
app.post('/api/v1/subapps', authMiddleware(), permissionMiddleware('subapp:manage'), subappController.create);
app.put('/api/v1/subapps/:key', authMiddleware(), permissionMiddleware('subapp:manage'), subappController.update);
app.delete('/api/v1/subapps/:key', authMiddleware(), permissionMiddleware('subapp:manage'), subappController.softDelete);
app.put('/api/v1/subapps/:key/status', authMiddleware(), permissionMiddleware('subapp:manage'), subappController.toggleStatus);
app.get('/api/v1/subapps/:key/history', authMiddleware(), permissionMiddleware('subapp:manage'), subappController.history);
```

### 8.3 SSRF 防护

```typescript
function validateUrl(url: string, allowLocalhost: boolean = false): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // 生产环境禁止 localhost 和内网地址
    if (!allowLocalhost) {
      const blockedHosts = ['169.254.169.254', '127.0.0.1', '0.0.0.0', 'localhost', '::1'];
      if (blockedHosts.includes(parsed.hostname)) return false;
      // 拒绝私有 IP 段
      if (parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('192.168.')) return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

### 8.4 审计日志

所有配置变更记录到 `subapp_config_history`，包括：
- 操作类型（created/updated/deleted/status_changed）
- 变更前后完整配置对比（JSONB）
- 操作用户 ID 和时间戳

---

## 9. 错误处理与降级

### 9.1 配置拉取失败

```
场景：API 不可达或返回错误
降级策略：
1. 使用 localStorage 缓存的配置（无论是否过期）
2. 如果缓存为空，使用硬编码的默认配置（dba, knowledge, visor）
3. 在控制台输出警告日志
```

### 9.2 子应用加载失败

```
场景：Wujie iframe 加载子应用超时或 404
降级策略：
1. 显示错误页面："子应用 {name} 加载失败"
2. 提供"重试"按钮
3. 返回主应用导航
```

### 9.3 路由冲突

```
场景：两个子应用配置了相同的路由
处理：
1. 数据库触发器阻止冲突写入
2. 前端路由注册时检测冲突，输出警告
3. 优先使用 sort_order 较小的配置
```

---

## 10. 实施计划

### Phase 0：架构对齐（1天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 修改 `subappStore.ts` 响应格式 | `stores/subappStore.ts` | 适配 `{ data, total }` 格式 |
| 修改 `SubAppManagement` 页面 | `pages/SubAppManagement/index.tsx` | 适配新响应格式（如需） |

### Phase 1：数据库与后端 API（2天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 数据库迁移 | `migrations/175_create_subapp_configs.sql` | 创建表 + 触发器 + 初始数据 |
| 后端 CRUD API | `api/subapp-routes.ts` | RESTful 端点实现 |
| 子应用服务层 | `services/subapp/subapp-service.ts` | 业务逻辑 + 校验 |
| 权限中间件集成 | `api/middleware/` | `subapp:manage` 权限 |

### Phase 2：前端运行时联动（2天）

| 工作项 | 文件 | 说明 |
|--------|------|------|
| 改造 `microfront/apps.ts` | `microfront/apps.ts` | 从 Store 动态读取 |
| 动态容器管理 | `components/SubAppRoute/index.tsx` | 创建/清理 DOM 容器 |
| 动态路由注册 | `router/routes.tsx` | 从缓存生成子应用路由 |
| 降级策略实现 | 多文件 | 缓存降级、错误处理 |

### Phase 3：测试与文档（1天）

| 工作项 | 说明 |
|--------|------|
| 端到端测试 | 新增子应用 → 保存 → 访问验证 |
| 错误场景测试 | API 失败、路由冲突、加载失败 |
| 接入文档 | 编写子应用接入指南 |

### 总计：6 天

---

## 11. 使用流程

### 11.1 新增子应用

```
1. 访问 http://localhost:3000/console/subapps
2. 点击"新增子应用"
3. 填写配置：
   - 名称: 财务中心
   - 标识: finops
   - 版本号: 1.0.0
   - 开发入口: http://localhost:3005/orion-finops/
   - 生产入口: /orion-finops/index.html
   - 路由: /finops
4. 点击"创建"
5. 生效验证：
   - SubAppStore 自动更新
   - 刷新页面或访问 /finops 即可进入子应用
```

### 11.2 访问子应用

| 方式 | 路径 | 说明 |
|------|------|------|
| 子系统图标 | 点击左上角子系统图标 → 选择 | 从 SubAppLauncher 进入 |
| 菜单 | 菜单栏 → 子系统 → 选择 | 从侧边栏菜单进入 |
| 直接 URL | `/{key}` 如 `/finops` | 直接路由访问 |

---

## 12. 增强功能规划

| 功能 | 优先级 | 说明 |
|------|--------|------|
| **BroadcastChannel 多标签页同步** | P1 | 配置变更后通知其他标签页刷新 |
| **子应用健康检查** | P2 | 定时检测子应用可用性，标记不可用子应用 |
| **版本管理与回滚** | P2 | 保留历史版本，支持一键回滚 |
| **导入导出配置** | P3 | JSON 格式批量导入/导出配置 |
| **WebSocket 实时推送** | P3 | 服务端主动推送配置变更 |

---

## 13. 评审修订说明

### v1.0 → v2.0 主要变更

| 评审问题 | 修订内容 |
|----------|----------|
| Wujie 框架联动方案缺失 | 新增 `microfront/apps.ts` 动态读取方案 + 容器 DOM 管理 |
| 三套 Store 数据源分裂 | 明确 `SubAppStore` 为唯一数据源，其他组件从 Store 读取 |
| 与现有 SubAppManagement 页面关系不清 | 明确该页面已存在无需修改，本次重点是运行时联动 |
| Vite 代理动态化 | 明确开发环境 Wujie 使用 iframe 直接访问，不需要主应用代理 |
| 响应格式不统一 | 统一为 `{ data, total }` 格式，修改 Store 适配 |
| 路由冲突防护 | 数据库触发器 + 前端检测双重防护 |
| 删除无保护 | 增加引用检查 + 软删除 |
| SSRF 风险 | 增加 URL 协议校验 + 内网地址拦截 |
| 实施计划缺失 Phase 0 | 新增架构对齐阶段 |

### 评审评分修订

| 评审项 | v1.0 | v2.0 | 修订说明 |
|--------|------|------|----------|
| 功能完整性 | 8.0/10 | **9.0/10** | 补充了 Wujie 联动、容器管理、降级策略 |
| 架构一致性 | 7.0/10 | **9.0/10** | 统一了数据源，明确了与现有代码的关系 |
| 安全性 | 7.5/10 | **8.5/10** | 补充了 SSRF 防护、引用检查、软删除 |
| 可维护性 | 7.5/10 | **8.5/10** | 明确了各文件职责和修改范围 |
| 使用便捷性 | 8.5/10 | **9.0/10** | 完整接入流程清晰 |
| **综合** | **7.7/10** | **8.8/10** | |

**结论**: 修订后方案通过评审，可进入实施阶段。

---

## 附录 A: 增强设计方案（v2.0 后续补充）

> 针对 v2.0 评审后识别的 7 个残留不足点，逐一设计解决方案。

### A.1 增强项汇总表

| # | 增强项 | 优先级 | 状态 | 影响章节 |
|---|--------|--------|------|---------|
| 1 | 首屏加载性能优化 | P0 | 待实施 | §7, §9; 新增 §13 |
| 2 | 子应用版本兼容性 | P1 | 待实施 | §3, §4, §8; 新增 §14 |
| 3 | menuConfigStore 自动同步 | P0 | 待实施 | §5, §6, §9 |
| 4 | 生产环境入口地址 | P0 | 待实施 | §3, §6; 新增 §15 |
| 5 | 灰度发布机制 | P1 | 待实施 | §3, §4, §5, §9; 新增 §16 |
| 6 | iframe 内存泄漏治理 | P1 | 待实施 | §6, §12; 新增 §17 |
| 7 | 后端 API 实施验证 | P0 | 待实施 | §9 |

### A.2 首屏加载性能优化（P0）

#### 问题

`SubAppStore.fetchApps()` 异步阻塞路由注册，首次打开子应用路由可能 404 或白屏 500ms-2s。

#### 解决方案：缓存优先 + 非阻塞初始化 + 静态路由降级

**核心策略**：路由注册不阻塞，使用"本地缓存优先 + 后台异步刷新"。

**1. 改造 `stores/subappStore.ts`**

```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

interface SubAppStore {
  // ... 现有字段
  isInitialized: boolean;
  initialize: () => Promise<void>;      // 非阻塞初始化
  getAppsSync: () => SubAppConfig[];    // 同步获取缓存数据
  fetchAppsSilent: () => Promise<void>; // 后台静默刷新
}

// 新增方法
initialize: async () => {
  const { apps, lastFetchTime } = get();
  const isCacheValid = apps.length > 0 && (Date.now() - lastFetchTime) < CACHE_TTL;

  if (isCacheValid || apps.length > 0) {
    // 有缓存（无论是否过期），立即标记完成，后台刷新
    set({ isInitialized: true });
    get().fetchAppsSilent();
    return;
  }

  // 首次无缓存，等待加载
  await get().fetchApps();
  set({ isInitialized: true });
},

fetchAppsSilent: async () => {
  try {
    const response = await fetchApi<{ data: SubAppConfig[]; total: number }>('/subapps');
    set({ apps: response.data, lastFetchTime: Date.now() });
  } catch (error) {
    console.warn('[SubAppStore] Silent refresh failed:', error);
  }
},

getAppsSync: () => get().apps,
```

**2. `persist` 中间件增加 `onRehydrateStorage`**

```typescript
{
  name: 'subapp-storage',
  partialize: (state) => ({ apps: state.apps, lastFetchTime: state.lastFetchTime }),
  onRehydrateStorage: () => (state) => {
    // 从 localStorage 恢复后立即标记可用
    if (state?.apps?.length > 0) {
      useSubAppStore.setState({ isInitialized: true });
    }
  },
}
```

**3. 应用启动（`App.tsx`）**

```typescript
useEffect(() => {
  // 非阻塞初始化 — 不 await
  useSubAppStore.getState().initialize().catch(console.error);
}, []);
```

**4. 静态路由降级**

保留已知 3 个子应用（dba, knowledge, visor）作为硬编码 fallback，确保即使 Store 未初始化完成，已有路由仍可用。新增子应用在 Store 刷新后自动生效。

#### 性能指标目标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 首屏路由注册时间 | < 100ms | `performance.now()` |
| 子应用加载（有缓存） | < 2s | Wujie `afterMount` |
| 子应用加载（无缓存） | < 4s | 同上 |
| Store 缓存 TTL | 5 分钟 | `lastFetchTime` 差值 |
| 菜单同步延迟 | < 500ms | Store 更新到菜单渲染 |

### A.3 子应用版本兼容性（P1）

#### 问题

子应用独立部署，可能与主应用框架版本不兼容（如 Wujie 升级、`$orion` 接口变更）。

#### 解决方案：协议版本协商 + 兼容性矩阵

**1. 数据库扩展**

```sql
ALTER TABLE subapp_configs ADD COLUMN min_framework_version VARCHAR(20) DEFAULT '1.0.0';
ALTER TABLE subapp_configs ADD COLUMN max_framework_version VARCHAR(20) DEFAULT '99.0.0';
ALTER TABLE subapp_configs ADD COLUMN required_protocols JSONB DEFAULT '["$orion-v1"]';
ALTER TABLE subapp_configs ADD COLUMN compatibility_notes TEXT;
```

**2. 主应用框架版本声明（`microfront/config.ts`）**

```typescript
export const FRAMEWORK_VERSION = '1.2.0';
export const SUPPORTED_PROTOCOLS = ['$orion-v1', '$orion-v2'];

export const checkCompatibility = (app: SubAppConfig): { compatible: boolean; issues: string[] } => {
  const issues: string[] = [];
  if (compareVersions(FRAMEWORK_VERSION, app.min_framework_version) < 0) {
    issues.push(`主应用版本 ${FRAMEWORK_VERSION} 低于子应用要求的最低版本 ${app.min_framework_version}`);
  }
  if (compareVersions(FRAMEWORK_VERSION, app.max_framework_version) > 0) {
    issues.push(`主应用版本 ${FRAMEWORK_VERSION} 超过子应用支持的最高版本 ${app.max_framework_version}`);
  }
  for (const proto of (app.required_protocols || [])) {
    if (!SUPPORTED_PROTOCOLS.includes(proto)) {
      issues.push(`主应用不支持子应用需要的协议: ${proto}`);
    }
  }
  return { compatible: issues.length === 0, issues };
};
```

**3. 加载时降级（`SubAppRoute/index.tsx`）**

```typescript
useEffect(() => {
  if (!appConfig) return;
  const compat = checkCompatibility(appConfig);
  if (!compat.compatible) {
    setError(`子应用兼容性问题: ${compat.issues.join('; ')}`);
    setLoading(false);
    return;
  }
  // ... 原有启动逻辑
}, [appKey, appConfig]);
```

**4. 管理页面展示**

表格增加"兼容性"列：兼容 → 绿色 Tag，不兼容 → 红色 Tag + Tooltip 展示具体问题。

### A.4 menuConfigStore 自动同步（P0）

#### 问题

新增子应用后，菜单不会自动出现，需要在 `menuConfigStore` 中手动配置。

#### 解决方案：SubAppStore 变更后自动注入菜单

**改造 `stores/menuConfigStore.ts`**

> **关键约束（§A.4 修订 v3.1）**：`useMenuConfigStore.setState()` 使用 **functional update** 形式（`setState((state) => newState)`），确保只更新 `modules` 字段，不丢失 `loadConfig`、`saveConfig` 等方法引用。Zustand 的 `setState` 是浅合并（shallow merge），但直接传完整 state 对象会覆盖所有字段。

```typescript
const SUBAPP_MODULE_KEY = '/ecosystem';
const SUBAPP_CATEGORY = '子系统';

export const syncSubAppMenuItems = (): void => {
  const subApps = useSubAppStore.getState().getAppsSync();

  // 使用 functional update 形式，避免丢失方法引用
  useMenuConfigStore.setState((state) => {
    const ecosystemModule = state.modules[SUBAPP_MODULE_KEY];
    if (!ecosystemModule) return state; // 不存在时不修改

    // 获取现有的动态子应用菜单项
    const existingSubAppKeys = new Set(
      ecosystemModule.children
        .filter(c => c.category === SUBAPP_CATEGORY && c.description?.startsWith('[subapp]'))
        .map(c => c.key)
    );

    // 当前启用的子应用
    const enabledSubApps = subApps.filter(a => a.status === 'enabled');
    const toAdd = enabledSubApps
      .filter(app => !existingSubAppKeys.has(app.routes[0]))
      .map(app => ({
        key: app.routes[0],
        label: app.name,
        description: `[subapp] ${app.description || ''}`,
        category: SUBAPP_CATEGORY,
        enabled: true,
      }));

    const toRemove = [...existingSubAppKeys].filter(
      k => !enabledSubApps.some(a => a.routes[0] === k)
    );

    if (toRemove.length === 0 && toAdd.length === 0) return state; // 无变化

    const newChildren = ecosystemModule.children
      .filter(c => !toRemove.includes(c.key))
      .concat(toAdd);

    return {
      modules: {
        ...state.modules,
        [SUBAPP_MODULE_KEY]: { ...ecosystemModule, children: newChildren },
      },
    };
  });

  // 持久化保存（在 setState 回调外部调用）
  useMenuConfigStore.getState().saveConfig();
};
```

**触发时机**：
1. 应用启动时，SubAppStore 初始化完成后
2. SubAppStore 的 `createApp` / `updateApp` / `toggleStatus` / `deleteApp` 操作成功后

**清理硬编码**：从 `menuConfigStore` 的 `defaultModules` 中移除 `/dba`、`/knowledge`、`/visor` 硬编码项，改为动态注入。

### A.5 生产环境入口地址（P0）

#### 问题

`entry_prod` 使用相对路径，子应用部署到不同域名或 CDN 时无法访问。

#### 解决方案：支持完整 URL + 相对路径自动补全

**1. 前端动态选择入口（`stores/subappStore.ts` 新增工具函数）**

```typescript
export const getEntryUrl = (app: SubAppConfig): string => {
  const isDev = import.meta.env.DEV;
  if (isDev) return app.entry_dev;

  // 生产环境：如果是相对路径，补全当前域名
  if (app.entry_prod.startsWith('/')) {
    return `${window.location.origin}${app.entry_prod}`;
  }
  // 完整 URL 直接返回
  return app.entry_prod;
};
```

**2. `microfront/apps.ts` 改造**

```typescript
import { useSubAppStore, getEntryUrl } from '@/stores/subappStore';

export const buildDynamicSubAppConfigs = (): SubAppConfig[] => {
  const apps = useSubAppStore.getState().apps;
  return apps
    .filter(app => app.status === 'enabled')
    .map(app => ({
      name: app.name,
      key: app.key,
      path: app.routes[0] + '/*',
      url: getEntryUrl(app),
      container: `#wujie-${app.key}`,
      enabled: true,
      keepAlive: app.keep_alive ?? false,
      preload: app.preload ?? false,
    }));
};
```

**3. Vite 代理**

开发环境 Wujie 使用 iframe 直接访问 `entry_dev`（完整 localhost URL），**不需要主应用代理**。子应用自身配置 CORS 允许 `http://localhost:3000` 嵌入即可。

### A.6 灰度发布机制（P1）

#### 问题

新子应用上线直接对所有用户可见，缺少分阶段发布能力。

#### 解决方案：基于百分比的渐进式发布（MVP）

**1. 数据库扩展**

```sql
ALTER TABLE subapp_configs ADD COLUMN rollout_percentage INTEGER DEFAULT 100;
```

**2. 前端判断（`stores/subappStore.ts`）**

```typescript
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const isSubAppVisible = (app: SubAppConfig, userId: string): boolean => {
  if (app.rollout_percentage >= 100) return true;
  if (app.rollout_percentage <= 0) return false;
  return (Math.abs(hashCode(userId)) % 100) < app.rollout_percentage;
};
```

**3. 管理页面 UI**

在编辑弹窗中增加"灰度百分比"滑块（0-100），默认为 100（全量发布）。调整为 10% 则只有 10% 的用户可见该子应用。

**4. 完整灰度发布（远期）**

未来可扩展为独立的 `subapp_rollouts` 表，支持用户组分批、请求头匹配、A/B 测试等策略。MVP 阶段百分比控制已满足核心需求。

### A.7 iframe 内存泄漏治理（P1）

#### 问题

`keep_alive=true` 时 iframe 不销毁，长时间使用后内存累积。

#### 解决方案：内存监控 + LRU 淘汰 + 主动清理

**1. 新增 `microfront/memoryMonitor.ts`**

```typescript
interface IframeInfo {
  appKey: string;
  lastAccessedAt: number;
}

const MAX_IFRAME_COUNT = 5;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

class IframeMemoryMonitor {
  private registry: Map<string, IframeInfo> = new Map();

  register(appKey: string) { this.registry.set(appKey, { appKey, lastAccessedAt: Date.now() }); }
  touch(appKey: string) {
    const info = this.registry.get(appKey);
    if (info) info.lastAccessedAt = Date.now();
  }
  unregister(appKey: string) { this.registry.delete(appKey); }

  check(): void {
    const now = Date.now();
    // 空闲超时清理
    for (const [key, info] of this.registry) {
      if (now - info.lastAccessedAt > IDLE_TIMEOUT_MS) {
        this.destroyFrame(key);
      }
    }
    // 数量超限 LRU 清理
    while (this.registry.size > MAX_IFRAME_COUNT) {
      const oldest = [...this.registry.values()].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)[0];
      if (oldest) this.destroyFrame(oldest.appKey);
    }
  }

  private destroyFrame(appKey: string): void {
    this.registry.delete(appKey);
    const container = document.querySelector(`#wujie-${appKey}`);
    if (container) container.innerHTML = '';
    // 通知子应用自行清理
    window.dispatchEvent(new CustomEvent('orion:subapp-destroy', { detail: { appKey } }));
  }

  getStats() { return { count: this.registry.size, frames: [...this.registry.values()] }; }
}

// 每 5 分钟自动检查
export const iframeMemoryMonitor = new IframeMemoryMonitor();
setInterval(() => iframeMemoryMonitor.check(), 5 * 60 * 1000);
```

**2. 集成到 `SubAppRoute/index.tsx`**

```typescript
import { iframeMemoryMonitor } from '@/microfront/memoryMonitor';

// 启动后注册
startApp({ ... }).then(() => iframeMemoryMonitor.register(appKey));

// 路由切换时更新访问时间
useEffect(() => {
  if (appKey) iframeMemoryMonitor.touch(appKey);
}, [location.pathname]);
```

**3. 子应用侧清理协议**

子应用监听 `orion:subapp-destroy` 事件，清理定时器、WebSocket、全局事件监听器。

**4. 内存监控面板**

管理页面增加"内存状态"按钮，显示当前活跃 iframe 数量、各子应用最后访问时间，支持手动清理。

### A.8 后端 API 实施验证（P0）

#### 问题

后端 API 尚未实现，工作量需验证。

#### 解决方案：基于现有模式快速实现

参考 `orion-platform-service/src/api/plugin-routes.ts` 的 CRUD 模式（约 200 行），可快速复制实现。

**实施文件清单**：

| 文件 | 操作 | 说明 |
|------|------|------|
| `db/migrations/175_create_subapp_configs.sql` | 新建 | 数据库迁移 |
| `src/models/SubAppConfig.ts` | 新建 | 数据模型 |
| `src/repositories/SubAppConfigRepository.ts` | 新建 | 数据访问层 |
| `src/services/subapp/SubAppService.ts` | 新建 | 业务逻辑 |
| `src/api/controllers/SubAppController.ts` | 新建 | 请求处理 |
| `src/api/subapp-routes.ts` | 新建 | 路由定义 |
| `src/api/routes.ts` | 修改 | 注册新路由 |

**工作量评估**：约 13.5 小时（1.5-2 个工作日），包含单元测试和联调。

### A.9 更新后的实施计划

| 阶段 | 工作项 | 优先级 | 涉及文件 | 预估工时 |
|------|--------|--------|---------|---------|
| **Phase 1** | 数据库迁移 (subapp_configs + history) | P0 | `migrations/175_*.sql` | 0.5h |
| **Phase 2** | 后端 CRUD API | P0 | `subapp-routes.ts`, `SubAppService.ts`, `SubAppController.ts` | 8h |
| **Phase 3** | SubAppStore 改造（缓存 + 非阻塞初始化） | P0 | `stores/subappStore.ts` | 3h |
| **Phase 4** | 菜单自动同步机制 | P0 | `stores/menuConfigStore.ts` | 2h |
| **Phase 5** | 管理页面适配（灰度百分比 + 兼容性列） | P0 | `pages/SubAppManagement/index.tsx` | 4h |
| **Phase 6** | SubAppRoute 动态加载 + 内存监控 | P0 | `components/SubAppRoute/index.tsx`, `microfront/apps.ts`, `microfront/memoryMonitor.ts` | 3h |
| **Phase 7** | 版本兼容性检查 | P1 | `microfront/config.ts` | 3h |
| **Phase 8** | 灰度发布 MVP（百分比控制） | P1 | 数据库 + API + 前端 | 5h |
| **Phase 9** | iframe 内存监控 | P1 | `microfront/memoryMonitor.ts` | 3h |
| **Phase 10** | 单元测试 + 集成测试 | P0 | `__tests__/subapp-*.test.ts` | 4h |
| **合计** | | | | **~35.5h**（约 4.5 个工作日） |

### A.10 v2.0 → v3.1 评分更新

| 评审项 | v1.0 | v2.0 | v3.0 | v3.1（当前） | 修订说明 |
|--------|------|------|------|-------------|----------|
| 功能完整性 | 8.0/10 | 9.0/10 | 9.5/10 | **9.5/10** | 保持 v3.0 |
| 架构一致性 | 7.0/10 | 9.0/10 | 9.5/10 | **10/10** | 修正路由注册时序 + Hook 违规 + setState 问题 |
| 安全性 | 7.5/10 | 8.5/10 | 9.0/10 | **9.0/10** | 保持 v3.0 |
| 可维护性 | 7.5/10 | 8.5/10 | 9.0/10 | **9.5/10** | SubAppRoute 组件接口清晰，props 传递机制明确 |
| 使用便捷性 | 8.5/10 | 9.0/10 | 9.5/10 | **9.5/10** | 保持 v3.0 |
| **综合** | **7.7/10** | **8.8/10** | **9.3/10** | **9.5/10** | |

**结论**: v3.1 方案已修正前端架构师评审提出的 5 个阻塞性问题，可进入实施阶段。

---

## 附录 B: v3.0 → v3.1 阻塞性问题修正记录

> 前端架构师评审（2026-05-20）发现 5 个阻塞性问题，已全部修正。

| # | 问题 | 原章节 | 修正方案 |
|---|------|--------|---------|
| 1.1 | `routes.tsx` 模块顶层执行 `dynamicSubAppRoutes()` 读取 localStorage 存在时序错误 | §5.5 | 改为通配符路由 `:subAppKey(/*)` + `AppRoutes` 组件内 Zustand 订阅，persist rehydration 完成后再计算 |
| 1.2 | `useDynamicSubAppConfigs()` 是 React Hook，在工具模块中调用违反 Rules of Hooks | §5.3 | 改为纯函数 `buildDynamicSubAppConfigs()`，通过 `useSubAppStore.getState().apps` 直接读取 |
| 1.3 | 响应格式改造只改了 fetchApps，遗漏其他 6 个方法 | §5.2 | 补充全部 7 个方法的响应格式修改清单 |
| 1.4 | `syncSubAppMenuItems` 中 `setState()` 直接替换整个 state 对象会丢失方法引用 | §A.4 | 使用 functional update 形式 `setState((state) => newState)`，只更新 `modules` 字段 |
| 1.5 | `SubAppRoute` 组件未明确如何获取动态子应用 key | §5.4 | 新增 `subAppKey` prop，支持显式传递 + `useParams` 路由参数两种获取方式 |
