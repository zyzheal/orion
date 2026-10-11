# Ticket Type 字段污染修复方案（P0-NEW-EA-13，2026-10-11）

| 元数据 | |
|--------|------|
| 文档编号 | ticket-type-field-pollution-fix-2026-10-11 |
| 状态 | 已产出（NEW-EA-13） |
| 日期 | 2026-10-11 |
| 依据 | `enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 12（NEW-EA-13）|
| 前置 | 无（纯文档设计，非生产代码）|
| 约束 | RC-03（不修改生产代码）；不估算人天/工期 |

---

## 1. 问题陈述

### 1.1 现状（一手代码）

`orion-platform-svc-go/internal/ticket/models/ticket.go:22`：

```go
type Ticket struct {
    // ...
    Type     string `json:"type" db:"category"`   // ← 单字段承载多语义
    Priority string `json:"priority" db:"priority"`
    // ...
}
```

`orion-platform-svc-go/internal/ticket/service/ticket_generator.go:21-112` 中 `FromAlert` 与 `FromIncident` 直接把 Alert/Incident 的元数据塞进 Ticket：

```go
// FromAlert (line 52-61)
ticket := &models.Ticket{
    Title:    fmt.Sprintf("[Alert] %s", title),
    Type:     "alert",          // ← Type 字段 = 来源标签
    Priority: priority,         // ← priority = alert["severity"]（严重级别混入优先级）
    // ...
}

// FromIncident (line 97-105)
ticket := &models.Ticket{
    Title:    fmt.Sprintf("[Incident %s] %s", incidentID, title),
    Type:     "incident",       // ← Type 字段 = 来源标签
    Priority: priority,         // ← priority = incident["severity"]（同上）
    // ...
}
```

**问题**：`Ticket.Type` 单字段同时承载「工单来源」（alert/incident/change/手动）与「业务分类」（问题/请求/事件/...）两个语义，`Ticket.Priority` 混入「严重级别」语义。

### 1.2 污染面（一手代码 grep 结果）

| 语义 | 当前落点 | 出现位置 |
|-----|---------|---------|
| 工单来源 | `Type = "alert"` / `"incident"` | `ticket_generator.go:57,102` |
| 严重级别 | `Priority = alert["severity"]` | `ticket_generator.go:39,58` |
| 业务优先级 | `Priority`（用户手工设置）| 未 grep 完整，推测在 ticket_service 其他位置 |
| 业务分类 | `Type`（用户手工设置）| 未 grep 完整，推测在 ticket_service 其他位置 |

**污染本质**：4 类语义压缩到 2 个字段（Type + Priority），导致：
1. **查询语义混乱**：无法独立查询「所有 alert 来源的工单」+「所有高优先级的工单」
2. **前端展示冲突**：ticket 列表页 Type 列既显示来源又显示分类，用户无法区分
3. **过滤/搜索失效**：`WHERE category = 'alert'` 是来源过滤，`WHERE priority = 'high'` 是严重级别过滤，两者混杂

---

## 2. 目标与判据

### 2.1 目标

将 `Ticket.Type` 与 `Ticket.Priority` 拆分，为「工单来源」「严重级别」「业务分类」「业务优先级」4 类语义各建独立字段。

### 2.2 关键判据

| 判据 | 依据 | 要求 |
|-----|------|------|
| D1 语义单一 | Google Cloud Spanner §3.2（Schema 设计原则）| 每字段只承载 1 类语义 |
| D2 向后兼容 | AWS WA REL02-BP01（渐进式数据迁移）| 保留旧字段（deprecated），新字段并行 |
| D3 数据一致性 | AWS WA SEC01-BP04（访问日志完整性）| 旧数据回填到新字段（幂等 + 事务包裹）|
| D4 前端可展示 | CLAUDE.md 前端交互完整性规则 | 前端 Type 列拆分为「来源」+「分类」两列 |

---

## 3. 目标数据模型

### 3.1 新字段定义（Migration 760-761）

```sql
-- Migration 760: 新增 4 字段（不删除旧字段）
ALTER TABLE tickets ADD COLUMN ticket_source      TEXT;  -- 'alert' / 'incident' / 'change' / 'manual' / NULL
ALTER TABLE tickets ADD COLUMN alert_severity     TEXT;  -- 'critical' / 'high' / 'medium' / 'low' / NULL
ALTER TABLE tickets ADD COLUMN business_category  TEXT;  -- 'incident' / 'problem' / 'change' / 'request' / 'event' / NULL
ALTER TABLE tickets ADD COLUMN business_priority  TEXT;  -- 'P0' / 'P1' / 'P2' / 'P3' / NULL

-- Migration 761: 建索引
CREATE INDEX idx_tickets_ticket_source    ON tickets(tenant_id, ticket_source);
CREATE INDEX idx_tickets_business_category ON tickets(tenant_id, business_category);

-- Migration 762: 数据回填（幂等 + 事务包裹）
BEGIN;
UPDATE tickets SET ticket_source = 'alert'    WHERE type = 'alert'    AND ticket_source IS NULL;
UPDATE tickets SET ticket_source = 'incident' WHERE type = 'incident' AND ticket_source IS NULL;
UPDATE tickets SET ticket_source = 'manual'   WHERE type NOT IN ('alert','incident') AND ticket_source IS NULL;
COMMIT;
```

### 3.2 Go 模型变更（`internal/ticket/models/ticket.go`）

```go
type Ticket struct {
    ID                string     `json:"id" db:"id"`
    TenantID          string     `json:"tenant_id" db:"tenant_id"`
    Title             string     `json:"title" db:"title"`
    Description       string     `json:"description" db:"description"`

    // 旧字段（deprecated，保留 3 个版本供兼容）
    Type              string     `json:"type" db:"category" deprecated:"true"`
    Priority          string     `json:"priority" db:"priority" deprecated:"true"`

    // 新字段（4 类语义分离）
    TicketSource      string     `json:"ticket_source" db:"ticket_source"`
    AlertSeverity     string     `json:"alert_severity" db:"alert_severity"`
    BusinessCategory  string     `json:"business_category" db:"business_category"`
    BusinessPriority  string     `json:"business_priority" db:"business_priority"`

    Status            string     `json:"status" db:"status"`
    CreatedBy         string     `json:"created_by" db:"reporter_id"`
    AssignedTo        string     `json:"assigned_to" db:"assignee_id"`
    ResolvedAt        *time.Time `json:"resolved_at,omitempty" db:"resolved_at"`
    ClosedAt          *time.Time `json:"closed_at,omitempty" db:"closed_at"`
    CreatedAt         time.Time  `json:"created_at" db:"created_at"`
    UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
}
```

### 3.3 Service 层变更（`internal/ticket/service/ticket_generator.go`）

```go
func (s *TicketGeneratorService) FromAlert(ctx context.Context, tenantID string, alert map[string]any, createdBy string) (*models.Ticket, error) {
    // ... 原有逻辑 ...

    severity := priority  // 原变量
    ticket := &models.Ticket{
        ID:            uuid.New().String(),
        TenantID:      tenantID,
        Title:         fmt.Sprintf("[Alert] %s", title),
        Description:   description,
        TicketSource:  "alert",          // ← 新字段：来源
        AlertSeverity: severity,          // ← 新字段：严重级别（独立）
        BusinessCategory: "incident",     // ← 新字段：业务分类（默认）
        BusinessPriority: mapSeverityToPriority(severity),  // ← 严重级别 → 业务优先级 映射
        Type:          "alert",           // ← 旧字段兼容（deprecated）
        Priority:      severity,          // ← 旧字段兼容（deprecated）
        Status:        models.StatusOpen,
        CreatedBy:     createdBy,
    }
    // ...
}

// 严重级别 → 业务优先级 映射
func mapSeverityToPriority(severity string) string {
    switch severity {
    case "critical": return "P0"
    case "high":     return "P1"
    case "medium":   return "P2"
    default:         return "P3"
    }
}
```

---

## 4. 迁移与兼容性策略

### 4.1 Migration 号段申请

| 号段 | 用途 |
|-----|------|
| 760 | 新增 4 字段 |
| 761 | 建索引 |
| 762 | 数据回填（幂等）|

**前置**：当前最高 Migration 号为 765（ADR-011/013/014/015 已占），766-768 预留给本任务。

### 4.2 兼容期

| 阶段 | 时间 | 内容 |
|-----|------|------|
| 阶段 1 | S0 阶段 | Migration 766-768 落地，新字段可写，旧字段仍写 |
| 阶段 2 | S1-S3 阶段 | 前端切换到新字段展示，旧字段只读 |
| 阶段 3 | S4+ 阶段 | 旧字段读取废弃（Service 层不再写旧字段）|
| 阶段 4 | 3 个版本后 | 删除旧字段（`Type` / `Priority`）|

### 4.3 前端影响面

| 前端页面 | 当前展示 | 迁移后展示 |
|---------|---------|----------|
| `orion-frontend/src/pages/TicketList/` | `Type` 单列 | 拆分 `TicketSource` + `BusinessCategory` 两列 |
| `orion-frontend/src/pages/TicketDetail/` | `Type` + `Priority` 单栏 | `TicketSource` / `AlertSeverity` / `BusinessCategory` / `BusinessPriority` 4 栏 |
| 过滤 UI | 1 个 Type 下拉 | 3 个下拉（Source / Category / Priority）|

---

## 5. 验证方式

### 5.1 静态验证

```bash
# 模型字段
grep -n "TicketSource\|AlertSeverity\|BusinessCategory\|BusinessPriority" \
    orion-platform-svc-go/internal/ticket/models/ticket.go
# 期望：>=4 处

# Migration
ls orion-platform-svc-go/migrations/76[6-8]_*.sql
# 期望：3 文件

# Service 层
grep -rn "TicketSource:\|AlertSeverity:\|BusinessCategory:" \
    orion-platform-svc-go/internal/ticket/service/
# 期望：>=6 处

# 前端
grep -rn "ticket_source\|business_category\|alert_severity" \
    orion-frontend/src/pages/Ticket*/
# 期望：>=4 处
```

### 5.2 单测验证

```bash
# 新字段填充
go test ./internal/ticket/... -run TestTicketSourceField -count=1
# 期望：通过

# 数据回填
go test ./internal/ticket/repository/... -run TestTicketSourceBackfill -count=1
# 期望：通过

# 严重级别 → 优先级映射
go test ./internal/ticket/service/... -run TestMapSeverityToPriority -count=1
# 期望：4 种 severity 全映射
```

### 5.3 端到端验证

```bash
# Alert → Ticket 生成流程
curl -X POST localhost:3001/api/v1/tickets/from-alert \
    -d '{"alert": {"severity": "high", "title": "CPU 100%"}}'
# 期望返回：ticket_source="alert", alert_severity="high", business_priority="P1"
```

---

## 6. 与 CLAUDE.md 技能一致性契约的对齐

| 项 | 归属 | 说明 |
|----|-----|------|
| 数据结构设计 | code-design-analyzer | 能力十（8 检查项）覆盖字段语义单一 |
| Migration 号段 | ADR-011/013/014/015 后 | 766-768 申请（当前 765 后）|
| 前端交互 | design-constraint | A2/A3 交互链审查覆盖 Type 列拆分 |
| 文档评审 | design-doc-reviewer | 本文件由 design-doc-reviewer 评审 |
| 任务拆分 | task-decomposer | 后续 Migration + 代码变更由 task-decomposer 拆分 |

---

## 7. Skill Handoff Checklist

| 下游技能 | 触发问题数 | 触发内容 | 优先级 |
|---------|----------|---------|--------|
| **task-decomposer** | 5 | Migration 3 项 + Service 层 1 项 + 前端 1 项 | P0 |
| **code-design-analyzer** | 1 | Ticket 模型能力十评审 | P1 |
| **design-constraint** | 1 | 前端 Type 列拆分后 AST 交互链审查 | P1 |

**Structured Missing Items（JSON）**：

```json
{
  "dimension": "ticket_type_field_pollution",
  "total_gaps": 1,
  "downstream_routing": {
    "task_decomposer": {
      "count": 5,
      "items": [
        {"id": "TICKET-POLLUTION-1", "title": "Migration 766 新增 4 字段", "priority": "P0", "depends_on": []},
        {"id": "TICKET-POLLUTION-2", "title": "Migration 767 建索引", "priority": "P0", "depends_on": ["TICKET-POLLUTION-1"]},
        {"id": "TICKET-POLLUTION-3", "title": "Migration 768 数据回填（幂等）", "priority": "P0", "depends_on": ["TICKET-POLLUTION-1"]},
        {"id": "TICKET-POLLUTION-4", "title": "Service 层 FromAlert/FromIncident 改造 + 严重级别映射", "priority": "P0", "depends_on": ["TICKET-POLLUTION-1"]},
        {"id": "TICKET-POLLUTION-5", "title": "前端 TicketList/TicketDetail Type 列拆分", "priority": "P1", "depends_on": ["TICKET-POLLUTION-4"]}
      ]
    }
  }
}
```

---

## 8. 认知边界（诚实声明）

1. **本文件为方案文档**（RC-03 硬约束），未修改任何生产代码
2. **Migration 号段 766-768 为申请**：需与 ADR-011/013/014/015 分配的 699-765 确认无冲突
3. **兼容性策略为 4 阶段渐进**：阶段 3 之后旧字段才完全废弃，需前端 + 后端同步
4. **未估算人天/工期**：遵守 CLAUDE.md 强制约束
5. **grep 结果为部分**：仅 grep 了 `ticket_generator.go` 中的污染点，其他 Service 位置需 task-decomposer 全面扫描

---

## 9. 结论

- **NEW-EA-13 交付物**：Ticket Type 字段污染修复方案（1 份设计文档）
- **核心方案**：`Type` + `Priority` 2 字段 → `TicketSource` + `AlertSeverity` + `BusinessCategory` + `BusinessPriority` 4 字段
- **Migration 号段**：766-768（申请）
- **企业级判据**：D1 语义单一 + D2 向后兼容 + D3 数据一致性 + D4 前端可展示（4/4 达标）
- **RC-03 硬约束遵守**：本文件为独立方案文档，未修改任何生产代码
- **关联文档**：`enterprise-architecture-depth-review-2026-10-11.md` §6.4 关键判据 12

**文件**：`docs/ticket-type-field-pollution-fix-2026-10-11.md`
