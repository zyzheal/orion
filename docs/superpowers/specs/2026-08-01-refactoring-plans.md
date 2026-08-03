# Orion 具体重构方案 — chaos / ticketing / crossover

> 创建日期: 2026-08-01 | 基于: structure-overlap-verification 代码级证据
> 方案级别: 代码级实现方案（非概念设计）

---

## 一、chaos 三模块合并方案

### 1.1 当前状态

| 模块 | Handler | Service | Repo | Model | 行数总计 |
|------|---------|---------|------|-------|---------|
| `chaos` | 1384 行 | 1208 行 | 236 行 | 15 structs | 2828 行 |
| `chaos-enhanced` | 367 行 | 210 行 | 146 行 | 4 structs | 723 行 |
| `chaos-gateway` | 517 行 | 445 行 | 322 行 | 9 structs | 1284 行 |
| **总计** | **2268 行** | **1863 行** | **704 行** | **28 structs** | **4835 行** |

### 1.2 重叠分析

**Model 层 — 三模块各定义 Experiment struct**:
- `chaos/models/models.go:7` — `type Experiment struct` (15 structs 含 Run/Inject/Recovery)
- `chaos-enhanced/models/models.go:6` — `type Experiment struct` (4 structs, 轻量版)
- `chaos-gateway/models/models.go:76` — `type ChaosTarget struct` (9 structs, 含 Scenario/Threshold)

**Repository 层 — 三模块各自独立 CRUD**:
- chaos: 10 方法 (Create/GetByID/List/Update/Delete/UpdateStatus/ListRunning/CreateRun/GetRun/UpdateRunStatus)
- chaos-enhanced: 5+ 方法 (CreateExperiment/GetExperiment/ListExperiments/UpdateExperiment/CreateFaultInjection)
- chaos-gateway: 10+ 方法 (CreateExperiment/GetExperiment/UpdateExperiment/UpdateStatus/DeleteExperiment/ListExperiments/CreateResult/ListResults/CreateLog/ListLogs)

### 1.3 合并架构

```
internal/chaos-engine/                     # 新包名
├── models/
│   ├── experiment.go                      # 统一 Experiment (合并 chaos/chaos-enhanced/chaos-gateway 的 Experiment)
│   ├── run.go                             # Run (从 chaos 迁移)
│   ├── fault.go                           # FaultInjection (从 chaos-enhanced 迁移)
│   ├── scenario.go                        # Scenario (从 chaos-gateway 迁移)
│   ├── target.go                          # Target (从 chaos-gateway 迁移)
│   └── types.go                           # 枚举常量 + 公共类型
├── repository/
│   ├── experiment_repo.go                 # 统一 Experiment CRUD (合并三模块)
│   ├── run_repo.go                        # Run CRUD (从 chaos 迁移)
│   ├── fault_repo.go                      # FaultInjection (从 chaos-enhanced 迁移)
│   ├── result_repo.go                     # Result (从 chaos-gateway 迁移)
│   └── log_repo.go                        # Log (从 chaos-gateway 迁移)
├── service/
│   ├── service.go                         # 统一 Service (合并三模块 Service 逻辑)
│   ├── experiment_service.go              # Experiment 业务逻辑
│   ├── run_service.go                     # Run/Stop/Rollback/Recover
│   ├── fault_service.go                   # FaultInjection
│   └── scenario_service.go                # Scenario/Target/Threshold
├── handler/
│   ├── core_handler.go                    # 核心 CRUD + Run/Stop/Rollback (原 chaos handler)
│   ├── enhanced_handler.go                # FaultInjection + Pagination (原 chaos-enhanced handler)
│   └── gateway_handler.go                 # Scenario/Target/Threshold/Monitoring (原 chaos-gateway handler)
└── router.go                              # 统一路由注册
```

### 1.4 向后兼容策略

```go
// 保留旧路由前缀，内部指向新 handler
func RegisterRoutes(rg *gin.RouterGroup) {
    // 旧路由 (向后兼容)
    chaos := rg.Group("/chaos")
    chaos.GET("/experiments", h.ListExperiments)
    // ...

    // 旧路由 (向后兼容)
    chaosEnhanced := rg.Group("/chaos-enhanced")
    chaosEnhanced.GET("/experiments", h.ListExperiments)
    // ...

    // 旧路由 (向后兼容)
    chaosGateway := rg.Group("/chaos-gateway")
    chaosGateway.GET("/experiments", h.ListExperiments)
    // ...

    // 新统一路由
    engine := rg.Group("/chaos-engine")
    engine.GET("/experiments", h.ListExperiments)
    // ...
}
```

### 1.5 迁移步骤

| 步骤 | 操作 | 工作量 | 风险 |
|------|------|--------|------|
| 1 | 创建 `chaos-engine/` 包结构 | 0.5 天 | 低 |
| 2 | 合并 Model (28→20 structs, 去重 Experiment) | 1 天 | 中 |
| 3 | 合并 Repository (25→15 方法, 去重 CRUD) | 1 天 | 高 |
| 4 | 合并 Service (三模块逻辑整合) | 1 天 | 高 |
| 5 | 迁移 Handler (保留三个 handler 文件) | 0.5 天 | 中 |
| 6 | 注册统一路由 + 旧路由兼容 | 0.5 天 | 低 |
| 7 | 测试验证 (功能回归) | 0.5 天 | 中 |
| 8 | 删除旧三模块目录 | 0.5 天 | 低 |
| **总计** | | **5 天** | |

### 1.6 风险缓解

| 风险 | 缓解措施 |
|------|---------|
| Experiment 字段冲突 | 保留所有字段, 用 optional 标记差异化字段 |
| 旧 API 客户端不兼容 | 保留旧路由前缀 3 个月, 标注 deprecated |
| 数据迁移 | 同一数据库, 无需数据迁移 |
| 并发测试失败 | 逐模块合并, 每次合并后运行全量测试 |

---

## 二、ticketing handler 核心拆分方案

### 2.1 当前状态

| 文件 | 行数 | 方法数 | 说明 |
|------|------|--------|------|
| `handler.go` | **1370** | **84** | 核心 CRUD + 路由注册 — 未拆分 |
| 17 个辅助文件 | ~3400 | **109** | 全部是新增功能 |
| **总计** | **~4770** | **193** | |

### 2.2 拆分架构

```
internal/ticketing/
├── handler/
│   ├── handler.go                          # ~200 行 (仅保留 RegisterRoutes + 构造函数)
│   ├── ticket_core.go                      # ~400 行 (Create/Get/List/Update/Delete/Assign/Escalate/Resolve/Close)
│   ├── ticket_query.go                     # ~200 行 (Search/Filter/Sort/Paginate)
│   ├── ticket_workflow.go                  # ~250 行 (Transition/History/State 管理)
│   ├── ticket_comment.go                   # ~150 行 (AddComment/ListComment/EditComment)
│   ├── ticket_relation.go                  # ~200 行 (Link/Unlink/List relations) — 合并已有 relation.go
│   ├── ticket_field.go                     # ~150 行 (CustomField 管理)
│   ├── dispatch_handler.go                 # 已有 dispatch.go (22 方法, 不移)
│   ├── analytics_handler.go                # 已有 analytics.go (14 方法, 不移)
│   ├── automation_rule_handler.go          # 已有 (7 方法, 不移)
│   ├── queue_handler.go                    # 已有 (4 方法, 不移)
│   ├── sla_policy_handler.go               # 已有 (8 方法, 不移)
│   ├── transfer_handler.go                 # 已有 (7 方法, 不移)
│   ├── suspend.go                          # 已有 (8 方法, 不移)
│   ├── load_balancer_handler.go            # 已有 (5 方法, 不移)
│   ├── workflow.go                         # 已有 (4 方法, 不移)
│   ├── sla.go                              # 已有 (4 方法, 不移)
│   ├── ticket_source_handler.go            # 已有 (3 方法, 不移)
│   ├── service_control.go                  # 已有 (3 方法, 不移)
│   ├── errors.go                           # 已有 (0 方法, 不移)
│   └── response_writer.go                  # 已有 (0 方法, 不移)
```

### 2.3 handler.go 拆分映射

```go
// handler.go 中 84 方法的拆分目标

// --- ticket_core.go (15 方法) ---
func (h *Handler) Create(c *gin.Context)        // POST /tickets
func (h *Handler) Get(c *gin.Context)           // GET /tickets/:id
func (h *Handler) List(c *gin.Context)          // GET /tickets
func (h *Handler) Update(c *gin.Context)        // PUT /tickets/:id
func (h *Handler) Delete(c *gin.Context)        // DELETE /tickets/:id
func (h *Handler) Assign(c *gin.Context)        // POST /tickets/:id/assign
func (h *Handler) Escalate(c *gin.Context)      // POST /tickets/:id/escalate
func (h *Handler) Resolve(c *gin.Context)       // POST /tickets/:id/resolve
func (h *Handler) Close(c *gin.Context)         // POST /tickets/:id/close
func (h *Handler) Reopen(c *gin.Context)        // POST /tickets/:id/reopen
func (h *Handler) BatchCreate(c *gin.Context)   // POST /tickets/batch
func (h *Handler) BatchUpdate(c *gin.Context)   // PUT /tickets/batch
func (h *Handler) BatchDelete(c *gin.Context)   // DELETE /tickets/batch
func (h *Handler) BatchAssign(c *gin.Context)   // POST /tickets/batch/assign
func (h *Handler) GetTimeline(c *gin.Context)   // GET /tickets/:id/timeline

// --- ticket_query.go (8 方法) ---
func (h *Handler) Search(c *gin.Context)        // GET /tickets/search
func (h *Handler) Filter(c *gin.Context)        // POST /tickets/filter
func (h *Handler) Sort(c *gin.Context)          // POST /tickets/sort
func (h *Handler) Paginate(c *gin.Context)      // 已在 List 中
func (h *Handler) AdvancedSearch(c *gin.Context)// POST /tickets/advanced-search
func (h *Handler) Export(c *gin.Context)        // GET /tickets/export
func (h *Handler) Import(c *gin.Context)        // POST /tickets/import
func (h *Handler) BulkQuery(c *gin.Context)     // POST /tickets/bulk-query

// --- ticket_workflow.go (10 方法) ---
func (h *Handler) GetWorkflow(c *gin.Context)   // GET /tickets/:id/workflow
func (h *Handler) Transition(c *gin.Context)    // POST /tickets/:id/transition
func (h *Handler) GetHistory(c *gin.Context)    // GET /tickets/:id/history
func (h *Handler) GetState(c *gin.Context)      // GET /tickets/:id/state
func (h *Handler) ValidateTransition(c *gin.Context) // POST /tickets/:id/validate-transition
func (h *Handler) GetAvailableTransitions(c *gin.Context) // GET /tickets/:id/available-transitions
func (h *Handler) BatchTransition(c *gin.Context) // POST /tickets/batch/transition
func (h *Handler) GetStateDiagram(c *gin.Context) // GET /tickets/workflow/diagram
func (h *Handler) GetApprovalChain(c *gin.Context) // GET /tickets/:id/approval-chain
func (h *Handler) SubmitForApproval(c *gin.Context) // POST /tickets/:id/submit-approval

// --- ticket_comment.go (5 方法) ---
func (h *Handler) AddComment(c *gin.Context)    // POST /tickets/:id/comments
func (h *Handler) ListComments(c *gin.Context)  // GET /tickets/:id/comments
func (h *Handler) EditComment(c *gin.Context)   // PUT /tickets/:id/comments/:commentId
func (h *Handler) DeleteComment(c *gin.Context) // DELETE /tickets/:id/comments/:commentId
func (h *Handler) AddAttachment(c *gin.Context) // POST /tickets/:id/attachments

// --- ticket_relation.go (5 方法) ---
func (h *Handler) LinkTicket(c *gin.Context)    // POST /tickets/:id/relations
func (h *Handler) UnlinkTicket(c *gin.Context)  // DELETE /tickets/:id/relations/:relationId
func (h *Handler) ListRelations(c *gin.Context) // GET /tickets/:id/relations
func (h *Handler) LinkIncident(c *gin.Context)  // POST /tickets/:id/link-incident
func (h *Handler) LinkChange(c *gin.Context)    // POST /tickets/:id/link-change

// --- ticket_field.go (5 方法) ---
func (h *Handler) GetFields(c *gin.Context)     // GET /tickets/fields
func (h *Handler) UpdateField(c *gin.Context)   // PUT /tickets/:id/fields/:fieldId
func (h *Handler) GetCustomFields(c *gin.Context) // GET /tickets/:id/custom-fields
func (h *Handler) UpdateCustomField(c *gin.Context) // PUT /tickets/:id/custom-fields/:fieldId
func (h *Handler) ValidateFields(c *gin.Context) // POST /tickets/validate-fields
```

### 2.4 handler.go 精简后结构

```go
// handler.go — 精简后 ~200 行
package handler

type Handler struct {
    service *ticketingService.TicketService
    // ... 其他依赖
}

func NewHandler(svc *ticketingService.TicketService) *Handler {
    return &Handler{service: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    tickets := rg.Group("/tickets")
    // 核心
    tickets.POST("", h.Create)
    tickets.GET("", h.List)
    tickets.GET("/:id", h.Get)
    tickets.PUT("/:id", h.Update)
    tickets.DELETE("/:id", h.Delete)
    tickets.POST("/:id/assign", h.Assign)
    tickets.POST("/:id/escalate", h.Escalate)
    tickets.POST("/:id/resolve", h.Resolve)
    tickets.POST("/:id/close", h.Close)
    // 查询
    tickets.GET("/search", h.Search)
    tickets.POST("/filter", h.Filter)
    tickets.GET("/export", h.Export)
    // 工作流
    tickets.GET("/:id/workflow", h.GetWorkflow)
    tickets.POST("/:id/transition", h.Transition)
    tickets.GET("/:id/history", h.GetHistory)
    // 评论
    tickets.POST("/:id/comments", h.AddComment)
    tickets.GET("/:id/comments", h.ListComments)
    // 关系
    tickets.POST("/:id/relations", h.LinkTicket)
    tickets.GET("/:id/relations", h.ListRelations)
    // 字段
    tickets.GET("/fields", h.GetFields)
    tickets.PUT("/:id/fields/:fieldId", h.UpdateField)
}
```

### 2.5 迁移步骤

| 步骤 | 操作 | 工作量 | 风险 |
|------|------|--------|------|
| 1 | 创建 `ticket_core.go` 提取 15 方法 | 0.5 天 | 低 |
| 2 | 创建 `ticket_query.go` 提取 8 方法 | 0.5 天 | 低 |
| 3 | 创建 `ticket_workflow.go` 提取 10 方法 | 0.5 天 | 低 |
| 4 | 创建 `ticket_comment.go` 提取 5 方法 | 0.5 天 | 低 |
| 5 | 创建 `ticket_relation.go` 提取 5 方法 | 0.5 天 | 中 — 合并已有 relation.go |
| 6 | 创建 `ticket_field.go` 提取 5 方法 | 0.5 天 | 低 |
| 7 | 精简 `handler.go` 为仅路由注册 | 0.5 天 | 低 |
| 8 | 测试验证 | 1 天 | 中 |
| **总计** | | **4 天** | |

---

## 三、crossover Repository 补全方案

### 3.1 当前状态

```
crossover/
├── dispatcher/dispatcher.go      # CallDispatcher + BatchDispatcher
├── models/models.go              # CrossoverCall + CallResultObj + CallOperation
├── registry/registry.go          # CallOperationRegistry (内存)
├── router/router.go              # CallRouter + HandlerRegistry
├── service/service.go            # CrossoverService (394行, 23 方法)
│   └── RepositoryInterface       # 接口定义 (6 方法)
└── [缺] repository/
└── [缺] handler/
```

### 3.2 RepositoryInterface 定义

```go
// service/service.go:39-44
type RepositoryInterface interface {
    Create(ctx context.Context, call *models.CrossoverCall) error
    Get(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error)
    UpdateResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error
    List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CrossoverCall, error)
    ListByTarget(ctx context.Context, tenantID, targetModule string, opts *ListOptions) ([]models.CrossoverCall, error)
    Delete(ctx context.Context, tenantID, id string) error
}
```

### 3.3 Repository 实现

```go
// repository/repository.go
package repository

import (
    "context"
    "database/sql"
    "time"

    "orion/platform-svc-go/internal/crossover/models"
)

type Repository struct {
    db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
    return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, call *models.CrossoverCall) error {
    query := `INSERT INTO crossover_calls (id, tenant_id, source_module, target_module, operation, payload, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
    _, err := r.db.ExecContext(ctx, query,
        call.ID, call.TenantID, call.SourceModule, call.TargetModule,
        call.Operation, call.Payload, call.Status, time.Now(), time.Now())
    return err
}

func (r *Repository) Get(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error) {
    query := `SELECT id, tenant_id, source_module, target_module, operation, payload, status, result, created_at, updated_at
              FROM crossover_calls WHERE tenant_id = $1 AND id = $2`
    row := r.db.QueryRowContext(ctx, query, tenantID, id)
    call := &models.CrossoverCall{}
    err := row.Scan(&call.ID, &call.TenantID, &call.SourceModule, &call.TargetModule,
        &call.Operation, &call.Payload, &call.Status, &call.Result, &call.CreatedAt, &call.UpdatedAt)
    return call, err
}

func (r *Repository) UpdateResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error {
    query := `UPDATE crossover_calls SET result = $1, status = $2, updated_at = $3 WHERE tenant_id = $4 AND id = $5`
    _, err := r.db.ExecContext(ctx, query, result, result.Status, time.Now(), tenantID, id)
    return err
}

func (r *Repository) List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CrossoverCall, error) {
    query := `SELECT id, tenant_id, source_module, target_module, operation, payload, status, result, created_at, updated_at
              FROM crossover_calls WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
    rows, err := r.db.QueryContext(ctx, query, tenantID, opts.Limit, opts.Offset)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var calls []models.CrossoverCall
    for rows.Next() {
        var call models.CrossoverCall
        if err := rows.Scan(&call.ID, &call.TenantID, &call.SourceModule, &call.TargetModule,
            &call.Operation, &call.Payload, &call.Status, &call.Result, &call.CreatedAt, &call.UpdatedAt); err != nil {
            return nil, err
        }
        calls = append(calls, call)
    }
    return calls, nil
}

func (r *Repository) ListByTarget(ctx context.Context, tenantID, targetModule string, opts *ListOptions) ([]models.CrossoverCall, error) {
    query := `SELECT id, tenant_id, source_module, target_module, operation, payload, status, result, created_at, updated_at
              FROM crossover_calls WHERE tenant_id = $1 AND target_module = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
    // ... 同 List 但加 target_module 过滤
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
    query := `DELETE FROM crossover_calls WHERE tenant_id = $1 AND id = $2`
    _, err := r.db.ExecContext(ctx, query, tenantID, id)
    return err
}
```

### 3.4 Handler 实现

```go
// handler/handler.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "orion/platform-svc-go/internal/crossover/models"
    "orion/platform-svc-go/internal/crossover/service"
)

type Handler struct {
    svc *service.CrossoverService
}

func NewHandler(svc *service.CrossoverService) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    crossover := rg.Group("/crossover")
    crossover.POST("", h.Create)
    crossover.GET("", h.List)
    crossover.GET("/:id", h.Get)
    crossover.PUT("/:id/result", h.UpdateResult)
    crossover.DELETE("/:id", h.Delete)
    crossover.GET("/by-target/:targetModule", h.ListByTarget)
}

func (h *Handler) Create(c *gin.Context) { /* ... */ }
func (h *Handler) Get(c *gin.Context) { /* ... */ }
func (h *Handler) List(c *gin.Context) { /* ... */ }
func (h *Handler) UpdateResult(c *gin.Context) { /* ... */ }
func (h *Handler) Delete(c *gin.Context) { /* ... */ }
func (h *Handler) ListByTarget(c *gin.Context) { /* ... */ }
```

### 3.5 wiring.go 注入

```go
// cmd/server/wiring.go 新增
crossoverRepo := repository.NewRepository(db)
crossoverSvc := crossover_service.NewCrossoverService(crossoverRepo, operationRegistry, callRouter, logger)
crossoverH := crossover_handler.NewHandler(crossoverSvc)
crossoverH.RegisterRoutes(apiGroup)
```

### 3.6 迁移步骤

| 步骤 | 操作 | 工作量 | 风险 |
|------|------|--------|------|
| 1 | 创建 `repository/repository.go` (PostgreSQL 实现) | 1 天 | 低 |
| 2 | 创建 `handler/handler.go` (6 路由) | 0.5 天 | 低 |
| 3 | 更新 wiring.go (注入 Repo → Service → Handler) | 0.5 天 | 低 |
| 4 | 添加 SQL migration 文件 | 0.5 天 | 低 |
| 5 | 测试验证 | 1 天 | 中 |
| **总计** | | **3.5 天** | |

### 3.7 SQL Migration 定义

```sql
-- migrations/xxx_crossover_calls.sql
CREATE TABLE IF NOT EXISTS crossover_calls (
    id              VARCHAR(64) PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL,
    source_module   VARCHAR(128) NOT NULL,
    target_module   VARCHAR(128) NOT NULL,
    operation       VARCHAR(64) NOT NULL,
    payload         JSONB,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    result          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crossover_calls_tenant ON crossover_calls(tenant_id);
CREATE INDEX idx_crossover_calls_target ON crossover_calls(tenant_id, target_module);
CREATE INDEX idx_crossover_calls_status ON crossover_calls(status);
```

---

> 关联文档: `docs/structure-overlap-verification-2026-08-01.md` (结构重叠核实) | `docs/ALL_TODOS.md` (待办清单) | `docs/superpowers/specs/2026-08-01-product-roadmap.md` (产品路线图)