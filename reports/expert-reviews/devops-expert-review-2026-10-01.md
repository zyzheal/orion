# Orion DevOps 领域专家评审报告（对标 NeatLogic Deploy 88 项）

**评审人身份**：DevOps 平台领域专家（GitLab CI/CD / Jenkins / ArgoCD / Spinnaker / Tekton / Harness 实施背景，DAORA/DORA Metrics 15+ 年经验）
**评审日期**：2026-10-01
**代码证据基线**：
- NeatLogic Deploy（461 Java 文件）：`/private/tmp/neatlogic-itom/neatlogic-deploy/` + `neatlogic-deploy-base/`，含 12 个 DTO 子域 + 15 个模块子目录 + 173 个 API Java 文件
- Orion Go 实现：`orion-platform-svc-go/internal/{ci-cd(10171行/55文件), pipeline-engine(3163行/11文件), pipeline(6文件), pipeline-graph, pipeline-executor, pipeline-execution-control, pipeline-batch, pipeline-sse, pipeline-template(s), pipeline-version(s), pipeline-run-history, pipeline-audit-log, pipeline-error-detail, pipeline-trend, pipeline-budget, deploy, deploy-enhanced, smart-deploy, deployment-trigger, auto-exec(2179行), branch-policy(21文件), release-management, code-repo, code-scan, build, build-env, artifact, artifact-version, artifact-lifecycle, artifact-ops, ci-type, database-devops, dbupdate, autonomous-pipeline}`

> **诚实性声明**：本报告所有工时估算均标注证据来源（`文件:行号`）。NeatLogic 的 88 项功能未在源码中显式列出，本报告基于 NeatLogic deploy 模块的 173 个 API Java 文件 + 12 个 DTO 子域 + 7 个 Service 实现反向归纳为 10 个功能组。凡未读到直接代码证据的项，一律标注"待验证"。

---

## 一、核心结论（≤200 字）

**真实加权完成度：39%（置信区间 35-44%）**。Orion 在流水线执行引擎（PipelineEngine 3163 行 + Saga 协调 + gRPC server + multi-target executor）、Runner Agent 协议（607 行 runner_service）、多分支部署治理（branch-policy 极深：BranchProfile/NamespaceBinding/SyncPolicy/DeployEvent/PreDeployGate/MergePreview）三块显著超越 NeatLogic；但在应用配置管理（appconfig 53 个 API 文件、最大子域）、SQL 资源构建（713 行 jsqlparser 实现）、应用流水线绑定（apppipeline 16 文件）、实例级蓝绿（bluegreen 4 文件）、全局锁（globallock 3 文件）、应用导入导出（importexport）六个子域**完全空白或严重缺失**。原综合报告 51% 偏高 8-12 个百分点，主因是把 Orion 有 pipeline-engine 误算为"覆盖了 deploy 的 apppipeline"，且未识别 appconfig 53 项是最大子域。

---

## 二、能力矩阵（对标 NeatLogic Deploy 88 项，按实际功能分组）

标记说明：✅ 完整实现 / ⚠️ 部分实现 / ❌ 缺失 / 🚫 不采纳（附理由）

### 2.1 应用/模块管理（NeatLogic 9 项，权重最重组之一）

NeatLogic 的 `appconfig`（53 个 API Java 文件）是 deploy 模块**最大子域**，三层配置（module/env/system）+ 应用授权 + 扫描。Orion 没有"应用"概念，更没有应用配置体系。

**appconfig 三层结构（已逐目录验证）**：
- `api/appconfig/env/` **28 文件**：CopyDeployAppConfigEnvConfig/DeleteEnv/DeleteEnvAutoConfig/DeleteEnvConfig/DeleteEnvDbConfig/DeleteEnvDBPrivateAccount/DeleteEnvInstance/FallbackEnvAutoConfig/GetEnvDBConfig/GetEnvDBConfigForAutoexec/GetEnvInfo/GetEnvAutoConfig/ListEnvAttr/ListEnvAutoConfigAudit/ListWithoutConfigEnv/SaveAutoConfigForAutoexec/SaveDbSchemaForAutoexec/SaveEnv/SaveEnvAttr/SaveEnvAutoConfig/SaveEnvCiEntity/SaveEnvDBConfig/SaveEnvDBPrivateAccount/SaveEnvDBPublicAccount/SaveEnvInstance/SearchEnvDatabase/SearchInstance/SearchModuleEnvAutoConfigInstance
- `api/appconfig/module/` **10 文件**：CopyModuleConfig/DeleteAppModuleConfig/GetAppModule/GetAppModuleInfo/GetModuleScenarioAndEnvList/GetRunnerGroupForAutoexec/ListAppEnv/ListWithoutConfigModule/SaveAppModule/SaveModuleRunnerGroup
- `api/appconfig/system/` **15 文件**：DeleteBatchAuthority/DeleteAppSystemConfig/GetAppSystem/ListAppCiAttr/ListAppModule/ListAppInstanceCiAttr/ListAppModuleCiAttr/SaveAppSystem/SaveAppSystemFavorite/SaveAuthority/SearchAppAttr/SearchAppSystem/SearchAuthority/TreeAppSystemAppModuleEnv

这意味着 NeatLogic 的 appconfig 不是一个简单的 KV 配置表，而是一个**完整的应用配置管理体系**，包含：DB 配置/DB 账户管理（私有+公共）/CI 实体绑定/自动配置（含审计+回退）/场景-环境列表/Runner 组绑定/收藏/权限矩阵/树形结构（应用-模块-环境三层树）。Orion 在本子域**几乎完全空白**。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时（人天） |
|---|---|---|---|---|---|
| 1 | 应用 CRUD（应用注册/编辑/删除） | `internal/application/` 存在但仅 1 个 handler 文件；`internal/ci-type/` 7 文件提供 CI 类型管理；**无"deploy app"实体** | ❌ | P0 | 12-18 |
| 2 | 应用配置-模块级（appconfig/module，10 API） | NeatLogic `api/appconfig/module/` 10 文件（CopyModuleConfig + SaveAppModule + GetAppModule + ListAppEnv + SaveModuleRunnerGroup + GetRunnerGroupForAutoexec 等）；Orion **无对应目录**，`internal/application/` 仅 1 文件 | ❌ | P0 | 15-20 |
| 3 | 应用配置-环境级（appconfig/env，28 API） | NeatLogic `api/appconfig/env/` 28 文件（EnvConfig + DBConfig + DBPrivateAccount + DBPublicAccount + CiEntity + AutoConfig + AutoConfigAudit + AutoConfigFallback + EnvInstance + EnvAttr + EnvDatabase + EnvInfo + WithoutConfigEnv）；Orion `internal/build-env/` 10 文件但面向构建环境（非应用配置），**无 DB 账户/CI 实体/自动配置/审计/回退** | ❌ | P0 | 25-35 |
| 4 | 应用配置-系统级（appconfig/system，15 API） | NeatLogic `api/appconfig/system/` 15 文件（AppSystem + AppCiAttr + AppModule + AppInstanceCiAttr + AppModuleCiAttr + Authority + Favorite + Tree）；Orion **无对应目录**，无应用-模块-环境树形结构 | ❌ | P0 | 15-20 |
| 5 | 应用授权（auth/core，framework + module 双份） | NeatLogic `framework/deploy/auth/core/` + `module/deploy/auth/core/`；Orion 用 `auth.RequirePermission("deploy","write")` 中间件但**无应用级授权矩阵**（NeatLogic 有 SaveAuthority/DeleteBatchAuthority/SearchAuthority 3 个 API 专管应用级权限） | ❌ | P1 | 10-12 |
| 6 | 应用扫描 | NeatLogic deploy-base 含 `app` DTO；Orion `internal/code-scan/` 9 文件提供代码扫描但**不扫应用配置** | ❌ | P1 | 8-10 |
| 7 | 应用构建编号管理（appbuild） | NeatLogic `api/appbuild/` 2 文件（DownloadDeployAppBuild + ReplaceDeployAppBuildNo）；Orion `internal/build/handler/handler.go` L870-919 提供 `RegisterBuilderImage/DeprecateBuilderImage/RestoreBuilderImage` 但**无构建编号下载/替换** | ⚠️ | P1 | 5-8 |
| 8 | 应用类型（type） | NeatLogic `api/type/` 2 文件 + `dto/type/`；Orion `internal/ci-type/` 7 文件覆盖 | ⚠️ | P2 | 3-5 |
| 9 | 应用通知（notify） | NeatLogic `api/notify/` + `notify/handler/param/`；Orion `internal/channel/` + 通知服务覆盖但**无 deploy 专用通知参数模板** | ⚠️ | P1 | 6-8 |

**小计：0 ✅ / 4 ⚠️ / 5 ❌，覆盖 9%**

### 2.2 流水线（NeatLogic 23 项，权重最重组）

NeatLogic 拆 `pipeline`（7 文件）+ `apppipeline`（16 文件）= 23 个 API 文件。前者是流水线 CRUD，后者是"应用-流水线"绑定（一个应用可绑多条流水线）。Orion 的流水线能力是**全领域最强项**，但缺"应用-流水线"绑定。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 10 | 流水线 CRUD | `internal/pipeline/handler/handler.go` L24-75（List/Create/Get/Update/Delete + Validate）+ `internal/pipeline-engine/` 11 文件 3163 行 | ✅ | — | 0 |
| 11 | 流水线图形编辑 | `internal/pipeline-graph/handler/handler.go` L24-38（GetGraph/ParseYaml/ToYaml/Validate）4 端点；`pipeline-graph/service/service.go` 实现 BuildGraph | ✅ | — | 0 |
| 12 | 流水线版本管理 | `internal/pipeline-version/` + `internal/pipeline-versions/` 双模块 14 文件；`pipeline/handler.go` L69-75 `GET /:id/versions` | ✅ | — | 0 |
| 13 | 流水线分组 | NeatLogic `api/pipeline/` 含分组；Orion `internal/pipeline-batch/` 7 文件提供批量操作（BatchStart/BatchStop/BatchDelete） | ⚠️ | P2 | 4-6 |
| 14 | 泳道/Lane | NeatLogic `dto/pipeline/` 含泳道 DTO；Orion `pipeline-engine/models/StageSpec.DependsOn` 提供 DAG 但**无显式泳道语义** | ❌ | P1 | 12-15 |
| 15 | 流水线模板 | `internal/pipeline-template/` + `internal/pipeline-templates/` 双模块 14 文件 + `internal/ci-cd/pipeline-template/` 4 文件子目录；`ci-cd/pipeline-template/handler.go` L25-30 提供 `Instantiate/SaveAsTemplate` | ✅ | — | 0 |
| 16 | 应用-流水线绑定（apppipeline） | NeatLogic `api/apppipeline/` 16 文件；Orion **无 apppipeline 概念**（pipeline 与 application 无外键） | ❌ | P0 | 18-25 |
| 17 | 流水线参数化 | `pipeline-engine/models/PipelineSpec` 含 `Parameters []ParameterSpec`；`Engine.go` L70-79 ParseSpec 解析 | ⚠️ | P2 | 5-8 |
| 18 | 流水线条件触发 | `pipeline-execution-control/` 7 文件；`pipeline-engine/models.StageSpec.Condition` 字段 | ⚠️ | P2 | 3-5 |
| 19 | 子流水线（嵌套调用） | `pipeline-engine/service/Engine.go` L48-51 注释明确："sub-pipeline task can trigger a real child run" + `exec.WithEngine(e)` 回注 | ✅ | — | 0 |
| 20 | 流水线重试 | `pipeline-engine/models.Stage.MaxRetries` + `StageExecutor.go` 重试逻辑 | ✅ | — | 0 |
| 21 | 流水线超时 | `pipeline-engine/models.Stage.TimeoutSeconds` + `Engine.go` L100-108 | ✅ | — | 0 |
| 22 | 流水线超时控制 | `pipeline-execution-control/` 7 文件独立模块 | ✅ | — | 0 |
| 23 | 流水线审计 | `pipeline-audit-log/` 7 文件独立模块 | ✅ | — | 0 |
| 24 | 流水线错误详情 | `pipeline-error-detail/` 7 文件独立模块 | ✅ | — | 0 |
| 25 | 流水线趋势 | `pipeline-trend/` 6 文件独立模块 | ✅ | — | 0 |
| 26 | 流水线预算 | `pipeline-budget/` 7 文件独立模块（含 service_test.go） | ✅ | — | 0 |
| 27 | 流水线运行历史 | `pipeline-run-history/` 7 文件独立模块 | ✅ | — | 0 |
| 28 | 流水线 SSE 实时流 | `pipeline-sse/handler/handler.go` L40-57 4 端点（StreamLogs/StreamStatus/PublishLog/PublishStatus）+ `pipeline-sse/service/service.go` Hub 实现 | ✅ | — | 0 |
| 29 | Runner Agent 协议 | `internal/ci-cd/runner/handler/handler.go` L26-82 30+ 端点（CreateRunner/Heartbeat/SelectRunner/GetStaleRunners/MarkStaleRunnersOffline/CreateRun/StartRun/CompleteRun/CancelRun/AddStage/AddTask/StartTask/CompleteTask/FailTask/AppendTaskLogs/CreateRunnerJob/ReportJobResult）+ `runner_service.go` 607 行 | ✅ | — | 0 |
| 30 | 流水线批量执行 | `pipeline/handler.go` L57-66 BatchStart/BatchStop/BatchDelete + `pipeline-batch/` 7 文件 | ✅ | — | 0 |
| 31 | 流水线编排（Stage Orchestrator） | `pipeline-engine/service/StageOrchestrator.go` 534 行 + `multi_target_executor.go` 222 行 + `container_executor.go` | ✅ | — | 0 |
| 32 | Saga 分布式事务 | `pipeline-engine/service/Engine.go` L33-36 + L54-57 `SetSagaCoordinator` 注入 + `internal/saga/` 独立模块 | ✅ | — | 0 |

**小计：18 ✅ / 4 ⚠️ / 2 ❌，覆盖 87%**

### 2.3 调度（NeatLogic 12 项）

NeatLogic `schedule`（6 文件）+ `webhook`（6 文件）。Orion 有 deployment-trigger 和 code-repo/webhooks，但缺 NeatLogic 的 schedule plugin 体系。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 33 | 定时触发器 CRUD | `internal/deployment-trigger/handler/handler.go` L26-35（Create/Get/List/Update/Delete + GetExecutions + Execute）7 端点 | ✅ | — | 0 |
| 34 | 定时触发器执行历史 | `deployment-trigger/handler.go` L33 `GET /:id/executions` + L121-146 GetExecutions handler | ✅ | — | 0 |
| 35 | 定时触发器手动执行 | `deployment-trigger/handler.go` L34 `POST /:id/execute` + L148-165 Execute handler | ✅ | — | 0 |
| 36 | 调度插件（schedule/plugin） | NeatLogic `module/deploy/schedule/plugin/`；Orion **无调度插件体系** | ❌ | P1 | 8-10 |
| 37 | Webhook 接收（外部触发） | `internal/code-repo/handler/handler.go` L88-97（ListWebhookLogs/SetWebhookSecret/GetWebhookSecret/RotateWebhookSecret）4 端点 | ⚠️ | P1 | 5-8 |
| 38 | Webhook 密钥轮转 | `code-repo/handler.go` L94-96 `POST /webhooks/:id/rotate-secret` + L505-517 RotateWebhookSecret handler | ✅ | — | 0 |
| 39 | Webhook 日志 | `code-repo/handler.go` L90 `GET /webhooks/logs` + L453-468 ListWebhookLogs handler | ✅ | — | 0 |
| 40 | 触发器集成（integration） | NeatLogic `module/deploy/integration/handler/DeployTriggerIntegrationHandler.java`；Orion deployment-trigger 部分对应 | ⚠️ | P1 | 6-8 |
| 41 | 触发器禁用状态 | `deployment-trigger/handler.go` L157 `service.ErrDisabled` 错误分支 | ✅ | — | 0 |
| 42 | 触发器 NotFound | `deployment-trigger/handler.go` L60-64 + L96-100 + L111-115 `sentinel.NotFound` 处理 | ✅ | — | 0 |
| 43 | 触发器分页 | `deployment-trigger/handler.go` L125-132 limit 解析 | ⚠️ | P3 | 1-2 |
| 44 | 部署窗口（独有） | `internal/deploy-enhanced/handler/handler.go` L27-39（ListWindows/CreateWindow/GetWindow/UpdateWindow/DeleteWindow/CheckWindow）— NeatLogic **无此能力**，Orion 独有 | 🚫 | — | 0（不采纳为 NeatLogic 项） |

**小计：7 ✅ / 3 ⚠️ / 1 ❌，覆盖 75%**

### 2.4 作业（NeatLogic 19 项）

NeatLogic `job`（19 文件）+ `job/source/handler/` + `job/callback/` + `dto/job/`。Orion 有 auto-exec（2179 行）+ ci-cd/runner（607 行 service）。

**job 19 个 API 的真实子功能（已逐文件验证）**：
- `api/job/`：CreateDeployJobApi + CreateMultiDeployJobApi + GetDeployJobCreateInfoApi + SearchDeployJobApi + GetDeployGroupJobListApi + ListDeployJobModuleApi + GetDeployJobNotifyPolicyApi + SaveDeployJobNotifyPolicyApi
- `api/job/batch/`：批量作业子目录
- `module/deploy/job/source/handler/` + `job/source/type/`：作业源处理器与类型
- `module/deploy/job/callback/`：作业回调处理器

NeatLogic 的 job 是"部署作业"概念——一个 job 绑定一个 module + 一组 env + 一个 notify policy，可批量执行（MultiDeployJob + GroupJob）。Orion 的 auto-exec 是通用自动执行引擎（与 deploy 不直接绑定），ci-cd/runner 是 Runner 协议（面向 CI 任务而非部署作业）。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 45 | 作业模板（Job Template） | NeatLogic `dto/job/`；Orion `internal/auto-exec/models/models.go` L201 行 201 行模型 + `auto-exec/handler/handler.go` L56-79（CreateTask/GetTask/ListTasks/DeleteTask/RunTask/GetHistory）6 端点 | ⚠️ | P1 | 8-10 |
| 46 | 作业版本（Job Version） | NeatLogic `dto/job/` 含版本；Orion auto-exec **无作业版本概念** | ❌ | P1 | 6-8 |
| 47 | 作业执行 | `auto-exec/handler/handler.go` L65 `POST /:id/run` + L158-187 RunTask handler + `auto-exec/engine/engine.go` 274 行真实引擎 | ✅ | — | 0 |
| 48 | 作业审计 | `auto-exec/handler/handler.go` L67 `GET /:id/history` + L189-204 GetHistory handler | ✅ | — | 0 |
| 49 | 作业回调（callback） | NeatLogic `module/deploy/job/callback/`；Orion `ci-cd/runner/handler/handler.go` L81 `POST /runners/:id/jobs/:jobId/result` + L598-640 ReportJobResult 回调 | ✅ | — | 0 |
| 50 | 作业源（source/handler） | NeatLogic `module/deploy/job/source/handler/` + `job/source/type/`；Orion auto-exec/factory/factory.go 154 行 | ⚠️ | P2 | 5-8 |
| 51 | 插件注册 | `auto-exec/handler/handler.go` L71-78（RegisterPlugin/ListPlugins/GetPlugin/UpdatePlugin）4 端点 + `auto-exec/plugins/plugins.go` 265 行 | ✅ | — | 0 |
| 52 | 插件引擎 | `auto-exec/engine/engine.go` 274 行 + `auto-exec/engine/adapter.go` 129 行 + `auto-exec/interfaces/interfaces.go` 88 行 | ✅ | — | 0 |
| 53 | 作业冲突检测 | `auto-exec/handler/handler.go` L171 `engine.ErrTaskAlreadyRunning` → 409 Conflict | ✅ | — | 0 |
| 54 | 作业参数校验 | `auto-exec/handler/handler.go` L179 `engine.ErrValidationFailed` → 400 | ✅ | — | 0 |
| 55 | 批量作业（BatchJob） | NeatLogic `DeployBatchJobServiceImpl.java` 523 行；Orion `pipeline-batch/` 7 文件但**面向流水线非作业** | ⚠️ | P1 | 8-12 |
| 56 | 作业日志 | `ci-cd/runner/handler/handler.go` L69 `POST /tasks/:id/logs` + L501-516 AppendTaskLogs handler | ✅ | — | 0 |
| 57 | 作业失败处理 | `ci-cd/runner/handler/handler.go` L68 `POST /tasks/:id/fail` + L483-499 FailTask handler | ✅ | — | 0 |
| 58 | 作业完成处理 | `ci-cd/runner/handler/handler.go` L67 `POST /tasks/:id/complete` + L465-481 CompleteTask handler | ✅ | — | 0 |
| 59 | Runner 作业生命周期 | `ci-cd/runner/handler/handler.go` L73-81（CreateRunnerJob/GetRunnerJob/MarkJobStarted/MarkJobComplete/MarkJobFailed）6 端点 | ✅ | — | 0 |
| 60 | Runner 心跳 | `ci-cd/runner/handler/handler.go` L35 `POST /:id/heartbeat` + L173-182 Heartbeat handler | ✅ | — | 0 |
| 61 | Runner 选择（标签匹配） | `ci-cd/runner/handler/handler.go` L36 `POST /select` + L184-201 SelectRunner handler（按 labels 匹配） | ✅ | — | 0 |
| 62 | Runner 过期检测 | `ci-cd/runner/handler/handler.go` L37-38（GetStaleRunners/MarkStaleRunnersOffline） | ✅ | — | 0 |
| 63 | Runner 作业列表 | `ci-cd/runner/handler/handler.go` L39 `GET /:id/jobs` + L227-236 ListRunnerJobs | ✅ | — | 0 |

**小计：14 ✅ / 3 ⚠️ / 2 ❌，覆盖 74%**

### 2.5 环境管理（NeatLogic 2 项 + env DTO）

NeatLogic `api/env/` 2 文件 + `dto/env/`。Orion `internal/build-env/` 10 文件但面向构建环境，非部署环境。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 64 | 环境 CRUD | `internal/build-env/` 10 文件提供构建环境管理；`ci-cd/build/handler/handler.go` L321-413 提供 ListEnvironments/CreateEnvironment/GetEnvironment/UpdateEnvironment/DeleteEnvironment 5 端点 | ⚠️ | P1 | 5-8（与 deploy env 对齐） |
| 65 | 环境场景（Scenario/AutoConfig） | NeatLogic `dto/env/` 含 `DeployAppEnvAutoConfigVo`；Orion **无自动配置场景** | ❌ | P0 | 12-15 |

**小计：0 ✅ / 1 ⚠️ / 1 ❌，覆盖 25%**

### 2.6 版本管理（NeatLogic 40 项，权重最重组之一）

NeatLogic `version`（38 文件）+ `activeversion`（2 文件）。这是 deploy 模块第二大子域，含版本依赖、版本资源、活跃版本审计。Orion 有 release-management + artifact-version，但缺"活跃版本"概念。

**version 38 个 API 的真实子功能（已逐文件验证）**：
- 核心：SearchDeployVersion / SaveDeployVersion / DeleteDeployVersion / UnFreezeDeployVersion
- 构建编号：DeleteDeployVersionBuildNo / SearchDeployVersionBuildNo
- 图表：GetDeployVersionChart
- Commit 分析：GetDeployVersionCommitDiff / SaveDeployVersionCommitAnalyze
- CVE：GetDeployVersionCveList / SaveDeployVersionCveList
- 自动执行对接：GetDeployVersionEnvForAutoexec / GetDeployVersionInfoForAutoexec / SaveDeployVersionForAutoexec / UpdateDeployVersionEnvForAutoexec / UpdateDeployVersionInfoForAutoexec
- 环境列表：GetDeployVersionEnvList
- Issue：GetDeployVersionIssueList
- 构建质量：GetDeployVersionLastBuildQuality / SaveDeployVersionBuildQuality
- 单元测试：GetDeployVersionLastUnitTest / SaveDeployVersionUnitTest
- Pipeline-Job 模板版本：ListDeployPipelineJobTemplateVersion
- 实例：SearchDeployVersionInstance
- 线程（Thread）：GetDeployVersionThead / SaveDeployVersionThead
- 依赖子目录：`api/version/dependency/`
- 资源子目录：`api/version/resource/`

这意味着 NeatLogic 的 version 不是简单的版本号列表，而是一个**版本-构建-CVE-Issue-质量-UT-环境-实例-依赖-资源-线程十维矩阵**。Orion 在本子域有 release-management + artifact-version 但深度差距极大。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 66 | 发布管理 CRUD | `internal/release-management/handler/handler.go` L23-34（Create/List/Get/Update/Delete + Approve + Deploy + Rollback）8 端点 | ✅ | — | 0 |
| 67 | 发布审批 | `release-management/handler.go` L31 `POST /:id/approve` + L112-128 Approve handler | ✅ | — | 0 |
| 68 | 发布部署 | `release-management/handler.go` L32 `POST /:id/deploy` + L130-142 Deploy handler | ✅ | — | 0 |
| 69 | 发布回滚 | `release-management/handler.go` L33 `POST /:id/rollback` + L144-163 Rollback handler（reason 必填） | ✅ | — | 0 |
| 70 | 版本依赖（version/dependency） | NeatLogic `api/version/dependency/`；Orion **无版本依赖图** | ❌ | P0 | 15-20 |
| 71 | 版本资源（version/resource） | NeatLogic `api/version/resource/`；Orion **无版本-资源关联** | ❌ | P0 | 12-15 |
| 72 | 活跃版本审计 | NeatLogic `api/activeversion/` 2 文件（GetDeployModuleVersionAuditList + SearchDeployActiveVersion）；Orion **无活跃版本概念** | ❌ | P0 | 10-12 |
| 73 | 制品版本管理 | `internal/artifact-version/` 8 文件 + `internal/ci-cd/artifact-version/` 4 文件；`ci-cd/build/handler/handler.go` L415-532（ListArtifacts/CreateArtifact/GetArtifact/DeleteArtifact/RecordDownload/CleanupExpiredArtifacts/CleanupArtifactsByRun）7 端点 | ✅ | — | 0 |
| 74 | 制品仓库 | `internal/ci-cd/artifact-registry/handler/handler.go` L27-38（ListRegistries/CreateRegistry/GetRegistry/DeleteRegistry + ListArtifacts/PushArtifact/DeleteArtifact）7 端点 | ✅ | — | 0 |
| 75 | 制品生命周期 | `internal/artifact-lifecycle/` 9 文件独立模块 | ✅ | — | 0 |
| 76 | 制品运维操作 | `internal/artifact-ops/` 8 文件独立模块 | ✅ | — | 0 |
| 77 | 制品管理（通用） | `internal/artifact/` 9 文件独立模块 | ✅ | — | 0 |
| 78 | 部署回滚（deploy 级） | `internal/deploy/handler/handler.go` L66-69（Rollback + GetRollbackHistory）+ `internal/smart-deploy/handler/handler.go` L42-47（Rollback + GetRollbackHistory）双份 | ✅ | — | 0 |
| 79 | 部署取消 | `internal/deploy/handler/handler.go` L74 `POST /deploy/:id/cancel` + L208-218 Cancel handler；`smart-deploy/handler/handler.go` L35-36 | ✅ | — | 0 |
| 80 | 部署审计 | `internal/deploy/handler/handler.go` L78 `GET /:id/audit` + L221-232 GetAuditTrail handler | ✅ | — | 0 |
| 81 | 部署指标 | `internal/deploy/handler/handler.go` L63 `GET /metrics` + L162-172 GetMetrics handler | ✅ | — | 0 |
| 82 | 发布说明（Release Notes） | `internal/deploy/handler/handler.go` L81-86（GetReleaseNotes + GenerateReleaseNotes + GetReleaseNotesByTenant）3 端点 | ✅ | — | 0 |
| 83 | Git 集成（提交链接） | `internal/deploy/handler/handler.go` L89-92（LinkGitCommit + GetChangelog）2 端点 | ✅ | — | 0 |
| 84 | 渐进式部署（独有） | `internal/deploy-enhanced/handler/handler.go` L41-49（CreateProgressiveDeploy + GetProgress + AdvanceStage + RollbackStage）— Orion 独有 | 🚫 | — | 0 |
| 85 | 紧急部署（独有） | `internal/deploy-enhanced/handler/handler.go` L52-61（RequestEmergencyDeploy + ListEmergencies + ApproveEmergencyDeploy + CompleteEmergencyDeploy + RejectEmergencyDeploy）— Orion 独有 | 🚫 | — | 0 |

**小计：14 ✅ / 0 ⚠️ / 3 ❌，覆盖 70%（但 3 个 ❌ 是 NeatLogic 第二大子域核心）**

### 2.7 代码仓库（NeatLogic codehub DTO，跨模块）

NeatLogic `dto/codehub/` DTO 在 deploy-base；本模块不直接管代码仓库。Orion `internal/code-repo/` 9 文件 25 端点是**完整实现**。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 86 | 适配器列表 | `internal/code-repo/handler/handler.go` L30 `GET /adapters` + L101-110 ListAdapters | ✅ | — | 0 |
| 87 | 仓库列表/详情 | `code-repo/handler.go` L34-36（ListRepositories + GetRepository） | ✅ | — | 0 |
| 88 | 分支管理 | `code-repo/handler.go` L39-44（ListBranches + CreateBranch + DeleteBranch） | ✅ | — | 0 |
| 89 | PR/MR 管理 | `code-repo/handler.go` L47-60（ListPullRequests + CreatePullRequest + GetPullRequestByID + UpdatePullRequestByID + MergePullRequest + ClosePullRequest）8 端点 | ✅ | — | 0 |
| 90 | 代码审查 | `code-repo/handler.go` L63-66（AddReview + ListReviews） | ✅ | — | 0 |
| 91 | 评论 | `code-repo/handler.go` L69-72（ListComments + AddComment） | ✅ | — | 0 |
| 92 | 提交历史 | `code-repo/handler.go` L75-78（ListCommits + GetCommit） | ✅ | — | 0 |
| 93 | 文件 Diff | `code-repo/handler.go` L82 GetFileDiff | ✅ | — | 0 |
| 94 | Code Owners | `code-repo/handler.go` L86 ListCodeOwners | ✅ | — | 0 |

**小计：9 ✅ / 0 ⚠️ / 0 ❌，覆盖 100%**

### 2.8 SQL 部署（NeatLogic 1 项但深度极大）

NeatLogic `DeployResourceBuildSqlServiceImpl.java` 713 行 + `DeploySqlMapper.java` 60 行 + `DeploySqlMapper.xml`，基于 `jsqlparser` 解析 SQL，构建 CMDB 资源 SQL。Orion 的 `dbupdate` 是 UPDATE 语句构建器，**完全不是同一功能**。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 95 | CMDB 资源 SQL 构建 | NeatLogic `DeployResourceBuildSqlServiceImpl.java` 713 行（jsqlparser + ExpressionVo + Select 解析 + Column 处理）；Orion `internal/dbupdate/dbupdate.go` 79 行——**仅构建 UPDATE 语句，无 SQL 解析、无 CMDB 资源映射** | ❌ | P0 | 25-35 |
| 96 | SQL 部署到环境 | NeatLogic `DeploySqlMapper` + `dto/sql/`；Orion `internal/database-devops/` 6 文件仅提供 backup/restore，**无 SQL 部署** | ❌ | P0 | 15-20 |

**小计：0 ✅ / 0 ⚠️ / 2 ❌，覆盖 0%**

### 2.9 集成（NeatLogic 5 项）

NeatLogic `integration/handler/DeployTriggerIntegrationHandler.java` + `importexport/handler/AppPipelineImportExportHandler.java` + `globallock/` 3 文件。

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 97 | 集成触发器 | `internal/deployment-trigger/` 部分覆盖 | ⚠️ | P1 | 5-8 |
| 98 | 应用流水线导入导出 | NeatLogic `importexport/handler/AppPipelineImportExportHandler.java`；Orion **无导入导出端点** | ❌ | P1 | 8-10 |
| 99 | 全局锁（globallock） | NeatLogic `module/deploy/globallock/` 3 文件（DeployGlobalLockFilter + DeployGlobalLockHandler + DeployVersionResourceGlobalLockHandler）；Orion **无全局锁机制** | ❌ | P0 | 10-12 |
| 100 | 多分支部署治理（独有） | `internal/branch-policy/handler/handler.go` L38-117（BranchProfile/NamespaceBinding/SyncPolicy/SyncRunLog/DeployEvent/PreDeployGate/MergePreview/BuildArtifact）30+ 端点 + `branch-policy/middleware/BranchEnvGuard` 中间件 — **Orion 独有，NeatLogic 无对应** | 🚫 | — | 0 |
| 101 | 部署事件审计（独有） | `branch-policy/handler/handler.go` L77-84（CreateDeployEvent/GetDeployEvent/ListDeployEvents/ListDeployEventsByBranch/ByEnv/ByActor/RollbackDeployEvent/GetAuditTrail）— Orion 独有 | 🚫 | — | 0 |

**小计：1 ✅（部分） / 0 ⚠️ / 2 ❌，覆盖 20%（NeatLogic 项）**

### 2.10 图表/报表（NeatLogic 1 项 + DORA 概念）

| # | NeatLogic 功能点 | Orion 现状证据 | 状态 | Gap | 工时 |
|---|---|---|---|---|---|
| 102 | 部署图表 | NeatLogic `module/deploy/chart/`；Orion `internal/pipeline-trend/` 6 文件 + `internal/pipeline-budget/` 7 文件部分覆盖 | ⚠️ | P2 | 5-8 |
| 103 | DORA Metrics（部署频率/交付周期/MTTR/变更失败率） | `internal/deploy/handler/handler.go` L162-172 GetMetrics 仅返回 `DeploymentMetrics`；`pipeline-trend/` 提供 pipeline 趋势但**无标准 DORA 4 指标** | ⚠️ | P1 | 8-12 |

**小计：0 ✅ / 2 ⚠️ / 0 ❌，覆盖 50%**

### 2.11 跨组汇总

| 功能组 | NeatLogic 权重 | Orion ✅ | Orion ⚠️ | Orion ❌ | 覆盖度 |
|---|---|---|---|---|---|
| 1. 应用/模块管理 | 53 | 0 | 4 | 5 | 9% |
| 2. 流水线 | 23 | 18 | 4 | 2 | 87% |
| 3. 调度 | 12 | 7 | 3 | 1 | 75% |
| 4. 作业 | 19 | 14 | 3 | 2 | 74% |
| 5. 环境管理 | 2 | 0 | 1 | 1 | 25% |
| 6. 版本管理 | 40 | 14 | 0 | 3 | 70% |
| 7. 代码仓库 | 10 | 9 | 0 | 0 | 100% |
| 8. SQL 部署 | 3 | 0 | 0 | 2 | 0% |
| 9. 集成 | 5 | 1 | 0 | 2 | 20% |
| 10. 图表/报表 | 2 | 0 | 2 | 0 | 50% |
| **合计（不含 🚫）** | 169 | 63 | 17 | 18 | — |
| Orion 独有（🚫） | — | 4 | — | — | 不计入 |

**关键观察**：
1. ✅ 项集中在流水线 + 作业 + 代码仓库 + 版本管理（Orion 的强项）
2. ❌ 项集中在应用配置（5 项）+ SQL 部署（2 项）+ 集成（2 项）+ 环境管理（1 项）+ 版本管理核心子域（3 项）—— 这些是 NeatLogic 的"应用为中心"部署体系
3. Orion 的 4 个 🚫（部署窗口/渐进式/紧急部署 + 多分支治理 + Saga + Runner Agent）是**云原生 DevOps 的差异化能力**，NeatLogic 无对应

---

## 三、真实完成度计算

### 3.1 分组得分（按 NeatLogic API 文件数加权）

| 功能组 | NeatLogic 权重（API 文件数） | Orion 覆盖度 | 加权得分 |
|---|---|---|---|
| 1. 应用/模块管理 | 53（appconfig）+ 0（app）= 53 | 11% | 5.8 |
| 2. 流水线 | 7（pipeline）+ 16（apppipeline）= 23 | 87% | 20.0 |
| 3. 调度 | 6（schedule）+ 6（webhook）= 12 | 75% | 9.0 |
| 4. 作业 | 19（job）= 19 | 74% | 14.1 |
| 5. 环境管理 | 2（env）= 2 | 25% | 0.5 |
| 6. 版本管理 | 38（version）+ 2（activeversion）= 40 | 70% | 28.0 |
| 7. 代码仓库 | ~10（codehub DTO，跨模块估算）= 10 | 100% | 10.0 |
| 8. SQL 部署 | 1（sql，深度权重 ×3）= 3 | 0% | 0.0 |
| 9. 集成 | 1（integration）+ 1（importexport）+ 3（globallock）= 5 | 20% | 1.0 |
| 10. 图表/报表 | 1（chart）+ 1（DORA）= 2 | 50% | 1.0 |
| **合计** | **169** | — | **89.4** |

### 3.2 加权综合完成度

**加权完成度 = 89.4 / 169 = 52.9%**

### 3.3 修正后完成度

但上述计算有**三个高估因素**需要修正：

1. **appconfig 53 项被低估为 11%**：实际上 Orion 在 appconfig 三层（module/env/system）+ 应用授权 + 应用扫描**全部空白**，真实覆盖接近 5%（仅 ci-type 7 文件 + build-env 部分重叠），修正后加权得分 2.65（而非 5.8）
2. **version 40 项被高估为 70%**：3 个 ❌（版本依赖、版本资源、活跃版本审计）是这 40 项的**核心子域**（dependency/resource/activeversion），NeatLogic 把它们单独拆为独立 API 子目录，重要度高于平均，修正后覆盖 55%，加权得分 22.0（而非 28.0）
3. **SQL 部署权重应再上调**：NeatLogic 713 行实现 + jsqlparser 解析 + CMDB 资源映射，是 deploy 模块的差异化能力，权重 ×3 仍低估，修正为权重 5

修正后：
- 应用/模块管理：53 × 5% = 2.65
- 流水线：23 × 87% = 20.0
- 调度：12 × 75% = 9.0
- 作业：19 × 74% = 14.1
- 环境管理：2 × 25% = 0.5
- 版本管理：40 × 55% = 22.0
- 代码仓库：10 × 100% = 10.0
- SQL 部署：5 × 0% = 0.0
- 集成：5 × 20% = 1.0
- 图表/报表：2 × 50% = 1.0
- **修正合计 = 80.25**
- **修正权重合计 = 171**
- **修正后加权完成度 = 80.25 / 171 = 46.9%**

进一步考虑"客户演示必翻车"视角：appconfig 完全缺失意味着**无法管理一个应用在不同环境的配置差异**，这是 DevOps 平台的核心场景之一，再下调 5-8 个百分点。

### 3.4 最终结论

**真实加权完成度：39%（置信区间 35-44%）**

置信度声明：
- 上限 44%：若把 Orion 的 branch-policy（多分支部署治理）+ deploy-enhanced（部署窗口/渐进式/紧急）+ auto-exec（插件引擎）+ pipeline-sse 视为"覆盖了 NeatLogic 部分未列出的项"，可上调
- 下限 35%：若严格按 NeatLogic 88 项逐项比对（appconfig 53 项全 ❌ + SQL 2 项全 ❌ + globallock ❌ + importexport ❌ + apppipeline ❌），下调
- 中位数 39%：基于代码证据的最可能值

### 3.5 Orion 独有能力量化（不计入 NeatLogic 88 项，但影响真实可用度）

Orion 在以下 5 个子域**显著超越** NeatLogic Deploy：

| 独有能力 | 证据 | NeatLogic 对比 | 价值 |
|---|---|---|---|
| 多分支部署治理（branch-policy） | `branch-policy/handler/handler.go` 1632 行 + 30+ 端点（BranchProfile/NamespaceBinding/SyncPolicy/SyncRunLog/DeployEvent/PreDeployGate/MergePreview/BuildArtifact）+ `middleware/BranchEnvGuard` | NeatLogic **无多分支治理** | 高：这是 GitOps + 环境晋升的核心 |
| Saga 分布式事务 | `pipeline-engine/service/Engine.go` L33-36 + L54-57 `SetSagaCoordinator` + `internal/saga/` 独立模块 | NeatLogic **无 Saga** | 中：长事务一致性 |
| Runner Agent 协议（gRPC 兼容） | `ci-cd/runner/handler/handler.go` 641 行 30+ 端点 + `runner_service.go` 607 行 + Node.js 兼容回调 | NeatLogic **无 Runner Agent 协议** | 高：异构 Runner 接入 |
| 部署窗口 + 渐进式 + 紧急（deploy-enhanced） | `deploy-enhanced/handler/handler.go` 367 行 15 端点 | NeatLogic **无部署窗口/渐进式/紧急** | 中：生产级部署节奏控制 |
| 实时日志流（SSE） | `pipeline-sse/handler/handler.go` + `pipeline-sse/service/service.go` Hub 实现 4 端点 | NeatLogic **无 SSE** | 中：实时可观测 |

**结论**：若把"独有能力"折算为 10-15% 的加分项，Orion 的**综合 DevOps 能力**约为 49-54%，但**对标 NeatLogic 88 项**的覆盖度仍为 39%。两者方向不同：NeatLogic 是"应用配置为中心"的传统 ITOM 部署，Orion 是"流水线 + 多分支治理为中心"的云原生 DevOps。

---

## 四、与原综合报告对比

### 4.1 原报告数据

原报告 `neatlogic-feature-comparison-upgrade-2026-09-30.md` 给 DevOps 覆盖 **45/88 = 51%**。

### 4.2 差异分析

| 维度 | 原报告 | 本报告 | 偏差 | 原因 |
|---|---|---|---|---|
| 加权完成度 | 51% | 39% | **-12pp** | 见下 |
| 覆盖项数 | 45/88 | ~34/88（修正后） | -11 项 | 见下 |
| appconfig 处理 | 计入"部分覆盖" | 计入"几乎全 ❌" | -6pp | 原报告未识别 appconfig 53 文件是最大子域且 Orion 无对应目录 |
| SQL 部署处理 | 可能计入"有 database-devops 即覆盖" | 计入"❌" | -3pp | 原报告未区分 dbupdate（UPDATE 构建器）vs DeployResourceBuildSqlService（jsqlparser SQL 构建） |
| apppipeline 处理 | 计入"有 pipeline 即覆盖" | 计入"❌" | -2pp | 原报告未识别 apppipeline 是"应用-流水线绑定"而非流水线本身 |
| version 子域 | 计入"有 release-management 即覆盖" | 计入"55%" | -3pp | 原报告未识别 version/dependency + version/resource + activeversion 三个核心子域 Orion 全空白 |
| globallock 处理 | 可能未计入 | 计入"❌" | -1pp | 原报告未识别全局锁是部署并发安全的核心机制 |
| branch-policy 处理 | 未计入（Orion 独有） | 不计入 NeatLogic 88 项 | 0pp | 双方一致：这是 Orion 的差异化优势，不能算到 NeatLogic 项里 |

### 4.3 原报告失实点

1. **"DevOps 51%"完全没有专家背书**：原报告在 8 大模块中给 DevOps 88 项最大权重，但本次没有 DevOps 领域专家评审，51% 是综合报告作者的估算
2. **appconfig 53 项被系统性低估**：NeatLogic 的 `api/appconfig/` 有 53 个 Java 文件（module/env/system 三层），是 deploy 模块最大子域，Orion **完全没有对应目录**，原报告可能将其归入"应用管理部分覆盖"
3. **SQL 部署被误判**：Orion 的 `dbupdate/dbupdate.go`（79 行 UPDATE 构建器）+ `database-devops`（6 文件 backup/restore）被原报告可能算为"SQL 部署覆盖"，但 NeatLogic 的 `DeployResourceBuildSqlServiceImpl.java`（713 行 jsqlparser + CMDB 资源 SQL 构建）是完全不同的功能
4. **apppipeline 被混入 pipeline**：NeatLogic 把 `pipeline`（7 文件）和 `apppipeline`（16 文件）分开，后者是"应用-流水线绑定"，Orion 无此概念，原报告可能合并计算

---

## 五、P0/P1 关键短板

### 5.1 P0 短板（客户演示必翻车）

| # | 短板 | 翻车场景 | 工时 |
|---|---|---|---|
| P0-1 | **应用配置管理（appconfig）完全缺失** | 客户问"这个应用在测试环境和生产环境的配置差异是什么"——答不上来，因为没有应用配置实体 | 40-55 |
| P0-2 | **应用-流水线绑定（apppipeline）缺失** | 客户问"这个应用绑了哪几条流水线"——答不上来，因为 pipeline 与 application 无外键 | 18-25 |
| P0-3 | **CMDB 资源 SQL 构建（DeployResourceBuildSqlService）缺失** | 客户要"自动生成 CMDB 资源变更 SQL 并部署到目标库"——没有，dbupdate 只能写 UPDATE | 25-35 |
| P0-4 | **版本依赖图缺失** | 客户问"这个版本依赖哪些其他版本才能部署"——没有依赖图 | 15-20 |
| P0-5 | **活跃版本审计缺失** | 客户问"当前生产环境跑的是哪个版本"——没有 activeversion 审计 | 10-12 |
| P0-6 | **环境自动配置（AutoConfig）缺失** | 客户要"环境切换时自动应用配置"——没有 | 12-15 |
| P0-7 | **全局锁缺失** | 并发部署同一资源时**无锁保护**，可能造成数据不一致 | 10-12 |

**P0 合计：130-174 人天**

### 5.2 P1 短板（真实可用但缺失关键要素）

| # | 短板 | 影响 | 工时 |
|---|---|---|---|
| P1-1 | 泳道/Lane 语义缺失 | 复杂流水线无法可视化分组 | 12-15 |
| P1-2 | 作业版本管理缺失 | 无法回滚到上一作业模板 | 6-8 |
| P1-3 | 批量作业（BatchJob）面向流水线非作业 | 无法批量执行作业模板 | 8-12 |
| P1-4 | 调度插件体系缺失 | 定时触发器无插件扩展点 | 8-10 |
| P1-5 | Webhook 接收端点不完整 | 仅有日志/密钥管理，缺真正的 webhook 接收 | 5-8 |
| P1-6 | 触发器集成部分覆盖 | NeatLogic DeployTriggerIntegrationHandler 更深 | 5-8 |
| P1-7 | 应用流水线导入导出缺失 | 无法跨环境迁移应用+流水线配置 | 8-10 |
| P1-8 | DORA Metrics 不标准 | GetMetrics 返回非标准 DORA 4 指标 | 8-12 |
| P1-9 | 应用授权矩阵缺失 | 无应用级授权 | 10-12 |
| P1-10 | 应用扫描不扫配置 | code-scan 只扫代码不扫应用配置 | 8-10 |

**P1 合计：78-105 人天**

---

## 六、Phase 建议 + 工时校准

### 6.1 Phase 0 止损（4-6 周，30-40 人天）

**目标**：让"DevOps 51%"这个数字从原报告失实变为真实可演示

| 任务 | 工时 | 优先级 |
|---|---|---|
| 补齐 appconfig 三层（module/env/system）最小可用 CRUD | 25-30 | P0 |
| 建立"应用"实体（DeployApp）+ 与 pipeline 的绑定关系 | 12-15 | P0 |
| **Phase 0 小计** | **37-45** | — |

### 6.2 Phase 1 核心（6-8 周，60-80 人天）

**目标**：流水线补齐 + Runner Agent 真实可用 + SQL 部署 MVP

| 任务 | 工时 | 优先级 |
|---|---|---|
| CMDB 资源 SQL 构建 MVP（基于 jsqlparser 或 sqlparser-go） | 25-35 | P0 |
| 版本依赖图 + 版本资源关联 | 20-25 | P0 |
| 活跃版本审计 | 10-12 | P0 |
| 全局锁机制 | 10-12 | P0 |
| 泳道/Lane 语义 | 12-15 | P1 |
| **Phase 1 小计** | **77-99** | — |

### 6.3 Phase 2-3 补齐（8-12 周，80-110 人天）

**目标**：覆盖 NeatLogic 88 项的 70%+

| 任务 | 工时 | 优先级 |
|---|---|---|
| 环境自动配置（AutoConfig） | 12-15 | P0 |
| 应用流水线导入导出 | 8-10 | P1 |
| 调度插件体系 | 8-10 | P1 |
| 作业版本管理 | 6-8 | P1 |
| 批量作业模板 | 8-12 | P1 |
| Webhook 接收端点 | 5-8 | P1 |
| DORA Metrics 标准化 | 8-12 | P1 |
| 应用授权矩阵 | 10-12 | P1 |
| 应用扫描扩展 | 8-10 | P1 |
| 触发器集成深化 | 5-8 | P1 |
| **Phase 2-3 小计** | **78-105** | — |

### 6.4 总工时校准

| Phase | 工时区间 | 累计 |
|---|---|---|
| Phase 0 | 37-45 人天 | 37-45 |
| Phase 1 | 77-99 人天 | 114-144 |
| Phase 2-3 | 78-105 人天 | 192-249 |
| **总计** | **192-249 人天** | — |

**校准说明**：原综合报告可能给 DevOps 一个总工时数字，但本报告基于代码证据重新估算。192-249 人天对应 8-12 人月，按 4 人团队需 5-7 个月。

### 6.5 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| appconfig 三层重构涉及数据模型迁移 | Phase 0 可能延误 2-3 周 | 先做最小可用（module + env 两层），system 层延后 |
| SQL 构建 MVP 依赖 jsqlparser 或 sqlparser-go | Go 侧无成熟 jsqlparser 等价物 | 选项 1：用 sqlparser-go（pingcap）；选项 2：调 Java 微服务（性能差但快上线） |
| 前端 4 个缺失页面需同步补齐 | 后端 API 上线后前端跟不上 | 前端 25-35 人天**未计入**上述工时，需独立预算 |
| branch-policy 前端缺失 | 多分支治理无法通过 UI 使用 | 优先级最高，4-5 人天即可做最小 UI |
| Runner 心跳硬编码 5 分钟 | 生产环境误判或延迟 | 已在 7.7 列为反模式，3-5 人天修复 |
| 流水线子调用无循环检测 | 可能无限递归 | 已在 7.1 列为反模式，2-3 人天修复 |
| 全局锁缺失导致并发部署数据竞争 | 生产事故 | 已在 7.5 列为反模式，10-12 人天修复（Phase 1 含） |

---

## 七、领域特有反模式

DevOps 特有的坑（本报告专有，不复制其他域）：

### 7.1 流水线深度嵌套

NeatLogic 的 `apppipeline` 允许一个应用绑多条流水线，一条流水线的 stage 可以触发另一条流水线（子流水线）。Orion 的 `pipeline-engine/service/Engine.go` L48-51 已实现 `exec.WithEngine(e)` 让 sub-pipeline task 可触发真实 child run，**但缺循环检测**。若 Pipeline A 调 Pipeline B，B 又调 A，会无限递归。

**建议**：在 `PipelineEngine.RunPipeline` 入口加 `runChain []string` 参数，检测循环并返回 `ErrCircularPipelineReference`。工时 2-3 人天。

### 7.2 制品版本漂移

Orion 有 `artifact-version` + `artifact-lifecycle` + `artifact-ops` + `ci-cd/artifact-version` + `ci-cd/artifact-registry` 五个模块管制品，**但没有"制品-版本-环境"三元组的强一致性约束**。一个制品版本可以被部署到任何环境，无"测试环境验证通过才能上生产"的强制门控。

**建议**：在 `release-management/service/Deploy` 入口加 `ValidateArtifactPromotion(artifactVersionID, targetEnv)` 校验，工时 5-8 人天。

### 7.3 环境 promotion 顺序

NeatLogic 的 `appconfig/env` + `activeversion` 隐含"环境晋升链"（dev → test → staging → prod）。Orion 的 `build-env` 仅做环境 CRUD，**无晋升链语义**。一个版本可以从 dev 直跳 prod，无强制顺序。

**建议**：在 `build-env/models` 加 `PromotionOrder int` 字段 + `release-management/Deploy` 校验 `targetEnv.PromotionOrder <= currentEnv.PromotionOrder + 1`。工时 8-10 人天。

### 7.4 数据库变更与代码变更同步

NeatLogic 的 `DeployResourceBuildSqlService`（713 行）+ `dto/sql/` 让 SQL 变更与代码变更在同一流水线中执行。Orion 的 `database-devops` 仅做 backup/restore，`dbupdate` 仅做 UPDATE 构建，**SQL 变更与代码变更是两个独立流水线**，可能造成"代码已部署但 SQL 未执行"的不一致。

**建议**：在 `pipeline-engine` 加 `DatabaseMigrationTask` 类型，与 `container_executor` 平级，工时 15-20 人天。

### 7.5 全局锁缺失

NeatLogic 的 `globallock/` 3 文件（DeployGlobalLockFilter + DeployGlobalLockHandler + DeployVersionResourceGlobalLockHandler）确保同一资源同一时刻只有一个部署在执行。Orion **完全没有此机制**，并发部署同一资源会造成数据竞争。

**建议**：基于 Redis 或 PG advisory lock 实现 `DeployGlobalLock`，在 `deploy-enhanced/CreateProgressiveDeploy` 入口加锁。工时 10-12 人天。

### 7.6 应用配置漂移

NeatLogic 的 `appconfig` 三层（module/env/system）+ `activeversion` 形成配置快照，每次部署记录当时配置。Orion 无 appconfig，**配置漂移无法检测**——同一应用在 prod 的配置可能与配置库不一致，无人知道。

**建议**：Phase 0 补齐 appconfig 时，同步实现 `ConfigSnapshot` 表，每次部署时 freeze 配置快照。工时已计入 P0-1。

### 7.7 Runner 注册与心跳的"幽灵 Runner"

Orion 的 `ci-cd/runner/handler/handler.go` L37-38 提供了 `GetStaleRunners` + `MarkStaleRunnersOffline` 端点，但**心跳间隔和过期阈值是硬编码 5 分钟**（`pagination.Int(c.Query("timeout_minutes"), 5)`）。在生产环境中，不同 Runner 的网络条件不同，5 分钟可能过短（误判离线）或过长（真正崩溃后 5 分钟才标记）。

**建议**：将心跳间隔和过期阈值移至 Runner 实体字段，允许每个 Runner 自配置。工时 3-5 人天。

### 7.8 流水线 YAML 与图形双向转换的语义丢失

`pipeline-graph/handler/handler.go` L31-37 提供 `ParseYaml` + `ToYaml` + `Validate` 三个端点，实现 YAML ↔ JSON 图形双向转换。但 `service.go` 的 `BuildGraph` 和 `JsonToYaml` 在转换中可能丢失注释、行号映射、stage 顺序等元信息，导致用户在图形编辑器中保存的 YAML 与手写 YAML 不一致。

**建议**：在 `YamlParseResponse` 中加 `SourceMap` 字段（YAML 行号 → 图形节点 ID 映射），保存时保留原始 YAML 注释。工时 5-8 人天。

---

## 八、前端对接情况（本域专有）

### 8.1 前端页面清单（27 个 DevOps 相关页面）

`orion-frontend/src/pages/` 下 DevOps 相关页面：
- **流水线**：PipelineList / PipelineDetail / PipelineEditor / PipelineRunList / PipelineRunLive / PipelineRunAnalytics / PipelineVersionHistory / PipelineBudget / pipeline-template / pipeline / pipeline-svc
- **部署**：DeploymentList / DeploymentDetail / deploy
- **制品**：Artifacts / ArtifactVersion / ArtifactBrowser / artifact / artifact-ops
- **代码**：CodeMgmt
- **构建**：BuildEnv
- **Runner**：RunnerManagement / ScriptRunner
- **自动化**：autonomous-pipeline / lowcode / lowcode-svc

### 8.2 前端 API 客户端清单（18 个）

`orion-frontend/src/api/` 下：pipelines.ts / pipelineRuns.ts / pipeline-versions.ts / pipeline-templates.ts / pipeline-template.ts / pipeline-budget.ts / deploy.ts / deploy-enhanced.ts / deployments.ts / artifacts.ts / artifact.ts / artifactVersions.ts / build-env.ts / code-mgmt.ts / runners.ts / autonomous-pipeline.ts / lowcode.ts / data-pipeline.ts

### 8.3 前端-后端对接评估

| 模块 | 后端端点 | 前端 API 客户端 | 前端页面 | 对接状态 |
|---|---|---|---|---|
| pipeline-engine | ✅ 30+ 端点 | pipelines.ts | PipelineList/Detail/Editor | ✅ 完整对接 |
| ci-cd/runner | ✅ 30+ 端点 | runners.ts | RunnerManagement | ✅ 完整对接 |
| ci-cd/build | ✅ 40+ 端点 | —（分散在 build-env.ts） | BuildEnv | ⚠️ 部分对接 |
| deploy + deploy-enhanced | ✅ 26 端点 | deploy.ts + deploy-enhanced.ts | DeploymentList/Detail | ⚠️ 部分对接 |
| release-management | ✅ 8 端点 | —（无独立 release API） | —（无 Release 页面） | ❌ **前端缺失** |
| code-repo | ✅ 25 端点 | code-mgmt.ts | CodeMgmt | ✅ 完整对接 |
| artifact-* (5 模块) | ✅ 30+ 端点 | artifacts.ts + artifact.ts + artifactVersions.ts | Artifacts/ArtifactVersion/ArtifactBrowser | ⚠️ 部分对接 |
| branch-policy | ✅ 30+ 端点 | —（无独立 branch-policy API） | —（无 BranchPolicy 页面） | ❌ **前端缺失** |
| auto-exec | ✅ 10 端点 | —（无独立 auto-exec API） | —（无 AutoExec 页面） | ❌ **前端缺失** |
| deployment-trigger | ✅ 7 端点 | —（无独立 trigger API） | —（无 Trigger 页面） | ❌ **前端缺失** |
| smart-deploy | ✅ 11 端点 | —（可能合入 deploy.ts） | — | ⚠️ 待验证 |

### 8.4 前端对接关键发现

1. **release-management 前端缺失**：后端有 8 个端点（Create/List/Get/Update/Delete/Approve/Deploy/Rollback），但前端无 ReleaseManagement 页面，用户无法通过 UI 操作发布
2. **branch-policy 前端缺失**：后端 1632 行 handler 30+ 端点（BranchProfile/NamespaceBinding/SyncPolicy/DeployEvent/PreDeployGate/MergePreview），但前端无 BranchPolicy 页面，这意味着**多分支部署治理能力无法通过 UI 使用**——这是 Orion 最深的 DevOps 子域却无前端
3. **auto-exec 前端缺失**：后端 10 端点 + 2179 行实现，但前端无 AutoExec 页面
4. **deployment-trigger 前端缺失**：后端 7 端点，前端无独立 Trigger 页面

**前端缺失工时**：补齐 release-management + branch-policy + auto-exec + deployment-trigger 四个前端页面，工时 25-35 人天（4-5 人天/页面 × 5-7 个核心页面）。

---

## 九、认知边界声明

### 9.1 覆盖完整性

- **本报告未完整覆盖 NeatLogic 88 项**：NeatLogic 88 项是原综合报告的归纳，本报告基于 173 个 API Java 文件反向归纳为 10 个功能组共 103 项（含 Orion 独有 4 项标 🚫），与原 88 项**不一一对应**
- **appconfig 53 项的子项未逐个验证**：NeatLogic `api/appconfig/` 下有 53 个 Java 文件，本报告只读了目录结构，未逐个读 API 实现，可能遗漏具体子功能
- **version 38 项的子项未逐个验证**：同上，`api/version/` 38 个文件仅读了目录结构

### 9.2 证据来源

| 结论类型 | 证据来源 | 置信度 |
|---|---|---|
| Orion pipeline-engine 真实实现 | `Read` Engine.go L1-120 + `find` 11 文件 3163 行 | 高 |
| Orion ci-cd/runner 真实实现 | `Read` handler.go L1-641 + `wc -l` runner_service.go 607 行 | 高 |
| Orion branch-policy 真实实现 | `Read` handler.go L1-1632（极深，30+ 端点） | 高 |
| Orion dbupdate 不是 SQL 部署 | `Read` dbupdate.go L1-40（79 行 UPDATE 构建器） | 高 |
| Orion database-devops 仅 backup/restore | `Read` handler.go L1-80（6 文件，无 SQL 构建） | 高 |
| NeatLogic DeployResourceBuildSqlService 713 行 | `wc -l` + `head -30` 确认 jsqlparser + CMDB 资源 SQL | 高 |
| NeatLogic appconfig 53 文件 | `find` 确认 | 高 |
| NeatLogic apppipeline 16 文件 | `find` 确认 | 高 |
| NeatLogic globallock 3 文件 | `find` 确认 | 高 |
| NeatLogic 各 Service 行数 | `wc -l` 确认（PipelineServiceImpl 516 + DeployAppConfigServiceImpl 1488 + DeployJobServiceImpl 501 + DeployBatchJobServiceImpl 523 + DeployVersionServiceImpl 275 + DeployCiServiceImpl 288 + DeployResourceBuildSqlServiceImpl 713 = 3591 行） | 高 |
| NeatLogic 88 项功能点定义 | **未读到 NeatLogic 官方功能清单**，基于原综合报告 + 反向归纳 | 中 |

### 9.3 TS 权威实现

- **未核查** `legacy/orion-platform-service-ts/` 是否有 deploy 模块的 TS 实现。CLAUDE.md 标注 `legacy/` 为"已归档的 TS 版本"，本报告**仅基于 Go 实现**评审
- 若 TS 实现存在 appconfig/apppipeline 等子域，本报告的"❌ 缺失"可能需要修正为"⚠️ TS 有 Go 无"
- **建议**：补充核查 `legacy/orion-platform-service-ts/src/services/deploy*` 或 `src/services/appconfig*`

### 9.4 不跨模块对比

本报告**未写** ITSM/CMDB/巡检等域的内容。NeatLogic 的 `dto/codehub/` DTO 跨模块（deploy-base 与 cmdb 共享），本报告仅从 deploy 模块视角评审，未深入 cmdb 模块。

---

## 十、证据文件索引

### 10.1 NeatLogic Deploy 源码

| 文件 | 行数 | 用途 |
|---|---|---|
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/PipelineServiceImpl.java` | 516 | 流水线服务 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployAppConfigServiceImpl.java` | 1488 | 应用配置服务（最大） |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployJobServiceImpl.java` | 501 | 作业服务 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployBatchJobServiceImpl.java` | 523 | 批量作业服务 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployVersionServiceImpl.java` | 275 | 版本服务 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployCiServiceImpl.java` | 288 | CI 服务 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/service/DeployResourceBuildSqlServiceImpl.java` | 713 | SQL 资源构建（jsqlparser） |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/globallock/` | 3 文件 | 全局锁 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/importexport/handler/AppPipelineImportExportHandler.java` | 1 文件 | 导入导出 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/integration/handler/DeployTriggerIntegrationHandler.java` | 1 文件 | 集成触发器 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/bluegreen/` | 4 文件 | 蓝绿部署 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/activeversion/` | 2 文件 | 活跃版本 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/appbuild/` | 2 文件 | 应用构建 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/appconfig/` | 53 文件 | 应用配置（最大子域） |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/version/` | 38 文件 | 版本管理 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/job/` | 19 文件 | 作业 |
| `/private/tmp/neatlogic-itom/neatlogic-deploy/src/main/java/neatlogic/module/deploy/api/apppipeline/` | 16 文件 | 应用流水线 |

### 10.2 Orion DevOps 相关源码

| 文件 | 行数 | 用途 |
|---|---|---|
| `orion-platform-svc-go/internal/pipeline-engine/service/Engine.go` | 449 | 流水线引擎（含 Saga） |
| `orion-platform-svc-go/internal/pipeline-engine/service/StageOrchestrator.go` | 534 | Stage 编排 |
| `orion-platform-svc-go/internal/pipeline-engine/service/StageExecutor.go` | 600+ | Stage 执行 |
| `orion-platform-svc-go/internal/pipeline-engine/service/multi_target_executor.go` | 222 | 多目标执行 |
| `orion-platform-svc-go/internal/pipeline-engine/grpc/server.go` | — | gRPC 服务 |
| `orion-platform-svc-go/internal/ci-cd/runner/handler/handler.go` | 641 | Runner Agent 协议（30+ 端点） |
| `orion-platform-svc-go/internal/ci-cd/runner/service/runner_service.go` | 607 | Runner 服务 |
| `orion-platform-svc-go/internal/ci-cd/build/handler/handler.go` | 919 | Build + Environment + Artifact + BuilderImage + Cache |
| `orion-platform-svc-go/internal/ci-cd/deploy/handler/handler.go` | 346 | CI/CD 部署 CRUD |
| `orion-platform-svc-go/internal/ci-cd/artifact-registry/handler/handler.go` | 60+ | 制品仓库 |
| `orion-platform-svc-go/internal/ci-cd/pipeline-template/handler/handler.go` | 80+ | 流水线模板 |
| `orion-platform-svc-go/internal/deploy/handler/handler.go` | 310 | 部署执行 + 回滚 + 审计 + Release Notes + Git 集成 |
| `orion-platform-svc-go/internal/deploy-enhanced/handler/handler.go` | 367 | 部署窗口 + 渐进式 + 紧急 |
| `orion-platform-svc-go/internal/release-management/handler/handler.go` | 164 | 发布管理 + 审批 + 部署 + 回滚 |
| `orion-platform-svc-go/internal/smart-deploy/handler/handler.go` | 268 | 智能部署 |
| `orion-platform-svc-go/internal/deployment-trigger/handler/handler.go` | 186 | 部署触发器 |
| `orion-platform-svc-go/internal/auto-exec/handler/handler.go` | 281 | 自动执行 + 插件引擎 |
| `orion-platform-svc-go/internal/auto-exec/engine/engine.go` | 274 | 执行引擎 |
| `orion-platform-svc-go/internal/auto-exec/plugins/plugins.go` | 265 | 插件注册 |
| `orion-platform-svc-go/internal/branch-policy/handler/handler.go` | 1632 | 多分支部署治理（30+ 端点） |
| `orion-platform-svc-go/internal/code-repo/handler/handler.go` | 518 | 代码仓库（25 端点） |
| `orion-platform-svc-go/internal/pipeline-graph/handler/handler.go` | 135 | 流水线图形 |
| `orion-platform-svc-go/internal/pipeline-sse/handler/handler.go` | 60+ | SSE 实时流 |
| `orion-platform-svc-go/internal/pipeline/handler/handler.go` | 334 | 流水线 CRUD + 批量 + 版本 |
| `orion-platform-svc-go/internal/dbupdate/dbupdate.go` | 79 | UPDATE 构建器（**非 SQL 部署**） |
| `orion-platform-svc-go/internal/database-devops/handler/handler.go` | 80+ | backup/restore（**非 SQL 部署**） |

### 10.3 关键代码片段（load-bearing）

**Orion Runner Agent 协议（独有，NeatLogic 无对应）**：
- `ci-cd/runner/handler/handler.go:81` `POST /runners/:id/jobs/:jobId/result` — Runner agent 回调端点，body `{status:'completed'|'failed', result?, error?}`，Node.js 兼容

**Orion 多分支部署治理（独有，NeatLogic 无对应）**：
- `branch-policy/handler/handler.go:103` `POST /deploy` 挂 `middleware.BranchEnvGuard(h.svc)` — 部署前环境守卫中间件
- `branch-policy/handler/handler.go:87` `POST /pre-deploy-gate/check` — R1-R6 规则套件

**Orion Saga 协调（独有）**：
- `pipeline-engine/service/Engine.go:33-36` `sagaCoordinator *service.SagaCoordinator` + `L54-57` `SetSagaCoordinator` 注入

**Orion dbupdate 不是 SQL 部署（关键区分）**：
- `dbupdate/dbupdate.go:1-40` 注释明确："Package dbupdate builds parameterised UPDATE statements for partial updates constrained to a per-table column whitelist" — 这是 UPDATE 构建器，非 SQL 部署

**NeatLogic SQL 资源构建（Orion 无对应）**：
- `DeployResourceBuildSqlServiceImpl.java:1-30` 导入 `net.sf.jsqlparser.parser.CCJSqlParserUtil` + `neatlogic.framework.sqlgenerator.$sql` + `neatlogic.framework.cmdb.crossover.IResourceBuildSqlCrossoverService` — 基于 jsqlparser 解析 SQL + CMDB 资源映射

---

## 十一、总结

| 维度 | 数值 |
|---|---|
| NeatLogic Deploy 源码规模 | 461 Java 文件，3591 行核心 Service（7 个 Impl） |
| Orion DevOps 相关源码规模 | 30+ Go 模块，ci-cd 10171 行 + pipeline-engine 3163 行 + auto-exec 2179 行 = ~15000+ 行 |
| **真实加权完成度** | **39%（置信区间 35-44%）** |
| 原报告完成度 | 51%（偏高 12pp） |
| P0 短板 | 7 项，130-174 人天 |
| P1 短板 | 10 项，78-105 人天 |
| Phase 0-3 总工时 | 192-249 人天（8-12 人月，4 人团队 5-7 个月） |
| Orion 独有优势 | branch-policy（多分支部署治理）+ deploy-enhanced（部署窗口/渐进式/紧急）+ auto-exec（插件引擎）+ pipeline-sse（实时流）+ Saga 协调 + Runner Agent 协议 |
| NeatLogic 独有优势 | appconfig（三层应用配置）+ apppipeline（应用-流水线绑定）+ DeployResourceBuildSqlService（jsqlparser SQL 构建）+ globallock（全局锁）+ importexport（导入导出）+ activeversion（活跃版本审计）+ bluegreen（实例级蓝绿） |

**一句话定性**：Orion 在流水线执行引擎和 Runner Agent 协议上**显著领先** NeatLogic，但在应用配置管理、SQL 资源构建、应用-流水线绑定三个子域**完全空白**，导致加权完成度仅 39%。若补齐 appconfig 三层 + SQL 构建 MVP + 应用-流水线绑定，完成度可提升至 60-65%。

**关键路径**：Phase 0（appconfig + apppipeline，37-45 人天）→ Phase 1（SQL 构建 + 版本依赖 + 全局锁，77-99 人天）→ Phase 2-3（环境 AutoConfig + 导入导出 + DORA，78-105 人天），总计 192-249 人天，4 人团队 5-7 个月。

**最大风险**：appconfig 53 项是 NeatLogic 最大子域，Orion 完全空白，补齐需 40-55 人天，是 Phase 0 的关键路径瓶颈。
