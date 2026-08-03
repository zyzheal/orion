# 功能重叠 / 结构重复 — 核实报告 (2026-08-01)

> 核实方法: 逐文件 grep/wc + 源码级验证
> 核实日期: 2026-08-01
> 来源: CROSS_VALIDATION_REPORT.md (9 项声明) + 逐项代码核实
> 状态: ✅ 全部 5 项已核实完毕

---

## 汇总

| # | 重叠项 | 核实结论 | 最终判定 | 工作量 |
|---|--------|---------|---------|--------|
| 1 | chaos 三模块合并 | ❌ 三模块仍在，Model/Repo/CRUD 完全独立 | **P1 — 需合并** | 3-5 天 |
| 2 | ticketing handler 拆分 | ⚠️ 17 个辅助文件(109方法)已拆出，但 handler.go 仍 1370行/84方法 | **P1 — 需核心拆分** | 2-3 天 |
| 3 | global-search 补 Service | Handler(183行) 直调 IndexerRegistry(含 search_repository) | **降级 — 信息项** | 0 |
| 4 | statistics 分层重构 | 独立工具库，全项目 0 处引用，非 REST 模块 | **删除 — 不适用** | 0 |
| 5 | crossover Repository 实现 | RepositoryInterface 已定义(6方法)，无 repository 包，未 wired | **P1 — 需补全** | 1-2 天 |

**实际待处理: 3 项 (chaos 合并 / ticketing 拆分 / crossover Repo)**

---

## 1. chaos 三模块合并

### 1.1 三模块规模

| 模块 | Handler | Service | Repo | Model |
|------|---------|---------|------|-------|
| `chaos` | 1384 行 | 1208 行 | 236 行 | 15 structs |
| `chaos-enhanced` | 367 行 | 210 行 | 146 行 | 4 structs |
| `chaos-gateway` | 517 行 | 445 行 | 322 行 | 9 structs |

### 1.2 重叠证据

**Handler 层 — 三模块各自实现相同的 CRUD + 生命周期方法**:

| 操作 | chaos/handler | chaos-enhanced/handler | chaos-gateway/handler |
|------|---------------|----------------------|----------------------|
| Create Experiment | `Create` | `CreateExperiment` | `CreateExperiment` |
| Get Experiment | `Get` | `GetExperiment` | `GetExperiment` |
| List Experiments | `List` | `ListExperiments` | `ListExperiments` |
| Update Experiment | `Update` | — | `UpdateExperiment` |
| Start/Run | `Run` | `StartExperiment` | `StartExperiment` |
| Stop | — | `StopExperiment` | `StopExperiment` |
| Delete | — | — | `DeleteExperiment` |
| Inject Fault | `Inject` | `InjectFault` | — |

**Repository 层 — 三模块各自实现独立的 CRUD**:

- `chaos/repository`: `Create/GetByID/List/Update/Delete/UpdateStatus/ListRunning/CreateRun/GetRun/UpdateRunStatus` (10 方法)
- `chaos-enhanced/repository`: `CreateExperiment/GetExperiment/ListExperiments/UpdateExperiment/CreateFaultInjection` (5+ 方法)
- `chaos-gateway/repository`: `CreateExperiment/GetExperiment/UpdateExperiment/UpdateStatus/DeleteExperiment/ListExperiments/CreateResult/ListResults/CreateLog/ListLogs` (10+ 方法)

**Model 层 — 三模块各定义 Experiment struct**:
- `chaos/models/models.go:7` — `type Experiment struct` (15 structs 含 Run/Inject/Recovery)
- `chaos-enhanced/models/models.go:6` — `type Experiment struct` (4 structs, 轻量版)
- `chaos-gateway/models/models.go:76` — `type ChaosTarget struct` (9 structs, 含 Scenario/Threshold)

### 1.3 差异分析（不是完全重复）

三模块有功能差异：
- `chaos`: 核心实验执行 + Rollback + Recover 闭环
- `chaos-enhanced`: 增强版，含 FaultInjection 和 PaginatedResponse
- `chaos-gateway`: 网关层，含 ChaosScenario/ChaosTarget/MonitoringThreshold/SafeguardConfig

### 1.4 合并方案

```
chaos-engine/
├── models/           # 统一 Model (合并 15+4+9 structs，去重 Experiment)
├── repository/       # 统一 Repo (合并 CRUD，保留各自特有方法)
├── service/          # 合并 Service，提供统一 API
├── handler/
│   ├── core_handler.go        # 核心 CRUD + Run/Stop/Rollback
│   ├── enhanced_handler.go    # FaultInjection + Pagination
│   └── gateway_handler.go     # Scenario/Target/Threshold/Monitoring
└── router.go         # 统一路由注册
```

**保持向后兼容**:
- 原有路由前缀 `/api/v1/chaos` / `/api/v1/chaos-enhanced` / `/api/v1/chaos-gateway` 均保留
- 共享底层 Model + Repo + Service
- 各 handler 只实现特有逻辑

---

## 2. ticketing handler 拆分

### 2.1 当前状态

| 文件 | 行数 | 方法数 | 说明 |
|------|------|--------|------|
| `handler.go` | **1370** | **84** | 核心工单 CRUD + 路由注册 — **未拆分** |
| 辅助文件合计 | ~3400 | **109** | 17 个文件，已拆出 |
| 总计 | ~4770 | **193** | |

### 2.2 17 个辅助文件清单

| 文件 | 方法数 | 功能域 |
|------|--------|--------|
| `dispatch.go` | 22 | 派单引擎 |
| `analytics.go` | 14 | 统计分析 |
| `automation_rule_handler.go` | 7 | 自动化规则 |
| `transfer_handler.go` | 7 | 工单转移 |
| `queue_handler.go` | 4 | 队列管理 |
| `ticket.go` | 10 | 工单操作 |
| `sla_policy_handler.go` | 8 | SLA 策略 |
| `suspend.go` | 8 | 挂起管理 |
| `relation.go` | 5 | 关系管理 |
| `load_balancer_handler.go` | 5 | 负载均衡 |
| `analytics_enhanced_handler.go` | 5 | 增强分析 |
| `workflow.go` | 4 | 工作流 |
| `sla.go` | 4 | SLA |
| `ticket_source_handler.go` | 3 | 工单来源 |
| `service_control.go` | 3 | 服务控制 |
| `errors.go` | 0 | 错误定义 |
| `response_writer.go` | 0 | 响应工具 |

### 2.3 核心问题

17 个辅助文件拆出的 109 个方法是**新增功能**（analytics/dispatch/relation 等），**没有从 handler.go 中剥离任何方法**。handler.go 的 84 个方法（核心 CRUD + 路由注册）仍在原文件。

### 2.4 拆分方案

将 `handler.go` 的 84 方法按业务域拆分为:

```
handler.go           → ~200 行 (仅保留 RegisterRoutes + 构造函数)
ticket_core.go       → ~400 行 (Create/Get/List/Update/Delete/Assign/Escalate/Resolve/Close)
workflow_handler.go  → ~300 行 (Transition/History/State 相关)
comment_handler.go   → ~150 行 (Comment/AddComment/ListComment)
relation_handler.go  → ~200 行 (已有 relation.go 可合并)
field_handler.go     → ~150 行 (Field/CustomField 相关)
```

---

## 3. global-search 补 Service

### 3.1 当前架构

```
Handler(183行, 6 方法)
    └── IndexerRegistry (编排层)
            ├── Search(ctx, SearchRequest) → 多索引聚合
            ├── Reindex(ctx, module) → 重建索引
            ├── DeleteIndex(ctx) → 删除索引
            └── Status/All/Get → 元数据查询
```

### 3.2 代码证据

`handler/search_handler.go`:
- `Handler` struct 只有 `registry *index.IndexerRegistry` 一个字段
- 6 个 handler 方法全部调 `h.registry.XXX()`，无 `h.service.XXX()`
- 无 `service/` 目录
- 有 `repository/search_repository.go`（ES 直调）

### 3.3 降级理由

`global-search` 不是传统 REST CRUD 模块，而是 **Elasticsearch 搜索聚合层**：

1. `IndexerRegistry` 已承担了 Service 角色（编排多索引搜索 + 结果聚合 + 权限过滤）
2. 搜索操作不适合"Service → Repo → DB"三层 — ES 本身是存储 + 计算
3. 补一个空的 Service 层只会增加文件数量而无实质收益
4. `IndexerRegistry` 已经是合理的领域抽象（Domain Model）

### 3.4 建议

**降级为信息项**。如果未来需要标准化三层，可在 `IndexerRegistry` 外部再包一层 `SearchService` 做权限校验和审计日志，但目前不必要。

---

## 4. statistics 分层重构

### 4.1 当前状态

| 文件 | 行内容 |
|------|--------|
| `aggregator.go` | `package statistics` — `Aggregator` struct, `Aggregate/AggregateByWindow/percentile` |
| `processor.go` | `package statistics` — `Processor` struct, `Ingest/IngestBatch/Aggregate/AggregateHistogram/AggregateAll` |
| `stat_metric.go` | `package statistics` — `StatMetric` struct, `MetricType/AggregationWindow/AggregationResult` |
| `statistics_test.go` | 测试文件 |

### 4.2 核实发现

- **全项目 0 处引用** — `grep -r 'import.*statistics' orion-platform-svc-go/` 返回空
- **无 handler / service / repository 子目录** — 只有 3 个文件平铺在 `internal/statistics/`
- **cmd/server 未使用** — `grep statistics cmd/server/` 返回空
- **纯工具库** — 只有 `NewProcessor/NewStatMetric/DefaultAggregator` 等工厂函数

### 4.3 结论

`statistics` 是一个**孤立工具包**，不是 REST 模块。全项目没有任何模块 import 它，cmd/server 也未使用它。

### 4.4 建议

**从重叠清单中删除**。这个包有两种处理方式:
1. **废弃** — 如果功能已被其他模块替代（如 `ticketing/analytics`、`finops/analysis`）
2. **保留为工具库** — 如果计划未来启用，需从零搭建 REST 层（handler + service + repo）

---

## 5. crossover Repository 实现

### 5.1 当前状态

```
crossover/
├── dispatcher/dispatcher.go     # CallDispatcher + BatchDispatcher
├── models/models.go            # CrossoverCall + CallResultObj + CallOperation
├── models/models_test.go
├── registry/registry.go        # CallOperationRegistry (内存注册表)
├── registry/registry.go        # RepositoryInterface (接口定义)
├── router/router.go            # CallRouter + HandlerRegistry
├── router/router_test.go
└── service/service.go          # CrossoverService (394行, 23 方法)
```

### 5.2 缺口证据

**RepositoryInterface 已定义** (`service/service.go:39-44`):
```go
type RepositoryInterface interface {
    Create(ctx context.Context, call *models.CrossoverCall) error
    Get(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error)
    UpdateResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error
    List(ctx context.Context, tenantID string, opts *ListOptions) ([]models.CrossoverCall, error)
    ListByTarget(ctx context.Context, tenantID, targetModule string, opts *ListOptions) ([]models.CrossoverCall, error)
    Delete(ctx context.Context, tenantID, id string) error
}
```

**缺口**:
1. **无 `repository/` 包** — 接口无实现
2. **`wiring.go` 无 crossover 引用** — 服务未被注入依赖容器
3. **无 routes 注册** — 23 个 Service 方法无 HTTP 端点

### 5.3 补全方案

```
crossover/
├── repository/
│   ├── repository.go       # 实现 RepositoryInterface (CRUD + 查询)
│   └── repository_test.go
└── handler/                # 新建 HTTP handler (注册 routes)
    └── handler.go
```

**实现步骤**:
1. 创建 `repository/repository.go` — PostgreSQL 实现 `RepositoryInterface`
2. 创建 `handler/handler.go` — 注册 `/api/v1/crossover/*` 路由
3. 更新 `wiring.go` — 注入 `CrossoverService` + `Repository`

---

## 执行顺序建议

```
Phase 1 (第 1-2 天):  P1-5 crossover Repository 补全 — 最简单
Phase 2 (第 3-5 天):  P1-2 ticketing handler 核心拆分
Phase 3 (第 6-10 天): P1-1 chaos 三模块合并 — 最复杂
```
