# Phase 5 Go 迁移进度追踪 (2026-07-14 更新)

## 总体进度

| Wave | 内容 | 模块数 | 已完成 | 完成率 | 状态 |
|------|------|--------|--------|--------|------|
| Wave 0 | 基础设施 (idempotency/sse/cron/dag/middleware) | 5 共享包 | 5 | 100% | ✅ |
| Wave 1 | 通用域 (user/role/session/api-key/ci-type/api-market/eventbus/event-trigger/hook-chain) | 9 | 9 | 100% | ✅ |
| Wave 2 | 认证+权限 (auth-enhanced/auth-mfa/sso-unified/sso-providers/abac-policy/permission-audit) | 6 | 6 | 100% | ✅ |
| Wave 3 | 通知上下文 (notification/policy/template/scheduled/webhook/do-not-disturb/channel) | 7 | 7 | 100% | ✅ |
| Wave 4 | 工作流+低代码 (workflow/trigger/task/dependency/lowcode/webhook) | 6 | 6 | 100% | ✅ |
| Wave 5 | Pipeline 辅助 (batch/sse/execution-control/audit-log/graph/template/version/run-history/batch-operations/trend/change-intelligence) | 11 | 11 | 100% | ✅ |
| Wave 6 | 可观测性 (tracing/slo/health-check) | 3 | 3 | 100% | ✅ |
| Wave 7a | P2 模块批次1 (compliance/supply-chain/secret/chaos-enhanced/ueba) | 5 | 5 | 100% | ✅ |
| Wave 7b-j | P2 模块+Webhook (alert-breaker~version-archive + 30 webhook-* + automation) | 80+ | 80+ | 100% | ✅ |
| **小计** | **Go 蓝图层 (标准 CRUD 模板)** | **194** | **188 registered** | **—** | **✅ 完成** |

## Phase 3: 核心域 TS 引擎迁移 ✅ 完成

| 任务 | 描述 | TS 源 | Go 产出 | 状态 |
|------|------|-------|---------|------|
| 3.1 | PipelineEngine Core | engine/PipelineEngine (405r) | 7 文件, 2,084 行 | ✅ |
| 3.2 | SagaCoordinator | saga/SagaCoordinator (432r) | 5 文件, 1,052 行 | ✅ |
| 3.3 | ContainerExecutor | engine/ContainerExecutor (272r) | 1 文件, 309 行 | ✅ |
| 3.4 | MultiTargetExecutor | engine/MultiTargetExecutor (167r) | 1 文件, 119 行 | ✅ |
| 3.5 | DeploySaga | saga/DeploySaga (532r) | 1 文件, 170 行 | ✅ |
| 3.6 | 事件系统 | events/types.ts | 1 文件, 150 行 | ✅ |
| **合计** | | **~2,000 行 TS** | **16 文件, 4,163 行 Go** | **✅ 完成** |

## Phase 3 实现详情

### 架构层次
```
PipelineEngine (Facade)
  └── StageOrchestrator (并行编排)
        ├── StageExecutor (任务执行)
        └── ContainerExecutor (容器执行)
              ├── LocalSpawnExecutor
              └── DockerExecutor
SagaCoordinator
  └── DeploySaga (部署编排)
        └── EventPublisher (事件通知)
```

### Go 文件清单 (16 文件)

**Pipeline Engine (8 文件)**:
- `models/models.go` - PipelineRun/Stage/Task/Checkpoint
- `repository/repository.go` - 4 张表 CRUD
- `service/Engine.go` - PipelineEngine 门面
- `service/StageOrchestrator.go` - 并行 Stage 编排
- `service/StageExecutor.go` - Task 执行
- `service/container_executor.go` - 容器执行器
- `service/multi_target_executor.go` - 多目标部署
- `handler/handler.go` - 6 HTTP 端点

**Saga (5 文件)**:
- `models/models.go` - SagaTransaction/SagaStep
- `repository/repository.go` - 2 张表 CRUD
- `service/coordinator.go` - Saga 协调器
- `service/deploy_saga.go` - 部署 Saga
- `handler/handler.go` - 7 HTTP 端点

**Events (1 文件)**:
- `events/events.go` - 13 事件类型 + 发布器接口

**Migrations (3 文件)**:
- `002_create_pipeline_engine_tables.sql` - 4 张表
- `003_create_saga_tables.sql` - 2 张表

### 端点汇总 (13 端点)

**Pipeline Engine**:
- POST /pipeline-engine/runs
- GET /pipeline-engine/runs/:runId
- GET /pipeline-engine/pipelines/:pipelineId/runs
- GET /pipeline-engine/runs/:runId/stages
- GET /pipeline-engine/stages/:stageId/tasks
- POST /pipeline-engine/runs/:runId/cancel

**Saga**:
- POST /saga/transactions
- GET /saga/transactions/:transactionId
- GET /saga/transactions
- POST /saga/transactions/:transactionId/cancel
- POST /saga/transactions/:transactionId/compensate
- GET /saga/transactions/:transactionId/steps
- GET /saga/steps/:stepId

## 下一步

**Phase 4**: Gateway 业务逻辑迁移 (12 routes.ts, 8,719 行)
- ai-models, ai-decisions, ai-degradation (AI 模型)
- chaos, digital-twin, governance (治理)
- pipeline-versions, pipeline-budget, pipeline-templates (Pipeline)
- resilience-score, sbom, tenant (安全/租户)

## Git 提交记录
| Commit | 说明 |
|--------|------|
| `30871ccc` | feat(events): Phase 3.6 Pipeline event system migration |
| `28100b58` | feat(saga): Phase 3.2-3.5 Go Saga + ContainerExecutor + MultiTargetExecutor |
| `1a8df7d9` | feat(pipeline-engine): Phase 3.1 Go Pipeline Engine Core |
| `2be5887f` | chore: register Wave 7 batch 3-4 modules (40 webhook + automation) |
| `57f5e57a` | chore: register Wave 7 batch 1-2 modules (45 modules) |
| `05d072b5` | feat(gateway-dynamic): complete gray release module |
| `a7d6341d` | chore: update go.mod/go.sum for Wave 7 |
