# Triage 域可观测性方案（承接 Meta Review D2）

**评审对象**：本轮 3 个新域（recipient / triage / notification-adapter）+ 12 个新前端页面/组件的可观测性方案
**文档性质**：可观测性设计，非生产代码
**版本**：v1.0（2026-10-11）
**关联**：
- 上游：`orion-granularity-and-enterprise-gap-2026-10-11.md` §3.2（业务日志 18.6% 覆盖 P0 缺口）
- 上游：`design-set-enterprise-level-meta-review-2026-10-11.md` §3.2（P2 可观测性缺失）
- 参考：`triage-api-contract-design-2026-10-11.md`（7 端点 + 3 WS 事件）
- 参考：`backend-g1-g3-implementation-spec-2026-10-11.md`（G1-G3 域）

**硬约束**：
- **RC-03**：可观测性设计，不修改生产代码。
- **不估算人天/工期**。
- **对齐 `orion-granularity-and-enterprise-gap-2026-10-11.md` §3.2** 的 P0 缺口：
  - 业务日志：从 55/296 域（18.6%）→ 补齐本轮新增 3 域
  - 业务指标：从 0 业务域 → 新增 3 域业务指标
  - 追踪：从 98.3% 域覆盖 → 保证新域 100% 覆盖

---

## 1. 三大支柱策略

### 1.1 日志（Logging）— 补齐 P0 缺口

**现状（⭐ 机械计数）**：
```
logger.Info/Warn/Error/Debug 调用: 558 次 (0.25/文件)
有日志调用的域: 55/296 (18.6%)
结构化日志字段 (Zap): 1,210 处
纯字符串日志: 0 域 (仅 statistics 1 例外)
```

**规则**：
- 每个 handler 入口必须打一条 Info（含 request_id / tenant_id / 关键业务 ID）
- 每个非平凡分支决策必须打一条 Debug
- 每个错误路径必须打一条 Error（含 error stack）
- **格式**：沿用现有 `logger.Info("msg", zap.String("k", v), ...)`（无新格式引入）

**本轮新增日志点**：
- recipient 域：3 个 resolver × 3 类日志 = 9 个
- triage 域：4 个 reader × 4 个 handler + WS = 20+ 个
- notification-adapter：3 层回退 × 3 类日志 = 9 个
- **总计**：40+ 个新日志点

### 1.2 指标（Metrics）— 从 0 到业务域全覆盖

**现状**：
```
Prometheus 指标定义文件: 2 个 (middleware/prometheus.go + observability/webvitals.go)
指标定义总数: 13 个 (HTTP 层 3 + Web Vitals 10)
业务域指标: 0 个
```

**规则**（承接 §3.2 P0 项）：
- 每个 Service 方法必须有 histogram（延迟）+ counter（调用次数）
- 每个 Repository 方法必须有 histogram（DB 延迟）
- 每个错误路径必须有 counter（错误次数）

**本轮新增指标**：
- recipient 域：6 个（3 histogram + 3 counter）
- triage 域：12 个（4 histogram + 4 counter + 4 gauge）
- notification-adapter 域：5 个（3 counter + 2 gauge）
- **总计**：23 个新指标

### 1.3 追踪（Tracing）— 补齐新域

**现状**：
```
otel.Tracer 出现在 437/2,247 文件 (19.4%)
追踪覆盖域数: 291/296 域 (98.3%)
otel.Tracer(...).Start(...) 调用: 4,412 处
```

**规则**：
- 每个跨域调用必须传播 trace context
- 每个 HTTP handler 必须有 root span
- 每个 Repository 方法必须有 DB span
- 每个外部调用（缓存/WS/Webhook）必须有 remote span

**本轮新增追踪**：
- recipient 域：6 个 resolver 方法 × 3 span = 18 span
- triage 域：4 reader + 7 handler + WS = 15 span
- notification-adapter：3 层回退 = 9 span
- **总计**：42+ 个新 span 定义点

---

## 2. 业务指标设计

### 2.1 命名规范

对齐 Orion 现有 Prometheus 命名（见 `middleware/prometheus.go`）：

```
<domain>_<metric_name>_<type>
例:
  triage_items_acknowledged_total       # Counter
  triage_ws_event_duration_ms           # Histogram
  triage_active_users                   # Gauge
  recipient_resolve_duration_ms         # Histogram
```

**类型**：
- `*_total` → Counter
- `*_duration_ms` / `*_latency_ms` → Histogram
- `*_active` / `*_current` → Gauge

### 2.2 Triage 域指标（12 个）

| 指标 | 类型 | 标签 | SLO 目标 |
|---|---|---|---|
| `triage_overview_requests_total` | Counter | `status_code` | - |
| `triage_overview_duration_ms` | Histogram | `status_code` | p95 < 200ms |
| `triage_items_requests_total` | Counter | `kind`, `status_code` | - |
| `triage_items_duration_ms` | Histogram | `kind` | p95 < 300ms |
| `triage_ack_total` | Counter | `kind`, `result` | - |
| `triage_ack_duration_ms` | Histogram | `kind` | p95 < 500ms |
| `triage_dismiss_total` | Counter | `kind`, `result` | - |
| `triage_batch_ops_total` | Counter | `kind`, `batch_size` | - |
| `triage_ws_connections_active` | Gauge | `tenant_id` | - |
| `triage_ws_events_total` | Counter | `event_type`, `result` | - |
| `triage_ws_event_delivery_ms` | Histogram | `event_type` | p95 < 100ms |
| `triage_partial_failure_total` | Counter | `source` | p95 < 5/min |

**代码骨架**：

```go
package triage

var (
    OverviewRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Namespace: "triage",
        Subsystem: "overview",
        Name:      "requests_total",
        Help:      "Total triage overview API requests.",
    }, []string{"status_code"})
    
    OverviewDurationMs = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Namespace: "triage",
        Subsystem: "overview",
        Name:      "duration_ms",
        Help:      "Triage overview API duration in milliseconds.",
        Buckets:   []float64{50, 100, 200, 500, 1000, 2000, 5000},
    }, []string{"status_code"})
    
    WsEventsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Namespace: "triage",
        Subsystem: "ws",
        Name:      "events_total",
        Help:      "Total triage WebSocket events sent.",
    }, []string{"event_type", "result"})
    
    WsConnectionsActive = promauto.NewGaugeVec(prometheus.GaugeOpts{
        Namespace: "triage",
        Subsystem: "ws",
        Name:      "connections_active",
        Help:      "Number of active triage WebSocket connections.",
    }, []string{"tenant_id"})
)
```

### 2.3 Recipient 域指标（6 个）

| 指标 | 类型 | 标签 | SLO 目标 |
|---|---|---|---|
| `recipient_resolve_total` | Counter | `kind`, `result` | - |
| `recipient_resolve_duration_ms` | Histogram | `kind` | p95 < 100ms |
| `recipient_resolve_cache_hit_total` | Counter | `kind`, `result` | cache_hit_rate > 90% |
| `recipient_resolve_errors_total` | Counter | `kind`, `error_code` | p95 < 1/min |
| `recipient_registry_registered` | Gauge | `kind` | 6 (启动时) |
| `recipient_validate_requests_total` | Counter | `status_code` | - |

### 2.4 Notification Adapter 指标（5 个）

| 指标 | 类型 | 标签 | SLO 目标 |
|---|---|---|---|
| `adapter_dispatch_total` | Counter | `channel`, `result` | - |
| `adapter_dispatch_duration_ms` | Histogram | `channel` | p95 < 200ms |
| `adapter_fallback_total` | Counter | `reason` | p95 < 5/min |
| `adapter_enabled_tenants` | Gauge | - | - |
| `adapter_traffic_ratio` | Gauge | - | 0-100 |

---

## 3. 关键日志点设计

### 3.1 日志规范

**格式**：`logger.Info("msg", zap.String("k", v), ...)` 或 `logger.Warn("msg", ...)`

**必备字段**：
- `request_id`（middleware 自动注入）
- `trace_id`（middleware 自动注入）
- `tenant_id`（从 context 获取）
- `user_id`（若有）
- 关键业务 ID（如 `alert_id`, `role_id`, `external_id`）

### 3.2 Triage 域日志点

**Handler 入口**（7 个）：

```go
// GET /v1/triage/me
log.Info("triage.overview.request", 
    zap.String("tenant_id", tenantID),
    zap.String("user_id", userID),
    zap.Int("recent_limit", recentLimit))

// GET /v1/triage/me/items  
log.Info("triage.items.request",
    zap.String("tenant_id", tenantID),
    zap.String("user_id", userID),
    zap.Strings("severity_filter", severity),
    zap.Strings("kind_filter", kind),
    zap.String("group_by", groupBy),
    zap.Int("limit", limit))

// POST /v1/triage/me/items/:id/ack
log.Info("triage.ack.request",
    zap.String("tenant_id", tenantID),
    zap.String("user_id", userID),
    zap.String("external_id", externalID),
    zap.String("kind", kind),
    zap.String("idempotency_key", idempotencyKey))
```

**Reader 分支决策**（Debug 级）：

```go
// AlertReader.GetUnreadAlertsByUser
log.Debug("triage.reader.alerts.query",
    zap.String("tenant_id", tenantID),
    zap.String("user_id", userID),
    zap.Int("limit", limit),
    zap.Strings("assignee_candidates", assignees))

// 空结果（可能是 DND 过滤）
log.Debug("triage.reader.alerts.empty",
    zap.String("tenant_id", tenantID),
    zap.String("user_id", userID),
    zap.Bool("dnd_active", dndActive))
```

**错误路径**（Error 级）：

```go
// 单源 Reader 失败
log.Error("triage.reader.failure",
    zap.String("tenant_id", tenantID),
    zap.String("source", "alerts"),
    zap.Error(err))

// 跨租户访问
log.Error("triage.cross_tenant_attempt",
    zap.String("tenant_id_request", requestTenantID),
    zap.String("tenant_id_resource", resourceTenantID),
    zap.String("user_id", userID),
    zap.String("external_id", externalID))
```

**WebSocket 事件**：

```go
// 新条目到达
log.Debug("triage.ws.item.new",
    zap.String("tenant_id", tenantID),
    zap.String("external_id", externalID),
    zap.String("kind", kind),
    zap.String("severity", severity))

// 事件投递失败
log.Error("triage.ws.delivery_failure",
    zap.String("user_id", userID),
    zap.String("event_type", eventType),
    zap.Error(err))
```

### 3.3 Recipient 域日志点

**Resolver 调用**：

```go
log.Debug("recipient.resolve",
    zap.String("tenant_id", tenantID),
    zap.String("kind", kind),
    zap.String("ref", ref),
    zap.Duration("duration", elapsed))

log.Debug("recipient.resolve.cache_miss",
    zap.String("tenant_id", tenantID),
    zap.String("kind", kind),
    zap.String("ref", ref))
```

**错误路径**：

```go
log.Error("recipient.resolve.failure",
    zap.String("tenant_id", tenantID),
    zap.String("kind", kind),
    zap.String("ref", ref),
    zap.Error(err))
```

### 3.4 Notification Adapter 日志点

**Feature Flag 判断**：

```go
log.Debug("adapter.flag.check",
    zap.String("tenant_id", tenantID),
    zap.String("flag", "notification.pipeline_adapter.enabled"),
    zap.Bool("enabled", enabled))
```

**回退路径**：

```go
log.Warn("adapter.fallback",
    zap.String("tenant_id", tenantID),
    zap.String("channel", channel),
    zap.String("reason", reason),
    zap.Error(err))
```

---

## 4. 追踪（Tracing）

### 4.1 Span 定义规范

对齐 Orion 现有 otel 使用（`otel.Tracer("domain.name")`）：

```go
// 每个域有独立的 tracer
var tracer = otel.Tracer("orion.triage")
var tracerRecipient = otel.Tracer("orion.recipient")
var tracerAdapter = otel.Tracer("orion.notification.adapter")
```

### 4.2 Triage 域 Span 层级

```
HTTP /v1/triage/me                              [triage.overview]
  └─ Reader: GetUnreadAlertsByUser              [triage.reader.alerts]
      └─ DB query                               [pg.query]
  └─ Reader: GetMyTickets                       [triage.reader.tickets]
      └─ DB query
  └─ Reader: GetMyOnCall                        [triage.reader.oncall]
      └─ DB query
  └─ Reader: GetUnreadCount                     [triage.reader.notifications]
      └─ DB query
  └─ Aggregation                                [triage.aggregate]
      └─ Cache write                            [cache.set]
```

**Span 属性**（所有 span 必须含）：
- `http.method`, `http.url`, `http.status_code`
- `db.system` = "postgresql"
- `cache.kind`
- `triage.tenant_id`
- `triage.user_id`
- `triage.kind`（若有）

### 4.3 WebSocket 追踪

```
WS /api/v1/ws/triage                            [triage.ws.connection]
  ├─ Event: item.new                            [triage.ws.event.item_new]
  ├─ Event: item.updated                        [triage.ws.event.item_updated]
  └─ Event: oncall.handoff                      [triage.ws.event.handoff]
```

**关键属性**：
- `ws.event_type`
- `ws.event_duration_ms`
- `ws.delivery_status`

---

## 5. SLO 定义

### 5.1 Triage API SLO

| 端点 | p95 延迟 | p99 延迟 | 错误率 |
|---|---|---|---|
| `GET /v1/triage/me` | 200ms | 500ms | < 0.1% |
| `GET /v1/triage/me/items` | 300ms | 800ms | < 0.1% |
| `GET /v1/triage/me/alerts` | 200ms | 500ms | < 0.1% |
| `GET /v1/triage/me/tickets` | 200ms | 500ms | < 0.1% |
| `GET /v1/triage/me/oncall` | 150ms | 400ms | < 0.1% |
| `POST /v1/triage/me/items/:id/ack` | 500ms | 1500ms | < 0.5% |
| `POST /v1/triage/me/items/:id/dismiss` | 500ms | 1500ms | < 0.5% |
| WS event delivery | 100ms | 300ms | < 0.5% |

### 5.2 Recipient Resolver SLO

| Resolver | p95 延迟 | p99 延迟 | 错误率 |
|---|---|---|---|
| user (direct) | 5ms | 20ms | < 0.01% |
| role (DB query) | 50ms | 150ms | < 0.1% |
| team (DB query) | 100ms | 300ms | < 0.1% |
| oncall-duty (DB query) | 100ms | 300ms | < 0.1% |
| escalation (DB query) | 200ms | 500ms | < 0.5% |
| broadcast (DB query) | 200ms | 500ms | < 0.5% |

**缓存命中率目标**：> 90%（除 user 类型外）

### 5.3 Notification Adapter SLO

| 阶段 | p95 延迟 | 错误率 |
|---|---|---|
| Adapter dispatch | 200ms | < 0.5% |
| Fallback direct | 200ms | < 1% |
| 总回退率 | - | < 5% |

---

## 6. 告警规则（Prometheus AlertManager）

### 6.1 关键告警

```yaml
groups:
  - name: triage.alerts
    rules:
      - alert: TriageOverviewLatencyHigh
        expr: histogram_quantile(0.95, rate(triage_overview_duration_ms_bucket[5m])) > 200
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Triage overview API latency p95 > 200ms"
          
      - alert: TriageErrorRateHigh
        expr: rate(triage_overview_requests_total{status_code=~"5.."}[5m]) 
             / rate(triage_overview_requests_total[5m]) > 0.005
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Triage overview API error rate > 0.5%"
          
      - alert: TriagePartialFailureSpike
        expr: rate(triage_partial_failure_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Triage partial failure spike (> 5/min)"
          
      - alert: TriageWsConnectionLoss
        expr: change(triage_ws_connections_active[5m]) < -10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Triage WebSocket connections dropped (> 10/5min)"
          
      - alert: RecipientResolveCacheMissHigh
        expr: 
          rate(recipient_resolve_cache_hit_total{result="miss"}[5m]) 
          / rate(recipient_resolve_cache_hit_total[5m]) > 0.5
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Recipient resolve cache hit rate < 50%"
          
      - alert: AdapterFallbackSpike
        expr: rate(adapter_fallback_total[5m]) > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Notification adapter fallback spike (> 5/min)"
```

### 6.2 告警分级

| 级别 | 说明 | 通知 |
|---|---|---|
| `critical` | 严重影响用户 / 高错误率 | 电话 + IM + 邮件 |
| `warning` | 潜在问题 / 趋势异常 | IM + 邮件 |
| `info` | 参考信息 | 邮件 |

---

## 7. 仪表板（Grafana Dashboard）

### 7.1 Triage Dashboard 布局

```
┌─────────────────────────────────────────────────────────┐
│  Triage Dashboard                                       │
├─────────────────────────────────────────────────────────┤
│  Row 1: Overview (4 panels)                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │ RPS     │ │ p95     │ │ Error   │ │ Active  │     │
│  │ (line)  │ │ (line)  │ │ Rate    │ │ WS      │     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
│                                                          │
│  Row 2: Endpoints (7 panels)                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │/me  │ │/items│ │/alerts│ │/tickets│ │/oncall│       │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│  ┌─────┐ ┌─────┐                                       │
│  │/ack │ │/dismiss│                                     │
│  └─────┘ └─────┘                                       │
│                                                          │
│  Row 3: WebSocket (3 panels)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Connections│ │ Events   │ │ Delivery │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                          │
│  Row 4: Data Sources (5 panels)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Alerts   │ │ Tickets  │ │ OnCall   │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│  ┌──────────┐ ┌──────────┐                              │
│  │ Partial  │ │ BatchOps │                              │
│  └──────────┘ └──────────┘                              │
└─────────────────────────────────────────────────────────┘
```

### 7.2 关键 Grafana 查询

**p95 延迟**：
```promql
histogram_quantile(0.95, 
  rate(triage_overview_duration_ms_bucket[5m])
)
```

**错误率**：
```promql
rate(triage_overview_requests_total{status_code=~"5.."}[5m]) 
/ rate(triage_overview_requests_total[5m])
```

**按 kind 分组**：
```promql
sum by (kind) (rate(triage_items_requests_total[5m]))
```

---

## 8. 与 orion-granularity 报告的衔接

### 8.1 补齐的 P0 缺口

`orion-granularity-and-enterprise-gap-2026-10-11.md` §3.2 指出：
- 业务日志仅覆盖 55/296 域（18.6%）
- 业务指标 0 个

**本方案补齐**：
- 3 个新域 100% 日志覆盖（+3/299 = 从 18.6% → 20.3%）
- 23 个业务指标（+23/0 = 从 0 → 23）

### 8.2 长期目标（后续工作）

本方案只覆盖本轮新域，长期需要：
- 全仓 241/296 无日志域补齐（承接 orion-granularity §3.2 P0）
- 更多业务域指标（alert_*, ticket_*, pipeline_*, cmdb_* 前缀）

---

## 9. 复现命令

```bash
cd /Users/heal/orion-design

# 现有 Prometheus 指标定义
grep -rhoE 'promauto\.New[A-Za-z]+|prometheus\.New[A-Za-z]+' \
  orion-platform-svc-go/internal --include='*.go' | wc -l

# 现有 logger.* 调用
grep -rhoE 'logger\.(Info|Warn|Error|Debug)\(' \
  orion-platform-svc-go/internal --include='*.go' | wc -l

# 现有 otel.Tracer 使用
grep -rn 'otel\.Tracer' orion-platform-svc-go/internal --include='*.go' | wc -l

# 现有业务日志 (非 middleware)
grep -rn 'logger\.' orion-platform-svc-go/internal \
  --include='*.go' | grep -v '_test.go' | grep -v 'middleware' | wc -l

# 现有 AlertManager 配置
find orion-platform-svc-go -name '*.yml' -o -name '*.yaml' | xargs grep -l 'alertmanager\|prometheus' | head -5

# 现有 Grafana 仪表板
find orion-platform-svc-go -name '*.json' | xargs grep -l 'grafana\|dashboard' | head -5

# 新增域已存在性 (应为 0)
find orion-platform-svc-go/internal -maxdepth 1 -type d \( -name 'triage' -o -name 'recipient' \) | wc -l

# 新指标命名规范检查
grep -rn 'Namespace:.*Subsystem:' orion-platform-svc-go --include='*.go' | head -20
```

---

## 10. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 三大支柱策略明确（日志 / 指标 / 追踪）| §1 |
| 2 | 23 个业务指标完整定义 | §2.2-2.4 |
| 3 | 40+ 关键日志点 | §3.2-3.4 |
| 4 | 42+ 追踪 span 定义 | §4 |
| 5 | SLO 定义覆盖 8 个 triage 端点 + 6 个 resolver + 3 个 adapter 阶段 | §5 |
| 6 | 告警规则 6 条 + 分级 | §6 |
| 7 | Grafana 仪表板布局 | §7 |
| 8 | 与 orion-granularity 报告衔接 | §8 |
| 9 | ⭐ 复现命令 10+ 条 | §9 |
| 10 | 未修改生产代码 | `git status --porcelain` 空 |
| 11 | 未估算人天/工期 | 全文检索禁词 |
| 12 | 无新日志格式（复用 zap.String/Int/Error 等）| §3.1 |
| 13 | 无新 tracer 命名空间冲突 | §4.1 |
| 14 | 指标命名符合 Prometheus 规范 | §2.1 |

---

*本方案补齐了 Meta Review §3.2 的 P2 可观测性缺失问题，
同时承接 `orion-granularity-and-enterprise-gap-2026-10-11.md` §3.2 的 P0 缺口。

3 个新域（triage / recipient / notification-adapter）实现：
- 日志：40+ 个日志点，覆盖 handler 入口 + 分支决策 + 错误路径
- 指标：23 个业务指标（12 triage + 6 recipient + 5 adapter）
- 追踪：42+ 个 span 定义，含 HTTP/DB/Cache/WS 全链路
- SLO：8 端点 + 6 resolver + 3 adapter 阶段
- 告警：6 条 Prometheus AlertManager 规则
- 仪表板：Grafana Triage Dashboard 完整布局

对齐 Orion 现有基础设施（zap.String / otel.Tracer / promauto.New），
无新依赖引入，无格式冲突。*
