# 能力配置体系设计

## 1. 设计目标

建立分层级能力配置体系（Capability System），解决两个核心场景：

1. **ChatOps 场景优先** — 控制高风险命令执行权限（如 `kubectl delete`、批量操作）
2. **全平台通用** — 覆盖所有模块的敏感操作和高级功能

设计原则：**分层级、可组合、后端校验优先、前端按需隐藏、RBAC+ABAC 之上附加**。

---

## 2. 与现有 RBAC+ABAC 授权引擎的关系

### 2.1 现有授权架构

Orion 已有完整的 **统一 RBAC+ABAC 授权引擎**（`AuthorizationEngine`，文件 `orion-platform-service/src/services/authz/AuthorizationEngine.ts`），按严格 5 步流水线评估：

```
[0]  用户状态检查     → disabled/suspended → deny
[1]  super_admin 通配 → 直接 bypass 所有后续检查
[2]  RBAC 检查        → RoleService.checkPermissions(roles, resource, action)
[2.5] Pipeline RBAC   → 仅 pipeline 资源的特例检查
[3]  ABAC 检查        → deny-only 约束（租户隔离、工作时间、跨部门等 6 条预置策略）
[4]  关系检查         → owner / project member
[5]  全部通过         → allow
```

- **RBAC** 是门禁（能不能进入）
- **ABAC** 是安全网（进入后有没有额外约束，deny-only 模式）
- **Deny 优先**，任意一层拒绝即最终拒绝
- `super_admin` 在第 [1] 步直接 bypass

### 2.2 能力配置体系的定位

**Capability 不是替代 RBAC，而是 RBAC 之上的操作级附加层。**

| 维度 | RBAC 管什么 | Capability 管什么 | ABAC 管什么 |
|------|-----------|-----------------|-----------|
| 问题 | "能不能访问这个资源" | "能不能执行这个操作" | "在什么条件下可以操作" |
| 粒度 | `resource:action`（如 `pipeline:execute`） | 操作级（如 `bulk_operations.restart`） | 属性约束（如时间、网络、租户） |
| 层级 | 扁平 | 树状（父子继承） | 规则表达式 |
| 风险 | 无 | 4 级风险分级 + 审批绑定 | deny 规则 |
| 覆盖 | 角色级 | 角色级 + 用户级临时覆盖 | 策略级 |
| 示例 | `developer` 有 `pipeline:execute` | 但未必能执行 `bulk_operations.rollback` | 且只能在 9-18 点执行 |

**三者在 AuthorizationEngine 中的关系**：

```
请求到达
  │
  ├─ [0] 用户状态检查（现有）
  ├─ [1] super_admin bypass（现有）
  ├─ [2] RBAC 检查（现有）→ denied → 403
  │
  ├─ [2.1] Capability 检查（新增）→ denied → 403 "需要额外能力授权"
  │
  ├─ [2.5] Pipeline RBAC（现有）
  ├─ [3]  ABAC 检查（现有）→ denied → 403
  ├─ [4]  关系检查（现有）→ denied → 403
  │
  └─ [5] 全部通过 → allow
```

**关键设计决策**：

- **能力 ≠ 权限** — 权限（Permission）控制资源访问，能力（Capability）控制操作执行
- **Capability 在 RBAC 之后、ABAC 之前** — 先确认你能访问资源，再确认你能执行操作，最后确认条件是否满足
- **用户级覆盖** — 管理员可以为特定用户临时授予/撤销能力，不改变角色本身
- **复用现有基础设施** — CapabilityEngine 复用现有的 `PermissionAuditRepository`、`PermissionCache`、`UEBAEngine`

---

## 3. 架构分层

```
┌──────────────────────────────────────────────────────────────────┐
│  UI 展示层                                                        │
│  PermissionGate / CapabilityGate 组件 / 条件渲染 / 按钮禁用         │
│  → 根据 capability 列表显示/隐藏功能                               │
├──────────────────────────────────────────────────────────────────┤
│  前端能力层                                                        │
│  CapabilityStore (has('chatops_advanced.command.kubectl_delete'))  │
│  → 缓存自 GET /api/v1/authz/capabilities                           │
├──────────────────────────────────────────────────────────────────┤
│  后端授权层（统一 AuthorizationEngine）                              │
│  [0]  用户状态                                                     │
│  [1]  super_admin bypass                                          │
│  [2]  RBAC（RoleService）                                         │
│  [2.1] Capability（CapabilityEngine）← 新增步骤                    │
│  [2.5] Pipeline RBAC（PipelineRBACService）                       │
│  [3]  ABAC（AbacPolicyEngine, deny-only）                         │
│  [4]  关系检查（RelationshipService）                              │
│  → deny 优先，任何一层拒绝即拒绝                                     │
├──────────────────────────────────────────────────────────────────┤
│  数据层                                                           │
│  capabilities (DB) + role_capabilities (DB) + user_overrides (DB) │
│  → 复用现有的 roles/permissions/audit 基础设施                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 能力层级设计（方案 C：分层级）

### 3.1 能力结构

```
Capability
├── id: string          // 唯一标识，如 "chatops_advanced"
├── name: string        // 显示名称，如 "ChatOps 高级操作"
├── description: string
├── category: string    // 分类：chatops / bulk / analytics / sensitive / system
├── riskLevel: number   // 风险等级：1=低，2=中，3=高，4=极高
├── requiresApproval: boolean  // 是否需要审批
├── children: Capability[]     // 子能力
└── defaultRoles: string[]     // 默认拥有此能力的角色
```

### 3.2 能力树（共 13 个顶级能力，48 个子能力）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            一、ChatOps 能力 (chatops)                        │
├─────────────────────────────────────────────────────────────────────────────┤
chatops_advanced (风险3)
├── chatops_advanced.command.kubectl (风险3)
│   ├── chatops_advanced.command.kubectl.get (风险1)         -- 查看资源
│   ├── chatops_advanced.command.kubectl.describe (风险1)    -- 资源详情
│   ├── chatops_advanced.command.kubectl.logs (风险2)        -- 查看日志
│   ├── chatops_advanced.command.kubectl.restart (风险3)     -- 重启 Pod
│   ├── chatops_advanced.command.kubectl.scale (风险3)       -- 扩缩容
│   ├── chatops_advanced.command.kubectl.exec (风险3)        -- exec 进入容器
│   ├── chatops_advanced.command.kubectl.debug (风险2)       -- 调试终端
│   └── chatops_advanced.command.kubectl.delete (风险4)      -- 删除资源
├── chatops_advanced.command.deploy (风险3)
│   ├── chatops_advanced.command.deploy.preview (风险1)      -- 预览部署
│   ├── chatops_advanced.command.deploy.staging (风险2)      -- 部署到预发
│   └── chatops_advanced.command.deploy.production (风险4)   -- 部署到生产
└── chatops_advanced.command.custom (风险2)                  -- 自定义命令

chatops_command_create (风险3)
├── chatops_command_create.draft (风险1)                     -- 草稿命令
├── chatops_command_create.publish (风险3)                   -- 发布命令
└── chatops_command_create.approve (风险3)                   -- 审批命令

┌─────────────────────────────────────────────────────────────────────────────┐
│                            二、运维操作能力 (infrastructure)                  │
├─────────────────────────────────────────────────────────────────────────────┤
infrastructure_operations (风险3)
├── infrastructure_operations.env_create (风险3)            -- 创建环境
├── infrastructure_operations.env_destroy (风险4)            -- 销毁环境
├── infrastructure_operations.env_config (风险3)             -- 环境配置变更
├── infrastructure_operations.temp_env_create (风险2)        -- 创建临时环境
├── infrastructure_operations.secret_view (风险3)            -- 查看 Secret
├── infrastructure_operations.secret_write (风险4)           -- 修改 Secret
├── infrastructure_operations.config_view (风险1)            -- 查看 ConfigMap
└── infrastructure_operations.config_write (风险3)           -- 修改 ConfigMap

┌─────────────────────────────────────────────────────────────────────────────┐
│                            三、交付操作能力 (delivery)                        │
├─────────────────────────────────────────────────────────────────────────────┤
delivery_operations (风险3)
├── delivery_operations.pipeline_create (风险2)             -- 创建流水线
├── delivery_operations.pipeline_delete (风险4)              -- 删除流水线
├── delivery_operations.pipeline_trigger (风险2)             -- 手动触发流水线
├── delivery_operations.pipeline_edit (风险2)                -- 编辑流水线
├── delivery_operations.artifact_delete (风险4)              -- 删除制品
├── delivery_operations.version_rollback (风险3)             -- 版本回滚
└── delivery_operations.version_promote (风险2)              -- 版本 promotion

┌─────────────────────────────────────────────────────────────────────────────┐
│                            四、批量操作能力 (bulk)                            │
├─────────────────────────────────────────────────────────────────────────────┤
bulk_operations (风险3)
├── bulk_operations.restart (风险3)                         -- 批量重启
├── bulk_operations.deploy (风险3)                          -- 批量部署
├── bulk_operations.rollback (风险4)                        -- 批量回滚
└── bulk_operations.delete (风险4)                          -- 批量删除

┌─────────────────────────────────────────────────────────────────────────────┐
│                            五、备份回滚能力 (backup)     【新增】             │
├─────────────────────────────────────────────────────────────────────────────┤
backup_operations (风险3)
├── backup_operations.create (风险3)                        -- 创建备份
├── backup_operations.restore (风险4)                       -- 执行恢复
├── backup_operations.schedule (风险3)                      -- 备份计划管理
├── backup_operations.delete (风险4)                        -- 删除备份
└── backup_operations.verify (风险2)                        -- 备份验证

disaster_recovery (风险4)
├── disaster_recovery.plan_create (风险3)                   -- 创建灾备计划
├── disaster_recovery.plan_execute (风险4)                  -- 执行灾备切换
├── disaster_recovery.plan_test (风险3)                     -- 灾备演练
└── disaster_recovery.failback (风险4)                      -- 故障恢复

┌─────────────────────────────────────────────────────────────────────────────┐
│                            六、用户权限能力 (user)                            │
├─────────────────────────────────────────────────────────────────────────────┤
user_management (风险3)
├── user_management.user_disable (风险3)                    -- 禁用用户
├── user_management.user_enable (风险2)                     -- 启用用户
├── user_management.user_create (风险2)                     -- 创建用户
├── user_management.role_assign (风险3)                     -- 分配角色
├── user_management.role_revoke (风险3)                     -- 撤销角色
└── user_management.bulk_import (风险2)                     -- 批量导入用户

┌─────────────────────────────────────────────────────────────────────────────┐
│                            七、分析能力 (analytics)                          │
├─────────────────────────────────────────────────────────────────────────────┤
advanced_analytics (风险1)
├── advanced_analytics.view_dashboard (风险1)               -- 查看仪表盘
├── advanced_analytics.export_report (风险2)                -- 导出报表
└── advanced_analytics.custom_dimension (风险2)             -- 自定义分析维度

┌─────────────────────────────────────────────────────────────────────────────┐
│                            八、审计合规能力 (audit)                          │
├─────────────────────────────────────────────────────────────────────────────┤
audit_management (风险2)
├── audit_management.view (风险2)                           -- 查看审计日志
├── audit_management.export (风险2)                         -- 导出审计日志
├── audit_management.config (风险2)                         -- 审计配置修改
└── audit_management.compliance_report (风险2)              -- 合规报告生成

┌─────────────────────────────────────────────────────────────────────────────┐
│                            九、系统配置能力 (system)                          │
├─────────────────────────────────────────────────────────────────────────────┤
system_config (风险3)
├── system_config.read (风险1)                              -- 查看系统配置
├── system_config.write (风险3)                             -- 修改系统配置
├── system_config.delete (风险4)                            -- 删除系统配置
├── system_config.webhook_manage (风险3)                    -- Webhook 管理
└── system_config.notification_manage (风险3)               -- 通知渠道管理

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十、生态扩展能力 (ecosystem)                       │
├─────────────────────────────────────────────────────────────────────────────┤
ecosystem_operations (风险3)
├── ecosystem_operations.plugin_install (风险4)             -- 安装插件
├── ecosystem_operations.plugin_uninstall (风险4)           -- 卸载插件
├── ecosystem_operations.plugin_config (风险3)              -- 插件配置
├── ecosystem_operations.skill_publish (风险3)              -- Skill 发布
├── ecosystem_operations.skill_unpublish (风险3)            -- Skill 下架
└── ecosystem_operations.skill_approve (风险3)              -- Skill 审批

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十一、敏感操作能力 (sensitive)                     │
├─────────────────────────────────────────────────────────────────────────────┤
sensitive_operations (风险4)
├── sensitive_operations.project_delete (风险4)             -- 删除项目
├── sensitive_operations.environment_destroy (风险4)        -- 销毁环境
├── sensitive_operations.data_wipe (风险4)                  -- 清空数据
├── sensitive_operations.approval_bypass (风险4)            -- 绕过审批
└── sensitive_operations.critical_config (风险4)            -- 关键配置修改

┌─────────────────────────────────────────────────────────────────────────────┐
│                            十二、跨域能力 (cross_domain)                      │
├─────────────────────────────────────────────────────────────────────────────┤
cross_tenant (风险4)
└── cross_tenant.access (风险4)                             -- 跨租户访问

org_access (风险3)
├── org_access.view_other_dept (风险2)                      -- 查看其他部门
└── org_access.operate_other_dept (风险4)                   -- 操作其他部门资源
```

### 3.3 风险等级与审批

| 风险等级 | 说明 | 典型操作 | 默认行为 |
|---------|------|---------|---------|
| 1 | 低风险（只读、查看） | 查看资源、查看仪表盘、预览部署 | 默认开放，无需审批 |
| 2 | 中风险（信息获取、触发） | 查看日志、导出报表、手动触发、环境创建 | 默认开放，记录审计日志 |
| 3 | 高风险（变更、配置） | 重启服务、修改配置、创建流水线、发布 Skill | 需要能力 + 操作确认 |
| 4 | 极高风险（破坏、越权） | 删除、销毁、回滚、跨租户、绕过审批 | 需要能力 + 审批流 + 双人确认 |

### 3.4 能力统计

| 顶级能力 | 风险 | 子能力数 | 管控入口 |
|---------|------|---------|---------|
| chatops_advanced | 3 | 11 | ChatOps 对话界面 |
| chatops_command_create | 3 | 3 | ChatOps 设置页 |
| infrastructure_operations | 3 | 8 | 环境管理、配置中心 |
| delivery_operations | 3 | 7 | 流水线管理、制品管理 |
| bulk_operations | 3 | 4 | 批量操作入口 |
| backup_operations | 3 | 5 | 备份管理、灾备中心 |
| disaster_recovery | 4 | 4 | 灾备管理 |
| user_management | 3 | 6 | 用户管理 |
| advanced_analytics | 1 | 3 | 数据看板 |
| audit_management | 2 | 4 | 审计日志 |
| system_config | 3 | 5 | 系统配置 |
| ecosystem_operations | 3 | 6 | 插件管理、Skill 市场 |
| sensitive_operations | 4 | 5 | 敏感操作确认弹窗 |
| cross_tenant | 4 | 1 | 跨租户切换器 |
| org_access | 3 | 2 | 组织架构管理 |

**总计**：15 个顶级能力，74 个子能力，覆盖 Orion 核心模块的完整操作管控。

---

## 4. 数据库设计

### 4.1 新增表

```sql
-- 能力定义表
CREATE TABLE capabilities (
    id VARCHAR(64) PRIMARY KEY,                          -- 'chatops_advanced.command.kubectl.delete'
    name VARCHAR(128) NOT NULL,                          -- 'Kubernetes 删除操作'
    description TEXT,
    category VARCHAR(32) NOT NULL,                       -- 'chatops', 'bulk', 'analytics', 'sensitive', 'system'
    risk_level INTEGER NOT NULL DEFAULT 1,              -- 1-4
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    parent_id VARCHAR(64) REFERENCES capabilities(id),   -- 父能力，NULL 表示顶级
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 角色能力关联表
CREATE TABLE role_capabilities (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    capability_id VARCHAR(64) NOT NULL REFERENCES capabilities(id),
    granted BOOLEAN NOT NULL DEFAULT true,               -- true=授予，false=显式拒绝（覆盖继承）
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(role_id, capability_id)
);

-- 用户能力覆盖表（针对特定用户单独调整）
CREATE TABLE user_capability_overrides (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    capability_id VARCHAR(64) NOT NULL REFERENCES capabilities(id),
    granted BOOLEAN NOT NULL,                            -- true=额外授予，false=强制撤销
    reason TEXT,
    granted_by BIGINT REFERENCES users(id),              -- 谁授予的
    expires_at TIMESTAMP,                                -- 临时权限过期时间
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(user_id, capability_id)
);

-- 能力使用审计日志
CREATE TABLE capability_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    capability_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,                         -- 'check', 'grant', 'revoke', 'execute'
    resource_type VARCHAR(32),
    resource_id VARCHAR(64),
    result VARCHAR(16),                                  -- 'allowed', 'denied', 'pending_approval'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_capabilities_category ON capabilities(category);
CREATE INDEX idx_capabilities_parent ON capabilities(parent_id);
CREATE INDEX idx_capabilities_risk ON capabilities(risk_level);
CREATE INDEX idx_role_capabilities_role ON role_capabilities(role_id);
CREATE INDEX idx_user_capability_overrides_user ON user_capability_overrides(user_id);
CREATE INDEX idx_user_capability_overrides_expires ON user_capability_overrides(expires_at);
CREATE INDEX idx_capability_audit_logs_user ON capability_audit_logs(user_id);
CREATE INDEX idx_capability_audit_logs_created ON capability_audit_logs(created_at);
```

### 4.2 数据迁移策略

1. 从现有 `permissions` 表推导能力种子数据
2. 按角色默认权限映射初始 `role_capabilities`
3. 高风险能力（risk_level >= 3）仅授予 `super_admin`、`platform_admin`、`sre`

---

## 5. 后端实现

### 5.1 CapabilityEngine

```typescript
// orion-platform-service/src/services/authz/CapabilityEngine.ts

interface CapabilityCheck {
  userId: string;
  capabilityId: string;
  resource?: { type: string; id: string };
  context?: Record<string, unknown>;
}

interface CapabilityResult {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  riskLevel: number;
}

class CapabilityEngine {
  // 检查用户是否拥有指定能力
  async check(request: CapabilityCheck): Promise<CapabilityResult>

  // 获取用户所有能力（含继承、覆盖）
  async getUserCapabilities(userId: string): Promise<CapabilityInfo[]>

  // 授予/撤销能力
  async grantCapability(userId: string, capabilityId: string, options: GrantOptions): Promise<void>
  async revokeCapability(userId: string, capabilityId: string): Promise<void>
}
```

### 5.2 评估流程（嵌入 AuthorizationEngine）

Capability 检查在 AuthorizationEngine 的步骤 [2.1] 执行：

```
AuthorizationEngine.evaluate()
  │
  ├─ [0] 用户状态检查
  ├─ [1] super_admin bypass → 直接 allow（Capability 也被 bypass）
  ├─ [2] RBAC 检查
  │     └─ denied → 403（不进入 Capability 检查）
  │
  ├─ [2.1] Capability 检查 ← 本系统
  │     │
  │     ├─ a. 检查用户状态
  │     │
  │     ├─ b. 检查用户级覆盖（user_capability_overrides）
  │     │     ├─ 显式撤销 (expires_at 未过期) → DENY
  │     │     └─ 显式授予 (expires_at 未过期) → ALLOW（跳过后续角色检查）
  │     │
  │     ├─ c. 检查角色能力（role_capabilities）
  │     │     ├─ 角色显式授予 → ALLOW
  │     │     └─ 角色显式拒绝 (granted=false) → DENY
  │     │
  │     ├─ d. 检查能力继承
  │     │     └─ 父能力已授予且子能力未显式拒绝 → ALLOW
  │     │
  │     └─ e. 无匹配 → DENY（不阻断，继续走 ABAC）
  │
  ├─ [2.5] Pipeline RBAC（现有，仅 pipeline 资源）
  ├─ [3]  ABAC（现有，deny-only 约束）
  ├─ [4]  关系检查（现有）
  └─ [5]  全部通过 → allow
```

**与现有系统的集成点**：

| 现有组件 | 集成方式 |
|---------|---------|
| `PermissionCache` | Capability 决策结果也缓存（Redis，TTL 300s，仅缓存 allow） |
| `PermissionAuditRepository` | Capability 检查写入同一审计表，增加 `check_type: 'capability'` 字段 |
| `UEBAEngine` | 异常能力使用（如非常规时间执行高风险操作）触发告警 |
| `requirePermission` 中间件 | 新增 `requireCapability` 中间件，用法类似 |

### 5.3 API 端点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| `GET` | `/api/v1/authz/capabilities` | 获取当前用户能力列表 | 已认证用户 |
| `GET` | `/api/v1/authz/capabilities/:id` | 查看能力详情 | system_config:read |
| `POST` | `/api/v1/authz/capabilities` | 创建新能力 | system_config:write |
| `PATCH` | `/api/v1/authz/capabilities/:id` | 修改能力配置 | system_config:write |
| `GET` | `/api/v1/authz/capabilities/tree` | 获取完整能力树 | system_config:read |
| `POST` | `/api/v1/authz/capabilities/check` | 检查用户能力 | 内部调用 |
| `POST` | `/api/v1/authz/roles/:roleId/capabilities` | 为角色授予能力 | system_config:write |
| `DELETE` | `/api/v1/authz/roles/:roleId/capabilities/:capId` | 撤销角色能力 | system_config:write |
| `POST` | `/api/v1/authz/users/:userId/capabilities` | 为用户添加能力覆盖 | system_config:write |
| `DELETE` | `/api/v1/authz/users/:userId/capabilities/:capId` | 撤销用户能力覆盖 | system_config:write |
| `GET` | `/api/v1/authz/capabilities/audit` | 查看能力使用审计日志 | audit_full |

---

## 6. 前端实现

### 6.1 CapabilityStore

```typescript
// orion-frontend/src/stores/capabilityStore.ts

interface CapabilityState {
  capabilities: Map<string, CapabilityInfo>;
  loaded: boolean;

  has: (id: string) => boolean;                    // 检查单一能力
  hasAny: (ids: string[]) => boolean;              // 任一满足
  hasAll: (ids: string[]) => boolean;              // 全部满足
  getByCategory: (category: string) => CapabilityInfo[];
  getByRiskLevel: (level: number) => CapabilityInfo[];
  loadCapabilities: () => Promise<void>;            // 从后端拉取
}
```

### 6.2 CapabilityGate 组件

```tsx
<CapabilityGate id="chatops_advanced.command.kubectl.delete">
  <Button danger onClick={handleDelete}>删除 Pod</Button>
</CapabilityGate>

<CapabilityGate id="advanced_analytics.export_report" fallback={<Tooltip title="需要导出权限">...</Tooltip>}>
  <Button icon={<ExportOutlined />}>导出报表</Button>
</CapabilityGate>
```

### 6.3 前端初始化流程

```
App 启动
  │
  ├─ 用户认证成功
  │
  ├─ 调用 GET /api/v1/authz/capabilities
  │
  ├─ 存入 CapabilityStore
  │
  └─ 组件根据能力显示/隐藏功能
```

---

## 7. ChatOps 集成（优先级最高）

### 7.1 ChatOps 命令级别能力映射

| 命令模式 | 能力要求 | 风险等级 | 审批 |
|---------|---------|---------|------|
| `kubectl get/describe` | `chatops_advanced.command.kubectl.get` | 1 | 否 |
| `kubectl logs` | `chatops_advanced.command.kubectl.logs` | 2 | 否 |
| `kubectl restart` | `chatops_advanced.command.kubectl.restart` | 3 | 是 |
| `kubectl scale` | `chatops_advanced.command.kubectl.scale` | 3 | 是 |
| `kubectl delete` | `chatops_advanced.command.kubectl.delete` | 4 | 是 + 双人确认 |
| `deploy preview` | `chatops_advanced.command.deploy.preview` | 1 | 否 |
| `deploy staging` | `chatops_advanced.command.deploy.staging` | 2 | 否 |
| `deploy production` | `chatops_advanced.command.deploy.production` | 4 | 是 + 审批流 |
| 自定义命令创建 | `chatops_command_create.publish` | 3 | 是 |

### 7.2 ChatOps 执行流程改造

```
用户发送消息
  │
  ├─ 意图识别
  │
  ├─ 命令解析 → 映射到 capabilityId
  │
  ├─ CapabilityEngine.check(userId, capabilityId)
  │    ├─ denied → 返回 "您没有权限执行此操作"
  │    ├─ allowed, requiresApproval=true → 创建审批单
  │    └─ allowed → 执行命令
  │
  └─ 记录 capability_audit_logs
```

---

## 8. 实施计划

### Phase 1：基础能力（1-2周）
- [ ] 数据库迁移（capabilities / role_capabilities / user_capability_overrides 表）
- [ ] CapabilityEngine 核心逻辑（嵌入 AuthorizationEngine [2.1] 步骤）
- [ ] `requireCapability` 中间件（复用 requirePermission 模式）
- [ ] `/api/v1/authz/capabilities` 接口
- [ ] 复用 PermissionCache 和 PermissionAuditRepository
- [ ] 前端 CapabilityStore + CapabilityGate

### Phase 2：ChatOps 集成（1周）
- [ ] ChatOps 命令到能力映射
- [ ] ChatOps 执行流程接入能力检查
- [ ] 审批流集成（高风险命令）

### Phase 3：管理与审计（1周）
- [ ] 能力管理页面（CRUD + 角色分配）
- [ ] 用户能力覆盖管理
- [ ] 能力使用审计日志查询

### Phase 4：全平台推广（按需）
- [ ] 敏感操作接入能力检查
- [ ] 批量操作接入能力检查
- [ ] 分析高级功能接入能力检查

---

## 9. 与现有系统的集成细节

### 9.1 路由中间件

```typescript
// 新增 requireCapability 中间件，用法与 requirePermission 一致
import { requireCapability } from './middleware/requireCapability';

app.delete('/api/v1/resources/:id', {
  onRequest: [
    requirePermission({ resource: 'resource', action: 'delete' }),  // RBAC 先检查
    requireCapability('sensitive_operations.resource_delete'),      // Capability 再检查
  ],
}, handler);
```

### 9.2 ChatOps 集成

ChatOps 的 `ToolExecutor` 在执行前调用 Capability 检查：

```typescript
// orion-ai-svc/src/services/ToolExecutor.ts
const capResult = await capabilityEngine.check({
  userId: request.userId,
  capabilityId: commandToCapabilityMap[command],
  resource: { type: 'chatops_command', id: command },
});

if (!capResult.allowed) {
  return { success: false, error: capResult.reason };
}
if (capResult.requiresApproval) {
  return createApprovalRequest(capResult);
}
// 执行命令
```

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Capability 与 RBAC/ABAC 评估顺序混乱 | 行为不一致 | 严格定义评估顺序：RBAC → Capability → ABAC，deny 优先 |
| 能力树过深导致性能问题 | 检查延迟 | Redis 缓存 + 扁平化索引（capability_id → 直接 lookup） |
| 前端能力列表泄露信息 | 安全风险 | 仅返回 granted 的能力，不返回完整树 |
| 与现有权限系统冲突 | 行为不一致 | Capability 作为 RBAC 之上的附加层，不修改 RBAC 逻辑 |
| 大量能力配置迁移 | 实施成本 | 分阶段迁移，先覆盖高风险操作 |
| user_override 过期未清理 | 权限泄漏 | 定时任务扫描 expires_at，自动失效 + 审计记录 |
