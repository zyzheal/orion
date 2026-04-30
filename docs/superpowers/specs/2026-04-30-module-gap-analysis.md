# Orion 模块缺失功能详细清单

> 日期：2026-04-30
> 状态：代码扫描完成，对比设计文档分析
> 方法：逐模块代码扫描 + 设计文档对比 + 已知问题汇总

---

## 一、严重性分级说明

| 级别 | 定义 | 示例 |
|------|------|------|
| **P0 - Critical** | 全 mock 无真实功能，核心路径缺失 | 部署引擎未接入 K8s、AI 分析返回硬编码数据 |
| **P1 - High** | 部分功能缺失，生产环境不可用 | GitLab API 未调用、Cron 表达式不解析 |
| **P2 - Medium** | 功能可用但有缺陷或缺少保护 | 无输入验证、无测试覆盖、重复方法名 |
| **P3 - Low** | 改进项或增强需求 | 缺少分页、缺少审计日志、缺少通知 |

---

## 二、核心域（Core Domain）

### 2.1 Pipeline 引擎 (`pipeline/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Pipeline 执行未接入 Tekton/K8s | P0 | `executePipeline()` 使用 `setTimeout(100)` 模拟阶段执行，无真实 Tekton PipelineRun 创建 | `PipelineService.ts` |
| 2 | 缺少 Pipeline 定时调度/Cron 触发 | P1 | 无 cron 触发功能，无法配置定时流水线 | — |
| 3 | 缺少 Pipeline 模板管理 | P1 | 无 PipelineTemplate CRUD，无法复用常用 Pipeline 定义 | — |
| 4 | Pipeline 版本控制薄弱 | P2 | `getVersions()` 方法存在但实现单薄，无版本差异对比 | `PipelineService.ts` |
| 5 | YAML 验证不完整 | P2 | 仅做基础字段校验，无完整 JSON Schema 验证 | `PipelineService.ts` |
| 6 | 缺少 Pipeline 测试覆盖 | P2 | 仅 `PipelineRepository.test.ts` 存在，Service 层无测试 | — |

### 2.2 构建服务 (`build/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Build 执行未接入 Docker/K8s | P0 | `executeBuild()` 使用 `setTimeout(500)` 模拟构建，无真实 Docker build | `BuildService.ts` |
| 2 | 制品上传/下载未接入对象存储 | P0 | `ArtifactService` 全部操作使用内存 Map，无 S3/Harbor 集成 | `BuildService.ts`, `ArtifactService.ts` |
| 3 | 构建日志未接入 Elasticsearch/Loki | P1 | `BuildLogService` 使用内存存储，无持久化日志查询 | `BuildLogService.ts` |
| 4 | K8s Build Executor 使用 mock 客户端 | P1 | `K8sBuildExecutor` 初始化传入 mock K8s client | `K8sBuildExecutor.ts` |
| 5 | Buildx 不可用时直接报错 | P2 | `createBuilder()` 在 buildx 不存在时抛错，无降级策略 | `BuildxBuilderService.ts` |
| 6 | 缺少构建队列/限流机制 | P1 | 无并发构建限制，无构建排队系统 | — |
| 7 | 缺少 Build 模块完整测试覆盖 | P2 | 部分子服务有测试，但 BuildService 主服务无测试 | — |

### 2.3 部署服务 (`deploy/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 部署执行未接入 K8s | P0 | `executeDeployment()` 使用 `setTimeout` 模拟，无真实 Deployment/Pod 创建 | `DeployService.ts` |
| 2 | 无真实流量管理 | P0 | 无 Ingress/Service 更新，无负载均衡器切换 | — |
| 3 | 缺少部署健康检查验证 | P1 | 部署完成后不验证 Pod 就绪状态 | — |
| 4 | Rollback 不执行真实回滚 | P0 | `rollback()` 仅创建新记录，不切换流量或缩放版本 | `DeployService.ts` |
| 5 | 缺少部署审批门控集成 | P1 | 无与 ApprovalService 的集成点 | — |
| 6 | **整个模块无测试目录** | P2 | `deploy/` 下无 `__tests__/` 目录 | — |
| 7 | 缺少部署完成通知/Webhook | P2 | 部署完成后无通知机制 | — |

### 2.4 配置管理 (`config-mgmt/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Git 客户端为 Mock 实现 | P1 | `GitOpsService` 使用 `MockGitClient`，无真实 Git clone/pull | `GitOpsService.ts` |
| 2 | YAML 解析器过于简陋 | P2 | `parseYamlConfig()` 使用逐行解析，无法处理嵌套 YAML | `GitOpsService.ts` |
| 3 | GitOps 配置存储在内存 Map 中 | P1 | 未持久化到数据库，重启丢失 | `GitOpsService.ts` |
| 4 | 配置加密未实现 | P1 | `encrypted` 标志存在但无实际加密/解密逻辑 | `ConfigService.ts` |
| 5 | 存在重复方法名 | P2 | `getConfig`/`getConfig2`, `deleteConfig`/`deleteConfig2` 等，表明迁移未完成 | `ConfigService.ts` |
| 6 | Config Approval 使用内存 Map | P1 | 变更请求未持久化到数据库 | `ConfigApprovalService.ts` |
| 7 | 缺少配置模板管理 | P2 | 无配置模板 CRUD | — |

### 2.5 代码仓库 (`code-repo/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **GitLab API 全部返回 mock 数据** | P0 | `GitLabApiClient.get/post/put/delete` 返回 `{}` 或 `[]`，无真实 HTTP 调用 | `GitLabAdapter.ts` |
| 2 | Gerrit API 同样全部 mock | P0 | 所有方法返回硬编码 mock 数据 | `GerritAdapter.ts` |
| 3 | 缺少 GitHub Adapter | P1 | 代码引用 GitHubClient 但不存在对应适配器 | — |
| 4 | 仓库/分支/Commit 列表返回空数组 | P0 | `listRepositories()`, `listBranches()`, `listCommits()` 等全部返回 `[]` | `GitLabAdapter.ts` |
| 5 | BranchPolicy 存储在内存 Map | P1 | 分支策略未持久化 | `BranchPolicyService.ts` |
| 6 | CodeOwnership 不从 Git 解析 | P1 | 使用内存 Map 而非解析实际 CODEOWNERS 文件 | `CodeOwnershipService.ts` |

### 2.6 智能部署 (`smart-deploy/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 所有部署策略使用模拟执行 | P0 | Blue-Green/Canary/Rolling/Recreate 全部使用 `simulateStepExecution()` | `DeploymentStrategyEngine.ts` |
| 2 | 部署验证使用随机值模拟指标 | P0 | `verifyMetrics()` 使用 `Math.random()` 生成假指标值 | `DeploymentVerifier.ts` |
| 3 | 回滚仅创建记录不切换流量 | P0 | `RollbackService.performRollback()` 使用 setTimeout 模拟 | `RollbackService.ts` |
| 4 | 版本查找使用字符串解析 | P2 | `findPreviousVersion()` 解析版本号字符串递减 patch，不查历史记录 | `RollbackService.ts` |
| 5 | 部署前检查为模拟 | P1 | 依赖检查和资源检查使用 setTimeout | `DeploymentWorkflow.ts` |
| 6 | Rolling 部署 replicas 硬编码为 3 | P2 | 无法根据实际环境配置副本数 | `DeploymentStrategyEngine.ts` |

### 2.7 环境管理 (`environment/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 无环境自动创建（K8s Namespace） | P1 | 不创建 K8s Namespace 或集群资源 | — |
| 2 | 无环境健康检查/连通性验证 | P1 | 无法验证环境是否可用 | — |
| 3 | 无环境模板/克隆功能 | P2 | 无法基于现有环境快速创建新环境 | — |
| 4 | 缺少环境使用统计 | P2 | 无查询每个环境的部署数、配置数 | — |
| 5 | `listAll()` 无分页 | P2 | 返回所有环境记录 | `EnvironmentRepository.ts` |
| 6 | **整个模块无测试目录** | P2 | `environment/` 下无 `__tests__/` 目录 | — |

### 2.8 审批流程 (`approval/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | API 路由无输入验证 | P1 | `request.body as any` 无 schema 校验 | `approval-routes.ts` |
| 2 | 审批标题在创建时丢失 | P2 | title 不传入 repository，重建为 `Approval for {resourceType}` | `ApprovalService.ts` |
| 3 | 缺少审批委托/升级机制 | P1 | 无 delegate 或 escalate 功能 | — |
| 4 | 无审批超时/SLA 跟踪 | P1 | 审批超时无自动处理 | — |
| 5 | 缺少审批通知 | P2 | 审批时无邮件/Slack 通知 | — |
| 6 | 审批意见未存储 | P2 | `approve()`/`reject()` 不接受 comment 参数 | `ApprovalService.ts` |
| 7 | `listPending()` 硬编码 limit 100 | P2 | 无分页支持 | `ApprovalService.ts` |

---

## 三、支撑域（Supporting Domain）

### 3.1 AI 增强层 (`ai/`, `ai-review/`, `ai-security/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | AI API 调用被注释掉 | P0 | `TODO: 集成 AI API`，实际 LLM 功能未接入 | `AIReviewService.ts:109` |
| 2 | AI Review 无真实 AI 模型 | P0 | 评论功能返回模拟结果 | `ai-review/` |
| 3 | **AI 模块无测试覆盖** | P2 | `ai/` 目录无 `__tests__/` | — |

### 3.2 Agent (`agent/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Agent run 使用 setTimeout 模拟 | P1 | `AgentService.ts` 用 300ms 延迟模拟任务执行 | `AgentService.ts` |
| 2 | sandbox-worker 工具有限 | P2 | 仅支持 read_file/write_file/exec，未知 action 直接抛错 | `sandbox-worker.ts` |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.3 告警管理 (`alert/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 告警抑制规则测试失败 | P2 | `AlertSuppressionService.test.ts` 维护窗口和已知规则测试全部失败（预先存在的问题） | — |

### 3.4 金丝雀分析 (`canary-analysis/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **全部分析使用硬编码 mock 数据** | P0 | `simulateAnalysisRun()` 返回硬编码指标和 ML 结果，无真实 Prometheus 数据源 | `CanaryAnalysisService.ts:261-346` |
| 2 | 无真实指标采集 | P0 | `getMetrics()`/`getMLResults()` 返回内存 mock 数据 | `CanaryAnalysisService.ts` |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.5 变更智能 (`change-intelligence/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **全 mock 分析引擎** | P0 | `analyze()` 返回硬编码 SHAP 因子、影响服务列表，"MVP: mock analysis with realistic data" | `ChangeIntelligenceService.ts:67` |
| 2 | 无真实 ML 模型调用 | P0 | 未调用 XGBoost 或其他 ML 模型 | — |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.6 ChatOps (`chatops/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Phase 1 mock 降级 | P1 | `CommandRouter` 对未接入服务返回 mock 结果 | `CommandRouter.ts:118-139` |
| 2 | ExecutionService mock 回退 | P2 | 无 commandRouter 时使用 mock 行为 | `ExecutionService.ts:164-176` |

### 3.7 基础设施即代码 (`iac/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **Terraform Plan 生成全 mock** | P0 | `PlanService.create()` 硬编码资源变更（aws_instance 等），未实际调用 Terraform | `PlanService.ts:43-55` |
| 2 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.8 可观测性 (`monitoring/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | Webhook 错误检查被注释 | P2 | `AlertNotificationService.ts:281` 错误处理逻辑被注释 | `AlertNotificationService.ts` |
| 2 | `pruneExpiredMetrics` 未实现 | P2 | 测试注释说明 "not implemented in current version" | — |

### 3.9 SBOM 管理 (`sbom/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **漏洞扫描全 mock** | P0 | `SbomVulnerabilityService.scan()` 返回硬编码 CVE 数据，"Mock vulnerability scan - simulates Grype scan results" | `SbomVulnerabilityService.ts:28-50` |
| 2 | Waiver update 不持久化 | P1 | `update()` 方法不实际更新数据库 | `SbomWaiverService.ts:81` |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.10 通知服务 (`notification/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 3.11 知识库 (`knowledge/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

---

## 四、平台基础设施（Infrastructure）

### 4.1 多租户 (`tenant/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 无重大问题 | — | CRUD、配额管理、命名空间池均已实现 | — |

### 4.2 角色权限 (`role/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少更新角色端点 | P1 | 无 `updateRole` 方法，API 无 PUT 路由 | `role-routes.ts` |
| 2 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.3 会话管理 (`session/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少列出用户会话端点 | P2 | 无法查看用户活跃会话列表 | — |
| 2 | 无刷新 Token 机制 | P1 | 仅 create/verify/revoke/cleanup，无 refresh token | — |

### 4.4 API Key 管理 (`api-key/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少 API 路由文件 | P0 | `api-key-routes.ts` 不存在，API 不可用 | — |
| 2 | 缺少更新/轮换 Key | P1 | 无 rotate 或 update 方法 | — |
| 3 | 缺少按 ID 查询 Key | P2 | 仅支持列出全部，无法按 ID 获取单个 | — |
| 4 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.5 审计日志 (`audit/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | `verifyChain` 返回简化结果 | P2 | 路由层合成 `verifiedCount` 为 0 或 1，非实际计数 | `audit-routes.ts` |
| 2 | 存储统计使用近似计算 | P2 | `storage/stats` 用 `total.total * 1024` 而非实际测量 | `audit-routes.ts` |

### 4.6 策略引擎 (`policy/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **OPA 评估为 Mock 实现** | P0 | `evaluate()` 使用硬编码 mock 逻辑，"Simulate some denial conditions for MVP demo" | `PolicyEvaluationService.ts` |
| 2 | 违规记录仅存内存 | P1 | `PolicyViolation`/`PolicyOverride` 存储在 Map，未持久化 | — |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.7 队列管理 (`queue/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少任务重试机制 | P1 | 失败任务无自动重试逻辑 | `QueueService.ts` |
| 2 | 缺少任务优先级支持 | P1 | 无优先级排序出队 | — |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.8 调度器 (`scheduler/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **Cron 表达式解析未实现** | P0 | `shouldExecuteJob()` 总是返回 true，"简化实现：总是返回 true 用于演示" | `CronSchedulerService.ts` |
| 2 | 使用 setInterval 60s 轮询 | P1 | 非真正的 cron 调度，使用 `setInterval` + 简单检查 | — |
| 3 | `stop()` 方法为 no-op | P1 | 不清理 interval 定时器 | — |
| 4 | OnCall GetCurrentOnCall 回退不当 | P2 | 无覆盖时回退到第一个成员而非基于时间轮换 | — |

### 4.9 Webhook 服务 (`webhook/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **HTTP 投递使用 setTimeout 模拟** | P1 | `trigger()` 使用 `setTimeout(100)` 模拟 HTTP 请求 | `WebhookService.ts` |
| 2 | 缺少投递重试逻辑 | P1 | 投递失败无重试机制 | — |

### 4.10 AI Skill 管理 (`skill/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少删除版本端点 | P2 | 可创建和列出版本但无法删除特定版本 | — |
| 2 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.11 测试选择器 (`test-selector/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | **无持久化层** | P0 | 所有数据（PR 结果、测试历史）存储在内存 Map，重启丢失 | — |
| 2 | 事件订阅为 no-op | P1 | `subscribeToPREvents()` 接收事件但不处理 | — |

### 4.12 产品线管理 (`product-line/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少 ReleaseTrain/HotfixChannel 测试 | P2 | 仅 `ProductLineService.test.ts` 存在 | — |

### 4.13 项目管理 (`project/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少更新项目功能 | P1 | 无 `updateProject` 方法，无 PUT 路由 | — |
| 2 | 数据模型过于简单 | P2 | 仅 name/tenantId/description，无 status/team/metadata | — |
| 3 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.14 制品管理 (`artifact/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 缺少 ArtifactService 测试 | P2 | 仅 `PromotionService.test.ts` 存在 | — |
| 2 | 缺少更新制品功能 | P2 | 无 `updateArtifact` 方法 | — |
| 3 | 路由使用 `(app as any).db` | P2 | 直接访问未类型化的数据库池 | `artifact-routes.ts` |

### 4.15 二方库管理 (`internal-library/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | `deprecateVersion` 不持久化 EOL 数据 | P2 | `eolDate`/`migrationGuide` 传入但不存储 | `InternalLibraryService.ts` |
| 2 | **无测试覆盖** | P2 | 无 `__tests__/` 目录 | — |

### 4.16 CMDB (`cmdb/`)

| # | 缺失功能 | 严重性 | 详细说明 | 文件位置 |
|---|---------|--------|---------|---------|
| 1 | 双重存储（内存 + DB） | P2 | 同时维护 `Map<string, CI>` 和 PostgreSQL 仓库 | — |
| 2 | `cmdbService` 导出为无数据库单例 | P2 | 模块级 `export const cmdbService = new CmdbService()` 无数据库连接 | `cmdb/index.ts` |
| 3 | TopologyService 无 API 路由 | P2 | 服务存在但无对应 HTTP 端点 | `TopologyService.ts` |

---

## 五、跨模块问题

### 5.1 外部系统集成缺失

| # | 缺失集成 | 影响模块 | 严重性 |
|---|---------|---------|--------|
| 1 | K8s API 未接入 | Deploy, Build, Pipeline, Environment, Smart-Deploy | P0 |
| 2 | GitLab/Gerrit API 未接入 | Code-Repo | P0 |
| 3 | GitHub API 适配器缺失 | Code-Repo | P1 |
| 4 | Terraform CLI 未接入 | IaC | P0 |
| 5 | Prometheus 数据源未接入 | Canary-Analysis, Monitoring, Smart-Deploy | P0 |
| 6 | Harbor/Nexus 未接入 | Build, Artifact | P0 |
| 7 | Tekton API 未接入 | Pipeline | P0 |
| 8 | OPA REST API 未接入 | Policy | P0 |
| 9 | Elasticsearch/Loki 未接入 | Build, Monitoring | P1 |
| 10 | 漏洞扫描器 (Grype/Trivy) 未接入 | SBOM | P0 |

### 5.2 测试覆盖缺失

以下 **15 个模块** 无测试文件：

| 模块 | 说明 |
|------|------|
| `deploy/` | 部署服务 |
| `environment/` | 环境管理 |
| `ai/` | AI 服务 |
| `canary-analysis/` | 金丝雀分析 |
| `change-intelligence/` | 变更智能 |
| `iac/` | 基础设施即代码 |
| `knowledge/` | 知识库 |
| `notification/` | 通知服务 |
| `sbom/` | SBOM 管理 |
| `agent/` | AI Agent |
| `role/` | 角色权限 |
| `api-key/` | API Key 管理 |
| `policy/` | 策略引擎 |
| `queue/` | 队列管理 |
| `skill/` | AI Skill |
| `project/` | 项目管理 |
| `internal-library/` | 二方库管理 |

### 5.3 代码质量问题

| # | 问题 | 影响模块 | 说明 |
|---|------|---------|------|
| 1 | 重复方法名 | ConfigService | `getConfig`/`getConfig2`, `deleteConfig`/`deleteConfig2` |
| 2 | 路由无输入验证 | Approval, Artifact | `request.body as any` 无 schema 校验 |
| 3 | 内存 fallback 模式泛滥 | 全局 | 所有模块都有内存 Map fallback |
| 4 | EventBus mockCalls 指标未使用 | EventBus | 初始化但从不递增 |

---

## 六、按优先级汇总

### P0 - Critical（8 项）

1. K8s API 未接入（Deploy/Build/Pipeline/Environment/Smart-Deploy）
2. GitLab/Gerrit API 全部 mock（Code-Repo）
3. Terraform Plan 全 mock（IaC）
4. Prometheus 数据源未接入（Canary-Analysis/Monitoring）
5. 漏洞扫描全 mock（SBOM）
6. OPA 评估为 mock（Policy）
7. Cron 表达式解析未实现（Scheduler）
8. API Key 路由文件缺失

### P1 - High（20 项）

1. Build 执行未接入 Docker
2. 制品上传/下载未接入对象存储
3. 构建日志未接入 ELK
4. 部署无真实流量管理
5. Rollback 不执行真实回滚
6. Git 客户端为 Mock（Config-Mgmt）
7. 配置加密未实现
8. 缺少 GitHub Adapter
9. 分支策略未持久化
10. CodeOwnership 不从 Git 解析
11. 部署无健康检查验证
12. 部署无审批门控集成
13. 环境无自动创建
14. AI API 调用被注释掉
15. Agent run 使用 setTimeout 模拟
16. 审批无委托/升级机制
17. 审批无超时/SLA 跟踪
18. Session 无刷新 Token
19. 策略违规记录仅存内存
20. 队列无重试/优先级

### P2 - Medium（30+ 项）

主要为测试覆盖缺失、分页缺失、数据模型过简等。详见上方各模块详细列表。

---

## 七、建议优先行动

1. **接入 K8s 真实 API** — 解决 Deploy、Build、Pipeline、Smart-Deploy 的 P0 问题
2. **接入 GitLab 真实 API** — 解决 Code-Repo 和 Config-Mgmt 的 P0/P1 问题
3. **补充 15 个模块的测试覆盖** — 确保现有代码不被破坏
4. **实现 Cron 解析库** — 替换 Scheduler 的 mock 实现
5. **接入 Prometheus** — 解决 Canary-Analysis 和 Smart-Deploy 的 mock 问题
6. **创建 API Key 路由** — 使该模块真正可用
