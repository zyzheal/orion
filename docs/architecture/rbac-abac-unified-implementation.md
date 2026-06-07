# Orion Platform RBAC + ABAC 统一权限管控实施方案

> **文档版本**: v1.1
> **创建日期**: 2026-05-18
> **评审日期**: 2026-05-18
> **状态**: 评审通过，待实施
>
> **注意**：本文档的角色体系/权限模型/ABAC 设计是权威来源。JWT/Token 部分以 `docs/security/认证授权与数据加密设计.md` 为准。全局统一视图见 `docs/security/权限系统统一规范.md`。
> **前置文档**:
> - `docs/security/安全与权限详解.md` — SSO/角色矩阵/审计/UEBA
> - `orion-api-gateway/src/services/auth/AbacPolicyEngine.ts` — 已实现的 ABAC 引擎
> - `src/services/permission/PermissionService.ts` — 权限定义服务
> - `src/services/role/RoleService.ts` — 角色 CRUD 服务
> - `src/services/pipeline/PipelineRBACService.ts` — 流水线 RBAC
> - `src/middleware/roleGuard.ts` — 路由角色守卫

---

## 1. 现状评估

### 1.1 已有能力

| 组件 | 位置 | 状态 | 说明 |
|------|------|------|------|
| JWT 认证中间件 | `src/middleware/authMiddleware.ts` | 已实现 | JWT 验证 + user 信息挂载 |
| 角色 CRUD | `src/services/role/RoleService.ts` | 已实现 | 多租户角色管理 |
| 权限定义 | `src/services/permission/PermissionService.ts` | 已实现 | 20+ resource:action 预置 |
| RBAC 路由守卫 | `src/middleware/roleGuard.ts` | 已实现 | admin/non-admin 两档 |
| 数据库表 | `002_create_roles_permissions.sql` | 已实现 | roles/permissions/role_permissions/user_roles |
| Pipeline RBAC | `src/services/pipeline/PipelineRBACService.ts` | 已实现 | admin/editor/viewer/approver |
| ABAC 引擎 | `orion-api-gateway/src/services/auth/AbacPolicyEngine.ts` | 已实现 | 完整条件评估引擎 |
| 租户 RLS | `src/services/tenant/RLSPolicyManager.ts` | 已实现 | 50+ 表行级安全 |
| 前端路由守卫 | `orion-frontend/src/router/index.tsx` | 已实现 | requiredRole 属性 |

### 1.2 核心缺陷

| 缺陷 | 影响 | 优先级 |
|------|------|--------|
| Permission 定义从未被路由层使用 | 权限表形同虚设 | P0 |
| roleGuard 只有 admin/non-admin 两档 | 无法做细粒度控制 | P0 |
| PipelineRBACService 未被路由/控制器调用 | 流水线级权限未生效 | P0 |
| 无统一的 AuthZ 评估引擎 | 各模块各自为战 | P0 |
| 无 ABAC 与 RBAC 的结合点 | 只有角色判断，没有属性/关系判断 | P1 |
| 前端无按钮级权限控制 | 所有按钮对登录用户可见 | P1 |
| 无权限审计日志 | 无法追溯越权访问 | P2 |

### 1.3 架构问题：双重 /v1 前缀

已在本次会话中修复：`routes.ts` 内所有 `'/v1/'` 前缀改为 `'/'`，避免与 `app.ts` 的 `prefix: '/api/v1'` 冲突导致全部 404。

---

## 2. 总体架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      Orion AuthZ Engine                             │
│                                                                     │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │  RBAC    │   │  ABAC    │   │ 关系检查  │   │  审计层   │         │
│  │  角色层   │──→│  属性层   │──→│ 归属层    │──→│  日志层   │         │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘         │
│       │              │              │                               │
│       ▼              ▼              ▼                               │
│  roles table    abac_policies   project_members                     │
│  permissions    条件评估器      resource_tags                       │
│  user_roles     租户隔离       owner/creator 检查                    │
│  角色继承       环境约束       团队关系                              │
│                                                                    │
│  决策流程:                                                          │
│  1. RBAC → 角色是否有基础权限？deny → 403                          │
│  2. ABAC → 属性条件是否满足？deny → 403                            │
│  3. 关系 → 是否资源 owner/项目成员？deny → 403                     │
│  4. 全部通过 → 放行                                                  │
└────────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ 前端层   │         │ 中间件层 │         │ DB 层   │
    │         │         │         │         │         │
    │ 路由守卫 │         │ require  │         │ RLS     │
    │ 按钮指令 │         │Permission │         │ owner_id│
    │ 权限Hook │         │ canAccess│         │ RLS     │
    └─────────┘         └─────────┘         └─────────┘
```

---

## 3. 角色体系设计

### 3.1 系统级角色（全局角色，跨模块生效）

| 角色 ID | 名称 | 说明 | 来源 |
|---------|------|------|------|
| `super_admin` | 超级管理员 | 全平台通配权限 `*:*` | 安全与权限详解 |
| `platform_admin` | 平台管理员 | 平台运维，管理所有模块 | 现有 roleGuard |
| `tenant_admin` | 租户管理员 | 租户内全权 | HR 同步映射 |
| `security_admin` | 安全管理员 | 安全合规、审计 | 安全与权限详解 |
| `finops_admin` | 成本管理员 | FinOps 全权 | 新增 |

### 3.2 业务角色（按 HR 职级自动映射）

| 角色 ID | 映射条件 | 说明 | 来源 |
|---------|---------|------|------|
| `org_admin` | P9/P10/总监/VP | 组织管理员 | 安全与权限详解 |
| `tech_lead` | P7/P8/TechLead/架构师 | 技术负责人 | 安全与权限详解 |
| `developer` | P5/P6/工程师 | 普通开发者 | 安全与权限详解 |
| `sre` | 运维/SRE | 站点可靠性工程师 | 安全与权限详解 |
| `dba` | DBA/数据库管理员 | 数据库管理员 | 安全与权限详解 |
| `viewer` | 默认 | 只读用户 | 安全与权限详解 |
| `auditor` | 审计员 | 审计日志查看 | 安全与权限详解 |

### 3.3 项目级角色（在每个 project 内独立分配）

| 角色 ID | 说明 | 来源 |
|---------|------|------|
| `project_admin` | 项目内全权 | 新增 |
| `project_lead` | 项目写权限 + 审批 | 新增 |
| `project_developer` | 项目读写 | 新增 |
| `project_viewer` | 项目只读 | 新增 |

### 3.4 模块级角色（特定资源）

已在 PipelineRBACService 实现，需扩展到更多模块：

| 模块 | 角色 |
|------|------|
| 流水线 | `pipeline.admin`, `pipeline.editor`, `pipeline.viewer`, `pipeline.approver` |
| 环境 | `environment.admin`, `environment.deployer`, `environment.viewer` |
| 配置 | `config.admin`, `config.editor`, `config.viewer` |
| 制品 | `artifact.admin`, `artifact.publisher`, `artifact.viewer` |

### 3.5 角色继承关系

```
super_admin
  └── platform_admin
        └── tenant_admin
              └── org_admin
                    ├── tech_lead
                    │     └── developer
                    ├── sre
                    ├── dba
                    ├── security_admin
                    └── finops_admin

project_admin
  └── project_lead
        └── project_developer
              └── project_viewer
```

**继承规则**: 子角色自动继承父角色的所有权限。例如 `tech_lead` 拥有 `developer` 的全部权限，`org_admin` 拥有 `tech_lead` 的全部权限。

**实现注意**: `ROLE_INHERITANCE` 的 key 是子角色，value 是父角色列表。展开时应从用户已有角色向上递归查找所有父角色。

---

## 4. 权限模型

### 4.1 权限格式

统一使用 `{resource}:{action}` 格式，与 `PermissionService` 现有的 resource:action 模型一致。

支持通配符：
- `*:*` — 所有资源所有操作（super_admin）
- `pipeline:*` — 流水线所有操作
- `*:read` — 所有资源只读

### 4.2 资源-动作矩阵

| 资源 \ 动作 | read | write | execute | delete | manage | approve | acknowledge |
|------------|------|-------|---------|--------|--------|---------|-------------|
| `project` | ✅ | ✅ | - | ✅ | - | - | - |
| `pipeline` | ✅ | ✅ | ✅ | ✅ | - | ✅ | - |
| `deployment` | ✅ | ✅ | ✅ | ✅ | - | ✅ | - |
| `environment` | ✅ | ✅ | ✅ | - | ✅ | - | - |
| `alert` | ✅ | ✅ | acknowledge | ✅ | - | - | - |
| `config` | ✅ | ✅ | - | - | ✅ | - | - |
| `artifact` | ✅ | ✅ | - | ✅ | - | - | - |
| `ticket` | ✅ | ✅ | - | - | ✅ | - | - |
| `audit_log` | ✅ | - | - | - | - | - | - |
| `tenant` | ✅ | ✅ | - | - | ✅ | - | - |
| `user` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `role` | ✅ | ✅ | - | ✅ | - | - | - |
| `finops` | ✅ | ✅ | - | - | ✅ | - | - |
| `cmdb` | ✅ | ✅ | - | - | ✅ | - | - |
| `iac` | ✅ | ✅ | ✅ | ✅ | - | - | - |
| `knowledge` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `agent` | ✅ | ✅ | execute | ✅ | ✅ | - | - |
| `skill` | ✅ | ✅ | execute | ✅ | - | - | - |
| `api_key` | ✅ | ✅ | - | ✅ | - | - | - |
| `notification` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `webhook` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `approval` | ✅ | - | approve | - | manage | ✅ | - |
| `cron` | ✅ | ✅ | execute | ✅ | ✅ | - | - |
| `session` | ✅ | - | - | - | ✅ | - | - |
| `plugin` | ✅ | ✅ | execute | ✅ | ✅ | - | - |
| `event` | ✅ | - | execute | - | ✅ | - | - |
| `oncall` | ✅ | ✅ | - | - | ✅ | - | - |
| `backup` | ✅ | ✅ | execute | - | ✅ | - | - |
| `secrets` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `vector_store` | ✅ | ✅ | - | ✅ | ✅ | - | - |
| `chatops` | ✅ | ✅ | execute | - | ✅ | - | - |

### 4.3 角色-权限映射（完整版）

#### 系统级

```typescript
const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  'super_admin':         ['*:*'],
  'platform_admin':      ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve'],
  'tenant_admin':        ['*:read', '*:write', '*:manage', 'audit_log:read'],
  'org_admin':           ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  'security_admin':      ['audit_log:read', 'config:read', 'secrets:read', 'user:read', 'role:read',
                          'project:read', 'pipeline:read', 'deployment:read', 'alert:read',
                          'security:manage', 'ticket:read', 'approval:approve'],
  'finops_admin':        ['finops:*', 'project:read', 'deployment:read', 'pipeline:read'],
};
```

#### 业务级

```typescript
const BUSINESS_ROLE_PERMISSIONS: Record<string, string[]> = {
  'tech_lead':   ['project:read', 'project:write', 'pipeline:read', 'pipeline:write',
                   'pipeline:execute', 'pipeline:approve', 'deployment:read',
                   'deployment:execute', 'alert:read', 'alert:acknowledge',
                   'config:read', 'ticket:read', 'ticket:write',
                   'artifact:read', 'knowledge:read', 'knowledge:write'],
  'developer':   ['project:read', 'pipeline:read', 'pipeline:write', 'pipeline:execute',
                   'deployment:read', 'alert:read', 'config:read',
                   'ticket:read', 'ticket:write', 'artifact:read',
                   'knowledge:read'],
  'sre':         ['*:read', 'deployment:execute', 'deployment:approve',
                   'environment:*', 'alert:*', 'config:write',
                   'pipeline:read', 'pipeline:execute', 'iac:*',
                   'ticket:read', 'ticket:write', 'oncall:*'],
  'dba':         ['project:read', 'pipeline:read', 'deployment:read',
                   'config:read', 'alert:read', 'cmdb:read',
                   'environment:read', 'secrets:read'],
  'viewer':      ['project:read', 'pipeline:read', 'deployment:read',
                   'alert:read', 'artifact:read', 'knowledge:read',
                   'ticket:read', 'finops:read'],
  'auditor':     ['audit_log:*', '*:read', 'ticket:read', 'approval:read'],
};
```

#### 项目级

```typescript
const PROJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'project_admin':     ['project:*', 'pipeline:*', 'deployment:*',
                         'environment:read', 'artifact:*', 'alert:*',
                         'ticket:*', 'approval:*', 'secrets:*', 'oncall:*'],
  'project_lead':      ['project:read', 'project:write', 'pipeline:*',
                         'pipeline:approve', 'deployment:read',
                         'deployment:execute', 'artifact:read', 'artifact:write',
                         'alert:read', 'alert:acknowledge', 'ticket:*',
                         'approval:approve', 'secrets:read', 'oncall:*'],
  'project_developer': ['project:read', 'pipeline:read', 'pipeline:write',
                         'pipeline:execute', 'deployment:read',
                         'artifact:read', 'alert:read', 'ticket:read',
                         'ticket:write', 'secrets:read'],
  'project_viewer':    ['project:read', 'pipeline:read', 'deployment:read',
                         'artifact:read', 'alert:read', 'ticket:read',
                         'knowledge:read'],
};
```

---

## 5. ABAC 属性模型

### 5.1 统一上下文接口（融合 API Gateway ABAC 引擎）

> 注：`orion-api-gateway` 已有完整的 `AbacContext` 接口和 `AbacPolicyEngine` 实现（750+ 行，含条件评估器、政策管理、缓存、批量评估等）。本方案将其从 API Gateway 下沉到 Platform Service 作为统一的 AuthZ 引擎。

```typescript
// src/services/authz/types.ts

// === 用户属性 ===
export interface UserAttributes {
  id: string;
  username: string;
  roles: string[];
  department?: string;
  level?: 'junior' | 'senior' | 'manager' | 'director';
  teams?: string[];
  tenantId: string;
  clearanceLevel?: 'L1' | 'L2' | 'L3' | 'L4';
  status?: 'active' | 'disabled' | 'suspended';
}

// === 资源属性 ===
export interface ResourceAttributes {
  type: string;       // 'project', 'pipeline', 'deployment', 'alert', ...
  id?: string;
  ownerId?: string;   // 创建者/负责人
  tenantId: string;
  projectId?: string;
  environment?: 'dev' | 'staging' | 'production';
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  department?: string;
  tags?: string[];
  status?: string;
}

// === 环境属性 ===
export interface EnvAttributes {
  time: Date;
  sourceIp?: string;
  network?: 'internal' | 'external' | 'vpn';
  requestOrigin?: 'web' | 'api' | 'cli' | 'webhook';
  sessionId?: string;
}

// === 操作属性 ===
export interface ActionAttributes {
  type: string;  // 'read', 'write', 'execute', 'delete', 'manage', 'approve'
  impact?: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
}

// === AuthZ 请求上下文 ===
export interface AuthZRequest {
  user: UserAttributes;
  resource: ResourceAttributes;
  environment: EnvAttributes;
  action: ActionAttributes;
}
```

### 5.2 ABAC 预置规则（基于 API Gateway 已有策略）

> 以下 6 条策略已在 `AbacPolicyEngine.SYSTEM_ABAC_POLICIES` 中实现，需迁移到 Platform Service 统一存储和评估。

| # | 策略 ID | 名称 | 效果 | 条件 | 优先级 |
|---|---------|------|------|------|--------|
| 1 | `resource-owner-full-control` | 资源所有者完全控制 | allow | `resource.owner == user.id` | 100 |
| 2 | `tenant-isolation` | 租户隔离 | deny | `resource.tenantId != user.tenantId` | 99 |
| 3 | `restricted-resource-access` | 敏感资源访问限制 | allow | `resource.sensitivity == 'restricted'` AND (`user.role in [admin,security]` OR `user.department == resource.department`) | 90 |
| 4 | `external-network-restriction` | 外部网络写操作限制 | deny | `environment.network == 'external'` AND `action in [create,update,delete,execute]` | 80 |
| 5 | `working-hours-restriction` | 关键操作时间限制 | deny | `action.impact in [high,critical]` AND NOT 工作时间(9-18) AND `user.role != admin` | 70 |
| 6 | `cross-department-restriction` | 跨部门访问限制 | deny | `resource.department != user.department` AND `user.role != admin` | 60 |

### 5.3 条件操作符（复用 API Gateway 已实现）

`equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `in`, `notIn`, `greaterThan`, `lessThan`, `matches` (正则), `exists`, `notExists`, `between`, `timeInRange`

支持变量引用：`${user.id}`, `${resource.department}` 等。

---

## 6. 决策流程与合并策略

### 6.1 评估顺序

```
请求进入
  │
  ├─ [0] 认证检查: JWT 有效？→ 无效 → 401
  │
  ├─ [1] 用户状态: disabled/suspended？→ 403 "账号已禁用"
  │
  ├─ [2] RBAC: 角色是否有 resource:action 权限？
  │     └─ deny → 403 "角色无权限"
  │     └─ allow → 继续
  │
  ├─ [3] ABAC: 评估所有匹配的策略规则（deny-only）
  │     └─ 有 deny 策略匹配 → 403 "策略拒绝: {reason}"
  │     └─ 无 deny 策略 → 继续（无匹配的 allow 不拒绝）
  │
  ├─ [4] 关系检查: resourceId 存在时
  │     ├─ 是否 owner/creator？→ 直接 allow
  │     ├─ 是否 project member？→ 检查项目角色权限
  │     └─ 无关系 → 403 "非资源所有者/非项目成员"
  │
  └─ [5] 全部通过 → 放行，记录审计日志
```

### 6.2 合并策略

- **Deny Override（拒绝优先）**: 任何一层拒绝即最终拒绝
- **RBAC 是基础准入**: RBAC deny 直接拒绝，不进入 ABAC
- **ABAC 是 deny-only 约束**: 仅当有匹配的 deny 策略时才拒绝；无匹配的 allow 策略时 **不拒绝**（默认允许）。这避免了新资源类型因缺少 ABAC 策略而被误拒
- **关系是兜底**: RBAC + ABAC 通过后，再检查资源归属
- **通配符 `*:*` 跳过 ABAC**: super_admin 不受 ABAC 约束

---

## 7. 数据库设计

### 7.1 现有表（无需修改）

```sql
-- Migration 002: 已存在
roles             -- 角色定义
permissions       -- 权限定义 (resource, action)
role_permissions  -- 角色-权限映射
user_roles        -- 用户-角色映射
```

### 7.2 新增表

```sql
-- ABAC 策略规则表
CREATE TABLE abac_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  effect          VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  resource_type   VARCHAR(100) NOT NULL,          -- 或 '*' 表示所有
  action_type     VARCHAR(50) NOT NULL,           -- 或 '*' 表示所有
  subject_conditions  JSONB NOT NULL DEFAULT '{}', -- 用户属性条件
  resource_conditions JSONB NOT NULL DEFAULT '{}', -- 资源属性条件
  environment_conditions JSONB NOT NULL DEFAULT '{}', -- 环境属性条件
  priority        INT NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_abac_policies_resource ON abac_policies(resource_type, action_type);
CREATE INDEX idx_abac_policies_tenant ON abac_policies(tenant_id);

-- 项目成员表（项目级 RBAC + 关系检查）
CREATE TABLE project_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL,  -- admin, lead, developer, viewer
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- 资源标签表（P1 阶段使用，P0 仅建表）
-- 用途: 为 ABAC 条件匹配提供资源标签属性
-- 示例: 按标签 "production", "critical" 限制访问
CREATE TABLE resource_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID NOT NULL,
  tag             VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_type, resource_id, tag)
);
CREATE INDEX idx_resource_tags_lookup ON resource_tags(resource_type, resource_id);

-- 权限审计日志
CREATE TABLE permission_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id),
  resource_type   VARCHAR(100),
  resource_id     UUID,
  action          VARCHAR(50),
  decision        VARCHAR(10) CHECK (decision IN ('allow', 'deny')),
  decision_source VARCHAR(50),  -- 'rbac', 'abac', 'relationship', 'rls'
  reason          TEXT,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_permission_audit_user ON permission_audit_logs(user_id, evaluated_at DESC);
CREATE INDEX idx_permission_audit_denied ON permission_audit_logs(decision, evaluated_at DESC)
  WHERE decision = 'deny';

-- 角色继承关系表
CREATE TABLE role_inheritance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_role     VARCHAR(100) NOT NULL,
  child_role      VARCHAR(100) NOT NULL,
  UNIQUE(parent_role, child_role)
);
```

---

## 8. 后端核心实现

### 8.1 授权引擎

```typescript
// src/services/authz/AuthorizationEngine.ts

import pino from 'pino';
import { AuthZRequest, UserAttributes } from './types';
import { RBACService } from '../role/RoleService';
import { AbacPolicyEngine } from '../authz/AbacPolicyEngine';
import { RelationshipService } from '../authz/RelationshipService';
import { PermissionAuditRepository } from '../../repositories/PermissionAuditRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface AuthZDecision {
  allowed: boolean;
  reason: string;
  source: 'rbac' | 'abac' | 'relationship' | 'super_admin_bypass' | 'all';
  evaluatedBy: string[];
  evaluationTime: number;
}

export class AuthorizationEngine {
  constructor(
    private rbacService: RBACService,
    private abacEngine: AbacPolicyEngine,
    private relationshipService: RelationshipService,
    private auditRepo: PermissionAuditRepository,
  ) {}

  async evaluate(req: AuthZRequest): Promise<AuthZDecision> {
    const startTime = Date.now();

    // [0] 用户状态检查
    if (req.user.status === 'disabled' || req.user.status === 'suspended') {
      return this.deny('账号已禁用', 'rbac', Date.now() - startTime);
    }

    // [1] super_admin 通配符跳过所有检查
    if (req.user.roles.includes('super_admin')) {
      return this.allow('Super Admin bypass', 'super_admin_bypass', Date.now() - startTime);
    }

    // [2] RBAC 检查
    const rbacResult = await this.rbacService.checkPermissions(
      req.user.roles,
      req.resource.type,
      req.action.type,
    );
    if (!rbacResult.allowed) {
      return this.deny(rbacResult.reason, 'rbac', Date.now() - startTime);
    }

    // [3] ABAC 检查（deny-only 约束）
    // ABAC 仅作为拒绝约束: 只有匹配的 deny 策略才拒绝
    // 无匹配的 allow 策略不拒绝（RBAC 已通过基础准入）
    const abacResult = this.abacEngine.evaluate({
      user: req.user,
      resource: req.resource,
      environment: req.environment,
      action: req.action,
    });
    if (abacResult.denied) {
      return this.deny(abacResult.denialReason || 'ABAC policy denied', 'abac', Date.now() - startTime);
    }
    // 注意: 不再检查 !abacResult.allowed，因为 ABAC 是 deny-only

    // [4] 关系检查
    if (req.resource.id) {
      const relResult = await this.relationshipService.check({
        userId: req.user.id,
        projectId: req.resource.projectId,
        resourceId: req.resource.id,
        resourceType: req.resource.type,
        ownerId: req.resource.ownerId,
      });
      if (!relResult.allowed) {
        return this.deny(relResult.reason, 'relationship', Date.now() - startTime);
      }
    }

    // [5] 全部通过
    return this.allow('All checks passed', 'all', Date.now() - startTime, ['rbac', 'abac', 'relationship']);
  }

  private allow(reason: string, source: AuthZDecision['source'], time: number, evaluatedBy?: string[]): AuthZDecision {
    return { allowed: true, reason, source, evaluatedBy: evaluatedBy || [source], evaluationTime: time };
  }

  private deny(reason: string, source: AuthZDecision['source'], time: number): AuthZDecision {
    return { allowed: false, reason, source, evaluatedBy: [source], evaluationTime: time };
  }
}
```

### 8.2 RBAC 服务增强

```typescript
// src/services/role/RBACService.ts (增强现有 RoleService)

import { RoleRepository, Role } from './RoleRepository';
import { PermissionRepository } from '../../repositories/PermissionRepository';

// 角色继承关系: key = 子角色, value = 父角色列表
// 子角色自动拥有父角色的所有权限
const ROLE_INHERITANCE: Record<string, string[]> = {
  'platform_admin': ['super_admin'],
  'tenant_admin':   ['platform_admin'],
  'org_admin':      ['tenant_admin'],
  'tech_lead':      ['org_admin'],
  'developer':      ['tech_lead'],
  'project_lead':   ['project_admin'],
  'project_developer': ['project_lead'],
  'project_viewer': ['project_developer'],
};

export class RBACService {
  constructor(
    private roleRepo: RoleRepository,
    private permRepo: PermissionRepository,
  ) {}

  /** 获取用户所有角色（含继承） */
  async getAllRoles(userId: string, tenantId: string): Promise<string[]> {
    const userRoles = await this.roleRepo.findUserRoles(userId, tenantId);
    const allRoles = new Set<string>(userRoles.map(r => r.name));

    // 递归向上展开父角色（子角色 → 父角色方向）
    let changed = true;
    while (changed) {
      changed = false;
      for (const role of [...allRoles]) {
        const parents = ROLE_INHERITANCE[role];
        if (parents) {
          for (const parent of parents) {
            if (!allRoles.has(parent)) {
              allRoles.add(parent);
              changed = true;
            }
          }
        }
      }
    }
    return Array.from(allRoles);
  }

  /** 检查角色是否有某权限（含继承） */
  async checkPermissions(
    roles: string[],
    resource: string,
    action: string,
  ): Promise<{ allowed: boolean; reason: string }> {
    // 通配符检查
    if (roles.includes('super_admin')) {
      return { allowed: true, reason: 'Super Admin' };
    }

    // 获取所有角色对应的权限
    // 注意: findByRoles 需通过 SQL JOIN 查询实现:
    // SELECT DISTINCT p.resource, p.action FROM permissions p
    // JOIN role_permissions rp ON p.id = rp.permission_id
    // WHERE rp.role_id IN (...)
    const permissions = await this.permRepo.findByRoles(roles);

    // 检查是否有匹配的权限
    const hasExact = permissions.some(p => p.resource === resource && p.action === action);
    if (hasExact) return { allowed: true, reason: `Permission ${resource}:${action} granted` };

    // 检查通配符权限
    const hasResourceWildcard = permissions.some(p => p.resource === resource && p.action === '*');
    if (hasResourceWildcard) return { allowed: true, reason: `Resource wildcard ${resource}:* granted` };

    const hasActionWildcard = permissions.some(p => p.resource === '*' && p.action === action);
    if (hasActionWildcard) return { allowed: true, reason: `Action wildcard *:${action} granted` };

    const hasFullWildcard = permissions.some(p => p.resource === '*' && p.action === '*');
    if (hasFullWildcard) return { allowed: true, reason: 'Full wildcard *:* granted' };

    return { allowed: false, reason: `No role grants ${resource}:${action}` };
  }

  /** 加载角色默认权限映射
   *
   * 实施注意:
   * - 复用现有 PermissionService.seedCommonPermissions() 先创建权限定义
   * - 本方法负责将权限绑定到角色（写入 role_permissions 表）
   * - 两个方法应在初始化脚本中顺序调用：先 seedCommonPermissions，再 seedRolePermissions
   */
  async seedRolePermissions(): Promise<void> {
    const rolePerms: Record<string, string[]> = {
      ...SYSTEM_ROLE_PERMISSIONS,
      ...BUSINESS_ROLE_PERMISSIONS,
      ...PROJECT_ROLE_PERMISSIONS,
    };

    for (const [roleName, perms] of Object.entries(rolePerms)) {
      const role = await this.roleRepo.findByName(roleName);
      if (!role) continue;

      for (const perm of perms) {
        const [resource, action] = perm.split(':');
        const existing = await this.roleRepo.findRolePermission(role.id, resource, action);
        if (!existing) {
          await this.roleRepo.addRolePermission(role.id, resource, action);
        }
      }
    }
  }
}
```

### 8.3 关系检查服务

> **P0 范围**: 仅实现基础的 owner 检查和 project_member 检查。§10.2 中提到的工单分配、知识库空间、ChatOps 渠道、OnCall 排班等关系检查在 P1 阶段按模块逐步补充。

```typescript
// src/services/authz/RelationshipService.ts

export interface RelationshipCheck {
  userId: string;
  projectId?: string;
  resourceId?: string;
  resourceType: string;
  ownerId?: string;
}

export class RelationshipService {
  constructor(
    private db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  ) {}

  async check(req: RelationshipCheck): Promise<{ allowed: boolean; reason: string }> {
    // 1. Owner 检查
    if (req.ownerId && req.userId === req.ownerId) {
      return { allowed: true, reason: 'Resource owner' };
    }

    // 2. 项目成员检查
    if (req.projectId) {
      const result = await this.db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [req.projectId, req.userId],
      );
      if (result.rows.length > 0) {
        return { allowed: true, reason: `Project member with role: ${result.rows[0].role}` };
      }
    }

    return { allowed: false, reason: 'Not resource owner or project member' };
  }
}
```

### 8.4 中间件封装

```typescript
// src/middleware/requirePermission.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthorizationEngine } from '../services/authz/AuthorizationEngine';
import { AuthZRequest } from '../services/authz/types';

export interface RequirePermissionOptions {
  resourceType: string;
  action: string;
  extractResourceId?: (req: FastifyRequest) => string;
  extractProjectId?: (req: FastifyRequest) => string;
  extractOwnerId?: (req: FastifyRequest) => string;
  requiredImpact?: 'low' | 'medium' | 'high' | 'critical';
}

// Global engine instance, set during app initialization
let authzEngine: AuthorizationEngine | null = null;

export function setAuthzEngine(engine: AuthorizationEngine) {
  authzEngine = engine;
}

export function requirePermission(options: RequirePermissionOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!authzEngine) {
      throw new Error('AuthZ engine not initialized');
    }

    const resourceId = options.extractResourceId?.(request);
    const projectId = options.extractProjectId?.(request);
    const ownerId = options.extractOwnerId?.(request);

    const authzReq: AuthZRequest = {
      user: request.user as any,  // JWT 中间件已挂载
      resource: {
        type: options.resourceType,
        id: resourceId,
        tenantId: (request.user as any).tenantId,
        projectId,
        ownerId,
      },
      environment: {
        time: new Date(),
        sourceIp: request.ip,
        network: request.headers['x-network'] as any || 'internal',
        requestOrigin: 'web',
      },
      action: {
        type: options.action,
        impact: options.requiredImpact,
      },
    };

    const decision = await authzEngine.evaluate(authzReq);

    if (!decision.allowed) {
      // 记录审计日志（异步，不阻塞响应）
      authzEngine.auditRepo?.logDecision({
        userId: authzReq.user.id,
        tenantId: authzReq.resource.tenantId,
        resourceType: authzReq.resource.type,
        resourceId: authzReq.resource.id,
        action: authzReq.action.type,
        decision: 'deny',
        decisionSource: decision.source,
        reason: decision.reason,
      }).catch(err => {
        // 审计日志失败不影响主流程，仅记录
        console.error('Failed to write permission audit log:', err);
      });

      return reply.code(403).send({
        code: 403,
        error: 'FORBIDDEN',
        message: decision.reason,
        source: decision.source,
      });
    }
  };
}
```

### 8.5 路由使用方式

```typescript
// src/api/project-routes.ts (示例)

import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

export default async function projectRoutes(app: FastifyInstance, options): Promise<void> {
  // 列表/搜索 — 需要 project:read
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({
      resourceType: 'project',
      action: 'read',
    })],
  }, listProjects);

  // 创建 — 需要 project:write
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({
      resourceType: 'project',
      action: 'write',
    })],
  }, createProject);

  // 删除 — 需要 project:delete + 高影响 + 关系检查
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({
      resourceType: 'project',
      action: 'delete',
      extractResourceId: (req) => req.params.id,
      requiredImpact: 'high',
    })],
  }, deleteProject);
}
```

---

## 9. 前端权限集成

### 9.1 权限 Hook

```typescript
// orion-frontend/src/hooks/usePermission.ts

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

// 角色权限映射（与后端同步）
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'super_admin': ['*:*'],
  'platform_admin': ['*:*'],
  'tenant_admin': ['*:manage', '*:read', '*:write'],
  'org_admin': ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  'tech_lead': ['project:read', 'project:write', 'pipeline:*', 'deployment:execute'],
  'developer': ['project:read', 'pipeline:read', 'pipeline:write', 'pipeline:execute'],
  'sre': ['*:read', 'deployment:execute', 'environment:*'],
  'dba': ['*:read'],
  'viewer': ['*:read'],
  'auditor': ['audit_log:*', '*:read'],
};

export function usePermission() {
  const user = useAuthStore(state => state.user);
  // 注意: 用户可能有多个角色，authStore 应暴露 roles 数组（或从 JWT 解析）
  const userRoles = useMemo(() => {
    if (user?.roles && Array.isArray(user.roles)) return user.roles;
    if (user?.role) return [user.role]; // 向后兼容单角色
    return [];
  }, [user?.roles, user?.role]);

  const hasPermission = useMemo(() => {
    return (resource: string, action: string): boolean => {
      for (const role of userRoles) {
        const perms = ROLE_PERMISSIONS[role] || [];
        if (perms.includes('*:*')) return true;
        if (perms.includes(`${resource}:${action}`)) return true;
        if (perms.includes(`${resource}:*`)) return true;
        if (perms.includes(`*:${action}`)) return true;
      }
      return false;
    };
  }, [userRoles]);

  const canView = useMemo(() => (resource: string) => hasPermission(resource, 'read'), [hasPermission]);
  const canEdit = useMemo(() => (resource: string) => hasPermission(resource, 'write'), [hasPermission]);
  const canDelete = useMemo(() => (resource: string) => hasPermission(resource, 'delete'), [hasPermission]);
  const canExecute = useMemo(() => (resource: string) => hasPermission(resource, 'execute'), [hasPermission]);
  const canApprove = useMemo(() => (resource: string) => hasPermission(resource, 'approve'), [hasPermission]);

  return { hasPermission, canView, canEdit, canDelete, canExecute, canApprove };
}
```

### 9.2 使用示例

```tsx
// 页面级权限（路由守卫已处理 requiredRole）

// 按钮级权限
import { usePermission } from '@/hooks/usePermission';

function ProjectActions({ project }: { project: Project }) {
  const { canEdit, canDelete } = usePermission();

  return (
    <Space>
      {canEdit('project') && (
        <Button icon={<EditOutlined />} onClick={() => handleEdit(project)}>编辑</Button>
      )}
      {canDelete('project') && (
        <Popconfirm title="确认删除?" onConfirm={() => handleDelete(project.id)}>
          <Button danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      )}
    </Space>
  );
}

// Pipeline 操作按钮
function PipelineActions({ pipeline }: { pipeline: Pipeline }) {
  const { canExecute, canApprove } = usePermission();

  return (
    <Space>
      {canExecute('pipeline') && (
        <Button type="primary" onClick={() => triggerPipeline(pipeline.id)}>执行</Button>
      )}
      {canApprove('pipeline') && (
        <Button onClick={() => approvePipeline(pipeline.id)}>审批</Button>
      )}
    </Space>
  );
}
```

### 9.3 前端权限指令组件

```tsx
// orion-frontend/src/components/PermissionGate/index.tsx

import { usePermission } from '@/hooks/usePermission';

interface PermissionGateProps {
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  resource,
  action,
  fallback = null,
  children,
}) => {
  const { hasPermission } = usePermission();
  return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>;
};

// 使用:
// <PermissionGate resource="project" action="delete" fallback={<Button disabled>删除</Button>}>
//   <Button danger>删除</Button>
// </PermissionGate>
```

---

## 10. 各模块权限映射

### 10.1 路由保护级别

每个路由在 `routes.ts` 中已有 `requiredRole`，需升级为 `requiredPermission`:

```typescript
// 现有 (routes.ts)
{ path: '/console/settings', requiredRole: ['admin', 'platform_admin'] }

// 升级为
{ path: '/console/settings', requiredPermission: { resource: 'config', action: 'manage' } }
```

### 10.2 模块级权限需求

| 模块 | RBAC 最小角色 | ABAC 规则 | 关系检查 |
|------|-------------|-----------|----------|
| 项目管理 | `project:read` | 租户隔离 | 项目成员可见 |
| 流水线 | `pipeline:read` | 租户隔离 | 项目成员可见 |
| 流水线执行 | `pipeline:execute` | 工作时间限制 | 项目成员 |
| 生产部署 | `deployment:execute` + `deployment:approve` | 非工作时间deny + 高影响审批 | 项目成员 + tech_lead |
| 监控查看 | `*:read` 或对应模块 read | 租户隔离 | 项目成员 |
| 告警确认 | `alert:acknowledge` | 仅可确认自己负责的 | - |
| 配置查看 | `config:read` | 租户隔离 | - |
| 配置修改 | `config:write` | 生产配置需审批 | - |
| 制品查看 | `artifact:read` | 租户隔离 | 项目成员 |
| FinOps | `finops:read` | 仅看自己项目成本 | 项目成员 |
| CMDB | `cmdb:read` | 租户隔离 | - |
| 工单 | `ticket:read` | 仅看分配给自己的 | 分配检查 |
| 知识库 | `knowledge:read` | 按空间权限 | 空间成员 |
| 审计日志 | `audit_log:read` | 仅 security_admin | - |
| 租户管理 | `tenant:*` | 仅管理自己租户 | tenant_id 匹配 |
| 用户管理 | `user:*` | 租户管理员仅管理自己租户 | tenant_id 匹配 |
| IaC | `iac:*` | 生产环境需审批 | 项目成员 |
| AI Agent | `agent:*` | 租户隔离 + 成本限制 | 项目成员 |
| ChatOps | `chatops:*` | 渠道权限 | 频道成员 |
| 审批 | `approval:approve` | 仅审批员可审批 | 审批链检查 |
| Secrets | `secrets:*` | 高敏感度限制 | 项目成员 |
| Backup | `backup:execute` | 租户隔离 | - |
| OnCall | `oncall:*` | 租户隔离 | 排班成员 |

### 10.3 与现有角色矩阵的对应

来自 `docs/security/安全与权限详解.md` 的角色矩阵：

| 权限 | org_admin | tech_lead | developer | dba | sre | viewer | auditor |
|------|:---------:|:---------:|:---------:|:---:|:---:|:------:|:-------:|
| 创建流水线 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 触发流水线 | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 配置流水线 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Code Review | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Release 审批 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 生产部署审批 | ✅ | ✅* | ❌ | ❌ | ✅ | ❌ | ❌ |
| SQL 审核/执行 | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| IaC 生产审批 | ✅ | ✅* | ❌ | ❌ | ✅ | ❌ | ❌ |
| 修复执行 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 监控管理 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 查看团队效能 | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 查看个人效能 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 查看所有审计日志 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 团队管理 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 系统管理 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> * tech_lead 生产审批需 + SRE 双签

这些矩阵规则已通过第 4 节的 `BUSINESS_ROLE_PERMISSIONS` 映射实现。

> **集成注意**: 现有 `PermissionService` 的 `validActions` 列表需补充 `approve`:
> ```typescript
> // 修改前: ['read', 'write', 'execute', 'delete', 'manage', 'acknowledge', 'use']
> // 修改后: ['read', 'write', 'execute', 'delete', 'manage', 'acknowledge', 'approve', 'use']
> ```
> `seedCommonPermissions()` 中也需要补充各资源类型的 `approve` 权限定义。

---

## 11. 实施计划

### Phase P0 — 核心框架（1-2 周）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1. 创建 `AuthorizationEngine` | `src/services/authz/AuthorizationEngine.ts` | 统一评估引擎 |
| 2. 迁移 `AbacPolicyEngine` | `src/services/authz/AbacPolicyEngine.ts` | 从 API Gateway 下沉 |
| 3. 创建 `RelationshipService` | `src/services/authz/RelationshipService.ts` | 关系检查 |
| 4. 增强 `RBACService` | `src/services/role/RBACService.ts` | 角色继承 + 权限映射 |
| 5. 创建 `requirePermission` 中间件 | `src/middleware/requirePermission.ts` | 替代 `roleGuard` |
| 6. 数据库迁移 | `src/db/migrations/050_authz_unified.sql` | 新增 5 张表 |
| 7. 初始化角色默认权限 | `src/services/role/RBACService.seedRolePermissions()` | 种子数据 |
| 8. 替换项目路由为 requirePermission | `src/api/project-routes.ts` | 示例模块 |

### Phase P1 — 模块推广（2-3 周）

| 任务 | 说明 |
|------|------|
| 9. 所有路由替换 requirePermission | 替换 routes.ts 中的 registerWithRoleGuard |
| 10. Pipeline RBAC 接入 | 将 PipelineRBACService 整合到 AuthZ 引擎 |
| 11. 前端 usePermission Hook | `orion-frontend/src/hooks/usePermission.ts` |
| 12. 前端 PermissionGate 组件 | 按钮级权限控制 |
| 13. 前端路由 requiredPermission | 替换 routes.ts 中的 requiredRole |

### Phase P2 — 高级功能（2-3 周）

| 任务 | 说明 |
|------|------|
| 14. 权限审计日志面板 | 前端展示 + 越权告警 |
| 15. ABAC 策略管理 UI | 动态创建/编辑 ABAC 规则 |
| 16. 项目成员管理 | 项目级角色分配 UI |
| 17. UEBA 异常行为检测 | 基于审计日志的模式分析 |

### Phase P3 — 优化与性能

| 任务 | 说明 |
|------|------|
| 18. Redis 权限缓存 | 降低数据库查询 |
| 19. 权限预计算 | 用户登录时计算完整权限集 |
| 20. 性能基准测试 | AuthZ 评估 < 10ms |

---

## 12. 验收标准

| 维度 | 标准 | 验证方式 |
|------|------|----------|
| 功能 | 所有路由使用 requirePermission 替代 roleGuard | 代码审查 |
| 功能 | 前端按钮级权限控制生效 | 手动测试 |
| 功能 | 项目成员只能访问自己项目的资源 | 集成测试 |
| 功能 | ABAC 6 条预置策略生效 | 单元测试 |
| 功能 | 角色继承正确工作 | 单元测试 |
| 性能 | 单次 AuthZ 评估 < 10ms (P95) | 基准测试 |
| 性能 | 权限缓存命中率 > 90% | 监控指标 |
| 安全 | 无越权访问漏洞 | 渗透测试 |
| 安全 | 审计日志记录所有 deny 决策 | 日志审查 |
| 兼容 | 现有用户和角色数据无损迁移 | 迁移测试 |

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 现有路由替换量大 | 可能引入回归 bug | 分模块逐步替换 + 自动化测试 |
| 角色权限映射错误 | 用户权限过大或过小 | 双人审查 + 权限矩阵对比测试 |
| ABAC 评估性能 | 复杂规则链可能慢 | Redis 缓存 + 规则优先级短路 |
| 前端权限与后端不同步 | 按钮可见但操作被拒 | 前后端共用同一份权限映射常量 |
| 数据库迁移风险 | 新表影响现有数据 | 独立事务 + 回滚脚本 |

---

## 14. 与现有系统的集成点

| 现有组件 | 集成方式 | 变更 |
|----------|---------|------|
| `authMiddleware.ts` | 不变，JWT 验证后挂载 user | 无需变更 |
| `roleGuard.ts` | **替换**为 `requirePermission` | 保留向后兼容别名 |
| `roleRoutes.ts` | 不变，角色 CRUD | 增加 seed 接口 |
| `permissionService.ts` | **增强**，新增 `findByRoles` 批量查询 | 新增方法 |
| `PipelineRBACService.ts` | **整合**到 AuthZ 引擎 | 作为关系检查的一部分 |
| `AbacPolicyEngine.ts` (API Gateway) | **下沉**到 Platform Service | 复制并统一 |
| `RLSPolicyManager.ts` | 不变，DB 层租户隔离 | 无需变更 |
| 前端 `roleGuard` (router) | **升级**为 `requiredPermission` | 新增属性 |
| 前端 `authStore.ts` | **增强**，增加用户权限列表 | 新增字段 |

---

## 附录 A：权限常量（前后端共享）

```typescript
// src/constants/permissions.ts (后端)
// orion-frontend/src/constants/permissions.ts (前端，保持同步)

export const PERMISSIONS = {
  // Project
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  PROJECT_DELETE: 'project:delete',
  // Pipeline
  PIPELINE_READ: 'pipeline:read',
  PIPELINE_WRITE: 'pipeline:write',
  PIPELINE_EXECUTE: 'pipeline:execute',
  PIPELINE_DELETE: 'pipeline:delete',
  PIPELINE_APPROVE: 'pipeline:approve',
  // Deployment
  DEPLOYMENT_READ: 'deployment:read',
  DEPLOYMENT_WRITE: 'deployment:write',
  DEPLOYMENT_EXECUTE: 'deployment:execute',
  DEPLOYMENT_DELETE: 'deployment:delete',
  DEPLOYMENT_APPROVE: 'deployment:approve',
  // Alert
  ALERT_READ: 'alert:read',
  ALERT_WRITE: 'alert:write',
  ALERT_ACKNOWLEDGE: 'alert:acknowledge',
  ALERT_DELETE: 'alert:delete',
  // Config
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
  CONFIG_MANAGE: 'config:manage',
  // Audit
  AUDIT_READ: 'audit_log:read',
  // User
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  // Role
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  ROLE_DELETE: 'role:delete',
  // FinOps
  FINOPS_READ: 'finops:read',
  FINOPS_WRITE: 'finops:write',
  FINOPS_MANAGE: 'finops:manage',
  // CMDB
  CMDB_READ: 'cmdb:read',
  CMDB_WRITE: 'cmdb:write',
  CMDB_MANAGE: 'cmdb:manage',
  // IaC
  IAC_READ: 'iac:read',
  IAC_WRITE: 'iac:write',
  IAC_EXECUTE: 'iac:execute',
  IAC_DELETE: 'iac:delete',
  // Ticket
  TICKET_READ: 'ticket:read',
  TICKET_WRITE: 'ticket:write',
  TICKET_MANAGE: 'ticket:manage',
  // Approval
  APPROVAL_READ: 'approval:read',
  APPROVAL_APPROVE: 'approval:approve',
  APPROVAL_MANAGE: 'approval:manage',
  // Secrets
  SECRETS_READ: 'secrets:read',
  SECRETS_WRITE: 'secrets:write',
  SECRETS_DELETE: 'secrets:delete',
} as const;
```

---

## 附录 B：ABAC 规则配置示例

```json
{
  "name": "生产环境部署双签要求",
  "effect": "deny",
  "resourceType": "deployment",
  "actionType": "execute",
  "resourceConditions": {
    "condition": {
      "attribute": "resource.environment",
      "operator": "equals",
      "value": "production"
    }
  },
  "subjectConditions": {
    "and": [
      {
        "condition": {
          "attribute": "user.level",
          "operator": "in",
          "value": ["manager", "director"]
        }
      }
    ]
  },
  "environmentConditions": {
    "condition": {
      "attribute": "environment.time",
      "operator": "timeInRange",
      "value": { "startHour": 9, "endHour": 18 }
    }
  },
  "priority": 75,
  "enabled": true
}
```

---

_文档版本: v1.1 | 创建日期: 2026-05-18 | 评审日期: 2026-05-18 | 状态: 评审通过，待实施_
