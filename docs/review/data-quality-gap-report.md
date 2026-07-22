# Data Quality Execution Engine Gap Report (P1-11)

**Date:** 2026-07-20
**Scope:** `orion-platform-svc-go/internal/data-quality/`
**Classification:** P1 — Feature has CRUD storage but no execution engine

---

## 1. What Exists (Inventory)

The data-quality module is a **fully realized CRUD subsystem** backed by PostgreSQL. It stores three entity types — Rules, Scan Results, and Alerts — with a complete model/repo/service/handler stack.

### Files Present

| File | Lines | Role |
|------|-------|------|
| `internal/data-quality/models/models.go` | 122 | Entity models + request/response DTOs |
| `internal/data-quality/repository/repository_interface.go` | 29 | Data access interface contract |
| `internal/data-quality/repository/repository.go` | 251 | PostgreSQL-backed repo (sqlx, named queries) |
| `internal/data-quality/service/service_interface.go` | 32 | Service interface contract |
| `internal/data-quality/service/service.go` | 277 | Business logic (validation, CRUD orchestration) |
| `internal/data-quality/service/service_test.go` | 13 | Trivial unit test (nil repo only) |
| `internal/data-quality/handler/handler.go` | 321 | HTTP handler + routes, Gin |
| `internal/data-quality/handler/handler_test.go` | 134 | All skipped — "handler uses concrete service, cannot inject mock" |

### Existing Capabilities (working)

- **Rules CRUD**: Create/Read/Update/Delete with tenant isolation, filtering by ruleType/severity/status
- **Scan Results**: Store results manually via POST; list by rule ID with status filter
- **Alerts**: CRUD lifecycle (open → acknowledged → resolved), with resolvedAt/resolvedBy tracking
- **Stats**: Aggregated counts (total rules, active rules, total scans, avg pass rate, open/critical alerts)
- **Auth**: All routes gated by `auth.RequirePermission("data-quality", ...)`
- **Tracing**: OpenTelemetry spans on every handler method
- **Validation**: Service-layer input validation (empty name, invalid severity, etc.)

### What the Module Does NOT Do

The module is a **passive data store**. No code anywhere in the stack actually:

- Executes a rule against a target table
- Evaluates the rule expression
- Produces scan results automatically
- Creates alerts when thresholds are breached
- Schedules or triggers scans

**The ScanResult and Alert entities are designed for consumption by an execution engine, but the engine does not exist.**

---

## 2. What's Missing (Gap Analysis)

### Gap 1: Rule Execution Engine (CRITICAL)

No component reads active rules and executes them against the target data source.

**Missing file(s):**
```
internal/data-quality/engine/engine.go       (NEW — core execution engine)
internal/data-quality/engine/executor.go     (NEW — SQL query executor per rule type)
```

**Required interface:**
```go
// engine/engine.go

package engine

type RuleExecutor interface {
    ExecuteRule(ctx context.Context, rule *models.Rule) (*models.ScanResult, error)
}

type Engine struct {
    db      *sqlx.DB
    svc     *service.Service
    repo    repository.RepositoryInterface
    alerts  AlertNotifier
}

func (e *Engine) RunSingleRule(ctx context.Context, tenantID, ruleID string) (*models.ScanResult, error)
func (e *Engine) RunAllActiveRules(ctx context.Context, tenantID string) ([]*models.ScanResult, error)
```

**Required method signatures:**

```go
// engine/executor.go — per-rule-type execution

// ExecuteNotNull scans a table column for NULL values
func ExecuteNotNull(ctx context.Context, db *sqlx.DB, table, column string) (total, passed, failed int64, err error)

// ExecuteUniqueness checks for duplicate values in a column
func ExecuteUniqueness(ctx context.Context, db *sqlx.DB, table, column string) (total, passed, failed int64, err error)

// ExecuteCustom evaluates a user-provided SQL expression
func ExecuteCustom(ctx context.Context, db *sqlx.DB, expression string) (total, passed, failed int64, err error)

// ExecuteEnum validates values against a predefined set
func ExecuteEnum(ctx context.Context, db *sqlx.DB, table, column string, allowed []string) (total, passed, failed int64, err error)
```

### Gap 2: Scheduler / Cron Integration (CRITICAL)

No mechanism to trigger rule execution on a schedule.

**Missing file(s):**
```
internal/data-quality/scheduler.go       (NEW — cron-based scheduler)
```

**Required interface:**
```go
// scheduler.go

type Scheduler struct {
    cron *cron.Cron
    engine *engine.Engine
}

type ScheduleConfig struct {
    RuleID    string
    TenantID  string
    Expression string  // cron expression like "0 2 * * *" (daily at 2am)
    Enabled   bool
}

func (s *Scheduler) AddRuleSchedule(config ScheduleConfig) error
func (s *Scheduler) RemoveRuleSchedule(ruleID string) error
func (s *Scheduler) Start() error
func (s *Scheduler) Stop()
```

**Also missing from models/models.go:**
```go
// RuleSchedule represents a schedule configuration for a quality rule.
type RuleSchedule struct {
    ID           string    `json:"id" db:"id"`
    TenantID     string    `json:"tenantId" db:"tenant_id"`
    RuleID       string    `json:"ruleId" db:"rule_id"`
    CronExpr     string    `json:"cronExpr" db:"cron_expression"`
    Enabled      bool      `json:"enabled" db:"enabled"`
    LastRunAt    *time.Time `json:"lastRunAt" db:"last_run_at"`
    NextRunAt    *time.Time `json:"nextRunAt" db:"next_run_at"`
    CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}
```

**Database migration needed:**
```sql
CREATE TABLE data_quality_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    rule_id VARCHAR(255) NOT NULL REFERENCES data_quality_rules(id),
    cron_expression VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Gap 3: Automatic Alert Generation (HIGH)

When a scan result fails the threshold, the module should auto-create an alert. Currently this must be done manually via `POST /alerts`.

**Change to existing file:**
```go
// service/service.go — add to CreateScanResult method (around line 156-193)

func (s *Service) CreateScanResult(ctx context.Context, tenantID string, req *models.CreateScanResultRequest) (*models.ScanResult, error) {
    // ... existing creation logic ...

    // [NEW] After successful creation, auto-generate alert if threshold breached
    result, err := s.repo.GetScanResultByID(ctx, tenantID, result.ID) // need repo method
    if err != nil {
        return result, err
    }

    rule, err := s.repo.GetRuleByID(ctx, tenantID, result.RuleID)
    if err == nil && rule.Threshold != nil && result.PassRate != nil {
        if *result.PassRate < *rule.Threshold {
            alertReq := &models.CreateAlertRequest{
                RuleID:       result.RuleID,
                ScanResultID: result.ID,
                Message:      stringPtr(fmt.Sprintf("Quality scan failed: pass rate %.1f%% below threshold %.1f%%", *result.PassRate, *rule.Threshold)),
                Severity:     rule.Severity,
            }
            _, _ = s.CreateAlert(ctx, tenantID, alertReq) // best-effort, don't fail the scan
        }
    }

    return result, nil
}
```

**Also needed:** A `GetScanResultByID` method in `repository.RepositoryInterface` and `repository.Repository` — currently no method exists to read a single scan result.

### Gap 4: Notification / Alert Dispatch (MEDIUM)

No mechanism to notify users when a quality alert is created.

**Missing file(s):**
```
internal/data-quality/notifier.go        (NEW — alert notification dispatch)
```

**Required interface:**
```go
// notifier.go

type AlertNotifier interface {
    Notify(ctx context.Context, alert *models.Alert) error
}

type NotificationService struct {
    notificationRepo *notification.Repository // reuse existing notification module
}
```

This should integrate with the existing notification/alert infrastructure already present in `orion-platform-svc-go`.

### Gap 5: Schedule Management API (MEDIUM)

No routes to manage rule schedules.

**Change to existing file:**
```go
// handler/handler.go — add to RegisterRoutes (around line 25-48)

// === Schedules ===
f.GET("/schedules", auth.RequirePermission("data-quality", "read"), h.ListSchedules)
f.POST("/schedules", auth.RequirePermission("data-quality", "write"), h.CreateSchedule)
f.GET("/schedules/:id", auth.RequirePermission("data-quality", "read"), h.GetSchedule)
f.PUT("/schedules/:id", auth.RequirePermission("data-quality", "write"), h.UpdateSchedule)
f.DELETE("/schedules/:id", auth.RequirePermission("data-quality", "delete"), h.DeleteSchedule)

// === Manual Execution ===
f.POST("/rules/:id/run", auth.RequirePermission("data-quality", "write"), h.RunRule)
f.POST("/rules/run-all", auth.RequirePermission("data-quality", "write"), h.RunAllRules)
```

---

## 3. Comparison with TS Source

**No TypeScript source exists** at `orion-platform-service/src/services/data-quality/` — this directory was not found. The Go implementation is the primary (and only) source of truth for this module. This means the execution engine must be designed from scratch in Go.

---

## 4. Test Quality Assessment

- **Service tests**: 1 trivial test (`TestService_NilRepo`) — no integration tests, no mock repo tests
- **Handler tests**: 13 tests, ALL skipped with "handler uses concrete service, cannot inject mock"
- **Repository tests**: None exist

**Required additions:**
```go
internal/data-quality/engine/engine_test.go
internal/data-quality/service/service_test.go (expand beyond nil-repo test)
internal/data-quality/handler/handler_test.go (fix mock injection)
internal/data-quality/repository/repository_test.go (NEW)
```

---

## 5. Dependency Checklist

New dependencies needed for execution engine:

| Dependency | Purpose | Location |
|------------|---------|----------|
| `github.com/robfig/cron/v3` | Cron scheduling | `scheduler.go` |
| `github.com/jmoiron/sqlx` | Already used | Rule executor queries |
| Existing notification service | Alert dispatch | `notifier.go` |

No external dependencies required beyond what the module already uses.

---

## 6. Implementation Priority

| Priority | Gap | Effort | Rationale |
|----------|-----|--------|-----------|
| **P0** | Gap 1: Rule Execution Engine | 2-3 days | Core value — without this, module is a data store only |
| **P0** | Gap 2: Scheduler | 1 day | Need scheduled execution for production use |
| **P1** | Gap 3: Auto Alert Generation | 0.5 day | Ties execution results to alert lifecycle |
| **P2** | Gap 4: Notification | 1 day | User visibility into quality issues |
| **P2** | Gap 5: Schedule Management API | 0.5 day | UI operability |
| **P3** | Gap 6: Test coverage | 1-2 days | Production confidence |

**Minimum viable product** = Gap 1 + Gap 3 (execution engine + auto-alerts). This alone transforms the module from "storage" to "functioning quality monitor."

---

## 7. Architecture Diagram (After Completion)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Scheduler   │────▶│  Engine      │────▶│  SQL Executor    │
│  (cron)      │     │  (orchestr)  │     │  (per rule type) │
└──────────────┘     └──────┬───────┘     └──────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Service     │── CreateScanResult ──▶  Repository (PG)
                    │  (business)  │── CreateAlert ──────▶  Repository (PG)
                    └──────┬───────┘                          └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Notifier    │── dispatch ──▶  Notification Service (existing)
                    │  (alerts)    │
                    └──────────────┘
```
