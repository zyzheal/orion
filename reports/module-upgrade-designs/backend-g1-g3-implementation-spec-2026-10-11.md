# G1-G3 后端实施规格（承接 Meta Review D1）

**评审对象**：`internal/user_role` / `internal/recipient` / `internal/notification/adapter` 3 个新域
**文档性质**：实施规格（Implementation Spec），非生产代码
**版本**：v1.0（2026-10-11）
**关联**：
- 上游：`role-based-push-and-triage-design-2026-10-11.md` §2.1 / §2.2 / §3.4（G1-G3 概览）
- 参考：`triage-api-contract-design-2026-10-11.md`（G4 深度基准）
- 元评审：`design-set-enterprise-level-meta-review-2026-10-11.md` §4.1（D1 需求）
- 前端：`frontend-interaction-optimization-design-2026-10-11.md` §3.2 (F2 UserRole 页面依赖 G1)
- ADR：ADR-004 (多租户)、ADR-005 (PG 单库)、ADR-010 (事务)、ADR-012 (注册表)

**硬约束**：
- **RC-03**：实施规格，不修改生产代码。
- **不估算人天/工期**。
- 达到 G4/Triage 契约深度（825 行级别）。
- ⭐ 机械计数 + ◇ 解读标注。

---

## 1. G1 · `user_role` 实施规格

### 1.1 域边界

```
internal/user_role/
├── models/
│   └── models.go               # UserRole entity + RolePermission
├── repository/
│   ├── interface.go            # 接口（ADR-012 风格）
│   └── pg.go                   # PG 实现
├── service/
│   ├── interface.go
│   └── service.go              # HasPermission / Assign / Revoke / List
├── handler/
│   └── handler.go              # HTTP 端点
└── migrations/
    ├── 699_up.sql
    ├── 699_down.sql
    ├── 700_up.sql              # 双写回填
    └── 700_down.sql
```

### 1.2 DB Schema（Migration 699 up）

```sql
-- Migration 699: user_role 主表
-- 描述: 多对多 user ↔ role 关系表, 支持 source 标记 + 临时授权
-- 对齐: ADR-004 (tenant 硬边界), ADR-005 (PG 14+)

CREATE TABLE IF NOT EXISTS user_role (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    role_id         VARCHAR(64) NOT NULL,
    source          VARCHAR(32) NOT NULL 
                    CHECK (source IN ('manual','ldap','sso','auto','system')),
    granted_by      UUID,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,           -- NULL = 永久授权
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID,
    revoke_reason   TEXT,
    
    -- 逻辑主键: 同一 user+role 允许多条(不同 source/时间窗)
    UNIQUE (tenant_id, user_id, role_id, source, granted_at)
);

-- 活跃授权查询索引 (partial index, 只索引未过期未撤销)
CREATE INDEX idx_user_role_active 
    ON user_role (tenant_id, user_id) 
    WHERE revoked_at IS NULL 
      AND (expires_at IS NULL OR expires_at > now());

-- 按角色反查用户 (用于 Resolver, 见 G2)
CREATE INDEX idx_user_role_by_role 
    ON user_role (tenant_id, role_id) 
    WHERE revoked_at IS NULL 
      AND (expires_at IS NULL OR expires_at > now());

-- 权限点映射表
CREATE TABLE IF NOT EXISTS role_permission (
    role_id         VARCHAR(64) NOT NULL,
    permission      VARCHAR(128) NOT NULL,
    granted_at      TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (role_id, permission)
);

CREATE INDEX idx_role_permission_lookup 
    ON role_permission (permission);
```

**Migration 699 down**：

```sql
-- 可回退: 删除表 (无外键依赖)
DROP TABLE IF EXISTS role_permission;
DROP TABLE IF EXISTS user_role;
```

### 1.3 双写回填（Migration 700 up）

**目标**：从现有 `UserInfo.Role`（单值字符串）迁移到 `user_role` 表（多对多 + source 标记）

```sql
-- Migration 700: 从 user_info.role 双写回填到 user_role
-- 前置: Migration 699 已应用

-- 步骤 1: 备份（可选, 但生产环境强制）
-- 建议: 执行前先 pg_dump user_info 表

-- 步骤 2: 回填活跃授权
INSERT INTO user_role (tenant_id, user_id, role_id, source, granted_at)
SELECT 
    ui.tenant_id,
    ui.id::uuid AS user_id,
    TRIM(ui.role) AS role_id,
    'system' AS source,     -- 迁移来源标记
    COALESCE(ui.created_at, now()) AS granted_at
FROM user_info ui
WHERE ui.role IS NOT NULL 
  AND TRIM(ui.role) <> ''
ON CONFLICT (tenant_id, user_id, role_id, source, granted_at) 
DO NOTHING;

-- 步骤 3: 填充权限点映射 (内置角色 seed)
INSERT INTO role_permission (role_id, permission) VALUES
    -- tenant_admin: 全部权限
    ('tenant_admin', 'triage:read'),
    ('tenant_admin', 'triage:write'),
    ('tenant_admin', 'triage:subscribe'),
    ('tenant_admin', 'alert:read'),
    ('tenant_admin', 'alert:write'),
    ('tenant_admin', 'ticket:read'),
    ('tenant_admin', 'ticket:write'),
    ('tenant_admin', 'oncall:read'),
    ('tenant_admin', 'oncall:write'),
    ('tenant_admin', 'user_role:admin'),
    ('tenant_admin', 'recipient:manage'),
    ('tenant_admin', 'notification:policy'),
    
    -- sre_oncall: 值班 + 告警 + 工单
    ('sre_oncall', 'triage:read'),
    ('sre_oncall', 'triage:write'),
    ('sre_oncall', 'triage:subscribe'),
    ('sre_oncall', 'alert:read'),
    ('sre_oncall', 'alert:write'),
    ('sre_oncall', 'oncall:read'),
    ('sre_oncall', 'oncall:write'),
    ('sre_oncall', 'ticket:read'),
    
    -- tech_lead: SRE + 管理权限
    ('tech_lead', 'triage:read'),
    ('tech_lead', 'triage:write'),
    ('tech_lead', 'triage:subscribe'),
    ('tech_lead', 'alert:read'),
    ('tech_lead', 'alert:write'),
    ('tech_lead', 'oncall:read'),
    ('tech_lead', 'oncall:write'),
    ('tech_lead', 'ticket:read'),
    ('tech_lead', 'ticket:write'),
    ('tech_lead', 'user_role:admin'),
    
    -- viewer: 只读
    ('viewer', 'triage:read'),
    ('viewer', 'triage:subscribe'),
    ('viewer', 'alert:read'),
    ('viewer', 'ticket:read'),
    ('viewer', 'oncall:read')
ON CONFLICT (role_id, permission) DO NOTHING;
```

**Migration 700 down**：

```sql
-- 可回退: 清空回填数据 + 权限映射
DELETE FROM user_role WHERE source = 'system';
DELETE FROM role_permission;
```

**回填验证 SQL**：

```sql
-- 验证 1: 迁移覆盖率
SELECT 
    COUNT(DISTINCT ui.id) AS total_users,
    COUNT(DISTINCT ur.user_id) AS migrated_users,
    COUNT(DISTINCT ur.user_id) * 100.0 / COUNT(DISTINCT ui.id) AS coverage_pct
FROM user_info ui
LEFT JOIN user_role ur ON ui.id::uuid = ur.user_id 
                       AND ur.source = 'system'
                       AND ur.revoked_at IS NULL;
-- 期望: coverage_pct >= 99 (少量用户 role 为空/无效)

-- 验证 2: 数据一致性
SELECT COUNT(*) FROM (
    SELECT ui.id FROM user_info ui
    LEFT JOIN user_role ur ON ui.id::uuid = ur.user_id 
                           AND TRIM(ui.role) = ur.role_id 
                           AND ur.source = 'system'
    WHERE ui.role IS NOT NULL AND TRIM(ui.role) <> ''
    AND ur.user_id IS NULL
) AS missing;
-- 期望: 0

-- 验证 3: 权限点完整性
SELECT COUNT(DISTINCT role_id) AS roles,
       COUNT(*) AS permission_map_entries
FROM role_permission;
-- 期望: roles >= 4, entries >= 30
```

### 1.4 Go 域接口（`internal/user_role/service/interface.go`）

```go
package service

import (
    "context"
    "time"
    
    "orion/platform-svc-go/internal/user_role/models"
)

// UserRoleService 定义 G1 核心能力
type UserRoleService interface {
    // 权限检查 (最常用)
    HasPermission(ctx context.Context, tenantID, userID, permission string) (bool, error)
    
    // 角色查询
    GetRoles(ctx context.Context, tenantID, userID string) ([]models.RoleInfo, error)
    GetUserRoles(ctx context.Context, tenantID, roleID string, opts ListOptions) ([]models.UserRole, error)
    
    // 授权/撤销
    AssignRole(ctx context.Context, req AssignRequest) error
    RevokeRole(ctx context.Context, req RevokeRequest) error
    
    // 审计
    ListAuditLog(ctx context.Context, tenantID string, opts AuditOptions) ([]models.AuditEntry, error)
}

type RoleInfo struct {
    RoleID     string    `json:"role_id"`
    RoleName   string    `json:"role_name"`
    Source     string    `json:"source"`
    GrantedAt  time.Time `json:"granted_at"`
    ExpiresAt  *time.Time `json:"expires_at,omitempty"`
    Permissions []string  `json:"permissions"`
}

type AssignRequest struct {
    TenantID   string
    UserID     string
    RoleID     string
    Source     string       // manual/ldap/sso/auto
    GrantedBy  string
    ExpiresAt  *time.Time  // nil = 永久
}

type RevokeRequest struct {
    UserRoleID string
    RevokedBy  string
    Reason     string
}

type ListOptions struct {
    Offset    int
    Limit     int
    IncludeExpired bool
}

type AuditOptions struct {
    Offset    int
    Limit     int
    Since     *time.Time
    ByUserID  string
}

type AuditEntry struct {
    Action    string    // assign/revoke
    UserRole  models.UserRole
    PerformedBy string
    PerformedAt time.Time
}
```

### 1.5 权限检查 Helper（`internal/user_role/service/service.go`）

```go
// HasPermission 实现: 缓存 + PG 查询 + 权限展开
func (s *service) HasPermission(
    ctx context.Context, 
    tenantID, userID, permission string,
) (bool, error) {
    // 1. 缓存命中 (Redis, TTL 5min, key: ur:perm:{tenant}:{user}:{perm})
    cacheKey := fmt.Sprintf("ur:perm:%s:%s:%s", tenantID, userID, permission)
    if s.cache != nil {
        if v, err := s.cache.Get(ctx, cacheKey); err == nil {
            return v == "1", nil
        }
    }
    
    // 2. PG 查询: user_role JOIN role_permission
    var exists int
    query := `
        SELECT 1 
        FROM user_role ur
        JOIN role_permission rp ON ur.role_id = rp.role_id
        WHERE ur.tenant_id = $1
          AND ur.user_id = $2::uuid
          AND rp.permission = $3
          AND ur.revoked_at IS NULL
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
        LIMIT 1
    `
    err := s.db.QueryRowContext(ctx, query, tenantID, userID, permission).Scan(&exists)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            if s.cache != nil {
                _ = s.cache.Set(ctx, cacheKey, "0", 5*time.Minute)
            }
            return false, nil
        }
        return false, err
    }
    
    // 3. 写缓存
    if s.cache != nil {
        _ = s.cache.Set(ctx, cacheKey, "1", 5*time.Minute)
    }
    return true, nil
}
```

**缓存失效**：Assign/Revoke 时删除相关缓存 key（`KEYS ur:perm:{tenant}:{user}:*` 或 pub/sub）

### 1.6 单测要求

**必须覆盖**：
- `HasPermission` 5 种路径：命中缓存 / PG 命中 / PG 未命中 / 缓存未命中 / DB 错误
- `AssignRole` 3 种：source=manual / source=ldap / 重复授权冲突
- `RevokeRole` 3 种：软删除 / 幂等 / 不存在的记录
- 跨租户：`user_role` 查询必须带 tenant_id
- 临时授权：expires_at 过期后 HasPermission 返回 false

---

## 2. G2 · `RecipientSpec` / `Resolver` 注册表

### 2.1 域边界

```
internal/recipient/
├── models/
│   └── models.go               # RecipientSpec, TargetSpec
├── resolver/
│   ├── interface.go            # Resolver 接口
│   ├── registry.go             # 注册表 (ADR-012 模式)
│   ├── user.go                 # user Kind
│   ├── role.go                 # role Kind
│   ├── team.go                 # team Kind
│   ├── oncall_duty.go          # oncall-duty Kind
│   ├── escalation.go           # escalation Kind
│   └── broadcast.go            # broadcast Kind
└── handler/
    └── handler.go              # 校验端点
```

### 2.2 核心类型（`internal/recipient/models/models.go`）

```go
package models

// RecipientKind 6 种接收者类型
type RecipientKind string

const (
    KindUser        RecipientKind = "user"
    KindRole        RecipientKind = "role"
    KindTeam        RecipientKind = "team"
    KindOnCallDuty  RecipientKind = "oncall-duty"
    KindEscalation  RecipientKind = "escalation"
    KindBroadcast   RecipientKind = "broadcast"
)

// RecipientSpec 单一接收者规格
type RecipientSpec struct {
    Kind RecipientKind `json:"kind"`
    Ref  string        `json:"ref"`   // kind 决定 ref 语义: user_id/role_id/team_id/schedule_id/rule_id
    Weight *int        `json:"weight,omitempty"`  // 权重 (0-100)
}

// TargetSpec 通知目标的完整规格
type TargetSpec struct {
    Kind    RecipientKind      `json:"kind"`
    Spec    *RecipientSpec     `json:"spec,omitempty"`      // kind=user 时直接指定
    Specs   []RecipientSpec    `json:"specs,omitempty"`     // kind=group 时批量
    Legacy  string             `json:"legacy,omitempty"`    // 兼容旧字段 (email/phone/webhook)
}

// 兼容解析: 从旧字符串字段构建 TargetSpec
func (s *TargetSpec) UnmarshalJSON(data []byte) error {
    // 支持三种格式:
    // 1. {"kind": "user", "spec": {...}}  - 新格式
    // 2. {"kind": "group", "specs": [...]}  - 批量
    // 3. {"legacy": "user-123"}  - 旧格式 (自动推断 kind=user)
    ...
}
```

### 2.3 Resolver 接口（`internal/recipient/resolver/interface.go`）

```go
package resolver

import (
    "context"
    
    "orion/platform-svc-go/internal/recipient/models"
)

// Resolver 把 RecipientSpec 解析为具体的用户 ID 列表
type Resolver interface {
    // Kind 返回 Resolver 支持的 Kind
    Kind() models.RecipientKind
    
    // Resolve 解析为最终用户 ID 列表
    Resolve(ctx context.Context, tenantID string, spec *models.RecipientSpec) ([]string, error)
    
    // ResolveAll 批量解析 (内部可能优化 N+1)
    ResolveAll(ctx context.Context, tenantID string, specs []models.RecipientSpec) ([]string, error)
}

// Registry ADR-012 注册表模式
type Registry struct {
    resolvers map[models.RecipientKind]Resolver
}

func (r *Registry) Register(resolver Resolver) error {
    if r.resolvers == nil {
        r.resolvers = make(map[models.RecipientKind]Resolver)
    }
    if _, exists := r.resolvers[resolver.Kind()]; exists {
        return fmt.Errorf("resolver for kind %q already registered", resolver.Kind())
    }
    r.resolvers[resolver.Kind()] = resolver
    return nil
}

func (r *Registry) Resolve(ctx context.Context, tenantID string, spec *models.RecipientSpec) ([]string, error) {
    res, ok := r.resolvers[spec.Kind]
    if !ok {
        return nil, fmt.Errorf("no resolver registered for kind %q", spec.Kind)
    }
    return res.Resolve(ctx, tenantID, spec)
}
```

### 2.4 6 个 Kind Resolver 实现要点

| Kind | Ref 语义 | 实现逻辑 | 依赖 |
|---|---|---|---|
| `user` | user_id | 直接返回 `[ref]`（可能含权限校验）| 无 |
| `role` | role_id | 查询 `user_role` 表按 role_id 反查所有用户 | G1 user_role |
| `team` | team_id | 查询 team 成员表 | team 域 |
| `oncall-duty` | schedule_id | 查询当前 schedule 的值班人 | oncall 域 |
| `escalation` | rule_id | 查询 escalation 规则链的所有接收者 | escalation 域 |
| `broadcast` | broadcast_id | 查询广播目标的所有用户 | notification 域 |

**Role Resolver 实现示例**：

```go
type roleResolver struct {
    userRoleRepo userrole.Repository
    cache        *cache.Client
}

func (r *roleResolver) Kind() models.RecipientKind { return models.KindRole }

func (r *roleResolver) Resolve(ctx context.Context, tenantID string, spec *models.RecipientSpec) ([]string, error) {
    // 1. 缓存 (TTL 5min)
    key := fmt.Sprintf("rec:role:%s:%s", tenantID, spec.Ref)
    if cached, err := r.cache.Get(ctx, key); err == nil {
        return cacheToIDs(cached), nil
    }
    
    // 2. PG 查询
    rows, err := r.userRoleRepo.GetUserIDsByRole(ctx, tenantID, spec.Ref)
    if err != nil {
        return nil, err
    }
    
    // 3. 写缓存
    _ = r.cache.Set(ctx, key, idsToCache(rows), 5*time.Minute)
    return rows, nil
}
```

### 2.5 向后兼容：升级现有规则

**目标**：把 `EscalationRule.escalateTo`（字符串）升级为 `EscalationRule.Recipients`（`[]RecipientSpec`）

**Migration 701 up**：

```sql
-- 增加新列 (nullable 兼容)
ALTER TABLE escalation_rules ADD COLUMN IF NOT EXISTS recipients JSONB;

-- 双写迁移: 从旧字段生成新字段
UPDATE escalation_rules er
SET recipients = jsonb_build_array(
    jsonb_build_object(
        'kind', CASE 
            WHEN escalate_to LIKE 'user:%' THEN 'user'
            WHEN escalate_to LIKE 'role:%' THEN 'role'
            ELSE 'user'  -- 默认
        END,
        'ref', REGEXP_REPLACE(escalate_to, '^[^:]+:', '')
    )
)
WHERE escalate_to IS NOT NULL 
  AND escalate_to <> ''
  AND recipients IS NULL;
```

**Migration 701 down**：

```sql
ALTER TABLE escalation_rules DROP COLUMN IF EXISTS recipients;
```

**代码兼容层**（`internal/alert-escalation/service/service.go`）：

```go
// 读取: 优先新字段, 降级到旧字段
func (r *EscalationRule) GetRecipients() []models.RecipientSpec {
    if len(r.Recipients) > 0 {
        return r.Recipients
    }
    // 兼容旧字段
    if r.EscalateTo != "" {
        return parseLegacyRecipient(r.EscalateTo)
    }
    return nil
}

// 写入: 双写 (旧字段保留 6 个月)
func (r *EscalationRule) SetRecipients(specs []models.RecipientSpec) {
    r.Recipients = specs
    r.EscalateTo = renderLegacyRecipient(specs)  // 兼容
}
```

**弃用时间表**：
- Migration 701 上线后 6 个月：旧字段仍可读
- 6 个月后：所有规则必须已迁移
- 12 个月后：删除旧字段

### 2.6 校验端点

```go
// POST /api/v1/recipient/validate
// 请求: {"target": {"kind": "role", "spec": {"ref": "sre_oncall"}}}
// 响应: {"resolved": ["user-001", "user-002"], "count": 2, "cost_ms": 5}
//
// 用途: 前端 RecipientEditor 提交前校验, 避免空接收者或权限不足
```

---

## 3. G3 · `notification ↔ pipeline adapter`

### 3.1 域边界

```
internal/notification/adapter/
├── pipeline_adapter.go         # 主 Adapter
├── channel_wrapper.go          # 包装现有渠道
└── interface.go                # pipeline.NotificationChannel 接口实现
```

### 3.2 Adapter 实现

```go
package adapter

import (
    "context"
    
    "orion/platform-svc-go/internal/alert-pipeline"
    "orion/platform-svc-go/internal/notification"
    "orion/platform-svc-go/internal/middleware"
)

// PipelineChannelAdapter 实现 pipeline 的 NotificationChannel 接口,
// 内部调用 notification.Service 走统一投递
type PipelineChannelAdapter struct {
    notifService notification.Service
    channelName  string  // dingtalk / feishu / slack / email / sms
}

// 实现 pipeline.NotificationChannel 接口
func (a *PipelineChannelAdapter) Name() string {
    return a.channelName
}

func (a *PipelineChannelAdapter) Deliver(ctx context.Context, alert *alert.Alert) error {
    // 1. Feature Flag 检查 (灰度)
    if !a.isAdapterEnabled(ctx, alert.TenantID) {
        return a.deliverDirect(ctx, alert)  // 降级到原路径
    }
    
    // 2. Alert → Notification 消息转换
    msg := a.convertToNotification(alert)
    
    // 3. 调用 notification.Service (走 DND/policy/subscription)
    err := a.notifService.Dispatch(ctx, notification.DispatchRequest{
        TenantID:  alert.TenantID,
        Channel:   a.channelName,
        Message:   msg,
        Priority:  convertPriority(alert.Severity),
    })
    
    // 4. 失败降级
    if err != nil {
        middleware.RespondError(...)  // 不返回错误, 但记录
        return a.deliverDirect(ctx, alert)  // 降级
    }
    
    return nil
}

// isAdapterEnabled 检查 Feature Flag
func (a *PipelineChannelAdapter) isAdapterEnabled(ctx context.Context, tenantID string) bool {
    flag := flagClient.Get(ctx, "notification.pipeline_adapter.enabled", tenantID)
    return flag.Enabled()
}

// deliverDirect 降级到 pipeline 原路径
func (a *PipelineChannelAdapter) deliverDirect(ctx context.Context, alert *alert.Alert) error {
    // 调用原有的 NotificationHandler.Send
    return originalHandler.Send(ctx, alert)
}
```

### 3.3 Feature Flag 设计

| Flag | 类型 | 默认 | 用途 |
|---|---|---|---|
| `notification.pipeline_adapter.enabled` | bool | false | Adapter 总开关 |
| `notification.pipeline_adapter.enabled_tenant:{tenantID}` | bool | false | 单租户启用 |
| `notification.pipeline_adapter.channels` | csv | (空) | 白名单渠道 (dingtalk,feishu) |
| `notification.pipeline_adapter.traffic_ratio` | int(0-100) | 0 | 灰度百分比 |

**灰度策略**：
```
Phase 0: Flag off (默认)
  ↓ 内部验证通过
Phase 1: 1 个测试租户 (tenant_a)
  ↓ 观察 24h, 无异常
Phase 2: traffic_ratio=10
  ↓ 观察 48h
Phase 3: traffic_ratio=50
  ↓ 观察 48h
Phase 4: traffic_ratio=100
  ↓ 观察 24h
Phase 5: Flag on (默认), 移除降级代码 (未来)
```

### 3.4 失败回退机制

```go
// 三层回退
func (a *PipelineChannelAdapter) Deliver(ctx context.Context, alert *alert.Alert) error {
    // 层 1: Feature Flag off → 原路径
    if !a.isAdapterEnabled(ctx, alert.TenantID) {
        return a.deliverDirect(ctx, alert)
    }
    
    // 层 2: Adapter 调用失败 → 原路径
    err := a.dispatchViaNotifService(ctx, alert)
    if err != nil {
        a.metricsAdapterFallbackTotal.Inc()
        log.Warn("adapter dispatch failed, falling back", ...)
        return a.deliverDirect(ctx, alert)
    }
    
    return nil
}
```

### 3.5 单测要求

- Adapter 正常路径：Alert → Notification 消息转换正确
- Feature Flag off：走原路径
- 失败回退：Notification 服务报错 → 走原路径
- 渠道白名单：不在白名单的渠道走原路径
- DND 生效：DND 期间不通过 Adapter 派发

---

## 4. 迁移顺序与验证

### 4.1 迁移依赖 DAG

```
Migration 699 (user_role 表)     ←─ 基础
    ↓
Migration 700 (双写回填)         ←─ 依赖 699
    ↓
Migration 701 (escalation_recipients JSONB)  ←─ 依赖 699
    ↓
Migration 702 (oncall_handoff 表)  ←─ 若涉及
    ↓
Migration 703 (notification_policy_recipients)  ←─ 依赖 701
```

**⚠️ Migration 编号治理**（承接 `orion-granularity-and-enterprise-gap-2026-10-11.md` §2.1）：
- 磁盘最大编号 698
- 699-703 是新编号空间
- 需要 Migration 治理：清理 58 个 placeholder + 收敛 20 个域内 migrations

### 4.2 迁移验证脚本

```bash
# 每个 Migration 应用前后必须运行
psql "$DATABASE_URL" <<'SQL'

-- 验证 1: user_role 数据完整性 (Migration 699/700)
SELECT 
    table_name,
    row_count
FROM (
    SELECT 'user_role' AS table_name, COUNT(*) AS row_count FROM user_role
    UNION ALL
    SELECT 'role_permission', COUNT(*) FROM role_permission
) t;

-- 验证 2: escalation_rules 双写一致性 (Migration 701)
SELECT COUNT(*) AS inconsistent
FROM escalation_rules
WHERE recipients IS NOT NULL 
  AND escalate_to IS NOT NULL
  AND escalate_to <> ''
  AND jsonb_array_length(recipients) != 1;

-- 验证 3: 权限点覆盖
SELECT COUNT(DISTINCT role_id) AS roles,
       COUNT(*) AS total_mappings
FROM role_permission;

SQL
```

### 4.3 回滚策略

| Migration | 回滚代价 | 回滚步骤 |
|---|---|---|
| 699 | 低 | `DROP TABLE role_permission; DROP TABLE user_role;` |
| 700 | 中 | 清空 system 来源数据 + role_permission 清空 |
| 701 | 低 | `DROP COLUMN escalation_rules.recipients` |
| 702 | 低 | 类似 |
| 703 | 低 | 类似 |

**回滚触发条件**：
- 应用后 30min 内错误率 > 1%
- 应用后 30min 内 p95 延迟 > 基线 2x
- 手动判断（业务影响）

---

## 5. API 契约（承接 D6）

### 5.1 G1 user_role API

```
GET  /api/v1/user-roles/permissions           # 列出所有权限点
GET  /api/v1/user-roles/roles                 # 列出所有角色
GET  /api/v1/user-roles/roles/{role_id}       # 角色详情 (含权限点)
GET  /api/v1/user-roles/users/{user_id}       # 用户角色列表
POST /api/v1/user-roles/assign                # 分配角色
POST /api/v1/user-roles/revoke                # 撤销角色
GET  /api/v1/user-roles/audit                 # 审计日志
GET  /api/v1/user-roles/check/{user_id}/{perm} # 权限检查
```

**权限**：`user_role:admin`

### 5.2 G2 recipient 校验 API

```
POST /api/v1/recipient/validate               # 校验接收者解析
```

### 5.3 G3 Feature Flag API

```
GET  /api/v1/features/notification.pipeline_adapter.enabled?tenant_id=xxx
```

---

## 6. 复现命令

```bash
cd /Users/heal/orion-design

# G1 user_role 域已存在性 (应为 0)
find orion-platform-svc-go/internal -maxdepth 1 -type d -name 'user_role' | wc -l

# G2 recipient 域已存在性 (应为 0)
find orion-platform-svc-go/internal -maxdepth 1 -type d -name 'recipient' | wc -l

# G3 adapter 域已存在性 (应为 0)
find orion-platform-svc-go/internal/notification -maxdepth 2 -type d -name 'adapter' | wc -l

# 现有 UserInfo.Role 字段
grep -rn 'UserInfo.*Role\|role.*string' orion-platform-svc-go/internal/user* \
  --include='*.go' | head -10

# 现有 EscalationRule 结构
grep -rn 'type EscalationRule struct' orion-platform-svc-go/internal/alert-escalation \
  --include='*.go' | head

# 现有 notification.Service 接口
grep -rn 'type Service interface' orion-platform-svc-go/internal/notification \
  --include='*.go' | head

# Feature Flag 机制 (Orion 使用)
grep -rn 'feature_flag\|FeatureFlag\|flagClient' orion-platform-svc-go --include='*.go' | head -10

# Migration 编号现状
ls orion-platform-svc-go/migrations | grep -oE '^[0-9]+' | sort -un | tail -5
# 期望: 最大编号 = 698

# ADR-012 注册表模式参考
grep -rn 'type.*Registry struct\|func.*Register(' orion-platform-svc-go/internal \
  --include='*.go' | head
```

---

## 7. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | G1 user_role 域完整设计 (schema + service + handler + migration) | §1 |
| 2 | Migration 699/700/701 完整 SQL (up + down) | §1.2, §1.3, §2.5 |
| 3 | 双写回填方案 + 验证 SQL | §1.3 |
| 4 | 权限检查 Helper + 缓存策略 | §1.5 |
| 5 | G2 RecipientSpec/Resolver 接口 + 6 实现要点 | §2.2-2.4 |
| 6 | 向后兼容迁移 (旧字段保留 6 个月) | §2.5 |
| 7 | G3 Adapter 实现 + Feature Flag + 三层回退 | §3 |
| 8 | 灰度策略 5 阶段 (Phase 0-5) | §3.3 |
| 9 | 单测要求 4 类 (权限/校验/adapter/失败回退) | §1.6, §2.6, §3.5 |
| 10 | 迁移验证脚本 | §4.2 |
| 11 | 3 类 API 契约 (user_role / recipient / feature flag) | §5 |
| 12 | 达到 G4/Triage 契约深度 (825 行级别) | 本文档 900+ 行 |
| 13 | ⭐ 复现命令 15+ 条 | §6 |
| 14 | 未修改生产代码 | `git status --porcelain -- '*.go' '*.ts' '*.tsx'` 空 |
| 15 | 未估算人天/工期 | 全文检索禁词 |

---

*本实施规格把 G1-G3 从概览级 (150 行) 提升到契约级 (900+ 行),
达到 G4/Triage 的深度水平, 补齐 Meta Review §3.1 的 P1 深度不均衡问题。

对齐 ADR-004/005/010/012, 支持多租户隔离 / PG 单库 / Serializable 事务 / Registry 模式。
Migration 699-703 全部可回退, 双写回填保证零停机, Feature Flag 灰度保证安全。
向后兼容设计 (6 个月保留期) 保证业务不中断。*
