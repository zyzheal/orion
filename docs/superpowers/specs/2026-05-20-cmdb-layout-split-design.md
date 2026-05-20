# CMDB 页面拆分设计文档

## 1. 现状与问题

### 1.1 当前架构

CMDB 采用单页面 + Tabs 模式：
- `CMDB/index.tsx` — 6 个 Tab（配置项、拓扑图、集成资源、Web 终端、批量执行、审计日志）
- 菜单配置了 `/cmdb/topology`、`/cmdb/integration` 等子路径，但路由表中**只注册了 `/cmdb`**
- 点击菜单子项会跳到无匹配路由的 URL（404）

### 1.2 核心问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | 路由与菜单路径不一致 | 子菜单点击无响应或 404 |
| 2 | Tab 模式 vs 路由模式混用 | 无法深链到具体功能页面 |
| 3 | 与 Monitoring/SelfHealing 架构不一致 | 维护模式混乱 |

## 2. 目标

将 CMDB 从 Tab 模式改为 **Layout + Outlet** 模式，每个子页面拥有独立路由路径，与 Monitoring/SelfHealing 现有模式对齐。

## 3. 架构设计

### 3.1 路由结构

```
/cmdb              → CMDBLayout（左侧导航 + Outlet）
/cmdb/cis          → CITablePage（配置项管理）
/cmdb/topology     → TopologyPage（拓扑图）
/cmdb/integration  → IntegrationPage（集成资源）
/cmdb/terminal     → WebTerminalPage（Web 终端）
/cmdb/batch-exec   → BatchExecPage（批量执行）
/cmdb/audit        → AuditLogPage（审计日志）
```

### 3.2 页面层级关系

```
App Layout (Header + Top Nav)
└── CMDBLayout
    ├── Sider (左侧 CMDB 导航菜单, 6 项)
    │   ├── 配置项      → /cmdb/cis
    │   ├── 拓扑图      → /cmdb/topology
    │   ├── 集成资源    → /cmdb/integration
    │   ├── Web 终端    → /cmdb/terminal
    │   ├── 批量执行    → /cmdb/batch-exec
    │   └── 审计日志    → /cmdb/audit
    └── Content
        └── <Outlet /> → 渲染当前选中的子页面
```

## 4. 变更清单

### 4.1 新建文件：CMDBLayout.tsx

**路径**: `orion-frontend/src/pages/CMDB/CMDBLayout.tsx`

复用 `Monitoring/index.tsx` 的布局模式：
- 左侧 Sider 宽度 220px，可折叠
- 6 个菜单项，使用 `useNavigate` 跳转
- 当前路径高亮（`useLocation` 匹配）
- 右侧 Content 渲染 `<Outlet />`
- 响应主题（深色/浅色）

```tsx
const menuItems = [
  { key: '/cmdb/cis', icon: <CloudServerOutlined />, label: '配置项' },
  { key: '/cmdb/topology', icon: <DeploymentUnitOutlined />, label: '拓扑图' },
  { key: '/cmdb/integration', icon: <LinkOutlined />, label: '集成资源' },
  { key: '/cmdb/terminal', icon: <DesktopOutlined />, label: 'Web 终端' },
  { key: '/cmdb/batch-exec', icon: <CodeOutlined />, label: '批量执行' },
  { key: '/cmdb/audit', icon: <EyeOutlined />, label: '审计日志' },
];
```

### 4.2 修改文件：routes.tsx

**路径**: `orion-frontend/src/router/routes.tsx`

当前：
```typescript
{ path: '/cmdb', element: React.lazy(() => import('@/pages/CMDB')), protected: true }
```

改为：
```typescript
// CMDB Layout
{ path: '/cmdb', element: React.lazy(() => import('@/pages/CMDB/CMDBLayout')), protected: true },
// CMDB children
{ path: '/cmdb/cis', element: React.lazy(() => import('@/pages/CMDB/CITablePage')), protected: true },
{ path: '/cmdb/topology', element: React.lazy(() => import('@/pages/CMDB/TopologyPage')), protected: true },
{ path: '/cmdb/integration', element: React.lazy(() => import('@/pages/CMDB/IntegrationPage')), protected: true },
{ path: '/cmdb/terminal', element: React.lazy(() => import('@/pages/CMDB/WebTerminalPage')), protected: true },
{ path: '/cmdb/batch-exec', element: React.lazy(() => import('@/pages/CMDB/BatchExecPage')), protected: true },
{ path: '/cmdb/audit', element: React.lazy(() => import('@/pages/CMDB/AuditLogPage')), protected: true },
```

**注意**：
- 每个子路由必须标记 `protected: true`
- `/cmdb` 路由本身指向 Layout（无 Outlet 内容时渲染空菜单），需要默认重定向到 `/cmdb/cis`
- 在 CMDBLayout 中使用 `useNavigate` 实现首次加载自动跳转：
  ```tsx
  useEffect(() => {
    if (location.pathname === '/cmdb') {
      navigate('/cmdb/cis', { replace: true });
    }
  }, [location.pathname, navigate]);
  ```

### 4.3 修改文件：menuConfigStore.ts

**路径**: `orion-frontend/src/stores/menuConfigStore.ts`

**关键修改**：将 `/cmdb` 子菜单的 `key` 从 `/cmdb` 改为 `/cmdb/cis`，以匹配新的路由。

当前：
```typescript
{ key: '/cmdb', label: 'CMDB', ... }  // 默认入口
```

改为：
```typescript
{ key: '/cmdb/cis', label: '配置项', description: '配置项管理', category: 'CMDB', enabled: true },
```

这样点击菜单"配置项"时跳转到 `/cmdb/cis`，匹配路由。

### 4.4 修改文件：iconMap.tsx

**路径**: `orion-frontend/src/components/Layout/iconMap.tsx`

添加 `/cmdb/cis` 图标映射：
```typescript
'/cmdb/cis': <DatabaseOutlined />,
```

### 4.5 删除文件：CMDB/index.tsx

**路径**: `orion-frontend/src/pages/CMDB/index.tsx`

原有 Tabs 包裹模式不再需要。新入口由 `CMDBLayout.tsx` 承担。

### 4.6 子页面调整

经评审，各子页面**不需要**移除标题。原因：
- Monitoring 模式下，Layout 侧边栏有模块级标题（如 "Monitoring"），子页面自身也有 `<Title level={4}>` 标题
- CMDB 子页面各自的标题（"配置项管理"、"拓扑图" 等）在 Content 区域内显示，与 Layout 侧边栏不冲突
- Layout 侧边栏标题显示 "CMDB"，子页面标题显示具体功能名

**无需修改的页面**：
- `WebTerminalPage.tsx` — 无全局标题，只有 Card 工具栏
- `BatchExecPage.tsx` — 无全局标题，内部有子 Tabs
- `AuditLogPage.tsx` — 无全局标题，内部有子 Tabs

**无需修改的标题**：
- `CITablePage.tsx` — "配置项管理" 标题保留
- `TopologyPage.tsx` — "拓扑图" 标题保留
- `IntegrationPage.tsx` — "集成资源" 标题保留

### 4.7 修复：缺失的 visor-exec API 模块

**路径**: `orion-frontend/src/api/visor-exec.ts`（已存在，需确认）

评审发现 `BatchExecPage.tsx` 第 53 行 import `@/api/visor-exec`，需要确认该文件存在。如不存在需创建或内联类型。

## 5. 深度评审发现的问题与处理

### 5.1 P0 级别

| # | 问题 | 处理 |
|---|------|------|
| 1 | `/cmdb` 路由无默认子页 | CMDBLayout 中添加 `useEffect` 自动重定向到 `/cmdb/cis` |
| 2 | 子路由缺少 `protected` 标记 | 每个子路由添加 `protected: true` |
| 3 | `/cmdb/cis` 缺少 iconMap 映射 | 添加 `'/cmdb/cis': <DatabaseOutlined />` |

### 5.2 P1 级别

| # | 问题 | 处理 |
|---|------|------|
| 1 | `platform-core/CMDB/index.tsx` 是重复实现（1064 行，3 个 Tab） | 标记待清理，不参与本次拆分 |
| 2 | `BatchExecPage` 统计卡片使用 `mockExecRecords` 常量而非实时状态 | 标记为已知问题，后续修复 |

### 5.3 P2 级别（已知但不处理）

| # | 问题 | 原因 |
|---|------|------|
| 1 | `getHosts()` 被 4 个页面独立调用 | 当前为只读查询，不影响功能 |
| 2 | WebTerminal 切换路由时 WebSocket 断开 | 这是正确行为，路由切换 = 离开终端 = 应断开 |
| 3 | `AuditLogPage` 和 `BatchExecPage` 有内部二级 Tabs | Layout + Outlet 与内部 Tabs 不冲突，符合 Monitoring 模式 |

## 6. 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `pages/CMDB/CMDBLayout.tsx` | 侧边栏导航 + Outlet |
| **修改** | `router/routes.tsx` | 拆分为 7 条路由（1 Layout + 6 子页） |
| **修改** | `stores/menuConfigStore.ts` | `/cmdb` 改为 `/cmdb/cis` |
| **修改** | `components/Layout/iconMap.tsx` | 添加 `/cmdb/cis` 图标映射 |
| **删除** | `pages/CMDB/index.tsx` | 旧的 Tabs 包裹模式 |

## 7. 验证清单

- [ ] `/cmdb` 自动跳转到 `/cmdb/cis`
- [ ] 左侧侧边栏 6 个菜单项点击正常切换
- [ ] 当前菜单项高亮正确
- [ ] 刷新页面后保持当前子页路由
- [ ] 浏览器前进/后退按钮正常
- [ ] 深色/浅色主题切换正常
- [ ] 所有子路由需要认证（`protected: true`）
- [ ] `menuConfigStore.ts` 中基础设施模块下的 CMDB 子菜单点击正常
- [ ] 构建无 TypeScript 错误
- [ ] `platform-core/CMDB/index.tsx` 不影响任何路由（确认无引用）
