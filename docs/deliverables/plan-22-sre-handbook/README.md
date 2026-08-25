# Plan 22 — SRE 运维手册 (SRE Handbook)

> 优先级: P2  
> 来源: v3.5 系统评审 — 本地代码扫描新增  
> 日期: 2026-08-26

## 本地代码扫描结果

| 模块 | 路径 | 文件数 | 行数 | 状态 |
|------|------|--------|------|------|
| Runbook | `internal/runbook/` | handler+models+repository+service | ~800 | ✅ 有基础CRUD |
| On-Call | `internal/oncall/` | handler+models+repository+service+test | ~1200 | ✅ 有Schedule/Rotation |

### 已有能力
- `Schedule` 模型: ID/TenantID/Name/Description/IsPrimary/CreatedAt/UpdatedAt
- `Rotation` 模型: ID/ScheduleID/UserID/UserName/IsActive/StartDate/EndDate
- Runbook CRUD handler + repository + service
- On-Call schedule + rotation CRUD
- On-Call 测试文件 (`oncall_test.go`)

### 缺口
1. **无告警规则管理** — 无 AlertRule 模型，无阈值配置，无告警路由
2. **无值班日历视图** — 无日历 API，无 iCal 导出，无冲突检测
3. **无 Runbook 关联** — 告警未关联 Runbook，无自动打开修复步骤
4. **无事后复盘流程** — 无 PostMortem 模型，无 RCA 模板，无 Action Item 跟踪
5. **无容量规划** — 无 CapacityMetric，无容量预测，无扩容建议
6. **无 SLO/SLI 管理** — 无 SLO 定义，无 Error Budget 追踪，无 Burn Rate 告警
7. **无噪声抑制** — 无告警分组，无抑制规则，无 ACK 机制

## 设计方案

### 1. 告警规则模型

```go
type AlertRule struct {
    ID          uuid.UUID `json:"id"`
    TenantID    uuid.UUID `json:"tenant_id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Expression  string    `json:"expression"`  // PromQL/Metric expression
    Threshold   float64  `json:"threshold"`
    Operator    string    `json:"operator"`     // gt, lt, gte, lte, eq
    Duration    string    `json:"duration"`     // for state: 5m, 10m
    Severity    string    `json:"severity"`     // critical, warning, info
    RunbookID   *uuid.UUID `json:"runbook_id"`  // 关联 Runbook
    ScheduleID  *uuid.UUID `json:"schedule_id"` // 路由到值班表
    Enabled     bool      `json:"enabled"`
    CreatedAt   time.Time `json:"created_at"`
}
```

### 2. 值班日历

```go
type CalendarEvent struct {
    ScheduleID  uuid.UUID `json:"schedule_id"`
    UserID      string    `json:"user_id"`
    UserName    string    `json:"user_name"`
    StartDate   time.Time `json:"start_date"`
    EndDate     time.Time `json:"end_date"`
    IsPrimary   bool      `json:"is_primary"`
    Conflict    bool      `json:"conflict"` // 检测重叠
}
```

- **iCal 导出**: `GET /api/v1/oncall/schedules/{id}/calendar.ics`
- **冲突检测**: 创建 Rotation 时检查同一用户在同一时间段是否有其他值班
- **自动轮换**: cron job 根据轮换策略自动创建下一个周期的 Rotation

### 3. 事后复盘

```go
type PostMortem struct {
    ID           uuid.UUID    `json:"id"`
    IncidentID   string       `json:"incident_id"`
    Title        string       `json:"title"`
    Severity     string       `json:"severity"`
    Status       string       `json:"status"` // draft, in_review, published
    Summary      string       `json:"summary"`
    RootCause    string       `json:"rootCause"`
    Impact       string       `json:"impact"`
    Timeline     []TimelineEntry `json:"timeline"`
    ActionItems  []ActionItem  `json:"actionItems"`
    Participants []string      `json:"participants"`
    CreatedAt    time.Time    `json:"created_at"`
    PublishedAt  *time.Time   `json:"publishedAt,omitempty"`
}

type ActionItem struct {
    ID          uuid.UUID `json:"id"`
    Description string   `json:"description"`
    OwnerID     string   `json:"ownerId"`
    Status      string   `json:"status"` // open, in_progress, done
    DueDate     time.Time `json:"dueDate"`
    PostMortemID uuid.UUID `json:"postMortemId"`
}
```

### 4. SLO/SLI 管理

```go
type SLO struct {
    ID           uuid.UUID `json:"id"`
    Name         string    `json:"name"`
    Service      string    `json:"service"`
    Target       float64   `json:"target"`       // 99.9, 99.95
    Window       string    `json:"window"`        // 30d, 7d
    SLIExpression string   `json:"sliExpression"` // success/total
    ErrorBudget  float64   `json:"errorBudget"`   // (1-target) * window
    BurnRate     float64   `json:"burnRate"`      // 当前 burn rate
    CreatedAt    time.Time `json:"createdAt"`
}

type ErrorBudgetStatus struct {
    SLOID        uuid.UUID `json:"sloId"`
    Available    float64   `json:"available"`   // 剩余 budget 百分比
    Consumed     float64   `json:"consumed"`    // 已消耗 budget
    BurnRate    float64   `json:"burnRate"`    // 消耗速率
    Projected   float64   `json:"projected"`   // 预计耗尽时间
    Status      string    `json:"status"`      // healthy, at_risk, exhausted
}
```

### 5. 告警噪声抑制

```go
type AlertInhibitionRule struct {
    ID            uuid.UUID `json:"id"`
    SourceMatch   map[string]string `json:"sourceMatch"` // 标签匹配
    TargetMatch   map[string]string `json:"targetMatch"`
    Equal         []string  `json:"equal"` // 相同标签才抑制
    Duration      string    `json:"duration"`
}

type AlertGroup struct {
    Key        string         `json:"key"`
    Alerts     []AlertEvent   `json:"alerts"`
    Severity   string         `json:"severity"`
    ACKUserID  string         `json:"ackUserId,omitempty"`
    ACKedAt    *time.Time     `json:"ackedAt,omitempty"`
    CreatedAt  time.Time      `json:"createdAt"`
}
```

### API 端点设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/sre/alert-rules` | 获取告警规则列表 |
| POST | `/api/v1/sre/alert-rules` | 创建告警规则 |
| PUT | `/api/v1/sre/alert-rules/{id}` | 更新告警规则 |
| GET | `/api/v1/oncall/schedules/{id}/calendar.ics` | 导出值班日历 |
| POST | `/api/v1/sre/postmortems` | 创建事后复盘 |
| PUT | `/api/v1/sre/postmortems/{id}/actions/{actionId}` | 更新 Action Item |
| GET | `/api/v1/sre/slos` | 获取 SLO 列表 |
| GET | `/api/v1/sre/slos/{id}/error-budget` | 获取 Error Budget 状态 |
| POST | `/api/v1/sre/alert-groups/{key}/ack` | ACK 告警组 |

### 合并策略

1. **复用** `internal/oncall/` 的 Schedule/Rotation 模型 — 不重建
2. **增强** `internal/runbook/` — 增加 RunbookStep 结构，关联 AlertRule
3. **新增** `internal/sre/` 模块 — AlertRule, PostMortem, SLO, AlertGroup
4. **新增** `internal/oncall/calendar.go` — iCal 导出 + 冲突检测
5. 前端新增 `src/pages/sre/` — AlertRulePage, PostMortemPage, SLODashboardPage

### 实现优先级

| 优先级 | 任务 | 预计工时 |
|--------|------|----------|
| P0 | SLO/Error Budget 追踪 | 3d |
| P0 | 告警规则 + Runbook 关联 | 2d |
| P1 | 事后复盘 + Action Items | 3d |
| P1 | 告警分组 + ACK + 噪声抑制 | 2d |
| P2 | 值班日历 iCal 导出 | 1d |
| P2 | 容量规划 + 扩容建议 | 3d |