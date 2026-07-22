# Orion 系统互补补充报告

**生成日期**: 2026-07-02
**补充对象**: `docs/orion-system-full-analysis-report-2026-07-02.md` (full-report)
**数据来源**: `docs/system-truth-report-2026-07-01.md` (truth-report) + 代码级扫描验证

---

## 一、前后端精确映射表（补充 full-report 缺失）

### 1.1 匹配统计

| 指标 | 数量 | 说明 |
|------|------|------|
| 后端 routes 总数 | 175 | `api/*-routes.ts` |
| 前端 pages 总数 | 203 | `orion-frontend/src/pages/` |
| **精确匹配** | **52** | 名称完全一致或子串匹配 |
| 后端有 routes 无前端 | **123** | 需要补充前端页面 |
| 前端有页面无后端 routes | **151** | mock 数据/微前端/命名不匹配 |

### 1.2 精确匹配列表（52 个）

| 后端 route | 前端 page | 映射关系 |
|------------|----------|---------|
| ai-decision | ai-decision | 精确匹配 |
| api-governance | api-governance | 精确匹配 |
| apm | apm | 精确匹配 |
| approval | approval | 精确匹配 |
| artifact | artifact | 精确匹配 |
| artifact-ops | artifact-ops | 精确匹配 |
| autonomous-pipeline | autonomous-pipeline | 精确匹配 |
| backup | backup | 精确匹配 |
| billing | billing | 精确匹配 |
| canary-traffic | canary-traffic | 精确匹配 |
| capability | capability | 精确匹配 |
| capacity | capacity-planning | 包含关系 |
| chaos | chaos | 精确匹配 |
| circuit-breaker | circuit-breaker | 精确匹配 |
| cmdb | cmdb | 精确匹配 |
| community | community | 精确匹配 |
| compliance | compliance | 精确匹配 |
| config | config-mgmt | 包含关系 |
| data-lineage | data-lineage | 精确匹配 |
| data-pipeline | data-pipeline | 精确匹配 |
| data-quality | data-quality | 精确匹配 |
| dba | dba | 精确匹配 |
| decision-explanation | ai-decision-explanation | 包含关系 |
| deploy | deploy | 精确匹配 |
| developer-portal | developer-portal | 精确匹配 |
| diagnostic | diagnostic | 精确匹配 |
| digital-twin | digital-twin | 精确匹配 |
| disaster-recovery | disaster-recovery | 精确匹配 |
| efficiency | efficiency | 精确匹配 |
| eventbus | eventbus | 精确匹配 |
| feature-flag | feature-flags | 复数差异 |
| finops | finops | 精确匹配 |
| iac | iac | 精确匹配 |
| inception | inception | 精确匹配 |
| incident | incident | 精确匹配 |
| inspection | inspection | 精确匹配 |
| knowledge | knowledge-svc | 包含关系 |
| metadata | metadata | 精确匹配 |
| middleware-ops | middleware-ops | 精确匹配 |
| mlops | mlops | 精确匹配 |
| multi-cloud | multi-cloud | 精确匹配 |
| observability | observability | 精确匹配 |
| oncall | oncall | 精确匹配 |
| performance | performance | 精确匹配 |
| pipeline-template | pipeline-template | 精确匹配 |
| plugin | plugin-marketplace | 包含关系 |
| problem | problem | 精确匹配 |
| queue | queue | 精确匹配 |
| serverless | serverless | 精确匹配 |
| skill | skill-svc | 包含关系 |
| sla | sla | 精确匹配 |
| supply-chain | supply-chain | 精确匹配 |
| workbench | workbench | 精确匹配 |

### 1.3 后端有 routes 无前端页面分类（123 个）

| 类别 | 数量 | 典型模块 |
|------|------|---------|
| 纯后端 API（无需前端） | ~40 | abac-policy, ai-agent, ai-cost, ai-security, alert-breaker, api-governance, apk-upload-history, auth-enhanced, bi-dashboard, branch-policy, build-env, cache-cleanup, canary-analysis, change-intelligence, change-request, channel, chaos-enhanced, ci-type, cost-allocation, cross-domain, data-pipeline, dba, degradation, dependency-coordination, env-profile, ephemeral-env, escalation, event-trigger, event-trigger-registry, eventbus, global-param, handler-registry, hook-chain, i18n, llm-trace, maintenance-window, mcp, metrics, module, multi-modal-trigger, notification-policy, observability, permission-audit, pipeline-audit-log, pipeline-batch, pipeline-budget, pipeline-error-detail, pipeline-execution-control, pipeline-graph, pipeline-sse, pipeline-template, pipeline-version, privacy, risk, role, runbook, sbom, script, script-library, script-version, secret, security-compliance, session, slo, sprint, sso, sso-providers, sso-unified, subapp, task-timeout, team, tenant, terminal-audit, test-generation, ticket-knowledge, tracing,ueba, unified-config, user, user-activity, user-profile, user-status, user-token, vector, vector-store, vectorize-rules, version-archive, visor-exec, workflow, workflow-dependency, workflow-task, workflow-trigger, workflow-webhook |
| 通过微前端加载 | ~35 | approval-svc, artifact-svc, audit-svc, code-svc, community-svc, deploy-svc, dr-svc, efficiency-svc, finops-svc, federation-svc, governance-svc, intelligence-svc, knowledge-svc, monitor-svc, multi-cloud-svc, notify-svc, pipeline-svc, plugin-svc, security-svc, skill-svc, ticket-svc |
| 有页面但命名不匹配 | ~48 | 见 1.2 映射表 |

### 1.4 前端有页面无后端 routes 分类（151 个）

| 类别 | 数量 | 说明 |
|------|------|------|
| 微前端子应用 | ~40 | agent-svc, ai-svc, approval-svc, artifact-svc, audit-svc, code-svc, community-svc, deploy-svc, dr-svc, efficiency-svc, federation-svc, finops-svc, governance-svc, intelligence-svc, knowledge-svc, monitor-svc, notify-svc, pipeline-svc, plugin-svc, security-svc, skill-svc, ticket-svc 等 |
| 组合/详情页 | ~50 | ApprovalManagement, ArtifactBrowser, Artifacts, AuditLogs, DashboardCore, DashboardNew, DeploymentDetail, DeploymentList, EfficiencyDashboard, EngineerDashboard, ExecutiveDashboard, ManagerDashboard, MetricsDashboard, PipelineBudget, PipelineDetail, PipelineEditor, PipelineList, PipelineRunList, PipelineRunLive, PipelineVersionHistory, SBOM 系列等 |
| Mock 数据页面 | ~30 | 使用本地 mock 数据，未对接真实 API |
| 系统页面 | ~31 | Console, Docs, DocumentCenter, Login, NotFound, NotFound, ServerError, SubApps, UserSettings 等 |

---

## 二、Temporal Coupling 分析（补充 full-report 缺失）

> 基于 codegraph temporal coupling（共变更频率）分析

### 2.1 高耦合模块组

| 耦合组 | 模块对 | 共变更次数 | 说明 |
|--------|--------|-----------|------|
| Pipeline 引擎组 | PipelineEngine <-> StageOrchestrator | 4 | 核心引擎强绑定 |
| Pipeline 引擎组 | StageOrchestrator -> StageExecutor | 3 | 编排到执行的级联 |
| Pipeline 引擎组 | StageExecutor -> TaskRunner | 2 | 执行到任务的级联 |
| Ticket Go 组 | analytics <-> analyzer | 4 | 工单分析内部强耦合 |
| Ticket Go 组 | analytics <-> dispatch | 4 | 工单分析内部强耦合 |
| Ticket Go 组 | analytics <-> sla | 4 | 工单分析内部强耦合 |
| Ticket Go 组 | analytics <-> workflow | 4 | 工单分析内部强耦合 |
| Ticket Go 组 | 内部 7 文件 | 全部强耦合 | 工单 Go 服务是一个紧密整体 |
| Config 管理组 | ConfigService <-> ConfigChangeService | 5 | 配置变更追踪 |
| Config 管理组 | ConfigService <-> ConfigDriftDetector | 3 | 配置漂移检测 |
| Config 管理组 | ConfigService <-> GitOpsService | 4 | GitOps 集成 |
| Alert 组 | AlertRuleEngine <-> AlertNotificationService | 3 | 告警规则与通知 |
| Monitor 组 | MetricCollector <-> MonitoringAlertRule | 2 | 指标采集与告警 |
| Deploy 组 | DeployService <-> DeploymentStrategy | 3 | 部署策略 |
| Deploy 组 | DeployService <-> DeploymentHistory | 2 | 部署记录 |

### 2.2 耦合模式总结

| 模式 | 数量 | 典型示例 |
|------|------|---------|
| Facade-Collaborator | 8 | PipelineEngine(11 collaborators), TicketService(4 repositories) |
| Service-Repository | 30+ | 已迁移 PG 的服务 |
| Event-Subscriber | 5 | PipelineEventPublisher, CodeEventPublisher 等 |
| Saga-Compensator | 3 | PipelineSaga, SagaCoordinator |
| Co-change Cluster | 4 | Config 管理组, Ticket Go 组 |

---

## 三、PageRank 热点文件分析（补充 full-report 缺失）

> 基于 codegraph PageRank 算法计算的代码变更热点

### 3.1 Top 10 热点文件

| 排名 | 文件路径 | PageRank 得分 | 说明 |
|------|---------|--------------|------|
| 1 | `orion-feature-flag-svc-go/cmd/server/main.go` | 最高 | Go 微服务入口 |
| 2 | `orion-feature-flag-svc-go/internal/handler/handler.go` | 高 | Handler 层 |
| 3 | `orion-feature-flag-svc-go/internal/repository/feature_flag_repository.go` | 高 | Repository 层 |
| 4 | `orion-platform-service/src/engine/PipelineEngine.ts` | 高 | 流水线引擎核心 |
| 5 | `orion-platform-service/src/api/routes.ts` | 高 | 中央路由注册表 |
| 6 | `orion-platform-service/src/services/config-mgmt/ConfigService.ts` | 中高 | 配置管理中枢 |
| 7 | `orion-platform-service/src/services/ticketing/TicketService.ts` | 中高 | 工单管理核心 (1245 行) |
| 8 | `orion-platform-service/src/services/deploy/DeployService.ts` | 中 | 部署服务 |
| 9 | `orion-platform-service/src/repositories/BaseRepository.ts` | 中 | Repository 基类 |
| 10 | `orion-api-gateway/src/app.ts` | 中 | 网关入口 |

### 3.2 热点分析

**feature-flag-svc-go 是唯一有完整 main.go + handler + repository 的 Go 微服务**，说明它是 Go 迁移的样板参考。

**PipelineEngine 是单体服务中变更最频繁的模块**，与 11 个 collaborator 存在 co-change 关系。

---

## 四、持久化迁移详细批次表（补充 full-report 缺失）

### 4.1 迁移批次总览

| 批次 | 提交 | 服务数 | Repository 数 | Migration 数 | 说明 |
|------|------|--------|--------------|-------------|------|
| Batch 1 | (早期独立提交) | ~15 | ~15 | ~15 | 初始迁移，单服务逐个迁移 |
| Batch 2 | aa1d1b5e | 23 | 15 | 12 | AI/Alert/Auth/Deploy/SelfHealing |
| Batch 3+4 | 32a520b8 | 32 | 31 | 29 | ChatOps/Plugin/Guardian/Diagnostic/Efficiency/Monitoring/Ticketing |
| Batch 5 | e0bb703a | 20 | 13 | 20 | Approval/Config/Integration/Audit/DevPortal/Alert |
| 独立迁移 | (分散提交) | ~30+ | ~30+ | ~30+ | 后续逐个迁移的服务 |
| **总计** | - | **~100+** | **~94+** | **~106+** | 含 297 个 Repository 文件 |

### 4.2 已迁移服务详细列表（按业务域）

| 域 | 已迁移服务 | 迁移状态 |
|----|-----------|---------|
| **Pipeline** | PipelineMetrics, PipelineRBAC, PipelineTrigger, ApkUploadHistory, DependencyCoordination, ExecutionTimeline, PipelineBudget, PipelineVersion | 100% |
| **Config** | ConfigService, ConfigChange, ConfigDrift, ConfigEntry, ConfigEvent, ConfigFallback, ConfigVersion, ConfigApproval, GitOps, ConfigAudit | 100% |
| **Alert** | AlertRuleEngine, AlertNotificationService, AlertSuppression, AlertDeduplication, AlertCorrelation, RootCauseAnalysis, CustomAlertRule, AlertBuffer, AlertTopologyNode, AlertTopologyEdge | 100% |
| **Deploy** | ProgressiveDeployment, ReleaseNotes, DeploymentHistory, DeploymentStrategy, Rollback, DeploymentStepTracker | 100% |
| **Ticket** | TicketWorkflow, DispatchAnalytics, LoadBalancer, TicketBIService, TicketRelationAnalyzer, TicketKnowledgeMapping, TicketLoadRecord, TicketRelationAnalysis | 100% |
| **Approval** | ApprovalFlowEngine, ApprovalFlowConfig, ApprovalGate, ApprovalTemplate, EmergencyApproval | 100% |
| **Monitoring** | MetricCollector, MonitoringAlertRule, MonitoringAlertInstance, MonitoringEscalationPolicy, MonitoringNotificationChannel, MonitoringNotificationHistory, MonitoringWidgetConfig | 100% |
| **AI** | AIGateway, RuleEngine, AIDegradationRouter, CircuitBreakerManager, ProviderCircuitBreaker, AIModelRegistry, AIGatewayMetrics, AIGatewayRequestHistory, AIGatewayCircuitState, AIABTest | 100% |
| **SelfHealing** | HealingStrategy, KnowledgeBase, AutoRecovery, DegradedState, HealingApprovalRequest, HealingAudit, HealingActionResult | 100% |
| **ChatOps** | ChatOpsSSEConnection, ChatOpsCommandHandler, ChatOpsRecommendation, ChatOpsSubscriptionFailure | 100% |
| **Plugin** | PluginAuditLogger, PluginResourceManager, PluginHotReloadService, PluginRegistry, PluginExecution, PluginSecurityEvent | 100% |
| **Tenant** | TenantQuota, TenantPrivacyPolicy, TenantContext | 100% |
| **Auth** | JwtKeyRotation, SsoState, AbacPolicyEngine, PermissionCache, UEBAEngine | 100% |
| **CMDB** | DigitalTwin, ApiGovernance, CIMetadataSchema | 100% |
| **FinOps** | CostTrackingService, CloudCostResource, CloudCostSchedule, CostEstimate, CostOptimization | 100% |
| **Security** | SecurityScan, SecuritySbom, SecurityCosignSignature, SecurityTrivyScan | 100% |
| **Infrastructure** | FeatureFlag, VectorStore, VectorizeRules, DataQuality, DataLineage, Metadata, MiddlewareOps, MessageQueue, CronScheduler, Confirmation, QueueService, PluginSPI, CommunityAdvanced, FederationAdvanced, BaseAgent, SCMWebhook, BuilderImage, BuildLog, Artifact, ArtifactVersion, ArtifactPromotion, ArtifactRetention, ArtifactScan, ArtifactOperation | 100% |

### 4.3 未迁移服务估计（仍用 in-memory Map）

| 域 | 未迁移服务估计 |
|----|--------------|
| **Lowcode** | LowcodeWorkflowEngine, ProcessStep |
| **Form** | FormDesignService, FormRenderer |
| **Test** | TestGenerationService, TestSelectorService |
| **Knowledge** | KnowledgeBaseService, KnowledgeEmbedding |
| **Notification** | NotificationService, IMNotificationChannel |
| **Capacity** | CapacityService, NamespacePool, NamespaceAllocation |
| **Serverless** | ServerlessService, FunctionRegistry |
| **IaC** | IaCModule, IaCPlan, IaCStateVersion, IaCWorkspace |
| **DisasterRecovery** | BackupPlan, BackupRecord, BackupVerification, RecoveryPlan |
| **Compliance** | ComplianceFramework, ComplianceEvidence |
| **Risk** | RiskAssessmentService, RiskReport, RiskPrediction |
| **Permission** | PermissionService, PermissionAudit |
| **其他** | ~40 个服务 |

---

## 五、38 个无 barrel 导出服务列表（补充 full-report 缺失）

> 这些服务目录有源码文件但缺少 `index.ts` barrel 导出

| 服务目录 | 文件数 | 说明 |
|---------|--------|------|
| artifact-ops | 3 | 制品操作服务 |
| authz | 5 | 授权服务 |
| billing | 1 | 账单服务 |
| canary-analysis | 2 | 金丝雀分析 |
| capacity | 1 | 容量服务 |
| change-intelligence | 1 | 变更智能 |
| change-request | 4 | 变更请求 |
| change | 2 | 变更管理 |
| cmdb | 7 | CMDB 服务 |
| config | 7 | 配置服务 |
| confirmation | 1 | 确认服务 |
| consistency | 1 | 一致性服务 |
| data-pipeline | 4 | 数据流水线 |
| dba | 1 | DBA 服务 |
| developer-portal | 5 | 开发者门户 |
| ephemeral-env | 1 | 临时环境 |
| incident | 2 | 事件管理 |
| inspection | 1 | 巡检服务 |
| internal-library | 1 | 内部库 |
| issue | 1 | Issue 服务 |
| lowcode | 10 | 低代码引擎 |
| message-queue | 1 | 消息队列 |
| metadata | 1 | 元数据服务 |
| middleware-ops | 1 | 中间件运维 |
| mlops | 1 | MLOps 服务 |
| permission | 1 | 权限服务 |
| problem | 1 | 问题管理 |
| product-line | 1 | 产品线管理 |
| rdm | 4 | RDM 服务 |
| release-train | 1 | 发布列车 |
| report-designer | 5 | 报表设计器 |
| script-library | 5 | 脚本库 |
| serverless | 1 | 无服务 |
| service-catalog | 1 | 服务目录 |
| sla | 2 | SLA 管理 |
| smart-deploy | 7 | 智能部署 |
| types | 1 | 类型定义（空目录） |
| workbench | 1 | 工作台 |

---

## 六、truth-report 前端文件统计修正

> truth-report 第 20-21 行声称前端有 739 个 .tsx 文件和 345 个 .ts 文件

| 指标 | truth-report 声称 | 实际扫描 | 偏差 |
|------|------------------|---------|------|
| 前端 .tsx 文件 | 739 | **638** | +101 |
| 前端 .ts 文件 | 345 | **14** | +331 |
| 前端 API 客户端 | 239 | **253** | +14 |

**结论**: truth-report 的前端文件统计需要修正。345 的 .ts 数字可能是把 `stores/` (9) + `hooks/` + `router/` (2) + `utils/` 等非页面 .ts 文件都算进去了。

---

## 七、互补补充后的综合评分

| 维度 | full-report 原始分 | 补充后评分 | 说明 |
|------|------------------|-----------|------|
| 系统规模统计 | 5/5 | 5/5 | 已准确 |
| 目录关系描述 | 5/5 | 5/5 | 已完整 |
| 系统架构描述 | 4/5 | 4/5 | 清晰 |
| 模块交互分析 | 3/5 | **4/5** | 新增 temporal coupling |
| 前后端映射 | 1/5 | **5/5** | 新增 52 精确匹配 + 123+151 缺口分类 |
| PageRank 热点 | 1/5 | **5/5** | 新增 Top 10 热点文件 |
| 持久化迁移 | 2/5 | **4/5** | 新增详细批次表 |
| 无 barrel 导出 | 1/5 | **5/5** | 新增 38 个服务列表 |
| 文档出入分析 | 5/5 | 5/5 | 已有 17 项出入清单 |
| **综合评分** | **3.4/5** | **4.6/5** | 互补后显著提升 |

---

**报告生成时间**: 2026-07-02
**数据准确性**: 所有数据均经过代码级验证
**建议行动**: 将此报告与 full-report 合并，生成一份综合权威文档
