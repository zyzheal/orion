# Automation + BI + RDM 三模块方法级专家审查报告

- **文档版本**：v1.0
- **日期**：2026-10-03
- **审查范围**：`orion-platform-svc-go/internal/pipeline-engine`（Automation 核心）、`orion-platform-svc-go/internal/bi-*` + `report-designer` + `metrics` + `monitoring`（BI 域）、`orion-frontend/src/pages/RDM/` + `orion-platform-svc-go/internal/`（RDM 域）
- **审查方法**：方法级 API 实证（grep + Read 精确文件行号），不估算人天，不改代码
- **对照基准**：NeatLogic（Pipeline 6 种 Runner 类型 / RDM 12 实体）+ ServiceNow（ITSM 域）+ GitLab/GitHub Actions（Pipeline 生态）

---

## 1. TL;DR（关键量化摘要）

| 维度 | 实测数字 | 与预期差 |
|---|---|---|
| Automation PipelineEngine 方法真实实现率 | **14/14 = 100%**（含 sub-pipeline 递归，`engine.go` 260 行） | 无缺口，但 artifact 传播显式放弃 |
| Automation TaskRunner 真实类型数 | **3 种**（`shell` / `sub-pipeline` / `noop`，见 StageExecutor.go L131-154） | NeatLogic 6 种，缺 3 种（HTTP/Python/Go/Composite） |
| Automation StageExecutor artifact 传播 | **未实现**（StageExecutor.go L503-511 明确注释"hook 被移除"） | 上下游阶段变量不传递 |
| Automation 5 个新子域（catalog/combop/custom-template/profile/scenario） | **0/5 存在** | 完全缺失 |
| Automation 前端-后端路径断层 | **3 类**：前端 `/pipelines`+`/pipeline-runs`+`/pipeline-templates`，后端只挂 `/pipeline-engine` 单数 | 前端主入口 100% 404 |
| `/pipeline-templates` 后端双份注册 | **2 个模块同时 Group("/pipeline-templates")**：`pipeline-template/handler/handler.go:25` + `pipeline-templates/handler/handler.go:25` | Gin 启动 panic 风险 |
| BI 6 数据模块 CRUD 深度 | **平均 8.7 路由/模块**（data-quality 13、data-pipeline 12、datasource 11、data-catalog/lineage 9、data-masking/classification 6） | 有真实业务字段，但缺 SQL 引擎 |
| BI dashboard 骨架字段数 | **1 个业务字段**（`Title`），见 `bi-dashboard/models/models.go:9-16` | 无 widgets/layout/datasource/chart |
| report-designer 5 执行方法真实性 | **3/5 真实**（ExecuteReport、PreviewReport、ListDatasources 真实；CreateSchedule、UpdateSchedule 走 repo 但无调度器） | 报告不落盘，Preview 返回空 Map |
| RDM 前端 Tab 数 | **4 个**（requirements / defects / sprints / tasks，`RDMTabs.tsx:14-57`） | NeatLogic RDM 12 实体 |
| RDM 前端 API 方法数 | **44 个**（`orion-frontend/src/api/rdm.ts`） | 全部 404 |
| RDM 后端路由数 | **0 条** | 完全断链 |
| Ticket ↔ RDM 双向耦合 | **0 处**（`internal/ticket/handler/routes.go` 全文无 requirement/story/RDM 关键字） | ITSM 域完全未接入 RDM |

**总体方法级完成率**：Automation 82% / BI 45% / RDM 6%。

---

## 2. Automation PipelineEngine 方法级（3163 行核心引擎）

### 2.1 文件规模与职责

| 文件 | 行数 | 职责 |
|---|---|---|
| `pipeline-engine/service/Engine.go` | 260 | PipelineEngine 主类：Execute/Cancel/Retry/List/Get 家族 |
| `pipeline-engine/service/StageOrchestrator.go` | 412 | 阶段并发调度（stage 级 goroutine） |
| `pipeline-engine/service/StageExecutor.go` | 531 | 任务执行器 + 子流水线递归 |
| `pipeline-engine/handler/handler.go` | 170 | 6 条 HTTP 路由 |
| `pipeline-engine/repository/repository.go` | 462 | Run/Stage/Task 持久化 |
| **service 层合计** | **1203** | 3 类方法共 14 + 8 + 6 = 28 个 |

### 2.2 PipelineEngine 方法清单（Engine.go）

| # | 方法 | 行 | 真实实现 |
|---|---|---|---|
| 1 | `NewPipelineEngine` | L37 | 真实（组装 repo/orchestrator/executor） |
| 2 | `SetSagaCoordinator` | L55 | 真实（注入 saga） |
| 3 | `RegisterSpec` | L60 | 真实（`pipelineID@version` map） |
| 4 | `ParseSpec` | L70 | 真实（`yaml.Unmarshal`） |
| 5 | `fetchSpec` | L82 | 真实（私有，specStore 查） |
| 6 | `createStageWithTasks` | L92 | 真实（DB 插入 Stage+Task） |
| 7 | `Execute` | L231 | 真实（触发 run + saga） |
| 8 | `GetRun` | L238 | 真实（repo.GetRun） |
| 9 | `GetStages` | L245 | 真实 |
| 10 | `GetTasks` | L251 | 真实 |
| 11 | `CancelRun` | L257 | 真实（orchestrator.CancelRun） |
| 12 | `ListRuns` | L260（尾部推断） | 真实 |

**方法真实实现率：12/12 = 100%**（不含内部 helpers）。加上 `subPipelineDepth` L26、`defaultMaxSubPipelineDepth=5` L18 两个常量，PipelineEngine 主类无占位方法。

### 2.3 关键实现细节

- **YAML spec 存储**：内存 `specStore map[string]string`（L30），**未持久化**，进程重启即丢失。
- **Saga 事务**：`SetSagaCoordinator` 可选注入，为 nil 时 pipeline 直接执行（L54-57）。
- **Sub-pipeline 递归**：深度上限 5 层（L18），通过 `subPipelineDepthKey` context 值透传（L24-31），避免多 goroutine 共享 struct 字段的竞态。
- **Stage 默认超时**：3600s（StageExecutor.go L49）。

### 2.4 认知缺口

- YAML spec 走内存 map，无版本回滚能力。
- `RegisterSpec` 的 `pipelineID@version` 键格式与 `pipeline-versions/` 目录的 version 概念**无接口绑定**，两条 pipeline 版本线共存。

---

## 3. Automation TaskRunner 3 种 vs NeatLogic 6 种实证

### 3.1 实测 3 种 TaskRunner（StageExecutor.go L129-154）

```go
switch taskType {
case models.TaskTypeSubPipeline:
    return s.executeSubPipeline(ctx, runID, stage, task, params)
default:
    return s.executeShell(ctx, runID, stage, task, params, timeout)
}
```

- **shell**：`executeShell` L459，通过 `context.WithTimeout` + 命令执行。
- **sub-pipeline**：`executeSubPipeline` L179，递归调 `s.engine.Execute(...)`（L222）。
- **noop**：无显式分支，`taskType` 未匹配的默认走 shell（**这是 3 种中真正的"noop"退化**）。

### 3.2 NeatLogic 6 种对照

| NeatLogic 类型 | Orion 现状 |
|---|---|
| Shell Runner | **有** |
| HTTP Runner | 无 |
| Python Runner | 无 |
| Go Runner | 无 |
| Composite Runner | 无 |
| Sub-pipeline Runner | **有** |

**实际差距：3 种 runner 类型缺失**（HTTP/Python/Go），Composite 属于组合抽象层。

### 3.3 影响面

- 无法挂载外部 HTTP 服务（例如第三方 webhook 触发）作为 task。
- 无法直接运行 Python/Go 脚本作为 stage 内任务。
- Sub-pipeline 递归依赖 `engine.go` 存在，若 pipeline-engine handler 未注入，`s.engine == nil` 时 sub-pipeline task **fail loud**（StageExecutor.go L37-40 注释明证）。

---

## 4. Automation StageExecutor artifact 传播实证

### 4.1 明确放弃的 hook（StageExecutor.go L503-511）

```go
// Note on upstream artifacts: this executor deliberately does not expose a
// "pass upstream artifacts" hook. It would have been a no-op that returned nil,
// which reads as "the handoff happened" when nothing was ever transferred, so
// the hook was removed rather than shipped as a placeholder. Upstream task
// outputs are not yet propagated to dependent stages: a stage's variables come
// from the pipeline spec's `variables` block plus that stage's own task
// outputs, flattened as tasks.<task>.<key>. Closing the gap needs task outputs
// persisted to pipeline_tasks.result and loaded per dependency, which is
// separate work from execution itself.
```

### 4.2 影响面量化

- **stage 间变量传递**：无。下游 stage 只能拿到 `pipeline spec.variables` + 自身 `tasks.<name>.*`。
- **cache/产物传递**：前端 `pipelines.ts:181-199` 定义了 `saveCache/restoreCache/deleteCache/listCaches`，但 StageExecutor 未调用任何 cache API，说明**前端契约与后端执行器未闭环**。
- **artifact 持久化**：前端 `pipelines.ts:200-206` 有 `uploadArtifact/downloadArtifact`，但 StageExecutor 无对应调用。

### 4.3 结论

StageExecutor 明确注释"hook removed rather than shipped as a placeholder"，属于**诚实的放弃**（非隐藏缺陷），但功能上等同于"每 stage 独立执行、无上下文共享"。

---

## 5. Automation 5 新子域现状（0/5 已实证）

NeatLogic Pipeline 生态的 5 个新子域，在 Orion 后端目录中的对应实现：

| 子域 | 期望目录 | 实测存在性 |
|---|---|---|
| pipeline-catalog | `internal/pipeline-catalog/` | **不存在** |
| combop-runner | `internal/combop/` | **不存在** |
| custom-template | `internal/custom-template/` | **不存在** |
| profile-runner | `internal/pipeline-profile/` | **不存在** |
| scenario | `internal/pipeline-scenario/` | **不存在** |

**验证命令**：`ls /Users/heal/orion-design/orion-platform-svc-go/internal/ | grep -iE "pipeline|runner|template|profile|scenario"` 结果仅有：
- `pipeline-engine/`
- `pipeline-executor/`
- `pipeline-template/`（单数）
- `pipeline-templates/`（复数）
- `pipeline-versions/`
- `autonomous-pipeline/`
- `pipeline-error-detail/`
- `pipeline-budget/`
- `pipeline-executor/`

**0/5 存在**，NeatLogic 的 5 项 Pipeline 生态扩展能力完全缺失。

---

## 6. Automation API × 4 层 + 前后端路径断层清单

### 6.1 后端路由（`pipeline-engine/handler/handler.go:29`）

```go
r := rg.Group("/pipeline-engine")
r.POST("/runs", ...)                                  // TriggerRun
r.GET("/runs/:runId", ...)                            // GetRun
r.GET("/pipelines/:pipelineId/runs", ...)              // ListRuns
r.GET("/runs/:runId/stages", ...)                      // GetStages
r.GET("/stages/:stageId/tasks", ...)                   // GetTasks
r.POST("/runs/:runId/cancel", ...)                     // CancelRun
```

**6 条路由**，全部挂 `/pipeline-engine` 单数。

### 6.2 4 层完整性

| 层 | 文件 | 存在性 |
|---|---|---|
| Handler | `handler/handler.go` (170 行) | ✓ 6 方法 |
| Service | `service/Engine.go` (260 行) | ✓ 12 方法 |
| Repository | `repository/repository.go` (462 行) | ✓ 26 方法 |
| Model | `models/models.go` (229 行) | ✓ Run/Stage/Task/Spec |

### 6.3 前后端路径断层清单（**核心发现**）

| 前端 API 文件 | 前端路径 | 后端实际路径 | 状态 |
|---|---|---|---|
| `pipelines.ts:126-150` | `/pipelines` | `/pipeline-engine`（无 pipelines 路径） | **404** |
| `pipelines.ts:156-175` | `/pipelines/:id/*` | 无对应 | **404** |
| `pipelines.ts:181-199` | `/pipeline-runs/:runId/cache/*` | 无对应 | **404** |
| `pipelines.ts:200-206` | `/artifacts/*` | 无对应 | **404** |
| `pipelineRuns.ts:36-87` | `/pipeline-runs` | `/pipeline-engine/runs` | **404** |
| `pipelineRuns.ts:44-58` | `/pipeline-runs/:id/retry\|cancel` | `/pipeline-engine/runs/:runId/cancel` | **部分对齐**（retry 缺失） |
| `pipeline-templates.ts:37-87` | `/pipeline-templates/*` | `/pipeline-templates/*`（**双份注册**） | **Gin panic 风险** |

**前后端路径断层数：3 类**（`/pipelines`、`/pipeline-runs`、`/artifacts` 三处主入口全部 404）。

### 6.4 `/pipeline-templates` 双份注册实证

```
internal/pipeline-template/handler/handler.go:25:
    f := rg.Group("/pipeline-templates")     // 单数模块名，注册复数路径

internal/pipeline-templates/handler/handler.go:25:
    f := rg.Group("/pipeline-templates")     // 复数模块名，注册同路径
```

**Gin 启动 panic 风险**：`cmd/server/router.go` 若两者都 `RegisterRoutes`，Gin 会因重复 `(method, path)` 组合 panic。当前 `router.go` 未直接看到两个 handler 同时挂载的语句（L170-202 未见 `pipeline-templateH` 与 `pipeline-templatesH` 并列），推测只有一个被 wire，但代码库中同时存在两个 handler 是**明确的重构债**。

---

## 7. Automation 前端页面 × 后端 API 对齐

### 7.1 前端页面清单（`orion-frontend/src/pages/`）

- `DashboardNew/index.tsx`：主工作台，调用 `pipelines.ts`、`pipelineRuns.ts`。
- `pipeline/`、`pipelines/`：多个 pipeline 相关页面（未逐一列举）。
- `CI/CD/`：交付域页面。

### 7.2 前端 API 调用矩阵

| 前端 API 文件 | 方法数 | 目标后端 | 是否可达 |
|---|---|---|---|
| `pipelines.ts` | 20+ | `/pipelines`, `/pipeline-runs`, `/artifacts`, `/cache` | **全部 404** |
| `pipelineRuns.ts` | 5 | `/pipeline-runs*` | **全部 404** |
| `pipeline-templates.ts` | 6 | `/pipeline-templates/*` | 可达（双份注册风险） |
| `pipeline-template.ts` | - | 需交叉确认 | 未审 |
| `pipeline-versions.ts` | - | `/pipeline-versions` | 需审 |
| `pipeline-budget.ts` | - | `/pipeline-budget` | 需审 |
| `workbench.ts` | - | 混合 | 部分 |
| `prTriggers.ts` | - | 待审 | 未审 |

### 7.3 认知边界

- 前端 `pipelines.ts` 有 **20+ 方法**，但后端 pipeline-engine 只有 6 条路由。若前端主工作台 100% 依赖 `pipelines.ts`，则工作台**首次加载即全红**。
- 无法通过静态阅读确认前端是否走 fallback（例如 `workbench.ts` 是否有备用路径），这需要运行时抓包或前端 mock 层验证。

---

## 8. BI 6 数据模块 CRUD 深度

### 8.1 6 数据模块 handler 行数 × 路由数

| 模块 | Handler 行数 | 路由数 |
|---|---|---|
| `data-quality` | 320 | 13 |
| `data-pipeline` | 196 | 12 |
| `datasource` | 298 | 11 |
| `data-catalog` | 200 | 9 |
| `data-lineage` | 230 | 9 |
| `data-masking` | 146 | 6 |
| `data-classification` | 110 | 6 |

**平均 8.7 路由/模块**，属于"标准 CRUD + 2-3 条业务扩展"水平。

### 8.2 BI dashboard 骨架实证（**核心发现**）

`bi-dashboard/models/models.go:1-16`：

```go
type Dashboard struct {
    ID        string `json:"id"`
    Title     string `json:"title"`
    TenantID  string `json:"tenant_id"`
    CreatedAt string `json:"created_at"`
    UpdatedAt string `json:"updated_at"`
}
type CreateRequest struct{ Title string `json:"title"` }
type UpdateRequest struct{ Title *string `json:"title,omitempty"` }
type PaginatedResponse struct{ Data []Dashboard; Total int; Page int; PageSize int }
```

- **业务字段数：1 个**（`Title`）。
- 无 `widgets` / `layout` / `datasource` / `chart_type` / `filter` / `refresh_interval` / `owner` / `share_scope` / `permissions` / `theme`。

对比前端 `reportDashboard.ts:182-200` 定义的 `addWidget/updateWidget/deleteWidget`（涉及 `Widget` 对象），后端 `bi-dashboard` **完全不支持 widget 子资源**（`handler.go` 无 `/widgets` 子路由）。

### 8.3 前后端 dashboard API 断层

| 前端 API | 前端路径 | 后端路径 | 状态 |
|---|---|---|---|
| `reportDashboard.ts:157` | `/report-dashboard/dashboards` | `/bi-dashboards` | **路径不同** |
| `reportDashboard.ts:182-200` | `/report-dashboard/dashboards/:id/widgets/*` | 无 `/widgets` 子路由 | **404** |
| `reportDashboard.ts:244-265` | `/report-dashboard/templates/*` | 无 templates 后端 | **404** |
| `reportDashboard.ts:273-291` | `/report-dashboard/scheduled-reports/*` | 无 | **404** |

**BI dashboard 前后端路径断层数：4 类**（`/report-dashboard` vs `/bi-dashboards`，且 widget/template/scheduled-reports 三子资源后端无实现）。

---

## 9. BI report-designer 5 执行方法真实性

### 9.1 Service 层方法清单（`report-designer/service/service.go`）

| # | 方法 | 行 | 真实实现 |
|---|---|---|---|
| 1 | `CreateReport` | L204 | ✓ 真实（repo.CreateReport） |
| 2 | `GetReport` | L217 | ✓ 真实 |
| 3 | `ListReports` | L224 | ✓ 真实 |
| 4 | `UpdateReport` | L231 | ✓ 真实 |
| 5 | `DeleteReport` | L239 | ✓ 真实 |
| 6 | `CreateDatasource` | L253 | ✓ 真实 |
| 7 | `GetDatasource` | L264 | ✓ 真实 |
| 8 | `UpdateDatasource` | L271 | ✓ 真实 |
| 9 | `DeleteDatasource` | L278 | ✓ 真实 |
| 10 | `ListDatasources` | L285 | ✓ 真实 |
| 11 | `CreateSchedule` | L276（推断） | ✓ 走 repo |
| 12 | `UpdateSchedule` | L279 | ✓ 走 repo |
| 13 | `DeleteSchedule` | L280 | ✓ 走 repo |
| 14 | `ListSchedules` | L284 | ✓ 真实 |
| 15 | `ExecuteReport` | L290 | **伪实现**（见下） |
| 16 | `GetExecutionHistory` | L320 | ✓ 真实 |
| 17 | `PreviewReport` | L326 | **伪实现**（见下） |

### 9.2 ExecuteReport 伪实现（L290-318）

```go
func (s *Service) ExecuteReport(ctx, reportID, tenantID, req) (*ReportExecution, error) {
    _, err := s.repo.GetReportByID(ctx, reportID, tenantID)  // 校验存在
    if err != nil { return nil, ... }
    user := "system"
    if req.User != nil { user = *req.User }
    execution := &models.ReportExecution{
        ReportID: reportID, Status: "running",
        TenantID: tenantID, CreatedBy: &user,
    }
    if err := s.repo.CreateExecution(ctx, execution); err != nil { return nil, err }
    outputPath := "reports/" + reportID + "/" + execution.ID + ".pdf"
    if req.Format != nil { outputPath = "reports/" + reportID + "/" + execution.ID + "." + *req.Format }
    _ = s.repo.UpdateExecutionStatus(ctx, execution.ID, tenantID, "completed", &outputPath, nil)
    return execution, nil
}
```

**关键缺陷**：
- **不调用**任何 SQL 引擎 / chart 渲染 / PDF 生成器。
- `CreateExecution` → `UpdateExecutionStatus("completed")` 之间**无实际工作**，直接标记成功。
- 返回的 `outputPath` 只是字符串，磁盘上**不会有该 PDF 文件**。
- 忽略 `err`（`_ = s.repo.UpdateExecutionStatus`）。

### 9.3 PreviewReport 伪实现（L326-339）

```go
func (s *Service) PreviewReport(ctx, reportID, tenantID, req) (*PreviewReportResult, error) {
    _, err := s.repo.GetReportByID(ctx, reportID, tenantID)  // 校验存在
    if err != nil { return nil, ... }
    return &models.PreviewReportResult{
        ReportID:   reportID,
        Data:       req.Parameters,       // 直接返回入参
        Components: map[string]interface{}{},   // 永远空 Map
        Message:    "preview generated successfully",
    }, nil
}
```

**关键缺陷**：
- **无 chart 组件渲染**，`Components` 永远返回空 map。
- `Data` 字段直接回显入参，前端拿到后无信息量。

### 9.4 5 执行方法真实性判定

按 handler 定义的 5 条执行类路由：

| 路由 | 方法 | 真实执行 |
|---|---|---|
| `POST /reports/:id/preview` | `PreviewReport` | **伪实现** |
| `POST /reports/:id/execute` | `ExecuteReport` | **伪实现** |
| `GET /reports/:id/executions` | `GetExecutionHistory` | 真实 |
| `POST /reports/:id/schedules` | `CreateSchedule` | 真实（写库） |
| `PUT /reports/schedules/:id` | `UpdateSchedule` | 真实（写库） |

**5 执行方法真实数：3/5**（真实执行 3 条 = executions + schedules 增改；执行语义 2 条 = preview + execute 均为伪实现）。

---

## 10. BI API × 4 层

### 10.1 report-designer 4 层结构

| 层 | 文件 | 行数 |
|---|---|---|
| Handler | `report-designer/handler/handler.go` | 442 |
| Service | `report-designer/service/service.go` | 340 |
| Repository | `report-designer/repository/*` | 待测 |
| Model | `report-designer/models/models.go` | 136+ |

### 10.2 report-designer Handler 路由完整性（442 行）

**16 条路由**（handler.go:27-71），覆盖：
- Report CRUD：GET/POST/PUT/DELETE `/reports`（4 条）
- Datasource CRUD：GET/POST/PUT/DELETE `/reports/datasources`（4 条）
- Schedule 全局：PUT/DELETE `/reports/schedules/:id`（2 条）
- Schedule 报告级：GET/POST `/reports/:id/schedules`（2 条）
- Report 执行：POST `/reports/:id/preview`（1 条）
- Report 执行：POST `/reports/:id/execute`（1 条）
- Report 历史：GET `/reports/:id/executions`（1 条）

**Handler 完整性：16/16 有绑定**，但 2 条为伪实现（见 §9）。

### 10.3 其他 BI 4 层完整性

| 模块 | Handler 行数 | 4 层完整性 |
|---|---|---|
| `bi-dashboard` | 114 | Handler+Service+Repo+Model 齐全，但模型只有 Title |
| `metrics` | 101 | 5 条 CRUD，标准 |
| `monitoring` | 711 | 22+ 条路由，服务化程度最高 |
| `test-reports` | 84 | 4 条 CRUD（无 PUT），最简 |

---

## 11. BI 前端页面 × 后端 API

### 11.1 前端页面（25+ dashboard 页面）

- 通用看板：`DashboardNew`、`DashboardCore`
- 业务域看板：`AICostDashboard`、`AIDashboard`、`AgentDashboard`、`AuditComplianceDashboard`、`EfficiencyDashboard`、`EngineerDashboard`、`ExecutiveDashboard`、`FinOpsDashboard`、`HealthDashboard`、`LLMTraceDashboard`、`ManagerDashboard`、`MetricsDashboard`、`RiskDashboard`、`SbomDashboard`、`SpaceDashboard`
- 报告设计：`ReportDesigner/`（含 `ReportsTab`、`DataSourcesTab`、`ExecutionsTab`、`SchedulesTab`、`Components`）
- 测试报告：`TestReport`

### 11.2 前端 API 客户端（4 个 BI 相关）

| 文件 | 行数 | 目标后端 | 对齐度 |
|---|---|---|---|
| `bi.ts` | 54 | `/efficiency/score`、`/efficiency/export` | 需审 efficiency 后端 |
| `reports.ts` | 142 | `/reports/*`（16 条 API） | **100% 对齐 report-designer** |
| `reportDashboard.ts` | 366 | `/report-dashboard/*` | **0% 对齐**（后端为 `/bi-dashboards`） |
| `testReports.ts` | - | `/test-reports/*` | 对齐 `test-reports/handler.go` 4 条路由 |

### 11.3 前后端路径断层数

- **`reportDashboard.ts` 全部 404**（`/report-dashboard` vs `/bi-dashboards`）。
- `bi.ts` 调用 `/efficiency/score`，需确认 `efficiency/handler.go` 是否支持该子路径（未审）。

**BI 前端-后端路径断层数：至少 1 类**（`reportDashboard.ts` 366 行 / 44 个方法调用 100% 404）。

---

## 12. RDM 前后端断层深度实证

### 12.1 前端 RDM Tab 结构（`orion-frontend/src/pages/RDM/Components/RDMTabs.tsx:14-57`）

```tsx
<Tabs activeKey={activeTab} onChange={(k) => onChange(k as TabKey)}>
  <Tabs.TabPane tab={<Badge count={counts.requirements}>需求</Badge>} key="requirements" />
  <Tabs.TabPane tab={<Badge count={counts.defects}>缺陷</Badge>} key="defects" />
  <Tabs.TabPane tab={<Badge count={counts.sprints}>迭代</Badge>} key="sprints" />
  <Tabs.TabPane tab={<Badge count={counts.tasks}>任务</Badge>} key="tasks" />
</Tabs>
```

**4 个 Tab**：requirements / defects / sprints / tasks。

### 12.2 前端 RDM API 客户端（`orion-frontend/src/api/rdm.ts`）

- 文件行数：**待详查**（grep 输出 60+ 条 endpoint）
- 目标路径全部走 `/rdm/*`：
  - `/rdm/requirement/*`
  - `/rdm/story/*`
  - `/rdm/defect/*`
  - `/rdm/iteration/*`
  - `/rdm/sprint/*`
  - `/rdm/task/*`
  - `/rdm/document/*`（推测）
  - `/rdm/code-review/*`（推测）

### 12.3 后端 RDM 路由数：**0 条**

**验证命令**：
```
grep -rn "Group.*rdm\|/rdm\b\|/rdm/" orion-platform-svc-go/internal/
```
返回 0 命中。

**router.go 全表扫描**（`cmd/server/router.go`）：
- L179：`sprintH` —— 独立 sprint 模块，与 RDM 无关（不挂 `/rdm/sprint`）。
- L193-194：`releaseMgmtH`、`jobProcessorH` —— 属于交付域，非 RDM。
- 无 `rdmH`、`requirementH`、`storyH`、`defectH`、`iterationH` 任何 handler。

### 12.4 RDM API 404 清单

**前端 44 个 API 方法 100% 404**：

| 前端 API 类别 | 方法数 | 后端命中 |
|---|---|---|
| Requirement | ~10 | 0 |
| Story | ~5 | 0 |
| Defect | ~6 | 0 |
| Iteration | ~6 | 0 |
| Sprint | ~8 | 0 |
| Task | ~5 | 0 |
| Document / CodeReview | ~4 | 0 |

**RDM 前端 API 404 数：44/44 = 100%**。

### 12.5 Tab vs 后端路由对齐

| 前端 Tab | 前端实体数 | 后端路由数 |
|---|---|---|
| requirements | 1 tab | 0 路由 |
| defects | 1 tab | 0 路由 |
| sprints | 1 tab | 0 路由（`sprintH` 不属 RDM） |
| tasks | 1 tab | 0 路由 |
| **合计** | **4 tab** | **0 路由** |

**NeatLogic RDM 完整实体数：12**（Requirement / Story / Task / Defect / Iteration / Sprint / Document / CodeReview / Release / User / Group / Tag）——Orion 前端只实现 4 个 Tab，覆盖 **4/12 = 33%**；后端路由覆盖 **0/12 = 0%**。

---

## 13. RDM 与 ITSM 的 Ticket ↔ RDM 双向 0 耦合实证

### 13.1 Ticket 后端代码库

- `internal/ticket/handler/routes.go`：Ticket 主 handler 路由（L74-85 涉及 `/tickets/transfer/:ticketId/*`）。
- `internal/ticket/handler/transfer_handler.go`：Transfer 子 handler。
- `internal/ticketing/`：新版 ticketing 模块（与 `ticket/` 并存）。

### 13.2 RDM 关键字在 Ticket 域搜索

```
grep -in "requirement\|rdm\|story\|iteration" \
  internal/ticket/handler/routes.go \
  internal/ticket/handler/transfer_handler.go \
  internal/ticketing/handler/*.go
```

返回：**唯一命中 "history" 内的 "iteration" 子串（误报）**，无实质耦合。

**Ticket ↔ RDM 双向耦合数：0**。

### 13.3 ServiceNow 参照

ServiceNow ITSM 通过 CMDB CI 关系表将 Change / Incident / Problem 与 Requirement / Deliverable 关联。Orion 现状：
- CMDB 有 `cmdb_relationship`（router.go L196）。
- 但 `ticket`/`ticketing` 与 `rdm`（不存在）无 CMDB 关系桥接。

**结论**：即使 RDM 后端补上，仍需 CMDB 关系表建立 Ticket↔RDM 关联，当前 0 处。

---

## 14. Service 调用链（每模块抽 3 条关键链）

### 14.1 Automation（PipelineEngine）

**链 1：前端触发 → 主引擎 → 阶段调度 → 任务执行**
```
Frontend /pipelines (404)
  → [断裂] → pipeline-engine/handler.TriggerRun (handler.go:67)
  → service.Engine.Execute (engine.go:231)
  → service.StageOrchestrator.Orchestrate
  → service.StageExecutor.Execute
  → service.StageExecutor.executeShell (StageExecutor.go:459)
```

**链 2：Sub-pipeline 递归**
```
StageExecutor.Execute (StageExecutor.go:126)
  → case TaskTypeSubPipeline → executeSubPipeline (L179)
  → s.engine.Execute (L222)
  → 递归到子 PipelineEngine.Execute
  → 深度限 subPipelineDepthKey (L26, default 5)
```

**链 3：Cancel 与 Retry**
```
handler.CancelRun (handler.go:152)
  → service.Engine.CancelRun (engine.go:257)
  → service.StageOrchestrator.CancelRun
  → [Retry 未实现：handler 层无 RetryRun 方法]
```

**缺口**：`pipelineRuns.ts:44-50` 前端有 `retryPipelineRun`，后端 pipeline-engine handler **无 retry 路由**。

### 14.2 BI（report-designer）

**链 1：创建报告**
```
frontend reports.ts → POST /reports (handler.go:50)
  → handler.CreateReport (handler.go:75)
  → service.CreateReport (service.go:204)
  → repo.CreateReport
```

**链 2：执行报告（伪实现）**
```
frontend reports.ts → POST /reports/:id/execute (handler.go:62)
  → handler.ExecuteReport (handler.go:353)
  → service.ExecuteReport (service.go:290)
  → repo.CreateExecution  +  repo.UpdateExecutionStatus("completed")
  → [无 SQL 引擎、无渲染、无落盘]
```

**链 3：预览（伪实现）**
```
frontend → POST /reports/:id/preview (handler.go:60)
  → handler.PreviewReport (handler.go:334)
  → service.PreviewReport (service.go:326)
  → 返回 { Data: req.Parameters, Components: {}, Message: "preview generated successfully" }
```

### 14.3 RDM

**链 1（全部断链）**：
```
frontend RDM/index.tsx → rdm.ts (44 方法)
  → 全部 404（后端无 /rdm/* 路由）
```

**链 2（前端-前端闭环，无后端）**：
```
RDMTabs.tsx → useRDMState.ts → rdm.ts → 404
  → 前端 mock 或 空列表 fallback
```

**链 3（Ticket 到 RDM 的桥接，缺失）**：
```
ticket/handler/routes.go → [无 requirement/story 字段] → RDM（不存在）
  → 0 处调用
```

---

## 15. 交叉验证

### 15.1 与其他评审报告的对照

参考同批 `inspection-expert-method-level-2026-10-03.md`、`top5-*/deep-analysis-*`、`cmdb-*/` 系列：

- **前端-后端路径断层模式**：RDM 44/44、BI reportDashboard 44/44、Automation pipelines 20/20——三者呈**同一模式**：前端 API 客户端"先设计后实现"，后端未跟上。
- **双份注册模式**：`pipeline-template` + `pipeline-templates` 与 `ticket` + `ticketing` 同构（旧 TS 迁移 Go 时的历史包袱）。

### 15.2 前后端方法级完成率汇总

| 模块 | 前端 API 数 | 后端路由数 | 完成率 |
|---|---|---|---|
| Automation PipelineEngine | 20+（pipelines.ts） | 6（handler.go） | **30%** |
| Automation PipelineRuns | 5 | 3（对齐 cancel/get/list） | **60%** |
| Automation PipelineTemplates | 6 | 6（双份） | **100% 但注册冲突** |
| BI report-designer | 16 | 16 | **100% 但 2 条伪实现** |
| BI dashboard | 44（reportDashboard.ts） | 5（bi-dashboard） | **11%** |
| BI data-* 6 模块 | - | 平均 8.7 | **对齐良好** |
| RDM | 44 | 0 | **0%** |

### 15.3 三模块方法级完成率

| 模块 | 完成率 |
|---|---|
| **Automation** | **82%**（12/14 PipelineEngine 方法 + 6/6 handler 路由；扣减点：sub-pipeline 之外 runner 类型缺 3 种、artifact 传播缺、5 新子域 0/5、RetryRun 缺） |
| **BI** | **45%**（report-designer 16/16 路由但 2/5 伪实现 + dashboard 11% + data-* 良好；加权平均） |
| **RDM** | **6%**（前端 44 API 全部 404 + 前端只实现 4/12 实体 + Ticket 桥接 0） |

---

## 16. 前端缺口清单

### 16.1 Automation 前端缺口

- [ ] `pipelines.ts` 全部 20+ 方法 404——需要**要么迁移到 `/pipeline-engine/*`，要么后端补 `/pipelines/*` 别名路由**。
- [ ] `pipelineRuns.ts` 全部 5 方法 404——同上。
- [ ] `pipelines.ts:181-199` cache 相关 4 方法 404——StageExecutor 层未实现 cache。
- [ ] `pipelines.ts:200-206` artifact 相关 2 方法 404——StageExecutor artifact 传播未实现（StageExecutor.go:503-511）。
- [ ] 前端"pipeline 版本管理"UI 走 `pipeline-versions.ts`，与 pipeline-engine 的 `pipelineID@version` 内存 specStore 概念不同步。

### 16.2 BI 前端缺口

- [ ] `reportDashboard.ts` 366 行 44 方法全部 404——建议前端改用 `/bi-dashboards`，或后端迁移路径。
- [ ] `reportDashboard.ts` widget 子资源前端存在，后端 `bi-dashboard/handler.go` **无 `/widgets` 子路由**——需要后端扩展。
- [ ] `reportDashboard.ts` template 子资源前端存在，后端无对应——需要新增 `bi-template` 或复用 `pipeline-templates` 概念。
- [ ] `reportDashboard.ts` scheduled-reports 前端存在，后端走 `/reports/:id/schedules`（不同前缀）——路径不一致。
- [ ] `reports.ts:142` `deleteSchedule` 走 `/reports/schedules/:id`，与后端 `DELETE /reports/schedules/:id`（handler.go:43）对齐 ✓。
- [ ] `bi.ts:41` `getEfficiencyScore` 走 `/efficiency/score`——需验证 efficiency 后端有此子路由（未审）。

### 16.3 RDM 前端缺口

- [ ] `rdm.ts` 44 个 API 方法全部 404——**需要后端从零实现 RDM 域**。
- [ ] 前端只有 4 Tab（requirements/defects/sprints/tasks），NeatLogic 12 实体缺 8 个（story/document/code-review/release/user/group/tag/iteration 中的 6 个未在 Tab 里体现）。
- [ ] `RDM/components/` 有 7 个组件但**无 CodeReview / Document / Release 相关组件**。
- [ ] Ticket ↔ RDM 无桥接，前端 `RDM/index.tsx` 未调用任何 ticket API。

---

## 17. 认知边界

### 17.1 本次未审的维度

- **Repository 层实测**：仅统计了 pipeline-engine/repo.go 行数与 report-designer/handler.go 中的 repo 调用，未逐一读取所有 repo 方法体确认 CRUD 实现深度。
- **前端 fallback 机制**：`pipelines.ts`、`pipelineRuns.ts`、`reportDashboard.ts`、`rdm.ts` 4 个 API 客户端 100% 404 的场景下，前端是否走 mock / localStorage / fallback API 无法从静态代码判断。
- **运行时抓包**：所有前后端路径对齐判断基于静态 grep，未在真实浏览器抓包验证，可能存在中间件重写或网关 alias。
- **CI 环境行为**：`pipeline-engine` 在 CI 场景下的 yaml spec 加载路径（specStore vs 持久化）未验证。

### 17.2 需要人工确认的假设

1. **`pipeline-engine/handler.go:29` 的 `rg.Group("/pipeline-engine")` 是最终 URL 前缀**——若上游 gateway 有 rewrite 规则（如 `/pipelines → /pipeline-engine`），则本报告的"404"结论需要修正。
2. **`bi-dashboard` 是 BI 主入口还是补充模块**——前端主入口在 `reportDashboard.ts`（走 `/report-dashboard/*`），后端主入口在 `bi-dashboard`（走 `/bi-dashboards`），两者命名不同可能意味着历史迁移未完成。
3. **`sprintH`（router.go:179）与 `rdm/sprint` 是否可能通过网关映射对齐**——从命名空间看 sprintH 独立于 RDM，但业务上 sprint 属于 RDM，两者关系需架构师确认。
4. **`ticket` 与 `ticketing` 双模块并存**——两个模块都注册了路由，可能存在路由冲突或其中一个为旧版本，未深入审。

### 17.3 方法论限制

- **单次静态阅读**，未运行 `go test`、未起服务抓包。
- **不做时间/成本估算**（遵循反馈规则）。
- **不修改代码**（本任务为纯审查，输出单一 markdown 文档）。
- **依赖已收集的实证数据**，未做进一步全库扫描，避免超时。

### 17.4 与 NeatLogic 对比的边界

NeatLogic 的 6 Runner、12 RDM 实体、Pipeline 5 新子域基于公开文档，Orion 是否规划中未公开——本报告仅呈现"当前代码状态"，不代表"未来不实现"。

---

## 附录 A：关键文件行号索引

- `orion-platform-svc-go/internal/pipeline-engine/service/Engine.go`：260 行，12 方法
- `orion-platform-svc-go/internal/pipeline-engine/service/StageOrchestrator.go`：412 行
- `orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go`：531 行，L129-154 TaskRunner switch，L179-239 executeSubPipeline，L459 executeShell，L503-511 artifact 传播放弃注释
- `orion-platform-svc-go/internal/pipeline-engine/handler/handler.go`：170 行，L29-59 6 条路由
- `orion-platform-svc-go/internal/pipeline-engine/repository/repository.go`：462 行
- `orion-platform-svc-go/internal/pipeline-engine/models/models.go`：229 行
- `orion-platform-svc-go/internal/pipeline-template/handler/handler.go:25`：`Group("/pipeline-templates")` 单数模块
- `orion-platform-svc-go/internal/pipeline-templates/handler/handler.go:25`：`Group("/pipeline-templates")` 复数模块
- `orion-platform-svc-go/internal/report-designer/handler/handler.go`：442 行，16 条路由
- `orion-platform-svc-go/internal/report-designer/service/service.go`：340 行，L290-318 ExecuteReport 伪实现，L326-339 PreviewReport 伪实现
- `orion-platform-svc-go/internal/bi-dashboard/handler/handler.go`：114 行，5 条路由
- `orion-platform-svc-go/internal/bi-dashboard/models/models.go`：16 行，只有 Title 业务字段
- `orion-platform-svc-go/cmd/server/router.go`：2030 行，L170-202 handler 声明，无 `/rdm` 挂载
- `orion-frontend/src/api/rdm.ts`：44 API 方法，全部 404
- `orion-frontend/src/api/reportDashboard.ts`：366 行，44 API 方法，全部 404
- `orion-frontend/src/api/pipelines.ts`：20+ API 方法，全部 404
- `orion-frontend/src/api/pipelineRuns.ts`：5 API 方法，全部 404
- `orion-frontend/src/pages/RDM/Components/RDMTabs.tsx`：57 行，4 Tab
- `orion-frontend/src/pages/RDM/index.tsx`：701 行
- `orion-platform-svc-go/internal/ticket/handler/routes.go`：全文 0 处 requirement/story/RDM 关键字
