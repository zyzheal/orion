# 能力配置体系设计

## 1. 设计目标

建立分层级能力配置体系（Capability System），解决两个核心场景：

1. **ChatOps 场景优先** — 控制高风险命令执行权限（如 `kubectl delete`、批量操作）
2. **全平台通用** — 覆盖所有模块的敏感操作和高级功能

设计原则：**分层级、可组合、后端校验优先、前端按需隐藏**。

---

## 2. 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  UI 展示层                                                │
│  PermissionGate 组件 / 条件渲染 / 按钮禁用                 │
│  → 根据 capability 列表显示/隐藏功能                       │
├─────────────────────────────────────────────────────────┤
│  前端能力层                                                │
│  CapabilityChecker (has('chatops_advanced.command.kubectl_delete')) │
│  → 缓存自 /api/v1/authz/capabilities                       │
├─────────────────────────────────────────────────────────┤
│  后端授权层（统一决策）                                      │
│  CapabilityEngine → RBAC + ABAC + 能力映射                │
│  → deny 优先，任何一层拒绝即拒绝                           │
├─────────────────────────────────────────────────────────┤
│  数据层                                                   │
│  role_capabilities (DB) + system_capabilities (DB seed)  │
│  → 支持角色级能力继承 + 用户级能力覆盖                      │
└─────────────────────────────────────────────────────────┘
```

**关键设计决策**：

- **能力 ≠ 权限** — 权限（Permission）控制资源访问，能力（Capability）控制操作执行。权限是 `能不能看到`，能力是 `能不能执行`。
- **deny 优先** — 任何一层拒绝即拒绝，即使上层有权限。
- **用户级覆盖** — 管理员可以为特定用户临时授予/撤销能力，不改变角色本身。

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

### 3.2 能力树

```
chatops_advanced (风险3)
├── chatops_advanced.command.kubectl (风险3)
│   ├── chatops_advanced.command.kubectl.get (风险1)
│   ├── chatops_advanced.command.kubectl.describe (风险1)
│   ├── chatops_advanced.command.kubectl.logs (风险2)
│   ├── chatops_advanced.command.kubectl.restart (风险3)
│   ├── chatops_advanced.command.kubectl.scale (风险3)
│   └── chatops_advanced.command.kubectl.delete (风险4)
├── chatops_advanced.command.deploy (风险3)
│   ├── chatops_advanced.command.deploy.preview (风险1)
│   ├── chatops_advanced.command.deploy.staging (风险2)
│   └── chatops_advanced.command.deploy.production (风险4)
└── chatops_advanced.command.custom (风险2)

bulk_operations (风险3)
├── bulk_operations.restart (风险3)
├── bulk_operations.deploy (风险3)
├── bulk_operations.rollback (风险4)
└── bulk_operations.delete (风险4)

advanced_analytics (风险1)
├── advanced_analytics.view_dashboard (风险1)
├── advanced_analytics.export_report (风险2)
└── advanced_analytics.custom_dimension (风险2)

sensitive_operations (风险4)
├── sensitive_operations.project_delete (风险4)
├── sensitive_operations.environment_destroy (风险4)
├── sensitive_operations.data_wipe (风险4)
└── sensitive_operations.approval_bypass (风险4)

system_config (风险3)
├── system_config.read (风险1)
├── system_config.write (风险3)
└── system_config.delete (风险4)

chatops_command_create (风险3)
├── chatops_command_create.draft (风险1)
├── chatops_command_create.publish (风险3)
└── chatops_command_create.approve (风险3)

audit_full (风险2)
├── audit_full.view (风险2)
└── audit_full.export (风险2)

cross_tenant (风险4)
└── cross_tenant.access (风险4)
```

### 3.3 风险等级与审批

| 风险等级 | 说明 | 默认行为 |
|---------|------|---------|
| 1 | 低风险（查看、只读） | 默认开放，无需审批 |
| 2 | 中风险（导出、预览部署） | 默认开放，记录审计日志 |
| 3 | 高风险（重启、修改配置） | 需要能力 + 操作确认 |
| 4 | 极高风险（删除、销毁、越权） | 需要能力 + 审批流 + 双人确认 |

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

### 5.2 评估流程

```
check(userId, capabilityId)
  │
  ├─ 1. 检查用户状态 (disabled/suspended → DENY)
  │
  ├─ 2. 检查用户级覆盖
  │    ├─ 显式撤销 (且未过期) → DENY
  │    └─ 显式授予 (且未过期) → ALLOW
  │
  ├─ 3. 检查角色能力
  │    ├─ 角色显式授予 → ALLOW
  │    └─ 角色显式拒绝 → DENY
  │
  ├─ 4. 检查能力继承
  │    ├─ 父能力已授予且子能力未显式拒绝 → ALLOW
  │    └─ 无匹配 → DENY
  │
  └─ 5. 检查 ABAC 策略
       ├─ deny 规则匹配 → DENY
       └─ 无拒绝 → ALLOW
```

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
- [ ] 数据库迁移（capabilities / role_capabilities 表）
- [ ] CapabilityEngine 核心逻辑
- [ ] `/api/v1/authz/capabilities` 接口
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

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 能力树过深导致性能问题 | 检查延迟 | Redis 缓存 + 扁平化索引 |
| 前端能力列表泄露信息 | 安全风险 | 仅返回 granted 的能力，不返回完整树 |
| 与现有权限系统冲突 | 行为不一致 | 能力层作为 RBAC 之上的附加层，deny 优先 |
| 大量能力配置迁移 | 实施成本 | 分阶段迁移，先覆盖高风险操作 |
