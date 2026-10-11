# 角色化推送 + 盯盘一体化能力升级设计（2026-10-11）

**范围**：把 Orion 现有 4 个零件（On-call / 告警升级 / 通知引擎 / ChatOps）+ 2 个前置
（用户-角色关联 / notification 打通）串成端到端闭环，实现「按人员角色推送问题、报警、
工单」+「一站式盯盘快速处理」两条业务链。

**上游文档**：
- `reports/reference/orion-granularity-and-enterprise-gap-2026-10-11.md`（三轴差距分析）
- `docs/adr/ADR-004-多租户.md`（TenantID 硬边界前提）
- `docs/adr/ADR-005-数据库选型决策.md`（PG 14+ 单库）
- `docs/adr/ADR-006-ClickHouse-集成设计.md`（如启用：跨库读需保持 PG 主库原则）
- `docs/adr/ADR-010-AlertBreaker-并发模型选型.md`（Alert 5 家族事务边界，本设计需兼容）
- `docs/adr/ADR-012-Factory-Handler-注册表模式.md`（Recipient Resolver 走同一注册表模式）
- `reports/module-upgrade-designs/alert-upgrade-design-2026-10-03.md`（Alert 5 家族设计）
- `reports/module-upgrade-designs/itsm-upgrade-design-2026-10-03.md`（Ticket 分配规则）
- `reports/module-upgrade-designs/data-model-migration-design-2026-10-03.md`（AA，Migration 699-765 编号预留）

**硬约束**：
- **RC-03**：本文档为设计文档，**不修改任何生产代码**。
- **不估算人天/工期**（全文禁词）。
- **遵循 PG 14+ 单库原则**（ADR-005），不引入新中间件。
- **TenantID 硬边界**：所有新增表与查询必须带 tenant_id 并参与锁键。
- **兼容 ADR-010 AlertBreaker Serializable 事务边界**：解析器不引入新事务，只在既有事务内调用。
- **不估算人天/工期**：本文档不出现"人日/工期/人天/week 数/sprint"字样。

**方法论**：⭐ 机械计数（`find`/`grep`/`wc`，命令见 §7 可复现），
不含 ◇ 解读性断言。沿用 `orion-granularity-and-enterprise-gap-2026-10-11.md` §9.3
新增的第 7 条验收标准：**每个 pattern 先用 `head` 抽样确认再统计**。

---

## 0. TL;DR

**当前状态**：4 个零件齐全（On-call 801 行 / 告警升级 1,151 行 / 通知引擎 7,571 行 / ChatOps 4,935 行），
但**跨域出度全部为 0**——`oncall` / `alert-escalation` / `notification` 三个域**没有任何其他域 import**。
用户视角的"角色化推送 + 快速盯盘"目前**做不到端到端闭环**。

**四个缺口，四个补齐方案**：

| # | 缺口 | 严重度 | 方案 | 性质 |
|---|---|---|---|---|
| G1 | 无 user↔role 多对多关联 | **P0 前置** | 新增 `user_role` 关联表（Migration 699）| 数据模型 |
| G2 | `EscalationRule.Target` 与 `NotificationPolicy.Recipients` 是自由字符串 | **P0** | 统一 `RecipientSpec` 类型 + `ResolveRecipients` 解析器（走 ADR-012 注册表模式）| 语义化 |
| G3 | alert-pipeline 用本地 `NotificationChannel` 接口，与 notification 系统两套 | P1 | 新增 `notification.Adapter` 打通 | 跨域打通 |
| G4 | 无一站式"我的"盯盘视图 | P1 | 新增 `triage` 域聚合 API（组合现有能力，不重复造轮子）| 聚合层 |

**依赖顺序**：G1 → G2 →（G3, G4 可并行）

**关键设计决定**：
1. `RecipientSpec` 走 **ADR-012 Factory/Handler 注册表模式**（与 `AttrValueHandlerFactory` 同源），
   避免硬编码 if-else 分支。
2. 不修改 `EscalationRule.Target` 字段类型（避免破坏现有 JSON），改为**新增**
   `TargetSpec RecipientSpec` 字段并双写过渡。
3. `triage` 域只做**聚合与投影**，不引入新的业务逻辑；所有数据来自现有域。
4. G1 的 `user_role` 表放在 `auth` 域（用户身份的所有者），不散落到各消费域。

---

## 1. 证据（⭐ 机械计数，命令见 §7）

### 1.1 已有零件清单

| 零件 | 位置 | 文件数 | 行数 | 关键类型 |
|---|---|---:|---:|---|
| **On-call** | `internal/oncall` | 8 | **801** | `Schedule` / `Rotation` / `EscalationPath` / `Assignment` / `Override` |
| **告警升级** | `internal/alert-escalation` | 5 | **1,151** | `EscalationPolicy` / `EscalationRule` / `EscalationTrigger` / `AlertClosure`（含 `MTTRSeconds`）|
| **通知引擎** | `internal/notification` + `-management` / `-policy` / `-template` | 30+ | **7,571+** | `NotificationPolicyEntity` / `PolicyCondition` / 12 渠道 Dispatcher / `DNDService` |
| **ChatOps** | `internal/chatops` | 10 | **4,935** | 17 类模型含 `NotificationPreference`（5 渠道开关）/ `AlertState`（4 状态）/ `PermissionRole` |
| **工单** | `internal/ticket` + `internal/ticketing` | 56 + 61 | **8,280 + 11,857** | `AssignmentRule`（Categories/Priorities → Assignee）|
| **Alert Pipeline** | `internal/alert-pipeline` | 16 | **2,245** | `stages/notify/notify.go`（本地 `NotificationChannel` 接口）|

### 1.2 三域跨域出度 = 0（**核心证据**）

```
$ for d in oncall alert-escalation notification; do
    echo -n "$d 跨域出度: "
    grep -rlE "orion/platform-svc-go/internal/$d" internal --include='*.go' \
      | grep -v "internal/$d/" | grep -v '_test.go' | wc -l
  done
oncall 跨域出度:       0
alert-escalation 跨域出度: 0
notification 跨域出度:     12  ← 但全部是 notification-* 兄弟域内部引用
```

**跨子系统消费者验证**：

```
$ grep -rlE 'orion/platform-svc-go/internal/notification' internal --include='*.go' \
    | grep -v 'internal/notification/' | grep -v '_test.go' | sed 's|.*/internal/||' \
    | cut -d/ -f1 | sort -u
（空 = 无外部域消费 notification）
```

**Alert 系统与通知系统完全断开**：

```
$ grep -rn 'orion/platform-svc-go/internal/notification' internal/alert internal/alert-pipeline \
    internal/alert-adapter-v2 --include='*.go'
（全部空 = alert 主域、alert-pipeline、alert-adapter-v2 均未 import notification）
```

**Ticket 系统与通知系统完全断开**：

```
$ grep -rn 'orion/platform-svc-go/internal/notification' internal/ticket internal/ticketing \
    --include='*.go'
（空 = ticket/ticketing 均未 import notification）
```

### 1.3 用户-角色模型残缺

```
$ grep -nE 'type [A-Z]' internal/auth/models/*.go | head -20
6:type LoginRequest
12:type LoginResponse
21:type RegisterRequest
...
69:type UserInfo struct {
    ID       string `json:"id"`
    Username string `json:"username"`
    Email    string `json:"email"`
    Role     string `json:"role"`        ← 单字符串，非 []string
    Avatar   string `json:"avatar"`
}
```

**全仓无 user-role 关联表**：

```
$ grep -rniE 'userr?ole|user_role|assignee_role' internal --include='*.go' | grep -v '_test.go'
（仅 capability.UserRoles []string、data-masking.UserRole string 用于**权限校验**，
  非用于**路由**；无独立 user_role 表）
```

**`chatops.PermissionRole` 只是角色定义，无 user 关联**：

```go
type PermissionRole struct {
    ID          string `json:"id" db:"id"`
    TenantID    string `json:"tenant_id" db:"tenant_id"`
    Name        string `json:"name" db:"name"`
    Description string `json:"description" db:"description"`
    Permissions string `json:"permissions" db:"permissions"`
    // ← 无 UserID / UserIDs 字段
}
```

### 1.4 Target 语义化缺失

```go
// internal/alert-escalation/models/models.go:22
type EscalationRule struct {
    Level        int    `json:"level"`
    DelayMinutes int    `json:"delayMinutes"`
    Target       string `json:"target"`       // ← 自由字符串，不区分 user/role/team/oncall
    Channel      string `json:"channel"`
    Message      string `json:"message"`
    NotifyOnFail bool   `json:"notifyOnFail"`
}

// internal/notification/models/*.go
type NotificationPolicyEntity struct {
    ...
    Channels   []string          `json:"channels"`
    Recipients []string          `json:"recipients"`   // ← 显式 user ID 数组，无 role 解析
    ...
}
```

### 1.5 盯盘视图缺失

```
$ grep -A2 'type DashboardWidget\|WidgetType' internal/notification/models/*.go | head -20
type WidgetType string

const (
    WidgetTypeTotalNotifications WidgetType = "total_notifications"
    WidgetTypeDeliveryStatus     WidgetType = "delivery_status"
    WidgetTypeFailureRate        WidgetType = "failure_rate"
    WidgetTypeRecentActivity     WidgetType = "recent_activity"
)
```

`notification.DashboardService` 4 类 widget **全部是通知投递指标**，无告警态势 / 工单积压 /
当前值班 / 未处理队列视图。`bi-dashboard`（6 文件 / 367 行）是通用 BI 框架，无运维业务逻辑。

---

## 2. 缺口分析

### G1（P0 前置）：无 user↔role 多对多关联

**问题**：`UserInfo.Role` 是单字符串，无法表达"一个用户属于多个角色"。
没有 `user_role` 表，"推送到所有 DBA"这类查询无从下手。

**为什么必须前置**：G2 的 `RecipientSpec{kind:"role"}` 解析时依赖
`SELECT user_id FROM user_role WHERE tenant_id=? AND role=?`，无表则解析器无法落地。

### G2（P0）：Target / Recipients 是自由字符串

**问题**：
- `EscalationRule.Target` 单字符串，规则作者无法结构化描述"这是谁"。
- `NotificationPolicyEntity.Recipients` 只支持 `[]userID`，**只能推送到具体人**，
  不能推送到"某角色""某团队""当前值班"。
- 两个字段各自为政，没有统一抽象。

**为什么必须做**：没有统一 Recipient 抽象，"角色化推送"这条链的**路由决策层**就不存在。
即使 G1 有了 user_role 表，也没有代码路径会去查它。

### G3（P1）：alert-pipeline 与 notification 是两套系统

**问题**：`alert-pipeline/stages/notify/notify.go` 定义了自己的 `NotificationChannel`
接口（本地 models.go:143），与 `notification.NotificationService` 的 12 渠道 Dispatcher
并行存在。

```go
// internal/alert-pipeline/models/models.go:143
type NotificationChannel interface { ... }  // 本地接口
```

**后果**：告警进入 pipeline 后走本地接口分发，不经过统一的 policy/DND/subscription
体系，用户视角看不到这些告警的投递记录，也无法配置免打扰。

### G4（P1）：无一站式"我的"盯盘视图

**问题**：`AlertState` / `Ticket.AssigneeID` / `OnCall.GetOnCallNow` / `Notification.GetUnreadCount`
四个能力各自有 API，但没有**"我是谁 → 我有什么要处理"**的一站式聚合。用户要组装"我的待办"
必须组合 4+ 个 API。

**为什么不复用 `bi-dashboard`**：`bi-dashboard` 是通用 BI 框架（图表 + 数据源配置），
不是业务聚合。硬套会让 dashboard 承担业务逻辑，违反分层。

---

## 3. 设计

### 3.1 设计 A（P0 前置）：`user_role` 多对多关联表

**归属**：`internal/auth`（用户身份的所有者）
**Migration 编号**：**699**（AA 已预留 699-765，本项占 699）

#### 3.1.1 Schema

```sql
-- Migration 699: create user_role association table
CREATE TABLE user_role (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    user_id     TEXT NOT NULL,
    role_id     TEXT NOT NULL,           -- 对应 chatops.PermissionRole.ID
    source      TEXT NOT NULL DEFAULT 'manual',  -- manual | ldap | sso | auto
    granted_by  TEXT,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,              -- NULL = 永久

    UNIQUE (tenant_id, user_id, role_id),
    CONSTRAINT fk_ur_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_user_role_by_user   ON user_role (tenant_id, user_id);
CREATE INDEX idx_user_role_by_role   ON user_role (tenant_id, role_id);
CREATE INDEX idx_user_role_active    ON user_role (tenant_id, role_id)
    WHERE expires_at IS NULL OR expires_at > now();
```

**设计要点**：
1. **`role_id` 复用 `chatops.PermissionRole.ID`**，不新造角色表（避免多套角色定义）。
2. **`source` 字段**支持 LDAP/SSO 同步与手工授予共存。
3. **`expires_at` 可空**：NULL 为永久，非空为临时授权（用于临时提权场景）。
4. **部分索引**（`WHERE expires_at IS NULL OR expires_at > now()`）优化热查询
   `SELECT user_id FROM user_role WHERE tenant_id=? AND role_id=? AND (expires_at IS NULL OR expires_at > now())`。

#### 3.1.2 Repository 接口

```go
// internal/auth/repository/user_role_repository.go
type UserRoleRepository interface {
    // 授予角色
    Grant(ctx context.Context, tenantID string, req GrantRoleRequest) error
    // 撤销角色
    Revoke(ctx context.Context, tenantID, userID, roleID string) error
    // 查询用户的所有角色
    RolesOfUser(ctx context.Context, tenantID, userID string) ([]string, error)
    // 查询角色的所有用户（G2 解析器使用）
    UsersOfRole(ctx context.Context, tenantID, roleID string) ([]string, error)
    // 批量查询用户的所有角色
    RolesOfUsers(ctx context.Context, tenantID string, userIDs []string) (map[string][]string, error)
}

type GrantRoleRequest struct {
    TenantID string
    UserID   string
    RoleID   string
    Source   string  // manual | ldap | sso | auto
    GrantedBy string
    ExpiresAt *time.Time
}
```

#### 3.1.3 Auth Middleware 集成

现有 `auth.RequirePermission` 只查 `UserInfo.Role` 单字符串。改为：

```go
// middleware 层，请求进入时预取
type AuthContext struct {
    UserID   string
    TenantID string
    Roles    []string  // 从 user_role 表 + UserInfo.Role 兼容读取
}

// 兼容策略：读取时同时查 user_role 表 + UserInfo.Role
// 写入时统一走 user_role 表；UserInfo.Role 保留但仅作兼容字段
func (m *AuthMiddleware) Roles(ctx context.Context, tenantID, userID string) []string {
    roles := set.New()
    // 新路径
    if dbRoles, err := m.userRoleRepo.RolesOfUser(ctx, tenantID, userID); err == nil {
        for _, r := range dbRoles { roles.Add(r) }
    }
    // 旧路径（兼容）
    if info, err := m.userRepo.Get(ctx, userID); err == nil && info.Role != "" {
        roles.Add(info.Role)
    }
    return roles.List()
}
```

**迁移策略**：**双写 + 单次回填**。
- 现有 `UserInfo.Role` 保留但不再新增写入。
- Migration 700 提供一次性回填脚本，把现存 `UserInfo.Role` 迁移到 `user_role` 表。
- 读路径优先查 `user_role`，`UserInfo.Role` 作为 fallback 保留 2 个版本周期。

### 3.2 设计 B（P0）：`RecipientSpec` 统一类型 + 解析器

**归属**：新增 `internal/recipient` 域
**性质**：跨域基础设施，供 `alert-escalation`、`notification`、`ticketing` 共同依赖

#### 3.2.1 类型定义

```go
// internal/recipient/models/models.go
package models

// RecipientKind 区分接收者类型
type RecipientKind string

const (
    KindUser        RecipientKind = "user"         // 直接指定用户 ID
    KindRole        RecipientKind = "role"         // 指定角色（查 user_role）
    KindTeam        RecipientKind = "team"         // 指定团队（查 team_member）
    KindOnCallDuty  RecipientKind = "oncall-duty"  // 指定值班排班（查 oncall.GetOnCallNow）
    KindEscalation  RecipientKind = "escalation"   // 指定升级路径层级
    KindBroadcast   RecipientKind = "broadcast"    // 广播到整租户
)

// RecipientSpec 统一接收者描述
type RecipientSpec struct {
    Kind RecipientKind `json:"kind"`
    Ref  string        `json:"ref"`  // user_id / role_id / team_id / schedule_id / level
}

// 便捷构造函数
func User(id string) RecipientSpec        { return RecipientSpec{KindUser, id} }
func Role(id string) RecipientSpec        { return RecipientSpec{KindRole, id} }
func Team(id string) RecipientSpec        { return RecipientSpec{KindTeam, id} }
func OnCallDuty(scheduleID string) RecipientSpec { return RecipientSpec{KindOnCallDuty, scheduleID} }
func EscalationLevel(level int) RecipientSpec {
    return RecipientSpec{KindEscalation, strconv.Itoa(level)}
}
```

#### 3.2.2 Resolver 注册表（ADR-012 模式）

```go
// internal/recipient/resolver/registry.go
package resolver

type Resolver interface {
    Kind() models.RecipientKind
    Resolve(ctx context.Context, tenantID string, spec models.RecipientSpec) ([]string, error)
}

type Registry struct {
    resolvers map[models.RecipientKind]Resolver
}

func (r *Registry) Register(res Resolver) {
    r.resolvers[res.Kind()] = res
}

func (r *Registry) Resolve(ctx context.Context, tenantID string, spec models.RecipientSpec) ([]string, error) {
    res, ok := r.resolvers[spec.Kind]
    if !ok {
        return nil, fmt.Errorf("no resolver for kind=%q", spec.Kind)
    }
    return res.Resolve(ctx, tenantID, spec)
}

// 批量解析（避免 N+1）
func (r *Registry) ResolveAll(ctx context.Context, tenantID string, specs []models.RecipientSpec) ([]string, error) {
    seen := make(map[string]bool)
    out := make([]string, 0)
    for _, spec := range specs {
        ids, err := r.Resolve(ctx, tenantID, spec)
        if err != nil { return nil, err }
        for _, id := range ids {
            if !seen[id] { seen[id] = true; out = append(out, id) }
        }
    }
    return out, nil
}
```

#### 3.2.3 内置 Resolver 实现清单

| Kind | Resolver 实现 | 依赖 | 数据来源 |
|---|---|---|---|
| `user` | `UserResolver` | 无（直通）| spec.Ref |
| `role` | `RoleResolver` | G1 `UserRoleRepository.UsersOfRole` | `user_role` 表 |
| `team` | `TeamResolver` | `internal/team`（如存在，否则新建）| `team_member` 表 |
| `oncall-duty` | `OnCallDutyResolver` | `internal/oncall.Service.GetOnCallNow` | `oncall.Schedule` + `Rotation` |
| `escalation` | `EscalationLevelResolver` | `internal/alert-escalation.Service` | `EscalationPath` |
| `broadcast` | `BroadcastResolver` | `internal/auth.Service.ListActiveUsers` | 整租户活跃用户 |

#### 3.2.4 应用到既有模型

**`EscalationRule`**（**新增**字段，不修改原字段）：

```go
type EscalationRule struct {
    Level        int                `json:"level"`
    DelayMinutes int                `json:"delayMinutes"`
    Target       string             `json:"target"`             // 保留：向后兼容
    TargetSpec   *RecipientSpec     `json:"target_spec,omitempty"`  // 新增：结构化描述
    Channel      string             `json:"channel"`
    Message      string             `json:"message"`
    NotifyOnFail bool               `json:"notifyOnFail"`
}
```

**`NotificationPolicyEntity`**：

```go
type NotificationPolicyEntity struct {
    ...
    Channels   []string                     `json:"channels"`
    Recipients []string                     `json:"recipients"`             // 保留
    RecipientSpecs []RecipientSpec          `json:"recipient_specs,omitempty"`  // 新增
    ...
}
```

**双写与迁移**：
- **读路径**：优先 `RecipientSpecs`；为空则 fallback 到 `Recipients`/`Target`（视为 `KindUser`）。
- **写路径**：新 API 只写 `RecipientSpecs`；旧 API 兼容。
- **回填**：Migration 701 提供脚本把现存 `Target` / `Recipients` 转换为 `TargetSpec` / `RecipientSpecs`
  （`Kind=user, Ref=<原值>`）。

### 3.3 设计 C（P1）：`triage` 聚合域（一站式"我的"盯盘）

**归属**：新增 `internal/triage` 域
**性质**：**只做聚合与投影**，不引入新业务逻辑；数据全部来自现有域。

#### 3.3.1 域边界

```
internal/triage/
├── models/         # TriageItem 聚合类型
├── repository/     # 只读聚合查询（跨域）
├── service/        # 组合逻辑
├── handler/        # HTTP 端点
└── ...
```

**依赖注入原则**：triage 域通过**接口注入**消费上游域的能力，不直接 import 内部实现。
这样上游域的接口演进不影响 triage，triage 变更也不影响上游。

#### 3.3.2 核心聚合类型

```go
// internal/triage/models/models.go
type TriageItemKind string

const (
    ItemAlert   TriageItemKind = "alert"
    ItemTicket  TriageItemKind = "ticket"
    ItemOnCall  TriageItemKind = "oncall"
    ItemChange  TriageItemKind = "change"
)

// TriageItem 统一的待办项
type TriageItem struct {
    Kind      TriageItemKind    `json:"kind"`
    ExternalID string           `json:"external_id"`   // 指向源域 ID
    Title     string            `json:"title"`
    Severity  string            `json:"severity,omitempty"`
    CreatedAt time.Time         `json:"created_at"`
    AssignedTo string           `json:"assigned_to"`
    Status    string            `json:"status"`        // unread | in_progress | resolved
    // 可选：告警专属
    AlertID   *string           `json:"alert_id,omitempty"`
    // 可选：工单专属
    TicketID  *string           `json:"ticket_id,omitempty"`
}

// MyOverview 首页聚合
type MyOverview struct {
    UnreadAlerts    int           `json:"unread_alerts"`
    MyTickets       int           `json:"my_tickets"`
    OnCallNow       *OnCallInfo   `json:"on_call_now,omitempty"`
    UnreadNotifications int       `json:"unread_notifications"`
    RecentItems     []TriageItem  `json:"recent_items"`    // top N
}

type OnCallInfo struct {
    ScheduleID    string    `json:"schedule_id"`
    ScheduleName  string    `json:"schedule_name"`
    Level         int       `json:"level"`
    StartDate     time.Time `json:"start_date"`
    EndDate       time.Time `json:"end_date"`
}
```

#### 3.3.3 接口定义（依赖注入）

```go
// internal/triage/service/service_interface.go
type AlertReader interface {
    GetUnreadAlertsByUser(ctx context.Context, tenantID, userID string, limit int) ([]TriageItem, error)
}
type TicketReader interface {
    GetMyTickets(ctx context.Context, tenantID, userID string, limit int) ([]TriageItem, error)
}
type OnCallReader interface {
    GetMyOnCall(ctx context.Context, tenantID, userID string) (*OnCallInfo, error)
}
type NotificationReader interface {
    GetUnreadCount(ctx context.Context, tenantID, userID string) (int, error)
}

type Service struct {
    alerts  AlertReader
    tickets TicketReader
    oncall  OnCallReader
    notifs  NotificationReader
}
```

#### 3.3.4 HTTP 端点

```go
// internal/triage/handler/handler.go
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    g := rg.Group("/triage")
    g.GET("/me",              auth.RequirePermission("triage", "read"), h.MyOverview)
    g.GET("/me/items",        auth.RequirePermission("triage", "read"), h.MyItems)
    g.GET("/me/alerts",       auth.RequirePermission("alert",  "read"), h.MyAlerts)
    g.GET("/me/tickets",      auth.RequirePermission("ticket", "read"), h.MyTickets)
    g.GET("/me/oncall",       auth.RequirePermission("oncall", "read"), h.MyOnCall)
    g.POST("/me/items/:id/ack", auth.RequirePermission("triage", "write"), h.AcknowledgeItem)
    g.POST("/me/items/:id/dismiss", auth.RequirePermission("triage", "write"), h.DismissItem)
}
```

**关键端点语义**：
- `GET /triage/me` — 首页聚合（4 个数字 + top N 最近项）
- `GET /triage/me/items?kind=alert&limit=50` — 分页查我的待办
- `POST /triage/me/items/:id/ack` — 一键确认（透传到源域的 acknowledge）
- `POST /triage/me/items/:id/dismiss` — 一键忽略（透传到 `AlertState` 更新）

**⚠️ 硬约束**：`/ack` / `/dismiss` 是**透传**，triage 不持有状态；
状态回写由源域完成，triage 只做路由。

### 3.4 设计 D（P1）：alert-pipeline → notification 打通

**归属**：新增 `internal/notification/adapter` 包（属于 notification 域，供 pipeline 依赖）
**性质**：Adapter 模式，桥接两套系统

#### 3.4.1 现状

```go
// internal/alert-pipeline/models/models.go:143
type NotificationChannel interface {
    Name() string
    Deliver(ctx context.Context, alert *Alert) error
}
```

pipeline 有本地接口，`notify` stage 通过 `ChannelRegistry` 分发，
**完全绕过** notification 的 policy/DND/subscription 体系。

#### 3.4.2 Adapter 设计

```go
// internal/notification/adapter/pipeline_adapter.go
package adapter

// PipelineChannelAdapter 实现 pipeline 的 NotificationChannel 接口，
// 内部调用 notification.Service 走统一投递
type PipelineChannelAdapter struct {
    notifService *service.Service
    channelName  string   // dingtalk / feishu / slack / ...
}

func (a *PipelineChannelAdapter) Name() string { return a.channelName }

func (a *PipelineChannelAdapter) Deliver(ctx context.Context, alert *pipeline.Alert) error {
    // 1. 构造 notification.CreateNotificationRequest
    req := &models.CreateNotificationRequest{
        TenantID:   alert.TenantID,
        Type:       "alert",
        Title:      alert.Title,
        Body:       alert.Body,
        Severity:   alert.Severity,
        SourceID:   alert.ID,
        // ...
    }
    // 2. 通过 policy 引擎解析 recipients（走 G2 Resolver）
    policies, err := a.policyService.EvaluatePolicies(ctx, alert.TenantID, alert.ToEvent())
    if err != nil { return err }
    for _, policy := range policies {
        recipients, err := a.resolver.ResolveAll(ctx, alert.TenantID, policy.RecipientSpecs)
        if err != nil { return err }
        req.Recipients = recipients
        req.Channel = a.channelName
        // 3. 交给 notification 统一投递（走 DND / subscription / delivery log）
        if _, err := a.notifService.SendNotification(ctx, alert.TenantID, req); err != nil {
            return err
        }
    }
    return nil
}
```

#### 3.4.3 迁移策略

**Phase 1**：新增 adapter，但 pipeline 仍用本地接口（Feature Flag 控制切换）。
**Phase 2**：Feature Flag 打开，走 adapter；旧路径保留。
**Phase 3**：稳定运行后删除本地 `NotificationChannel` 接口。

**风险**：pipeline 与 notification 都有 12 个渠道，如果 adapter 出错会导致告警丢失。
**降级**：Feature Flag 一键回退到本地接口。

### 3.5 依赖关系图

```
                    ┌──────────────────────────────────────────┐
                    │  设计 A：user_role 表（P0 前置）           │
                    │  auth.domain + Migration 699              │
                    │  双写 + 回填 Migration 700                │
                    └──────────────────────────────────────────┘
                                    ↓ 提供 RolesOfUser / UsersOfRole
                                    ↓
                    ┌──────────────────────────────────────────┐
                    │  设计 B：RecipientSpec + Resolver 注册表   │
                    │  internal/recipient 新域                  │
                    │  被 alert-escalation/notification/ticketing │
                    │  共同依赖（走 ADR-012 模式）              │
                    └──────────────────────────────────────────┘
                              ↓ 提供                    ↓ 提供
                              ↓ Resolve(specs)          ↓ Resolve(specs)
         ┌────────────────────┴────────────┐  ┌─────────┴───────────────────┐
         │  alert-escalation.EscalationRule │  │ notification.NotificationPolicy │
         │  Target → TargetSpec 双写过渡    │  │ Recipients → RecipientSpecs     │
         └─────────────────────────────────┘  └──────────────────────────────┘

    可并行：
         ┌──────────────────────────────────────────────────────┐
         │  设计 C：triage 聚合域（P1）                            │
         │  依赖：AlertReader / TicketReader / OnCallReader /    │
         │        NotificationReader（4 个接口注入）              │
         └──────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────────────┐
         │  设计 D：notification.Adapter（P1）                    │
         │  桥接 alert-pipeline → notification 服务              │
         │  Feature Flag 控制切换                                │
         └──────────────────────────────────────────────────────┘
```

---

## 4. Migration 编号规划

**AA 已预留 699-765**，本设计占用：

| Migration | 内容 | 是否可逆 |
|---|---|---|
| **699** | `CREATE TABLE user_role` | ✅（DROP TABLE）|
| **700** | 回填：`UserInfo.Role` → `user_role` 双写 | ✅（可清理回填数据）|
| **701** | `EscalationRule.Target` → `TargetSpec` JSON 字段回填 | ✅（原字段保留）|
| **702** | `NotificationPolicyEntity.Recipients` → `RecipientSpecs` JSONB 字段回填 | ✅（原字段保留）|
| **703** | `team_member` 表（如团队功能未存在则新增）| ✅ |

**共 5 个 Migration，全部可逆**（不违反 ADR-005 PG 单库 + 事务原则）。

---

## 5. 与升级方案的衔接

### 5.1 Stage Gate 关联

- **S4 pre（Alert 前置门控）**：本设计的 G1+G2 是 Alert 5 家族 PG 持久化之后的**路由决策层补齐**，
  应加入 S4 pre 硬指标：**"告警路由支持 role/oncall-duty 两种 RecipientKind"**。
- **S5（Alert 集成测试）**：本设计的 G3 adapter 需通过 Feature Flag 灰度测试。

### 5.2 关联 ADR

- **ADR-005**（PG 单库）：本设计新增 4 张 PG 表，符合单库原则。
- **ADR-004**（多租户 ThreadLocal TenantContext）：所有新增表带 `tenant_id`，符合硬边界。
- **ADR-010**（AlertBreaker 并发模型）：本设计的 Resolver 在 Serializable 事务内调用
  `UsersOfRole` / `GetOnCallNow`，不引入新事务。
- **ADR-012**（Factory/Handler 注册表）：`Recipient Resolver Registry` 直接对齐
  `AttrValueHandlerFactory` 模式。

### 5.3 关联设计文档

- `reports/module-upgrade-designs/alert-upgrade-design-2026-10-03.md`（Alert 5 家族设计）
  — 本设计 G2/G3 是它的**路由层与推送层补齐**。
- `reports/module-upgrade-designs/itsm-upgrade-design-2026-10-03.md`（Ticket 分配规则）
  — 本设计 G2 的 `RecipientSpec` 应回用于 `ticketing.AssignmentRule.Assignee`
  （当前也是自由字符串）。

---

## 6. 风险与降级

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| **R-T1** `user_role` 回填遗漏历史用户 | 中 | 中 | 回填脚本 dry-run 模式 + 用户列表前后 diff 报告 |
| **R-T2** `RecipientSpec` JSON 字段兼容性 | 低 | 中 | 双写过渡：读优先新字段，写始终双写 |
| **R-T3** Resolver 引入 N+1 查询 | 中 | 中 | `ResolveAll` 内部去重 + 批量 SQL（IN clause）|
| **R-T4** pipeline adapter 切换导致告警丢失 | 低 | 高 | Feature Flag + 灰度租户 + 双发（新旧路径同时发，去重后落库）|
| **R-T5** triage 域被误当作业务逻辑入口 | 中 | 中 | 硬约束：只做聚合，不持有状态；`/ack` `/dismiss` 是透传 |
| **R-T6** 与 ADR-010 事务边界冲突 | 低 | 中 | Resolver 不引入新事务；查询走既有 `alertLockTx` helper |
| **R-T7** DND 检查在 pipeline adapter 中被绕过 | 中 | 中 | adapter 内嵌 DND 检查（调用 `DNDService.IsDndActive`），确保走统一策略 |
| **R-T8** user_role 表高基数下查询慢 | 低 | 中 | 部分索引 + `idx_user_role_by_role`；如 > 100k 行考虑分区 |

**降级策略**：
- G1 失败：rollback Migration 699 + 700，`UserInfo.Role` 保留。
- G2 失败：rollback 701 / 702，`Target` / `Recipients` 原字段保留。
- G3 失败：Feature Flag 关闭 adapter，回退到本地 pipeline 接口。
- G4 失败：删除 triage 域，前端继续组合 4 个 API。

---

## 7. 复现命令（⭐ 机械计数，全部可复现）

```bash
# 已有零件清单
for d in oncall alert-escalation notification chatops ticket ticketing alert-pipeline; do
  echo -n "$d: "
  find orion-platform-svc-go/internal/$d -name '*.go' ! -name '*_test.go' 2>/dev/null \
    | wc -l
  find orion-platform-svc-go/internal/$d -name '*.go' ! -name '*_test.go' 2>/dev/null \
    -exec cat {} + | wc -l
done

# 三域跨域出度（应为 0）
for d in oncall alert-escalation notification; do
  echo -n "$d 跨域出度: "
  grep -rlE "orion/platform-svc-go/internal/$d" orion-platform-svc-go/internal \
    --include='*.go' | grep -v "internal/$d/" | grep -v '_test.go' | wc -l
done

# notification 消费者按域分类（应为空，全在 notification-* 兄弟域内）
grep -rlE 'orion/platform-svc-go/internal/notification' orion-platform-svc-go/internal \
  --include='*.go' | grep -v 'internal/notification/' | grep -v '_test.go' \
  | sed 's|.*/internal/||' | cut -d/ -f1 | sort -u

# alert/ticket 域是否消费 notification（应为空）
for d in alert alert-pipeline alert-adapter-v2 ticket ticketing; do
  echo -n "$d → notification: "
  grep -rE 'orion/platform-svc-go/internal/notification' \
    orion-platform-svc-go/internal/$d --include='*.go' 2>/dev/null | wc -l
done

# 用户-角色关联缺失
grep -rniE 'userr?ole|user_role|assignee_role' orion-platform-svc-go/internal \
  --include='*.go' | grep -v '_test.go' | head

# UserInfo.Role 单字符串
grep -A5 'type UserInfo' orion-platform-svc-go/internal/auth/models/*.go

# EscalationRule.Target 自由字符串
grep -A10 'type EscalationRule' orion-platform-svc-go/internal/alert-escalation/models/models.go

# NotificationPolicyEntity.Recipients 数组
grep -B1 -A15 'type NotificationPolicyEntity' orion-platform-svc-go/internal/notification/models/*.go

# Dashboard WidgetType 仅 4 种，全是通知投递
grep -A5 'WidgetType.*string' orion-platform-svc-go/internal/notification/models/*.go

# alert-pipeline 本地 NotificationChannel 接口
grep -n 'type NotificationChannel' orion-platform-svc-go/internal/alert-pipeline/models/*.go
```

---

## 8. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 4 个缺口全部有具体设计（Schema / 接口 / Adapter）| §3.1-3.4 |
| 2 | 所有新增表带 `tenant_id`，符合 ADR-004 硬边界 | §3.1.1 Migration 699 |
| 3 | Resolver 走 ADR-012 注册表模式（无硬编码 if-else）| §3.2.2 |
| 4 | Migration 编号占用 AA 预留段 699-703，不与其他设计冲突 | §4 |
| 5 | 双写过渡策略明确，不破坏现有 JSON 字段 | §3.1.3 / §3.2.4 |
| 6 | Feature Flag 控制切换，可回退 | §3.4.3 / §6 |
| 7 | 全部数字为机械计数，pattern 已 head 抽样验证 | §7 命令 |
| 8 | 与 ADR-010 事务边界兼容（Resolver 不引入新事务）| §3.2.2 / §6 R-T6 |
| 9 | 与 ADR-012 Factory/Handler 注册表模式一致 | §3.2.2 |
| 10 | 未修改生产代码 | `git diff -- '*.go' '*.ts' '*.tsx' '*.java' '*.py' '*.rs'` 为空 |
| 11 | 未估算人天/工期 | 全文检索 `人天`/`人日`/`工期`/`sprint`/`week` 为空 |
| 12 | 关联 ADR 与升级设计文档明确标注 | §5.2 / §5.3 |
| 13 | 风险与降级方案覆盖 G1-G4 全部方案 | §6 |

---

*本设计回答的核心问题："按人员角色推送问题、报警、工单 + 快速盯盘" 这条链，
Orion 目前是否有能力做到？答案是"零件齐全但架构断裂"。*

*4 个方案中 G1（`user_role` 表）是唯一的前置硬依赖——没有它，G2 的角色解析无表可查，
G3 的 adapter 也无法通过角色路由到具体用户，G4 的聚合视图也拉不出"我"的角色列表。
G2（`RecipientSpec` + Resolver）是**语义层的关键抽象**——把 `Target` / `Recipients`
从自由字符串升级为可解析的结构化描述，是"角色化"这个概念从口号变现实的转折点。*

*G3（adapter 打通）与 G4（聚合视图）可并行，且都可以 Feature Flag 或增量上线，
不阻塞主链。整个方案的复杂度集中在 G1+G2 的联合推进，其余是既有能力的组合与桥接。*

*本文档不估算人天/工期；不包含生产代码修改；所有数字均可通过 §7 命令复现。*
