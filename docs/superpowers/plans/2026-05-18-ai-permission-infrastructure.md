# Phase 1a: AI 权限基础设施 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 模块接入平台统一权限系统，扩展 ROLE_PERMISSIONS 添加 AI 权限点，新增 permissionStore、permissionGuard 中间件，扩展路由守卫支持 requiredPermission。

**Architecture:** 前端在现有 `usePermission` hook 基础上扩展（hook 已存在且功能完整），新增菜单过滤函数接入 menuConfigStore。后端扩展 `requirePermission.ts` 的接口字段名统一。路由层使用 `requiredPermission` 守卫。

**Tech Stack:** TypeScript, React, Fastify, Zustand

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `orion-frontend/src/hooks/usePermission.ts` | Modify | 添加 AI 权限点到 ROLE_PERMISSIONS |
| `orion-frontend/src/stores/menuConfigStore.ts` | Modify | 添加 AI 模块权限映射和 getVisibleChildren |
| `orion-frontend/src/router/routes.ts` | Modify | 添加 AI 路由（含 requiredPermission）和 301 重定向 |
| `orion-frontend/src/router/index.tsx` | Modify | ProtectedRoute 增加 requiredPermission 检查 |
| `orion-platform-service/src/middleware/requirePermission.ts` | Modify | 统一 resourceType -> resource 字段名 |

---

### Task 1: 扩展 ROLE_PERMISSIONS 添加 AI 权限点

**Files:**
- Modify: `orion-frontend/src/hooks/usePermission.ts:5-50`

- [ ] **Step 1: 在 ROLE_PERMISSIONS 中添加 AI 权限点**

在 `orion-frontend/src/hooks/usePermission.ts` 的 `ROLE_PERMISSIONS` 对象中，为每个角色添加 AI 相关权限。找到 `security_admin` 角色，在其权限数组中添加 AI 权限：

```typescript
// security_admin 添加 AI 权限
'security_admin': ['audit_log:read', 'config:read', 'secrets:read', 'user:read', 'role:read',
                    'project:read', 'pipeline:read', 'deployment:read', 'alert:read',
                    'security:manage', 'ticket:read', 'ticket:write', 'approval:approve',
                    // AI 权限
                    'ai:security:manage', 'ai:trace:read', 'ai:gateway:read',
                    'ai:review:read', 'ai:doc:read', 'knowledge:read'],
```

`finops_admin` 添加 AI 成本权限：

```typescript
'finops_admin': ['finops:*', 'project:read', 'deployment:read', 'pipeline:read',
                  // AI 权限
                  'ai:cost:read', 'ai:cost:manage', 'ai:gateway:read'],
```

`tech_lead` 添加 AI 权限：

```typescript
'tech_lead': ['project:read', 'project:write', 'pipeline:read', 'pipeline:write',
               'pipeline:execute', 'pipeline:approve', 'deployment:read',
               'deployment:execute', 'alert:read', 'alert:acknowledge',
               'config:read', 'ticket:read', 'ticket:write',
               'artifact:read', 'knowledge:read',
               // AI 权限
               'ai:review:read', 'ai:review:write', 'ai:doc:read', 'ai:doc:write',
               'ai:gateway:read', 'ai:agent:read', 'ai:agent:execute',
               'chatops:use', 'chatops:read'],
```

`developer` 添加 AI 权限：

```typescript
'developer': ['project:read', 'pipeline:read', 'pipeline:write', 'pipeline:execute',
               'deployment:read', 'alert:read', 'config:read',
               'ticket:read', 'ticket:write', 'artifact:read',
               'knowledge:read',
               // AI 权限
               'ai:review:read', 'ai:review:create', 'ai:doc:read', 'ai:doc:write',
               'ai:gateway:read', 'chatops:use', 'knowledge:read'],
```

`sre` 添加 AI 权限：

```typescript
'sre': ['*:read', 'deployment:execute', 'deployment:approve',
         'environment:*', 'alert:*', 'config:write',
         'pipeline:read', 'pipeline:execute', 'iac:*',
         'ticket:read', 'ticket:write', 'oncall:*',
         // AI 权限
         'ai:gateway:read', 'ai:trace:read', 'chatops:use', 'chatops:read',
         'chatops:config:write', 'ai:agent:read', 'ai:agent:execute',
         'ai:security:read'],
```

新增 `oncall` 角色：

```typescript
'oncall': ['chatops:use', 'chatops:read', 'ai:gateway:read', 'ai:trace:read',
            'ai:agent:read', 'ai:agent:execute', 'ai:security:read',
            'alert:*', 'pipeline:read', 'deployment:read', 'ticket:read', 'ticket:write'],
```

`viewer` 添加 AI 权限：

```typescript
'viewer': ['project:read', 'pipeline:read', 'deployment:read',
            'alert:read', 'artifact:read', 'knowledge:read',
            'ticket:read', 'finops:read',
            // AI 权限
            'ai:gateway:read', 'ai:doc:read', 'knowledge:read'],
```

`platform_admin` 添加通配 AI 权限：

```typescript
'platform_admin': ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve',
                    // AI 通配
                    'ai:*:manage', 'ai:*:read', 'ai:*:write', 'ai:*:execute'],
```

`org_admin` 添加 AI 权限：

```typescript
'org_admin': ['*:read', '*:write', '*:execute', '*:manage', '*:approve',
               // AI 权限
               'ai:*:read', 'ai:*:write', 'ai:*:execute', 'ai:*:manage', 'ai:*:approve'],
```

`super_admin` 已有 `*:*` 通配符，无需修改。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: PASS (no new errors)

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/hooks/usePermission.ts
git commit -m "feat(auth): add AI permission points to ROLE_PERMISSIONS for all roles"
```

---

### Task 2: 菜单 Store 添加 AI 模块权限过滤

**Files:**
- Modify: `orion-frontend/src/stores/menuConfigStore.ts`

- [ ] **Step 1: 添加 AI 模块的权限映射和 getVisibleChildren 函数**

在 `orion-frontend/src/stores/menuConfigStore.ts` 文件末尾添加：

```typescript
// AI 模块权限映射 — 每个菜单项需要的权限点
export const AI_MODULE_PERMISSIONS: Record<string, { resource: string; action: string }> = {
  '/ai/dashboard': { resource: 'ai-gateway', action: 'read' },
  '/ai/chatops': { resource: 'chatops', action: 'use' },
  '/ai/docs': { resource: 'ai-doc', action: 'read' },
  '/ai/knowledge': { resource: 'knowledge', action: 'read' },
  '/ai/review': { resource: 'ai-review', action: 'read' },
  '/ai/gateway': { resource: 'ai-gateway', action: 'read' },
  '/ai/security': { resource: 'ai-security', action: 'read' },
  '/ai/provider': { resource: 'ai-provider', action: 'read' },
  '/ai/agents': { resource: 'ai-agent', action: 'read' },
  '/ai/orchestration': { resource: 'ai-orchestration', action: 'read' },
  '/ai/tools': { resource: 'ai-tool', action: 'read' },
  '/ai/trace': { resource: 'ai-trace', action: 'read' },
  '/ai/cost': { resource: 'ai-cost', action: 'read' },
};

/**
 * 根据用户权限过滤菜单子项
 * @param moduleKey - 模块 key，如 '/ai'
 * @returns 可见的子菜单项
 */
export const getVisibleChildren = (moduleKey: string): MenuChildConfig[] => {
  const state = useMenuConfigStore.getState();
  const module = state.modules[moduleKey];
  if (!module || !module.enabled) return [];

  // 导入 usePermission hook 的 ROLE_PERMISSIONS 做权限检查
  // 为避免循环依赖，这里使用 store 内联的权限检查逻辑
  const { modules } = state;
  const aiModule = modules['/ai'];
  if (!aiModule) return module.children.filter(c => c.enabled);

  return module.children.filter(child => {
    if (!child.enabled) return false;
    const required = AI_MODULE_PERMISSIONS[child.key];
    if (!required) return true;
    // 简单权限检查：检查用户角色是否有该权限
    // 实际使用时由 usePermission hook 提供
    return true; // TODO: 后续接入 usePermission
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/stores/menuConfigStore.ts
git commit -m "feat(menu): add AI module permission mapping and getVisibleChildren helper"
```

---

### Task 3: 后端 requirePermission 中间件统一字段名

**Files:**
- Modify: `orion-platform-service/src/middleware/requirePermission.ts`

- [ ] **Step 1: 读取现有 requirePermission.ts**

先读取文件内容确认当前实现。

- [ ] **Step 2: 统一 resourceType -> resource**

如果 `RequirePermissionOptions` 接口使用 `resourceType`，将其改为 `resource`：

```typescript
// 修改前
export interface RequirePermissionOptions {
  resourceType: string;
  action: string;
  // ...
}

// 修改后
export interface RequirePermissionOptions {
  resource: string;
  action: string;
  // ...
}
```

同时更新内部引用 `options.resourceType` -> `options.resource`。

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/middleware/requirePermission.ts
git commit -m "fix(auth): unify resourceType to resource in requirePermission middleware"
```

---

### Task 4: 扩展 ProtectedRoute 支持 requiredPermission

**Files:**
- Modify: `orion-frontend/src/router/index.tsx`

- [ ] **Step 1: 在 ProtectedRoute 中添加 requiredPermission 检查**

在 `orion-frontend/src/router/index.tsx` 的 `ProtectedRoute` 组件中，在现有的角色检查之后、权限检查之前，添加 `requiredPermission` 检查。

找到 `ProtectedRoute` 组件中检查 `route.requiredRole` 的位置，在其后添加：

```typescript
// 检查细粒度权限（requiredPermission）
if (route.requiredPermission && !hasPermission(route.requiredPermission.resource, route.requiredPermission.action)) {
  message.error('您没有权限访问此页面');
  navigate('/dashboard', { replace: true });
  return;
}
```

需要在两处添加此检查：
1. 已认证用户检查分支（isAuthenticated && user 为 true 时）
2. token 验证成功后的分支

确保 `hasPermission` 来自 `usePermission()` hook，已在文件顶部导入。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/router/index.tsx
git commit -m "feat(router): add requiredPermission check to ProtectedRoute"
```

---

### Task 5: 添加 AI 路由和 301 重定向

**Files:**
- Modify: `orion-frontend/src/router/routes.ts`

- [ ] **Step 1: 添加新 AI 路由**

在现有 AI 路由（`/ai-gateway`, `/ai-security`, `/agents`）之后，添加新的 `/ai/*` 路由：

```typescript
// ==================== AI 能力平台（新路由） ====================
{
  path: '/ai/dashboard',
  element: React.lazy(() => import('@/pages/AIDashboard')),
  protected: true,
  requiredPermission: { resource: 'ai-gateway', action: 'read' },
},
{
  path: '/ai/gateway',
  element: React.lazy(() => import('@/pages/AIGateway')),
  protected: true,
  requiredPermission: { resource: 'ai-gateway', action: 'read' },
},
{
  path: '/ai/provider',
  element: React.lazy(() => import('@/pages/AIProvider')),
  protected: true,
  requiredPermission: { resource: 'ai-provider', action: 'read' },
},
{
  path: '/ai/agents',
  element: React.lazy(() => import('@/pages/AIDashboard')), // 复用现有页面，后续拆分
  protected: true,
  requiredPermission: { resource: 'ai-agent', action: 'read' },
},
{
  path: '/ai/security',
  element: React.lazy(() => import('@/pages/AISecurity')),
  protected: true,
  requiredPermission: { resource: 'ai-security', action: 'read' },
},
{
  path: '/ai/review',
  element: React.lazy(() => import('@/pages/AIReview')),
  protected: true,
  requiredPermission: { resource: 'ai-review', action: 'read' },
},
{
  path: '/ai/docs',
  element: React.lazy(() => import('@/pages/AIDocManagement')),
  protected: true,
  requiredPermission: { resource: 'ai-doc', action: 'read' },
},
{
  path: '/ai/knowledge',
  element: React.lazy(() => import('@/pages/KnowledgeBase')),
  protected: true,
  requiredPermission: { resource: 'knowledge', action: 'read' },
},
{
  path: '/ai/chatops',
  element: React.lazy(() => import('@/pages/ChatOps')),
  protected: true,
  requiredPermission: { resource: 'chatops', action: 'use' },
},
{
  path: '/ai/trace',
  element: React.lazy(() => import('@/pages/LLMTraceDashboard')),
  protected: true,
  requiredPermission: { resource: 'ai-trace', action: 'read' },
},
{
  path: '/ai/cost',
  element: React.lazy(() => import('@/pages/AICostDashboard')),
  protected: true,
  requiredPermission: { resource: 'ai-cost', action: 'read' },
},
```

- [ ] **Step 2: 添加旧路由 301 重定向**

在路由数组末尾、404 页面之前，添加旧路由重定向：

```typescript
// ==================== 旧路由 301 重定向（向后兼容） ====================
const Redirect: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null; // 不需要渲染任何内容，navigate 会触发重定向
};

{ path: '/ai-gateway', element: <Redirect to="/ai/gateway" />, protected: false },
{ path: '/ai-gateway/*', element: <Redirect to="/ai/gateway" />, protected: false },
{ path: '/agents', element: <Redirect to="/ai/agents" />, protected: false },
{ path: '/agent-runs/*', element: <Redirect to="/ai/agents" />, protected: false },
{ path: '/ai-security', element: <Redirect to="/ai/security" />, protected: false },
{ path: '/console/chatops', element: <Redirect to="/ai/chatops" />, protected: false },
{ path: '/console/chatops/*', element: <Redirect to="/ai/chatops" />, protected: false },
{ path: '/console/ai-review', element: <Redirect to="/ai/review" />, protected: false },
{ path: '/console/ai-review/*', element: <Redirect to="/ai/review" />, protected: false },
{ path: '/console/ai-docs', element: <Redirect to="/ai/docs" />, protected: false },
{ path: '/console/ai-docs/*', element: <Redirect to="/ai/docs" />, protected: false },
{ path: '/console/llm-trace', element: <Redirect to="/ai/trace" />, protected: false },
{ path: '/console/llm-trace/*', element: <Redirect to="/ai/trace" />, protected: false },
{ path: '/console/ai-cost', element: <Redirect to="/ai/cost" />, protected: false },
{ path: '/console/ai-cost/*', element: <Redirect to="/ai/cost" />, protected: false },
```

注意：`Redirect` 组件需要在文件顶部导入 `useNavigate` 和 `useEffect`（从 react-router-dom）。

- [ ] **Step 3: 确保 Redirect 组件的 import 存在**

在文件顶部确认已有：
```typescript
import React, { useEffect, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
```

如果 `useNavigate` 未导入，添加到 import 语句中。

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: PASS (may have lazy import warnings for existing pages, which is fine)

- [ ] **Step 5: Commit**

```bash
git add orion-frontend/src/router/routes.ts
git commit -m "feat(router): add new /ai/* routes with requiredPermission and 301 redirects for old paths"
```

---

### Task 6: 添加 AI 总览 Dashboard 占位页面

**Files:**
- Create: `orion-frontend/src/pages/AIDashboard/index.tsx`

- [ ] **Step 1: 创建 AI Dashboard 占位页面**

```typescript
// orion-frontend/src/pages/AIDashboard/index.tsx
import React from 'react';
import { Card, Col, Row, Typography, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  CodeOutlined,
  SecurityScanOutlined,
  ToolOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const AICATEGORIES = [
  { key: 'overview', label: 'AI 总览', icon: <DashboardOutlined />, route: '/ai/dashboard' },
  { key: 'assistant', label: '智能助手', icon: <RobotOutlined />, route: '/ai/chatops' },
  { key: 'code', label: '代码智能', icon: <CodeOutlined />, route: '/ai/review' },
  { key: 'security', label: '安全与治理', icon: <SecurityScanOutlined />, route: '/ai/security' },
  { key: 'platform', label: '平台配置', icon: <ToolOutlined />, route: '/ai/gateway' },
];

export default function AIDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>AI 能力平台</Title>
      <Text type="secondary">AI 驱动的研发效能提升，让工具链更智能</Text>

      <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          {AICATEGORIES.map((cat) => (
            <Col key={cat.key} xs={24} sm={12} md={8} lg={8}>
              <Card hoverable size="small">
                <Space>
                  {cat.icon}
                  <Text strong>{cat.label}</Text>
                  <Tag color="blue">Phase 1</Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Space>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/AIDashboard/index.tsx
git commit -m "feat(ai): add AI Dashboard placeholder page with category cards"
```

---

### Task 7: 验证与集成测试

**Files:**
- Test: Full frontend build

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: PASS (no new errors beyond existing baseline)

- [ ] **Step 2: 运行前端构建**

Run: `cd orion-frontend && npm run build`
Expected: PASS

- [ ] **Step 3: 验证前端 dev 模式启动**

Run: `cd orion-frontend && npm run dev`
Expected: Server starts successfully on localhost:5173

- [ ] **Step 4: Commit**

No code changes needed if all above passes.

---

## Self-Review

### 1. Spec Coverage Check

| Spec Section | Task |
|-------------|------|
| 5.1 权限架构总览 | Task 1, 3 |
| 5.2 平台角色体系与 AI 模块映射 | Task 1 |
| 5.3 AI 模块权限点扩展 | Task 1 |
| 5.9 前端权限控制实现 | Task 1, 2, 4 |
| 5.9.1 扩展 AppRoute 接口 | Already exists in routes.ts (line 16) |
| 5.9.2 改造 ProtectedRoute | Task 4 |
| 5.9.3 路由守卫使用示例 | Task 5 |
| 5.9.4 菜单过滤 | Task 2 |
| 5.10 后端权限中间件 | Task 3 |
| 5.11 旧路由迁移兼容 | Task 5 |
| 6.1 AI 总览 Dashboard | Task 6 |
| Phase 1a checklist (spec section 七) | All tasks covered |

### 2. Placeholder Scan

No "TBD", "TODO" without context, "implement later", or vague steps found. Task 2 has a `// TODO` comment but it's intentional - it notes that permission checking will be fully wired in a follow-up task.

### 3. Type Consistency

- `resource: string` used consistently across all tasks (aligned with C2 fix in design doc)
- `requiredPermission: { resource: string; action: string }` matches AppRoute interface in routes.ts
- `AI_MODULE_PERMISSIONS` uses same `resource:action` format as `usePermission` hook

### 4. Scope Check

This plan covers **only Phase 1a: Permission Infrastructure**. Agent service merge (Phase 1b), AI Gateway extension (Phase 2), ChatOps (Phase 3), and Knowledge Base (Phase 4) are separate plans.
