# CI/CD 域深度分析 (2026-08-02)

> **覆盖**: 31 模块 / ~42,000 行 | **原深度分析覆盖率**: CI/CD 域 72%
> **目标**: 补全 16 个 pipeline-* 子模块的深度分析

---

## 一、CI/CD 域总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **pipeline** (核心) | 990 | 1 | 14 | 14 | 9 | ✅ | ✅ | 85% |
| **pipeline-engine** (引擎) | 3,225 | 1 | 7 | **71** | 29 | ✅ | ✅ | **100%** |
| **pipeline-executor** (执行器) | 2,127 | 0 | 13 | 45 | 22 | ✅ | ❌ | 90% |
| **pipeline-execution-control** | 766 | 1 | 9 | 12 | 8 | ✅ | ✅ | 75% |
| **pipeline-graph** (DAG 图) | 1,632 | 2 | 6 | 38 | 2 | ✅ | ✅ | 85% |
| **pipeline-templates** (模板 v2) | 3,330 | 2 | 14 | **70** | 16 | ✅ | ✅ | **100%** |
| **pipeline-template** (模板 v1) | 1,523 | 2 | 8 | 39 | 8 | ✅ | ✅ | 90% |
| **pipeline-budget** | 1,974 | 2 | 9 | 45 | 10 | ✅ | ✅ | 90% |
| **pipeline-sse** (实时日志) | 1,506 | 2 | 8 | 31 | 5 | ✅ | ✅ | 90% |
| **pipeline-batch** (批量) | 891 | 1 | 15 | 18 | 10 | ✅ | ✅ | 80% |
| **pipeline-batch-operations** | 600 | 1 | 5 | 9 | 10 | ✅ | ✅ | 70% |
| **pipeline-version** | 661 | 1 | 8 | 16 | 9 | ✅ | ✅ | 80% |
| **pipeline-versions** (版本 v2) | 2,111 | 2 | 10 | 66 | 13 | ✅ | ✅ | **100%** |
| **pipeline-run-history** | 669 | 2 | 3 | 16 | 4 | ✅ | ✅ | 70% |
| **pipeline-trend** | 525 | 1 | 4 | 6 | 6 | ✅ | ✅ | 60% |
| **pipeline-audit-log** | 692 | 1 | 7 | 8 | 8 | ✅ | ✅ | 70% |
| **pipeline-error-detail** | 1,006 | 2 | 2 | 20 | 2 | ✅ | ❌ | 60% |
| **build** (构建) | 1,066 | 1 | 14 | 16 | 16 | ✅ | ✅ | 85% |
| **build-env** (构建环境) | 1,469 | 1 | 23 | 27 | 25 | ✅ | ✅ | 90% |
| **deploy** (部署) | 1,665 | 2 | 15 | **55** | 18 | ✅ | ✅ | **95%** |
| **deploy-enhanced** | 1,324 | 1 | 17 | 20 | 15 | ✅ | ✅ | 85% |
| **smart-deploy** | 1,228 | 1 | 11 | 13 | 13 | ✅ | ❌ | 80% |
| **progressive** (渐进式) | 1,413 | 1 | 13 | 19 | 14 | ✅ | ✅ | 80% |
| **canary-analysis** | 720 | 1 | 13 | 12 | 6 | ✅ | ✅ | 75% |
| **canary-traffic** | 701 | 1 | 9 | 8 | 7 | ✅ | ✅ | 70% |
| **saga** | 2,375 | 3 | 8 | **88** | 17 | ✅ | ❌ | **95%** |
| **runner** (Runner 管理) | 1,749 | 0 | 15 | 21 | 28 | ✅ | ❌ | 85% |
| **autonomous-pipeline** | 1,908 | 1 | 8 | 8 | — | ✅ | ❌ | 50% |
| **ci-cd** (CI/CD 聚合) | — | — | — | — | — | — | — | 聚合层 |
| **ci-type** | — | — | — | — | — | — | — | 枚举层 |
| **cron** | — | — | — | — | — | — | — | 调度器 |

### 域级 P0 问题

| # | 问题 | 模块 | 影响 |
|---|------|------|------|
| 1 | **未 wiring** | pipeline-executor (2,127 行) | 45S 执行引擎不可用 |
| 2 | **未 wiring** | pipeline-error-detail (1,006 行) | 20S 错误详情不可用 |
| 3 | **未 wiring** | smart-deploy (1,228 行) | 智能部署不可用 |
| 4 | **未 wiring** | saga (2,375 行) | **88S Saga 编排不可用** |
| 5 | **未 wiring** | runner (1,749 行) | 28R Runner 管理不可用 |
| 6 | **零测试** | pipeline-executor, runner | 关键执行模块无测试 |

---

## 二、核心模块深度分析

### 2.1 pipeline-engine (Pipeline 引擎) — 100% ⭐

**Kahn 算法 DAG 调度 + Saga 编排**，71 Service 方法：

| 能力 | 方法 |
|------|------|
| Pipeline 执行 | `Execute(ctx, tenantID, runID)` — 主入口 |
| Stage 调度 | Kahn 算法拓扑排序 → 并行 Stage 执行 |
| 状态管理 | `UpdateStatus(ctx, runID, status)` |
| Saga 协调 | SagaCoordinator 事务协调 |
| 错误处理 | `HandleError(ctx, runID, stageID, err)` |

### 2.2 pipeline-graph (DAG 图) — 85%

**DAG 图定义 + YAML/JSON 转换 + 可视化**，38 Service 方法：

| 能力 | 方法 |
|------|------|
| 图构建 | `BuildGraph(pipelineID, yamlDefinition)` — YAML→DAG |
| YAML↔JSON | `YamlToJson`/`JsonToYaml` — 格式转换 |
| 验证 | `Validate(yamlDefinition)` — 语法校验 |

### 2.3 pipeline-budget (Pipeline 预算) — 90%

**Pipeline 资源预算管理**，45 Service 方法：

| 能力 | 方法 |
|------|------|
| 预算配置 | `UpsertBudget(ctx, tenantID, pipelineID, UpsertBudgetRequest)` |
| 使用量查询 | `GetBudgetUsage(ctx, tenantID, pipelineID)` |
| 告警 | `CreateAlert(ctx, tenantID, pipelineID, CreateAlertRequest)` |
| 告警列表 | `GetAlerts(ctx, tenantID, pipelineID)` |

### 2.4 deploy (部署) — 95% ⭐

**多策略部署引擎**，55 Service 方法：

| 部署策略 | 说明 |
|---------|------|
| 蓝绿部署 | 双环境切换 |
| 金丝雀部署 | 逐步流量切换 |
| 渐进式部署 | Progressive rollout |
| 回滚 | 自动/手动回滚 |

### 2.5 saga — 95% ⚠️ 最复杂但未 wiring

**Saga 分布式事务编排**，88 Service 方法 (全平台最大之一)：

| 能力 | 方法 |
|------|------|
| Saga 定义 | `SagaDefinition` / `SagaStepDef` |
| 步骤编排 | 顺序/并行/补偿 |
| 事务协调 | SagaCoordinator |

### 2.6 runner (Runner 管理) — 85% ⚠️ 未 wiring

**CI Runner 生命周期管理**，28 Repo 方法：

| 能力 | 方法 |
|------|------|
| Agent 注册 | `RegisterAgent(ctx, tenantID, CreateAgentRequest)` |
| Agent 管理 | `GetAgent/ListAgents/UpdateAgent` |
| 任务分派 | 28 持久化方法 |

---

*分析完成: 2026-08-02 | CI/CD 域 31 模块*
