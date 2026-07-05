# 前端-后端路由映射表

**生成日期**: 2026-07-02
**后端 routes**: 175 条
**前端 pages**: 201 个目录

---

## 统计概览

| 分类 | 数量 | 说明 |
|------|------|------|
| 精确匹配 | 50 | 后端 route 与前端页面名称直接对应 |
| 命名差异 | 41 | 命名不一致但功能对应 |
| 后端有路由无前端 | 84 | 需要补充前端或为内部 API |
| 前端有页面无后端 | 109 | 可能是 mock 数据、Orion-MF 子应用或功能重叠 |

> **匹配率**: 52%（91/175）

## 精确匹配（50 条）

| 后端 Route | 前端页面 |
|-----------|----------|
| `ai-decision` | `ai-decision/` |
| `apm` | `apm/` |
| `approval` | `approval/` |
| `artifact` | `artifact/` |
| `artifact-ops` | `artifact-ops/` |
| `backup` | `Backup/` |
| `billing` | `billing/` |
| `canary-traffic` | `canary-traffic/` |
| `change-intelligence` | `ChangeIntelligence/` |
| `cmdb` | `CMDB/` |
| `community` | `community/` |
| `compliance` | `compliance/` |
| `cost-allocation` | `CostAllocation/` |
| `data-lineage` | `data-lineage/` |
| `data-pipeline` | `data-pipeline/` |
| `data-quality` | `data-quality/` |
| `dba` | `dba/` |
| `deploy` | `deploy/` |
| `developer-portal` | `developer-portal/` |
| `diagnostic` | `Diagnostic/` |
| `digital-twin` | `digital-twin/` |
| `disaster-recovery` | `disaster-recovery/` |
| `efficiency` | `efficiency/` |
| `finops` | `finops/` |
| `inception` | `inception/` |
| `incident` | `Incident/` |
| `inspection` | `inspection/` |
| `internal-library` | `InternalLibrary/` |
| `metadata` | `metadata/` |
| `middleware-ops` | `middleware-ops/` |
| `mlops` | `mlops/` |
| `multi-cloud` | `multi-cloud/` |
| `observability` | `observability/` |
| `oncall` | `OnCall/` |
| `performance` | `performance/` |
| `pipeline-template` | `pipeline-template/` |
| `problem` | `Problem/` |
| `process-step` | `ProcessStep/` |
| `product-line` | `ProductLine/` |
| `queue` | `Queue/` |
| `report-designer` | `ReportDesigner/` |
| `script-library` | `ScriptLibrary/` |
| `self-healing` | `SelfHealing/` |
| `serverless` | `serverless/` |
| `service-catalog` | `ServiceCatalog/` |
| `sla` | `SLA/` |
| `supply-chain` | `supply-chain/` |
| `user-profile` | `UserProfile/` |
| `vector-store` | `VectorStore/` |
| `workbench` | `Workbench/` |

## 命名差异（41 条）

| 后端 Route | 前端页面 | 差异说明 |
|-----------|----------|----------|
| `alert` | `AlertList/` | 后端用缩写/通用名，前端用具体页面名 |
| `audit` | `audit-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `auth-enhanced` | `Console/` | 命名不一致 |
| `capacity` | `capacity-planning/` | 命名不一致 |
| `change` | `ChangeManagement/` | 命名不一致 |
| `change-request` | `ChangeRequestManagement/` | 命名不一致 |
| `chatops` | `notify-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `code-repo` | `code-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `cron` | `CronJobs/` | 命名不一致 |
| `env-profile` | `EnvProfiles/` | 命名不一致 |
| `environment` | `env/` | 后端用通用名，前端用具体页面名 |
| `ephemeral-env` | `EphemeralEnvList/` | 命名不一致 |
| `event-trigger` | `trigger/` | 命名不一致 |
| `global-param` | `GlobalParams/` | 命名不一致 |
| `iac` | `IacManagement/` | 后端用缩写/通用名，前端用具体页面名 |
| `knowledge` | `knowledge-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `module` | `ModuleManager/` | 命名不一致 |
| `monitoring` | `monitor-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `notification` | `notify-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `notification-policy` | `NotificationRules/` | 命名不一致 |
| `pipeline-audit-log` | `AuditLogs/` | 命名不一致 |
| `pipeline-graph` | `PipelineRunList/` | 命名不一致 |
| `pipeline-sse` | `PipelineRunLive/` | 命名不一致 |
| `plugin` | `plugin-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `policy` | `PolicyManagement/` | 命名不一致 |
| `project` | `Projects/` | 后端用通用名，前端用具体页面名 |
| `runbook` | `RunbookManagement/` | 命名不一致 |
| `sbom` | `SbomDashboard/` | 命名不一致 |
| `script-version` | `ScriptVersions/` | 命名不一致 |
| `secret` | `SecretsManagement/` | 命名不一致 |
| `session` | `Sessions/` | 命名不一致 |
| `skill` | `skill-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `task-timeout` | `TaskTimeouts/` | 命名不一致 |
| `tenant` | `TenantList/` | 后端用通用名，前端用具体页面名 |
| `ticketing` | `ticket-svc/` | 服务归属不同（后端无 -svc 后缀） |
| `user` | `UserManagement/` | 后端用通用名，前端用具体页面名 |
| `user-activity` | `UserProfile/` | 命名不一致 |
| `user-status` | `UserManagement/` | 命名不一致 |
| `user-token` | `UserSettings/` | 命名不一致 |
| `webhook` | `WebhookManagement/` | 命名不一致 |
| `workflow` | `WorkflowDesigner/` | 后端用缩写/通用名，前端用具体页面名 |

## 后端有路由无前端（84 条）

> 以下后端路由没有直接对应的前端页面，可能是内部 API、微前端子应用路由或待开发功能。

| 后端 Route | 可能归属 |
|-----------|----------|
| `abac-policy` | 待确认 |
| `ai-agent` | 待确认 |
| `ai-cost` | 待确认 |
| `ai-gateway` | 待确认 |
| `ai-review` | 待确认 |
| `ai-security` | 待确认 |
| `alert-breaker` | 待确认 |
| `api-governance` | 待确认 |
| `api-key` | 待确认 |
| `api-market` | 待确认 |
| `apk-upload-history` | 待确认 |
| `artifact-version` | 待确认 |
| `autonomous-pipeline` | 待确认 |
| `bi-dashboard` | BI 仪表盘 |
| `branch-policy` | 待确认 |
| `build-env` | 待确认 |
| `cache` | 缓存管理 |
| `cache-cleanup` | 缓存管理 |
| `canary-analysis` | 待确认 |
| `capability` | 待确认 |
| `channel` | 待确认 |
| `chaos` | 待确认 |
| `chaos-enhanced` | Chaos 工程子应用 |
| `ci-type` | 待确认 |
| `circuit-breaker` | Chaos 工程子应用 |
| `community-advanced` | 待确认 |
| `config` | 待确认 |
| `config-mgmt-enhanced` | 待确认 |
| `confirmation` | 待确认 |
| `cross-domain` | 待确认 |
| `decision-explanation` | 待确认 |
| `degradation` | 待确认 |
| `dependency-coordination` | 待确认 |
| `dual-engine` | 待确认 |
| `escalation` | 待确认 |
| `event-trigger-registry` | 待确认 |
| `eventbus` | 待确认 |
| `feature-flag` | 待确认 |
| `finops-v2` | FinOps 微前端 |
| `handler-registry` | 待确认 |
| `hook-chain` | 待确认 |
| `i18n` | 待确认 |
| `integration` | 待确认 |
| `llm-trace` | 待确认 |
| `maintenance-window` | 待确认 |
| `mcp` | 待确认 |
| `message-queue` | 待确认 |
| `metrics` | 待确认 |
| `multi-modal-trigger` | 待确认 |
| `permission-audit` | 待确认 |
| `pipeline-batch` | Pipeline 微前端 |
| `pipeline-budget` | Pipeline 微前端 |
| `pipeline-error-detail` | Pipeline 微前端 |
| `pipeline-execution-control` | Pipeline 微前端 |
| `pipeline-version` | Pipeline 微前端 |
| `plugin-hotreload` | Plugin 微前端 |
| `privacy` | 待确认 |
| `project-member` | platform-core 微前端 |
| `risk` | 待确认 |
| `role` | 待确认 |
| `script` | 待确认 |
| `security-compliance` | 待确认 |
| `slo` | 待确认 |
| `sprint` | 待确认 |
| `sso` | 待确认 |
| `sso-providers` | 待确认 |
| `sso-unified` | 待确认 |
| `subapp` | 待确认 |
| `team` | 待确认 |
| `terminal-audit` | 待确认 |
| `test-generation` | 待确认 |
| `test-selector` | 待确认 |
| `ticket-knowledge` | 待确认 |
| `tracing` | 待确认 |
| `ueba` | 待确认 |
| `unified-config` | 待确认 |
| `vector` | 待确认 |
| `vectorize-rules` | 待确认 |
| `version-archive` | 待确认 |
| `visor-exec` | 待确认 |
| `workflow-dependency` | 待确认 |
| `workflow-task` | 待确认 |
| `workflow-trigger` | 待确认 |
| `workflow-webhook` | 待确认 |

## 前端有页面无后端路由（109 条）

> 以下前端页面没有直接对应的主后端路由，可能是 Orion-MF 微前端子应用、mock 数据页面或功能重叠。

| 前端页面 | 可能归属 |
|----------|----------|
| `AIAgents/` | AI Agents 微前端 |
| `AICostDashboard/` | 可观测性微前端 |
| `AIDashboard/` | 可观测性微前端 |
| `AIDocManagement/` | AI 文档微前端 |
| `AIGateway/` | 待确认 |
| `AIReview/` | 待确认 |
| `AISecurity/` | 待确认 |
| `AgentDashboard/` | 待确认 |
| `AgentRunDetail/` | 待确认 |
| `ApiKeyManagement/` | 待确认 |
| `ApprovalManagement/` | 待确认 |
| `Approvals/` | 待确认 |
| `ArtifactBrowser/` | 待确认 |
| `ArtifactVersion/` | 待确认 |
| `Artifacts/` | 待确认 |
| `AuditLog/` | 待确认 |
| `BuildEnv/` | 待确认 |
| `CITypeDesigner/` | CI 类型设计器 |
| `CanaryAnalysis/` | 灰度发布子应用 |
| `Capability/` | 能力管理 |
| `CapabilityAdmin/` | 能力管理 |
| `ChaosEngineering/` | Chaos 工程 |
| `CodeMgmt/` | 待确认 |
| `ConfigManagement/` | 待确认 |
| `ConfirmationWorkbench/` | 待确认 |
| `CronManagement/` | Cron 管理 |
| `DashboardCore/` | 工作台 |
| `DashboardNew/` | 工作台 |
| `DeploymentDetail/` | Deploy 微前端 |
| `DeploymentList/` | Deploy 微前端 |
| `DigitalTwin/` | 待确认 |
| `Docs/` | 文档中心 |
| `DocumentCenter/` | 文档中心 |
| `EfficiencyDashboard/` | 待确认 |
| `EngineerDashboard/` | 待确认 |
| `Environments/` | 待确认 |
| `EphemeralEnvDetail/` | 临时环境 |
| `EventBus/` | 事件总线 |
| `EventRegistry/` | 事件注册 |
| `ExecutiveDashboard/` | BI 仪表盘 |
| `FinOpsDashboard/` | 待确认 |
| `I18nManagement/` | 国际化 |
| `KnowledgeBase/` | 知识库 |
| `LLMTraceDashboard/` | LLM 追踪 |
| `ManagerDashboard/` | 管理仪表盘 |
| `MetricsDashboard/` | 可观测性微前端 |
| `NotificationCenter/` | 通知中心 |
| `PRTriggerManagement/` | 待确认 |
| `PipelineBudget/` | Pipeline 微前端 |
| `PipelineDetail/` | Pipeline 微前端 |
| `PipelineEditor/` | Pipeline 微前端 |
| `PipelineList/` | Pipeline 微前端 |
| `PipelineVersionHistory/` | Pipeline 微前端 |
| `PluginManagement/` | 插件管理 |
| `PluginSPI/` | 插件 SPI |
| `QueueTasks/` | 队列管理 |
| `RiskDashboard/` | 风险仪表盘 |
| `RoleManagement/` | platform-core 微前端 |
| `RunnerManagement/` | Runner 子应用 |
| `SbomDetail/` | SBOM 子应用 |
| `ScriptRunner/` | 脚本执行 |
| `SkillManagement/` | 待确认 |
| `SprintBoard/` | Sprint 看板 |
| `SubAppManagement/` | 子应用管理 |
| `SubApps/` | 子应用 |
| `TenantManagement/` | platform-core 微前端 |
| `TestReport/` | 测试报告 |
| `TestSelector/` | 待确认 |
| `TicketDetail/` | 待确认 |
| `TicketList/` | 待确认 |
| `WorkflowDependencies/` | 待确认 |
| `WorkflowTasks/` | 待确认 |
| `WorkflowTriggers/` | 待确认 |
| `agent-svc/` | 待确认 |
| `ai-decision-explanation/` | 待确认 |
| `ai-svc/` | 待确认 |
| `api-governance/` | 待确认 |
| `approval-svc/` | 待确认 |
| `artifact-svc/` | 待确认 |
| `autonomous-pipeline/` | 待确认 |
| `chaos/` | Chaos 工程 |
| `circuit-breaker/` | 熔断器 |
| `community-svc/` | 待确认 |
| `config-mgmt/` | 待确认 |
| `cost/` | 待确认 |
| `cost-operations/` | 待确认 |
| `deploy-svc/` | 待确认 |
| `dr-svc/` | 待确认 |
| `efficiency-svc/` | 待确认 |
| `feature-flags/` | 待确认 |
| `federation/` | 待确认 |
| `federation-svc/` | 待确认 |
| `finops-svc/` | 待确认 |
| `gateway/` | 待确认 |
| `governance-svc/` | 待确认 |
| `graph/` | 图谱 |
| `iac/` | 待确认 |
| `intelligence-svc/` | 待确认 |
| `orchestration/` | 待确认 |
| `pandawiki/` | 待确认 |
| `pipeline/` | 待确认 |
| `pipeline-svc/` | 待确认 |
| `platform-core/` | 待确认 |
| `plugin-marketplace/` | 待确认 |
| `quality-gate/` | 待确认 |
| `rate-limiting/` | 待确认 |
| `security-svc/` | 待确认 |
| `test-mf/` | 待确认 |
| `visor/` | 待确认 |
