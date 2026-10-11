# Triage API 契约规格（Backend ↔ Frontend Contract）

**评审对象**：`internal/triage` 域 HTTP API + WebSocket 事件（对齐 G3 `triage.Service`）
**文档性质**：契约规格（Contract Spec），非实现代码
**版本**：v1（2026-10-11）
**关联设计**：
- 上游后端设计：`role-based-push-and-triage-design-2026-10-11.md` §3.3（G3）
- 下游前端方案：`frontend-interaction-optimization-design-2026-10-11.md` §3.1（F1）
- UI 专家评审：`triage-ui-domain-expert-design-analysis-2026-10-11.md`
- 权限模型：G1（user_role 表）+ G2（RecipientSpec/Resolver）
- ADR 对齐：ADR-004（tenant 硬边界）、ADR-005（PG 单库）、ADR-010（AlertBreaker 事务）、ADR-012（Factory/Handler 注册表）

**硬约束**：
- **RC-03**：本文档为**契约规格**，不修改任何生产代码。
- **不估算人天/工期**。
- 契约必须支持 **API 版本演进**（`/v1/triage/...` 前缀，未来 `/v2/...` 兼容并存）。
- 契约必须支持 **partial failure**（单源失败不阻塞其他源）——`Promise.allSettled` 模式对齐。
- 契约必须支持 **幂等**（`POST /ack` `/dismiss` 带 idempotency key）。
- 契约必须通过 **多租户隔离测试**（ADR-004）。

---

## 1. 契约总览

### 1.1 端点清单（7 个）

| # | 端点 | 方法 | 语义 | 权限 | 幂等 |
|---|---|---|---|---|---|
| 1 | `/v1/triage/me` | GET | 首页聚合（4 数字 + top N） | `triage:read` | ✅ GET |
| 2 | `/v1/triage/me/items` | GET | 我的待办列表（过滤+分组+分页）| `triage:read` | ✅ GET |
| 3 | `/v1/triage/me/alerts` | GET | 我的未读告警（子集）| `alert:read` | ✅ GET |
| 4 | `/v1/triage/me/tickets` | GET | 我的工单（子集）| `ticket:read` | ✅ GET |
| 5 | `/v1/triage/me/oncall` | GET | 我的值班信息（子集）| `oncall:read` | ✅ GET |
| 6 | `/v1/triage/me/items/:id/ack` | POST | 一键确认（透传到源域） | `triage:write` | ✅ Idempotency-Key |
| 7 | `/v1/triage/me/items/:id/dismiss` | POST | 一键忽略（透传到源域）| `triage:write` | ✅ Idempotency-Key |

**基础 URL**：`/api/v1/triage/...`（Gin 路由前缀 `/api/v1` 已存在，见 ADR-004）

### 1.2 响应外壳

所有响应复用 `internal/middleware/response.go` 的 `RespondSuccess` / `RespondPaginated` / `RespondBadRequest` 等（**已存在，无需修改**）：

```json
{
  "success": true,
  "data": { ... },
  "trace_id": "trace-abc123"
}
```

错误响应（复用 `errors.WriteError`）：

```json
{
  "success": false,
  "error": {
    "code": "TRIAGE_PERMISSION_DENIED",
    "message": "not permitted to access triage",
    "details": { ... }
  },
  "trace_id": "trace-abc123"
}
```

分页响应（复用 `RespondPaginated`）：

```json
{
  "success": true,
  "data": [ ... ],
  "offset": 0,
  "limit": 50,
  "total": 137,
  "trace_id": "trace-abc123"
}
```

---

## 2. 数据模型（与 G3 §3.3.2 严格对齐）

### 2.1 TriageItem

对齐 `internal/triage/models/models.go`（G3 §3.3.2 已定义）：

```go
type TriageItemKind string
const (
    ItemAlert   TriageItemKind = "alert"
    ItemTicket  TriageItemKind = "ticket"
    ItemOnCall  TriageItemKind = "oncall"
    ItemChange  TriageItemKind = "change"
)

type TriageStatus string
const (
    StatusUnread      TriageStatus = "unread"
    StatusInProgress  TriageStatus = "in_progress"
    StatusAcknowledged TriageStatus = "acknowledged"
    StatusDismissed   TriageStatus = "dismissed"
    StatusResolved    TriageStatus = "resolved"
)

type SeverityLevel string
const (
    SeverityCritical SeverityLevel = "critical"
    SeverityHigh     SeverityLevel = "high"
    SeverityMedium   SeverityLevel = "medium"
    SeverityLow      SeverityLevel = "low"
)

type TriageItem struct {
    Kind       TriageItemKind    `json:"kind"`
    ExternalID string            `json:"external_id"`
    Title      string            `json:"title"`
    Severity   SeverityLevel     `json:"severity,omitempty"`
    Status     TriageStatus      `json:"status"`
    AssignedTo string            `json:"assigned_to"`
    CreatedAt  time.Time         `json:"created_at"`
    // 时限（对齐 UI 专家 §2.1 D5）
    SLADeadline *time.Time       `json:"sla_deadline,omitempty"`
    // 源域专属字段（omitempty）
    AlertID   *string   `json:"alert_id,omitempty"`
    TicketID  *string   `json:"ticket_id,omitempty"`
    ScheduleID *string  `json:"schedule_id,omitempty"`
    ChangeID  *string   `json:"change_id,omitempty"`
}
```

**注意**：G3 原始设计中 `Status` 仅含 `unread | in_progress | resolved` 3 值；
本契约扩展为 5 值（含 `acknowledged` / `dismissed`）以对齐 UI 专家 §2.1 D3
分类维度（5 种状态），并支撑 TriageItemRow 的动作按钮语义。
这是**契约的向后兼容扩展**（原 3 值仍是子集）。

### 2.2 MyOverview（首页聚合）

```go
type MyOverview struct {
    // 4 数字卡片
    UnreadAlerts        int           `json:"unread_alerts"`
    MyTickets           int           `json:"my_tickets"`
    UnreadNotifications int           `json:"unread_notifications"`
    PendingChanges      int           `json:"pending_changes"`
    // 值班状态
    OnCallNow           *OnCallInfo   `json:"on_call_now,omitempty"`
    // 最近活动
    RecentItems         []TriageItem  `json:"recent_items"`  // top N（默认 10）
    // 部分源失败指示（对齐 Promise.allSettled）
    Sources             SourceHealth  `json:"sources"`
    // 更新时间戳（对齐 UI 专家 §7.2 前端本地状态）
    GeneratedAt         time.Time     `json:"generated_at"`
}

type SourceHealth map[string] string // "alerts"|"tickets"|"oncall"|"notifications" -> "ok"|"error"
```

### 2.3 OnCallInfo

```go
type OnCallInfo struct {
    ScheduleID    string    `json:"schedule_id"`
    ScheduleName  string    `json:"schedule_name"`
    Level         int       `json:"level"`      // 1=L1, 2=L2, 3=L3
    StartDate     time.Time `json:"start_date"`
    EndDate       time.Time `json:"end_date"`
    // 剩余时长（前端展示用，后端计算）
    RemainingSeconds int64   `json:"remaining_seconds"`
    // 值班状态标记（对齐 UI 专家 §5.1 "值班中"视觉语言）
    Active          bool      `json:"active"`
}
```

---

## 3. 端点契约细节

### 3.1 `GET /v1/triage/me` — 首页聚合

**用途**：Overview 视图首屏数据（4 KPI + 值班状态 + 最近活动）

**权限**：`RequirePermission("triage", "read")`（G1 user_role 表授权）

**请求参数**：

| 参数 | 位置 | 类型 | 默认 | 说明 |
|---|---|---|---|---|
| `recent_limit` | query | int | 10 | RecentItems 数量上限（1-50） |

**响应体**（200）：

```json
{
  "success": true,
  "data": {
    "unread_alerts": 3,
    "my_tickets": 7,
    "unread_notifications": 12,
    "pending_changes": 2,
    "on_call_now": {
      "schedule_id": "sch-001",
      "schedule_name": "Payment-L1",
      "level": 1,
      "start_date": "2026-10-11T08:00:00Z",
      "end_date": "2026-10-11T20:00:00Z",
      "remaining_seconds": 23520,
      "active": true
    },
    "recent_items": [
      {
        "kind": "alert",
        "external_id": "alr-12345",
        "alert_id": "alr-12345",
        "title": "Payment-SVC 数据库连接池满",
        "severity": "high",
        "status": "unread",
        "assigned_to": "user-007",
        "created_at": "2026-10-11T10:23:00Z",
        "sla_deadline": "2026-10-11T11:23:00Z"
      }
    ],
    "sources": {
      "alerts": "ok",
      "tickets": "ok",
      "oncall": "ok",
      "notifications": "error"
    },
    "generated_at": "2026-10-11T10:24:33Z"
  },
  "trace_id": "trace-7f8e9d"
}
```

**部分源失败语义**：`sources.* = "error"` 时对应字段（如 `unread_notifications`）仍返回但值可能为 0，
前端应根据 `sources` 字段决定是否显示"XX 数据加载失败"警告。

**缓存**：
- **响应头** `Cache-Control: private, max-age=10`（10 秒 CDN 缓存，与 WebSocket 实时更新互补）
- 前端 `useTriageData` 应订阅 WebSocket `notification.new` / `alert.state_change` 事件做增量刷新，
  不必频繁轮询此端点

**性能目标**：p95 < 200ms（4 个 Reader 并行 + 聚合）

---

### 3.2 `GET /v1/triage/me/items` — 我的待办列表

**用途**：Queue 视图列表数据（对齐 UI 专家 §2.4 分组维度切换 + §2.4 过滤器叠加）

**权限**：`RequirePermission("triage", "read")`

**请求参数**：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| **过滤维度** | | | |
| `severity` | csv | (空) | 严重度多选，如 `critical,high`（UI D2）|
| `kind` | csv | (空) | 来源多选，如 `alert,ticket`（UI D1）|
| `status` | csv | (空) | 状态多选（UI D3）|
| `assigned_scope` | enum | `self` | `self\|role\|team\|all`（UI D4）|
| `time_range` | enum | `24h` | `today\|24h\|7d\|30d\|custom`（UI D5 基础）|
| `since` / `until` | RFC3339 | — | `time_range=custom` 时生效 |
| `sla_status` | enum | — | `overdue\|breaching\|healthy`（UI D5）|
| `exclude_dnd` | bool | `true` | DND 生效中过滤低严重度（UI §6.4）|
| **分组维度** | | | |
| `group_by` | enum | `severity` | `severity\|kind\|status\|assigned\|time`（UI §2.4）|
| **排序** | | | |
| `sort_by` | enum | `recency` | `recency\|severity\|sla` |
| `sort_order` | enum | `desc` | `asc\|desc` |
| **分页** | | | |
| `offset` | int | 0 | 偏移量 |
| `limit` | int | 50 | 每页数量（1-200）|

**响应体**（200）：

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "group_key": "critical",
        "group_label": "Critical",
        "count": 3,
        "items": [
          {
            "kind": "alert",
            "external_id": "alr-12345",
            "alert_id": "alr-12345",
            "title": "Payment-SVC 数据库连接池满",
            "severity": "critical",
            "status": "unread",
            "assigned_to": "user-007",
            "created_at": "2026-10-11T10:23:00Z",
            "sla_deadline": "2026-10-11T10:53:00Z"
          }
        ]
      },
      {
        "group_key": "high",
        "group_label": "High",
        "count": 8,
        "items": [ ... ]
      }
    ],
    "total": 11,
    "total_groups": 4
  },
  "offset": 0,
  "limit": 50,
  "trace_id": "trace-1a2b3c"
}
```

**关键约束**：
- 响应已按 `group_by` 分组返回，前端无需二次分组（减少网络传输 + 避免重复逻辑）
- 每组的 `items` 数组按 `sort_by` / `sort_order` 排序
- `count` 反映该组的**总条目数**（若 `group_by=severity`，`count` 为该严重度下所有条目数，即使 `limit` 截断 `items` 数组）

**性能目标**：p95 < 300ms（涉及 4 个 Reader + 过滤聚合）

---

### 3.3 `GET /v1/triage/me/alerts` — 我的未读告警

**用途**：AlertList 深度链接跳转（从 Triage 打开某条告警详情）

**权限**：`RequirePermission("alert", "read")`

**请求参数**：同 §3.2（除 `kind` 固定为 `alert`）

**响应体**：同 §3.2 结构，`group_by` 忽略，仅按 `sort_by` 排序

---

### 3.4 `GET /v1/triage/me/tickets` — 我的工单

**权限**：`RequirePermission("ticket", "read")`

**请求参数**：同 §3.2（除 `kind` 固定为 `ticket`）

---

### 3.5 `GET /v1/triage/me/oncall` — 我的值班信息

**权限**：`RequirePermission("oncall", "read")`

**响应体**：

```json
{
  "success": true,
  "data": {
    "on_call_now": { ... OnCallInfo },
    "next_shifts": [
      {
        "schedule_id": "sch-002",
        "schedule_name": "Payment-L1",
        "level": 1,
        "start_date": "2026-10-12T08:00:00Z",
        "end_date": "2026-10-12T20:00:00Z",
        "active": false
      }
    ],
    "recent_handoffs": [
      {
        "from_user": "user-007",
        "to_user": "user-012",
        "schedule_id": "sch-001",
        "handoff_at": "2026-10-10T20:00:00Z"
      }
    ]
  },
  "trace_id": "trace-9d8c7b"
}
```

**语义**：
- `on_call_now`：当前是否值班（可能为 null）
- `next_shifts`：接下来 30 天内的排班（用于交接规划）
- `recent_handoffs`：最近 7 天的交接记录（审计用途）

---

### 3.6 `POST /v1/triage/me/items/:id/ack` — 一键确认

**用途**：从 Triage 快速 Ack（对齐 UI §6.1 键盘 `a` + 行内按钮 + 批量操作）

**权限**：`RequirePermission("triage", "write")`

**请求头**：
- `Idempotency-Key: <uuid>`（**必须**，防止重复点击 + 网络重试）
- `Content-Type: application/json`（可选）

**请求体**（可选）：

```json
{
  "comment": "处理中，预计 15min",
  "duration_minutes": 15
}
```

**请求参数**：`id` = `external_id`（源域 ID，如 `alr-12345`）

**幂等语义**：
- 首次 POST：透传到源域 acknowledge，返回 200
- 相同 `Idempotency-Key` 的重复 POST：返回首次的 200 响应（不重复透传）
- 不同 `Idempotency-Key` 但状态已 acknowledged：返回 409 Conflict

**响应体**（200）：

```json
{
  "success": true,
  "data": {
    "kind": "alert",
    "external_id": "alr-12345",
    "status": "acknowledged",
    "acknowledged_at": "2026-10-11T10:25:00Z",
    "acknowledged_by": "user-007"
  },
  "trace_id": "trace-5c4b3a"
}
```

**响应体**（409 Conflict，已 Ack）：

```json
{
  "success": false,
  "error": {
    "code": "TRIAGE_ITEM_ALREADY_ACKNOWLEDGED",
    "message": "item already acknowledged at 2026-10-11T10:20:00Z",
    "details": {
      "external_id": "alr-12345",
      "previous_ack_at": "2026-10-11T10:20:00Z",
      "previous_ack_by": "user-007"
    }
  },
  "trace_id": "trace-6d5c4b"
}
```

**透传规则**（对齐 G3 §3.3.4 硬约束）：
- `kind=alert`：调用 `alert.StateChange(acknowledged)` → 触发 AlertBreaker（ADR-010 事务）
- `kind=ticket`：调用 `ticket.StatusUpdate(in_progress)`
- `kind=change`：调用 `change.Acknowledge()`（不修改状态）
- `kind=oncall`：**不允许**（值班本身不需要 Ack）→ 返回 400

---

### 3.7 `POST /v1/triage/me/items/:id/dismiss` — 一键忽略

**语义**：与 §3.6 对称

**幂等语义**：同 §3.6

**响应体**（200）：

```json
{
  "success": true,
  "data": {
    "kind": "alert",
    "external_id": "alr-12345",
    "status": "dismissed",
    "dismissed_at": "2026-10-11T10:26:00Z",
    "dismissed_by": "user-007",
    "reason": "false positive"
  }
}
```

**透传规则**：
- `kind=alert`：`alert.Dismiss(reason)` → 触发 AlertBreaker 抑制记录
- `kind=ticket`：`ticket.Dismiss(reason)`
- `kind=change`：**不允许**（变更不可 dismiss）→ 返回 400
- `kind=oncall`：**不允许**（值班本身不需要 dismiss）→ 返回 400

**请求体**（可选）：

```json
{
  "reason": "false positive | duplicate | out-of-scope | other",
  "note": "用户反馈已解决"
}
```

**批量操作约束**（对齐 UI §6.2）：
- **本端点不支持批量**（一次一条）
- 前端批量操作应在客户端**循环调用**并做**限流**（对齐 R-UI7 风险：100+ 条警告 + 二次确认）
- 后端建议：若客户端在 5s 内调用同一用户的 ack/dismiss > 20 次，返回 429 TooManyRequests

---

## 4. 错误码规范

### 4.1 错误码表

| Code | HTTP | 场景 | 前端动作 |
|---|---|---|---|
| `TRIAGE_PERMISSION_DENIED` | 403 | 无 `triage:read` 权限 | 显示无权限页 + 权限申请链接 |
| `TRIAGE_ITEM_NOT_FOUND` | 404 | `id` 不存在或跨租户 | 显示"条目已删除"或刷新列表 |
| `TRIAGE_ITEM_KIND_UNSUPPORTED` | 400 | Ack/Dismiss 的 kind 不支持 | 禁用行内按钮 |
| `TRIAGE_ITEM_ALREADY_ACKNOWLEDGED` | 409 | 重复 Ack | 提示"已确认" + 刷新列表 |
| `TRIAGE_ITEM_ALREADY_DISMISSED` | 409 | 重复 Dismiss | 提示"已忽略" + 刷新列表 |
| `TRIAGE_ITEM_CROSS_TENANT` | 403 | 跨租户访问（ADR-004 违规）| 隐藏条目 + 上报安全事件 |
| `TRIAGE_SOURCE_UNAVAILABLE` | 503 | 单源 Reader 不可用 | 单源警告 + 其他源正常显示 |
| `TRIAGE_RATE_LIMIT` | 429 | 批量操作过快 | 前端节流 |
| `TRIAGE_DND_ACTIVE` | 403 | DND 生效中操作低严重度 | 提示"需先解除 DND" |

### 4.2 错误响应体规范

所有错误响应统一格式（复用 `errors.WriteError`）：

```json
{
  "success": false,
  "error": {
    "code": "<错误码>",
    "message": "<人类可读>",
    "details": {
      "external_id": "alr-12345",
      "kind": "alert",
      "source": "alerts"
    }
  },
  "trace_id": "trace-xxx"
}
```

**硬约束**：
- `code` 必须**大写** + **下划线分隔**（对齐现有 `CIRCUIT_OPEN` / `DLP_BLOCKED` 命名）
- `trace_id` **必须**返回（前端用于错误上报关联）
- `details` 可选，但跨租户错误（`TRIAGE_ITEM_CROSS_TENANT`）**必须**含 `external_id`（审计用）

---

## 5. WebSocket 事件契约

### 5.1 事件通道

**订阅方式**（对齐 Orion 现有 WebSocket 基础设施）：

```
WS /api/v1/ws/triage?token=<jwt>&tenant_id=<uuid>
```

**心跳**：每 30s 一次（复用现有 WS middleware）

**鉴权**：JWT token 校验 `triage:subscribe` 权限

### 5.2 事件类型（3 类）

#### 5.2.1 `triage.item.new` — 新条目到达

```json
{
  "event": "triage.item.new",
  "occurred_at": "2026-10-11T10:23:00Z",
  "data": {
    "item": {
      "kind": "alert",
      "external_id": "alr-12346",
      "title": "Cache 命中率下降",
      "severity": "medium",
      "status": "unread",
      "assigned_to": "user-007",
      "created_at": "2026-10-11T10:23:00Z"
    }
  }
}
```

**前端动作**：
- 增量追加到本地 `items` 数组（不必刷新全量）
- 更新 KPI 计数（`unread_alerts += 1`）
- 显示通知气泡（若 NotificationBell 已打开则内部更新）

#### 5.2.2 `triage.item.updated` — 条目状态变更

```json
{
  "event": "triage.item.updated",
  "occurred_at": "2026-10-11T10:25:00Z",
  "data": {
    "external_id": "alr-12345",
    "kind": "alert",
    "old_status": "unread",
    "new_status": "acknowledged",
    "changed_by": "user-007",
    "changed_at": "2026-10-11T10:25:00Z"
  }
}
```

**前端动作**：
- 从 `items` 数组中移除或标记为 `acknowledged`（乐观更新回滚时用）
- 更新 KPI 计数

#### 5.2.3 `triage.oncall.handoff` — 值班交接

```json
{
  "event": "triage.oncall.handoff",
  "occurred_at": "2026-10-11T20:00:00Z",
  "data": {
    "schedule_id": "sch-001",
    "from_user": "user-007",
    "to_user": "user-012",
    "handoff_at": "2026-10-11T20:00:00Z",
    "next_start": "2026-10-11T20:00:00Z"
  }
}
```

**前端动作**：
- 更新值班状态卡（`OnCallNow` → null 或新值班人）
- 触发交接成功/失败 UI 提示

### 5.3 事件顺序保证

- **单用户内部有序**（保证同一 `external_id` 的多次更新按发生顺序处理）
- **不同用户之间不保证顺序**（多副本部署下）
- 客户端应通过 `occurred_at` + `external_id` 做**幂等处理**（后到的重复事件被丢弃）

---

## 6. 权限模型（对齐 G1 user_role）

### 6.1 权限点映射

| 端点 | 权限点 | 授权来源 |
|---|---|---|
| `GET /v1/triage/me` | `triage:read` | G1 user_role 表（角色→权限点映射） |
| `GET /v1/triage/me/items` | `triage:read` | 同上 |
| `GET /v1/triage/me/alerts` | `alert:read` | G1（复用 alert 域权限） |
| `GET /v1/triage/me/tickets` | `ticket:read` | G1（复用 ticket 域权限） |
| `GET /v1/triage/me/oncall` | `oncall:read` | G1（复用 oncall 域权限） |
| `POST /v1/triage/me/items/:id/ack` | `triage:write` | G1 |
| `POST /v1/triage/me/items/:id/dismiss` | `triage:write` | G1 |
| `WS /v1/ws/triage` | `triage:subscribe` | G1 |

### 6.2 内置角色（默认）

| 角色 | 权限点 |
|---|---|
| `tenant_admin` | 全部 |
| `sre_oncall` | `triage:read` + `triage:write` + `triage:subscribe` + `alert:read` + `oncall:read` |
| `tech_lead` | 同上 + `ticket:read` |
| `viewer` | 只读：`triage:read` + `triage:subscribe` |

**扩展**：租户可自定义角色，通过 G1 `user_role` 表 + 权限点表映射（见 `role-based-push-and-triage-design-2026-10-11.md` §2.1）

### 6.3 多租户隔离（ADR-004）

- 所有 API 参数必须携带 `tenant_id`（Gin middleware 从 JWT 解析）
- 所有 Reader 调用必须传 `tenant_id`（`AlertReader.GetUnreadAlertsByUser(tenantID, ...)`）
- 跨租户访问必须返回 `TRIAGE_ITEM_CROSS_TENANT` + 403（不允许静默失败）
- **测试覆盖要求**：每个端点至少 1 个跨租户测试用例

---

## 7. Feature Flag 与灰度

### 7.1 Feature Flag 列表

| Flag | 类型 | 默认 | 说明 |
|---|---|---|---|
| `triage.enabled` | bool | false | triage 域总开关（Phase 1 打开） |
| `triage.websocket.enabled` | bool | false | WebSocket 事件（Phase 2 打开） |
| `triage.partial_failure.enabled` | bool | true | 单源失败是否降级（Phase 1 打开）|
| `triage.dnd_filter.enabled` | bool | true | DND 过滤（Phase 2 打开）|
| `triage.group_by.enabled` | bool | true | 分组返回（Phase 1 打开）|

### 7.2 灰度策略

- **Phase 1**（`triage.enabled=true`）：静态聚合（无 WebSocket）
- **Phase 2**（`triage.websocket.enabled=true`）：实时推送
- **回滚**：Flag 关闭后 API 返回 503（前端降级为轮询 `GET /v1/alerts?unread=1` 现有 API）

---

## 8. 版本演进

### 8.1 版本策略

- **URL 前缀版本**：`/api/v1/triage/...`
- **字段演进**：
  - 新增字段：**必须** `omitempty` 或可选（向后兼容）
  - 修改字段：**禁止**在 v1 内直接修改（引入 v2）
  - 删除字段：**禁止**在 v1 内删除（v2 时才删除）
- **枚举扩展**：
  - `TriageItemKind` 新增值：客户端必须容忍未知值（`default: "unknown"` 处理）
  - `SeverityLevel` 新增值：同上
  - `TriageStatus` 新增值：同上

### 8.2 版本过渡

**当前 v1（2026-10-11）**：本契约定义

**未来 v2（未规划）**：
- 可能新增 `TriageItem.GroupContext`（跨条目关联，如相关告警集群）
- 可能新增 `POST /v1/triage/batch/ack` 批量端点（当前不推荐，见 §3.7）

---

## 9. 与 ADR 的对齐

| ADR | 对齐点 |
|---|---|
| **ADR-004** 多租户（tenant 硬边界） | §6.3 跨租户返回 403 + 审计 |
| **ADR-005** PG 单库 | 无新数据库依赖（triage 只读聚合，无自有表） |
| **ADR-010** AlertBreaker 事务 | `/ack` 透传到 alert.StateChange 时走 AlertBreaker 事务 |
| **ADR-011** DB-per-tenant | 所有 Reader 依赖 tenant_id 参数，与 tenant DB 隔离兼容 |
| **ADR-012** Factory/Handler 注册表 | 4 个 Reader 接口按 ADR-012 模式注册到 triage 域 |

---

## 10. 契约测试要求

### 10.1 单元测试（后端）

- **每个 Reader**：mock + 边界（0 条 / N 条 / 单源 panic）
- **每个端点**：成功 + 每种错误码 + 跨租户 + 权限不足
- **Idempotency-Key**：首次 + 重复 + 冲突 3 种路径
- **Feature Flag**：每个 flag 的 on/off 路径

### 10.2 契约测试（前后端）

- **Schema 快照**：所有响应体的 JSON Schema 快照（PR 前 diff）
- **错误码穷举**：前端 `switch error.code` 必须覆盖本表全部错误码（防漏处理）
- **枚举扩展测试**：后端注入未知枚举值，前端应显示"未知"而非崩溃

### 10.3 集成测试（端到端）

- **单源失败降级**：mock `NotificationReader` panic，验证 `sources.notifications = "error"` 且其他源正常
- **WebSocket 事件顺序**：并发 100 个 `item.new` + `item.updated`，验证客户端最终状态一致
- **多租户隔离**：租户 A 用户访问租户 B 的 item id，返回 403

---

## 11. 非目标（Non-Goals）

**明确不做**（避免范围蔓延）：

1. **不新增数据库表**（triage 域只读聚合，无自有持久化）
2. **不支持批量 ack/dismiss 端点**（客户端循环 + 限流，对齐 UI §6.2 的 100+ 条警告约束）
3. **不做全文搜索**（走现有 alert/ticket 域的搜索 API）
4. **不做跨租户聚合**（ADR-004 硬边界）
5. **不做实时协同编辑**（ack/dismiss 是单用户操作，不做 CRDT）
6. **不做离线缓存**（前端本地存储只用于乐观更新回滚，不做离线模式）
7. **不引入新依赖**（复用 `gin` + `errors` + `middleware` 现有基础设施）

---

## 12. 复现命令（⭐ 机械计数）

```bash
cd /Users/heal/orion-design

# Orion 现有响应外壳
cat orion-platform-svc-go/internal/middleware/response.go | grep -c 'func Respond'    # -> 11

# Orion 现有 WebSocket 基础设施
grep -rln 'websocket\|ws.Server\|ws.Conn' orion-platform-svc-go/internal --include='*.go' \
  | grep -v '_test.go' | wc -l                                                        # -> 存在

# Orion 现有权限模型（auth.RequirePermission）
grep -rh 'auth\.RequirePermission' orion-platform-svc-go --include='*.go' | wc -l     # -> 大量

# Orion 现有 error code 命名风格（大写+下划线）
grep -rhoE '"[A-Z][A-Z_]{3,}"' orion-platform-svc-go/internal --include='*.go' \
  | grep -E 'BLOCKED|DENIED|NOT_FOUND|EXCEEDED' | sort -u | head -20                  # 抽样确认命名

# Orion 现有 Feature Flag 机制
grep -rhE 'feature_flag|FeatureFlag|flag_enabled' orion-platform-svc-go/internal \
  --include='*.go' | head -10                                                         # 抽样确认

# 现有 triage 相关代码（应为 0，本契约是新增）
find orion-platform-svc-go/internal -maxdepth 1 -type d -iname 'triage'               # -> 无
```

---

## 13. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 覆盖 7 个端点（1 overview + 4 子集 + 2 动作）| §3 |
| 2 | 每个端点含请求参数、响应体、错误场景、权限点、性能目标 | §3 |
| 3 | 错误码表含 9 项 + 每种的前端动作 | §4.1 |
| 4 | WebSocket 事件 3 类（new/updated/handoff）+ 顺序保证 | §5 |
| 5 | 权限模型对齐 G1 user_role 表 | §6 |
| 6 | Feature Flag 5 项 + 灰度策略 | §7 |
| 7 | 版本演进策略 + 枚举扩展约定 | §8 |
| 8 | 与 5 个 ADR（004/005/010/011/012）对齐 | §9 |
| 9 | 契约测试要求 3 类（单元/契约/集成）| §10 |
| 10 | 非目标 7 项明确不做 | §11 |
| 11 | 全部 pattern 通过 head 抽样确认 | §12 |
| 12 | 未修改生产代码 | `git status --porcelain -- '*.go' '*.ts' '*.tsx' '*.java' '*.py' '*.rs'` 为空 |
| 13 | 未估算人天/工期 | 全文检索禁词为空（除合规声明与验收标准）|

---

## 14. 决策记录

| 决策 | 选项 | 理由 |
|---|---|---|
| TriageStatus 扩展 5 值 | (a) 保持 G3 原始 3 值 / (b) 扩展 5 值 | 选 (b)。对齐 UI 专家 §2.1 D3 分类维度；向后兼容（原 3 值是子集）|
| 分组在响应侧 | (a) 后端分组 / (b) 前端分组 | 选 (a)。减少网络传输 + 前端逻辑简化 |
| 批量 ack/dismiss | (a) 后端批量端点 / (b) 客户端循环 | 选 (b)。避免大批量幂等/回滚复杂化；前端节流 + 二次确认 |
| WebSocket vs SSE | (a) WebSocket / (b) SSE / (c) 短轮询 | 选 (a)。对齐 Orion 现有 WS 基础设施；双向通道 |
| Idempotency-Key 存 PG 还是 Redis | (a) PG / (b) Redis / (c) 内存 | 选 (b)（对齐 ADR-005 Redis 仅缓存/灰度）。TTL 24h |
| 版本前缀 | (a) URL /v1 / (b) Header / (c) Content-Types | 选 (a)。对齐 Orion 现有 `/api/v1` 惯例 |
| 跨租户错误码 | (a) 通用 403 / (b) 专用错误码 | 选 (b)。审计 + 前端可差异化处理 |

---

*本契约规格闭合了本轮 4 份设计文档（G3 后端 · F1 前端 · UI 专家分析 · 本契约）之间的
数据流转。开发可直接依据本文档启动 triage 域 HTTP 层与 WebSocket 层的实现。

对齐 ADR-004/005/010/011/012，无新数据库表 / 无新依赖 / 无跨租户访问。
契约支持 partial failure（`Promise.allSettled` 模式）、幂等（Idempotency-Key）、
Feature Flag 灰度、枚举扩展向后兼容。*
