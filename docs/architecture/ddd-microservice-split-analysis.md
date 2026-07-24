# Orion 平台基于 DDD 的微服务拆分分析

**分析日期**: 2026-05-09
**分析范围**: orion-platform-service 全量代码
**状态**: 架构分析文档

---

## 一、限界上下文识别 (Bounded Context Identification)

### 1.1 限界上下文全景

通过分析 `src/services/` 下的 98+ 个服务模块、`src/repositories/` 下的 98+ 个仓储、144 个 migration 文件、以及 `src/api/routes.ts` 中的路由注册，识别出以下 **12 个限界上下文**:

| # | 限界上下文 (BC) | 英文标识 | 核心聚合根 | 业务特征 |
|---|---|---|---|---|
| BC-01 | 身份与访问控制 | `iam` | User, Role, Session, Permission | 强一致性、安全敏感、所有服务依赖 |
| BC-02 | 多租户与组织 | `tenant-org` | Tenant, Team, Project, Environment | 读多写少、缓存友好、全局共享 |
| BC-03 | 流水线编排 | `pipeline` | Pipeline, PipelineRun, Stage, Task | 核心域、高频迭代、强一致性 |
| BC-04 | 构建与制品 | `build-artifact` | Build, Artifact, ArtifactVersion, BuilderImage | 大对象存储、生命周期管理 |
| BC-05 | 部署与发布 | `deploy-release` | Deployment, DeploymentStrategy, CanaryAnalysis | 渐进式发布、风险控制 |
| BC-06 | 基础设施与配置 | `infra-config` | CMDB, Config, IaC, Environment, K8s | 配置漂移检测、基础设施即代码 |
| BC-07 | 可观测性 | `observability` | Alert, Monitoring, Metric, Incident, SelfHealing | 写多读少、时序数据、实时性 |
| BC-08 | 安全与合规 | `security-governance` | Policy, SBOM, SecurityScan, AuditLog, Compliance | 写多读少、不可篡改、合规审计 |
| BC-09 | 插件与扩展 | `plugin-ecosystem` | Plugin, PluginMarket, Skill, Webhook, Cron | 事件驱动、扩展点多、社区生态 |
| BC-10 | AI 增强 | `ai-enhancement` | Agent, AgentRun, AIReview, Diagnostic, ChangeIntelligence | GPU 计算、异步处理、模型依赖 |
| BC-11 | 效能与成本 | `efficiency-finops` | CostRecord, DORA, EfficiencyReport, FinOps | 数据聚合、分析报表、ROI |
| BC-12 | 工单与协作 | `ticketing-collab` | Ticket, ChatOps, Notification, Approval, OnCall | 工作流引擎、状态机、通知链 |

### 1.2 服务/模块到限界上下文的映射

基于对 `src/services/` 目录的实际扫描，每个上下文包含的模块如下:

#### BC-01: 身份与访问控制 (iam)
```
services/
  ├── auth/                    # JWT 认证、登录、注册
  ├── user/                    # 用户 CRUD、用户画像
  ├── role/                    # RBAC 角色管理
  ├── session/                 # 会话管理 (SessionRepository)
  ├── api-key/                 # API Key 管理
  └── privacy/                 # 隐私策略
repositories/
  ├── RBACRuleRepository.ts
  ├── BlacklistedTokenRepository.ts
  ├── SecretRepository.ts
migrations/
  ├── 001_create_core_tables.sql        → users, tenants, tenant_users, refresh_tokens
  ├── 002_create_roles_permissions.sql  → roles, permissions, role_permissions, user_roles
  ├── 022_create_api_keys.sql           → api_keys
  ├── 051_create_sessions.sql           → sessions
  ├── 071_create_jwt_key_rotation.sql   → jwt_key_rotation
  ├── 072_create_token_blacklist.sql    → token_blacklist
  ├── 076_create_privacy_policy.sql     → privacy_policies
  ├── 132_create_secrets_table.sql      → secrets
```

#### BC-02: 多租户与组织 (tenant-org)
```
services/
  ├── tenant/                  # 租户 CRUD、隔离策略
  ├── project/                 # 项目管理
  ├── environment/             # 环境管理
  ├── product-line/            # 产品线管理
  └── developer-portal/        # 开发者门户
repositories/
  ├── TenantQuotaRepository.ts
  ├── EnvironmentRepository.ts
  ├── ProductLineRepository.ts
  ├── PortalDocumentRepository.ts
migrations/
  ├── 003_create_projects.sql           → projects, project_members
  ├── 008_create_environments.sql       → environments
  ├── 020_create_tenant_quotas.sql      → tenant_quotas
  ├── 046_create_product_line_tables.sql → product_lines, product_line_branches, product_line_releases
  ├── 088_developer_portal.sql          → portal_documents
  ├── 089_environment_management.sql    → env_templates, env_resources, env_allocations
```

#### BC-03: 流水线编排 (pipeline) — 核心域
```
services/
  ├── pipeline/                # PipelineService, PipelineRunService, PipelineVersionService, PipelineBudgetService, SubPipelineService, ArtifactService(stage间), WebhookNotifier, PipelineExecutionQueue, PipelineMetricsService
  ├── adaptive-pipeline/       # SelfAdaptivePipelineService
  ├── quality-gate/            # 质量门禁
  ├── scheduler/               # 调度器
  └── types/                   # 类型定义
engine/
  ├── PipelineEngine.ts        # 引擎核心
  ├── StageExecutor.ts         # Stage 执行
  ├── TaskRunner.ts            # Task 执行
  ├── ContainerExecutor.ts     # 容器执行
  ├── ExpressionEvaluator.ts   # 表达式求值
  ├── MatrixExpander.ts        # 矩阵展开
  ├── PipelineCheckpointManager.ts
  ├── VariableContext.ts
  ├── WorkspaceIsolator.ts
  └── YamlPreprocessor.ts
saga/
  ├── PipelineSaga.ts          # 流水线 Saga
  ├── SagaCoordinator.ts       # Saga 协调器
  ├── DeploySaga.ts
  └── SelfHealingSaga.ts
events/
  ├── PipelineEventPublisher.ts
  └── types.ts
repositories/ (pipeline 相关)
  ├── (通过 PipelineRepository, PipelineRunRepository 内嵌在 services/pipeline/)
migrations/
  ├── 004_create_pipelines.sql          → pipelines, pipeline_stages, pipeline_tasks
  ├── 005_create_pipeline_runs.sql      → pipeline_runs, pipeline_run_logs, pipeline_run_variables
  ├── 081_create_pipeline_versions.sql  → pipeline_versions, version_tags, version_baseline
  ├── 133_create_pipeline_checkpoints   → pipeline_checkpoints
  ├── 134_create_pipeline_triggers.sql  → pipeline_triggers, trigger_conditions
  ├── 135_create_pipeline_environments  → pipeline_environments
  ├── 136_create_pipeline_webhook       → pipeline_webhook_configs
  ├── 138_create_sub_pipeline_invocations → sub_pipeline_invocations
  ├── 138_create_quality_gates.sql      → quality_gates, quality_gate_results
  ├── 141_create_runner_pool_tables.sql → runners, runner_jobs
```

#### BC-04: 构建与制品 (build-artifact)
```
services/
  ├── build/                   # BuildService, BuildRepository
  ├── artifact/                # ArtifactRegistryService (产物注册)
  ├── artifact-ops/            # ArtifactOperationService (产物操作)
  ├── internal-library/        # InternalLibraryService (二方库)
  ├── sbom/                    # SbomService (SBOM 文档)
  └── code-repo/               # CodeRepoService, WebhookService
repositories/
  ├── ArtifactRepository.ts
  ├── ArtifactVersionRepository.ts
  ├── ArtifactPromotionRepository.ts
  ├── ArtifactRetentionRepository.ts
  ├── ArtifactScanRepository.ts
  ├── ArtifactOperationRepository.ts
  ├── BuildArtifactRepository.ts
  ├── BuildCacheRepository.ts
  ├── BuildLogRepository.ts
  ├── SbomDocumentRepository.ts
  ├── SbomVulnerabilityRepository.ts
  ├── SbomWaiverRepository.ts
  ├── InternalLibraryRepository.ts
  ├── CodeOwnershipRepository.ts
  ├── CodeEmbeddingRepository.ts
models/
  ├── Artifact.ts
  ├── ArtifactVersion.ts
  ├── BuildArtifact.ts
  ├── BuildCache.ts
  ├── BuilderImage.ts
  ├── BuildLog.ts
  ├── InternalLibrary.ts
  ├── SbomDocument.ts
migrations/
  ├── 006_create_builds.sql             → build_pods, build_logs
  ├── 010_create_artifact_registry.sql  → artifact_registry, artifact_versions, artifact_tags, artifact_downloads
  ├── 014_create_artifacts.sql          → artifacts, artifact_metadata, artifact_lifecycle
  ├── 026_create_sbom_tables.sql        → sbom_documents, sbom_components, sbom_vulnerabilities, sbom_licenses, sbom_relationships
  ├── 039_create_build_tables.sql       → builds, build_artifacts, build_stages, build_dependencies, build_pod_templates
  ├── 045_create_sbom_vulnerability_tables → sbom_vulnerability_scans, sbom_vulnerability_fixes
  ├── 046_create_rollback_history.sql   → rollback_history
  ├── 053_create_build_cache_tables.sql → build_caches, cache_keys
  ├── 064_code_ownership.sql            → code_ownership
  ├── 090_artifacts_persistence.sql     → (扩展产物持久化)
  ├── 103_artifact_operations.sql       → artifact_operations, artifact_promotions, artifact_retention_policies
  ├── 116_create_artifact_ops_tables.sql → artifact_scan_results, artifact_signatures, artifact_deployments, artifact_dependencies, artifact_usage_stats, artifact_quality_scores
  ├── 135_create_artifact_version_tracking → artifact_version_tracking
  ├── 143_create_shared_actions.sql     → shared_actions
  ├── 047_create_internal_library_tables → internal_libraries, library_versions, library_dependencies
```

#### BC-05: 部署与发布 (deploy-release)
```
services/
  ├── deploy/                  # DeployService, DeployRepository, ProgressiveDeployRepository, EmergencyDeployRepository, DeployWindowRepository
  ├── smart-deploy/            # SmartDeployService
  ├── canary-analysis/         # CanaryAnalysisService
  ├── canary-traffic/          # CanaryTrafficService
  ├── risk-assessment/         # RiskAssessmentService
  └── disaster-recovery/       # DisasterRecoveryService
repositories/
  ├── DeploymentHistoryRepository.ts
  ├── DeploymentStrategyRepository.ts
  ├── DeploymentStepTrackerRepository.ts
  ├── CanaryAnalysisRepository.ts
  ├── RollbackRepository.ts
  ├── DisasterRecoveryRepository.ts
  ├── RiskAssessmentRepository.ts
  ├── RiskPredictionRepository.ts
  ├── TrafficManagerRepository.ts
models/
  ├── DeploymentStrategy.ts
  ├── CanaryAnalysis.ts
  ├── RiskAssessment.ts
migrations/
  ├── 007_create_deployments.sql        → deployments, deployment_steps
  ├── 018_create_risk.sql               → risk_assessments, risk_predictions
  ├── 075_create_disaster_recovery.sql  → dr_plans, dr_exercises, dr_executions
  ├── 087_deploy_release_enhancement.sql → release_trains, release_candidates, release_signoffs, release_notes
  ├── 098_disaster_recovery.sql         → (扩展灾备)
  ├── 121_create_canary_traffic_tables  → traffic_rules, traffic_splits
  ├── 139_create_deployment_strategies  → deployment_strategies
  ├── 140_create_deployment_step_trackers → deployment_step_trackers, step_transition_logs
  ├── 029_create_canary_analysis_tables → canary_analyses, canary_metrics, canary_promotions, canary_alerts, canary_stages, canary_experiments
```

#### BC-06: 基础设施与配置 (infra-config)
```
services/
  ├── cmdb/                    # CmdbService, CmdbEventPublisher
  ├── config/                  # ConfigService, GitOpsService
  ├── config-mgmt/             # ConfigAuditService
  ├── iac/                     # IaCService, WorkspaceService, PlanService
  ├── multi-cloud/             # MultiCloudService
  ├── federation/              # FederationService
  ├── k8s-provisioner/         # K8sProvisionerService
  ├── namespace-pool/          # NamespacePoolService
  ├── backup/                  # BackupService
  └── ephemeral-env/           # EphemeralEnvService
repositories/
  ├── ConfigRepository.ts
  ├── IaCWorkspaceRepository.ts
  ├── IaCModuleRepository.ts
  ├── IaCPlanRepository.ts
  ├── IaCStateVersionRepository.ts
  ├── NamespacePoolRepository.ts
  ├── NamespaceAllocationRepository.ts
  ├── MultiCloudRepository.ts
  ├── FederationRepository.ts
  ├── K8sProvisionerRepository.ts
  ├── BackupRepository.ts (通过 services/backup/)
  ├── ResourceAbstractionRepository.ts
  ├── BranchPolicyRepository.ts
  ├── ConfigApprovalRepository.ts
models/
  ├── Environment.ts
  ├── EphemeralEnvironment.ts
  ├── IacWorkspace.ts
  ├── DataPipeline.ts
migrations/
  ├── 009_create_code_repositories.sql  → code_repositories, repo_webhooks
  ├── 015_create_backups.sql            → backup_jobs, backup_schedules, backup_storage
  ├── 016_create_configs.sql            → configs, config_versions
  ├── 025_create_ephemeral_env_tables   → ephemeral_envs, env_requests, env_templates, env_access
  ├── 032_create_iac_tables.sql         → iac_workspaces, iac_modules, iac_state_versions, iac_variables
  ├── 042_create_namespace_pools.sql    → namespace_pools
  ├── 044_create_iac_plans.sql          → iac_plans, iac_plan_results
  ├── 060_create_namespace_allocations  → namespace_allocations
  ├── 062_create_branch_policies.sql    → branch_policies
  ├── 063_create_config_change_requests → config_change_requests
  ├── 066_create_ephemeral_environments → ephemeral_environments
  ├── 083_create_chaos_engineering.sql  → chaos_experiments, chaos_schedules, chaos_results
  ├── 100_data_pipeline.sql             → data_pipelines, pipeline_runs, pipeline_connections
  ├── 101_federation.sql                → clusters, cluster_groups, cluster_syncs
  ├── 102_multi_cloud.sql               → cloud_providers, cloud_resources, cloud_costs
  ├── 107_config_management.sql         → config_items, config_relationships, config_snapshots
  ├── 114_phase3_cross_domain_config.sql → cross_domain_configs, domain_bindings, domain_validations, deployment_windows, window_exceptions, approval_templates, approval_instances
  ├── 120_create_resource_abstraction   → resource_definitions, resource_instances
  ├── 123_create_environment_executor   → environment_executors
```

#### BC-07: 可观测性 (observability)
```
services/
  ├── monitoring/              # MonitoringService
  ├── alert/                   # AlertService, CustomAlertRuleService, AlertSilenceService
  ├── self-healing/            # SelfHealingService, SelfHealingRepository
  ├── diagnostic/              # DiagnosticService
  ├── performance/             # PerformanceService
  ├── observability/           # ObservabilityService
  ├── incident/                # IncidentService
  ├── escalation/              # EscalationService
  ├── oncall/                  # OnCallService
  ├── metrics/                 # MetricsService
  └── change-intelligence/     # ChangeIntelligenceService
repositories/
  ├── AlertRuleRepository.ts
  ├── AlertSuppressionRepository.ts
  ├── ChangeIntelligenceRepository.ts
  ├── HealingAuditRepository.ts
  ├── KnownIssueRepository.ts
  ├── MaintenanceWindowRepository.ts
  ├── OnCallScheduleRepository.ts
  ├── OnCallAssignmentRepository.ts
  ├── OnCallOverrideRepository.ts
  ├── PerformanceRepository.ts
  ├── DeploymentHistoryRepository.ts
migrations/
  ├── 012_create_monitoring_alerts.sql  → monitoring_alerts, alert_rules, alert_history
  ├── 035_create_oncall_tables.sql      → oncall_schedules, oncall_rotations, oncall_escalations
  ├── 037_create_alert_suppression.sql  → alert_suppression_rules, suppression_history, suppression_stats
  ├── 049_create_monitoring_rules_channels → monitoring_rules, monitoring_channels, rule_channel_mapping, monitoring_metrics
  ├── 050_create_self_healing_incidents → self_healing_incidents, healing_actions
  ├── 055c_create_self_healing_audit_log → self_healing_audit_log
  ├── 055_create_chatops_phase1a_tables → (部分可观测相关)
  ├── 069_create_incidents.sql          → incidents
  ├── 093_observability_enhancement.sql → custom_alert_rules, rca_reports, silence_rules
  ├── 099_performance_engineering.sql   → performance_benchmarks, performance_regressions, performance_profiles
  ├── 117_create_performance_tables.sql → perf_test_suites, perf_test_runs, perf_test_metrics, perf_alerts
```

#### BC-08: 安全与合规 (security-governance)
```
services/
  ├── security/                # SecurityService, ComplianceFrameworkService
  ├── ai-security/             # AISecurityService
  ├── policy/                  # PolicyService, PolicyEvaluationService
  ├── audit/                   # AuditService, AuditRepository
  ├── api-governance/          # APISpecRegistryService
  ├── supply-chain/            # SupplyChainSecurityService
  └── confirmation/            # ConfirmationService (人工确认)
repositories/
  ├── AuditRepository.ts
  ├── SecurityScanRepository.ts
  ├── PolicyEvaluationRepository.ts
  ├── PolicyViolationRepository.ts
  ├── PolicyOverrideRepository.ts
  ├── ConfirmationRepository.ts
  ├── PluginAuditLogRepository.ts
models/
  ├── PolicyDefinition.ts
  ├── QualityGate.ts
migrations/
  ├── 013_create_audit_logs.sql           → audit_logs
  ├── 027_create_policy_tables.sql        → policy_definitions, policy_rules, policy_evaluations, policy_violations, policy_overrides
  ├── 056_create_confirmation_tables.sql  → confirmations, confirmation_records, confirmation_templates
  ├── 079_create_security_scan.sql        → security_scans, scan_rules, scan_findings
  ├── 097_supply_chain_security.sql       → supply_chain_policies, supply_chain_attestations, supply_chain_verifications
  ├── 108_security_compliance.sql         → compliance_frameworks, compliance_controls, compliance_evidence
  ├── 110_api_governance.sql              → api_specifications, api_validations, api_violations
  ├── 115_create_compliance_and_trigger_tables → compliance_rules, compliance_reports, compliance_alerts + 更多
  ├── 122_create_policy_override_tables   → policy_overrides_extended
  ├── 128_plugin_audit_logs.sql           → plugin_audit_logs
```

#### BC-09: 插件与扩展 (plugin-ecosystem)
```
services/
  ├── plugin/                  # PluginService
  ├── plugin-spi/              # Plugin SPI 框架
  ├── plugin-marketplace/      # PluginMarketplaceService
  ├── plugin-executor-service.ts
  ├── plugin-manager-service.ts
  ├── webhook/                 # WebhookService
  ├── cron/                    # CronService
  ├── skill/                   # SkillService
  ├── notification/            # NotificationService
  ├── multi-modal-trigger/     # UnifiedTriggerService
  ├── queue/                   # QueueService
  └── event-bus/               # EventBusService, EventBusRepository, JetStreamManager
repositories/
  ├── PluginRepository.ts
  ├── PluginExecutionRepository.ts
  ├── NotificationRepository.ts
  ├── NotificationChannelRepository.ts
  ├── NotificationSettingsRepository.ts
  ├── WebhookConfigRepository.ts
  ├── CronJobRepository.ts
  ├── CronExecutionRepository.ts
  ├── SkillRepository.ts
  ├── EventBusRepository.ts
  ├── NatsRegistryRepository.ts
  ├── TriggerRepository.ts
  ├── InlineScriptApprovalRepository.ts
  ├── InlineScriptApprovalRepository.ts
migrations/
  ├── 011_create_plugins.sql              → plugins, plugin_configs, plugin_versions, plugin_bindings
  ├── 017_create_notifications.sql        → notifications, notification_channels, notification_records
  ├── 021_create_webhooks.sql             → webhook_configs, webhook_deliveries
  ├── 030_create_skill_tables.sql         → skills, skill_versions, skill_bindings
  ├── 036_create_cron_tables.sql          → cron_jobs, cron_executions
  ├── 043_create_plugin_executions.sql    → plugin_executions
  ├── 048_create_notification_settings.sql → notification_settings
  ├── 054_create_event_bus_tables.sql     → event_subscriptions, event_logs, event_schemas
  ├── 105_multimodal_trigger.sql          → trigger_sources, trigger_rules, trigger_actions
  ├── 129_inline_script_approvals.sql     → inline_script_approvals, inline_script_logs
  ├── 130_plugin_installations.sql        → plugin_installations, plugin_installation_logs
migrations/ (扩展通知)
  ├── 111_community_advanced.sql          → community extensions
```

#### BC-10: AI 增强 (ai-enhancement)
```
services/
  ├── ai/                      # AIService, AI Gateway
  ├── agent/                   # AgentService
  ├── agent-profile-service.ts # AgentProfileService
  ├── agent-run-service.ts     # AgentRunService
  ├── ai-review/               # AIReviewService
  ├── test-selector/           # TestSelectorService
  ├── test-generation/         # TestGenerationService
  ├── decision-explanation/    # DecisionExplanationService
  ├── model-version/           # ModelVersionService
  ├── llm-trace/               # LLMTraceService
  ├── vector/                  # VectorService (语义搜索)
  └── knowledge/               # KnowledgeService
repositories/
  ├── AgentProfileRepository.ts
  ├── AgentRunRepository.ts
  ├── ModelVersionRepository.ts
  ├── VectorRepository.ts
  ├── KnowledgeEmbeddingRepository.ts
  ├── SecurityScanRepository.ts
models/
  ├── AgentProfile.ts
  ├── AgentRun.ts
  ├── SkillPackage.ts
  ├── TestReport.ts
migrations/
  ├── 023_create_knowledge.sql            → knowledge_articles, knowledge_tags
  ├── 024_create_agent_orchestration_tables → agents, agent_tasks, agent_schedules, agent_executions
  ├── 030_create_skill_tables.sql         → (技能也用于 AI)
  ├── 040_create_diagnostic_tables        → diagnostic_reports, diagnostic_rules, diagnostic_recommendations
  ├── 052_create_knowledge_base.sql       → knowledge_base_articles, knowledge_base_categories, knowledge_base_feedback
  ├── 057_create_vector_store.sql         → vector_store
  ├── 070_create_vector_tables.sql        → vector_embeddings, vector_collections
  ├── 080_create_llm_traces.sql           → llm_traces, llm_spans
  ├── 082_create_ai_model_versions.sql    → ai_models, model_versions, model_performance_metrics
  ├── 091_ai_decision_enhancement.sql     → decision_explanations, decision_contexts, decision_feedback
  ├── 118_create_model_version_tables.sql → (扩展模型版本)
```

#### BC-11: 效能与成本 (efficiency-finops)
```
services/
  ├── efficiency/              # EfficiencyService, DORACalculator, EventHandler
  ├── finops/                  # FinOpsService
  ├── cost/                    # CostService
  ├── cost-tracking/           # CostTrackingService
  ├── ai-cost/                 # AICostService
  └── data-pipeline/           # DataPipelineService (数据管道)
repositories/
  ├── CostRepositories.ts
  ├── PerformanceRepository.ts
migrations/
  ├── 019_create_efficiency.sql           → efficiency_metrics, efficiency_reports
  ├── 031_create_cost_tables.sql          → cost_records, cost_allocations, cost_budgets, cost_alerts
  ├── 053_create_metrics.sql              → metrics
  ├── 061_create_weekly_reports.sql       → weekly_reports
  ├── 067_create_engineer_profiles.sql    → engineer_profiles
  ├── 094_cost_operations.sql             → cost_operations, optimization_recommendations, roi_analyses
  ├── 096_efficiency_operations.sql       → efficiency_dashboards, efficiency_alerts, efficiency_goals
```

#### BC-12: 工单与协作 (ticketing-collab)
```
services/
  ├── ticketing/               # TicketService, TicketingRepository, TicketWorkflowService
  ├── approval/                # ApprovalService, ApprovalRepository, ApprovalTemplateService
  ├── chatops/                 # ChatOpsService (RecommendationService, ExecutionService, CommandService 等)
  └── guardian/                # GuardianService
repositories/
  ├── TicketWorkflowRepository.ts
  ├── ApprovalRepository.ts
  ├── ChatOpsRepository.ts (通过 services/chatops/)
migrations/
  ├── 010_create_approvals.sql            → approvals, approval_steps, approval_records
  ├── 011_create_tickets_healing.sql      → tickets, healing_tickets, ticket_assignments, ticket_comments
  ├── 033_create_chatops_tables.sql       → chatops_channels, chatops_commands, chatops_logs, chatops_bindings
  ├── 038_create_ticket_workflow.sql      → ticket_workflows, ticket_states, ticket_transitions, ticket_automations
  ├── 055_create_chatops_phase1a_tables   → chatop_users, chatop_sessions, chatop_intents, chatop_entities, chatop_conversations, chatop_analytics, chatop_feedback
  ├── 061_create_ticketing_sub_services.sql → auto_dispatch, transfer_records, sla_violations, engineer_ratings, dispatch_queues, dispatch_rules
  ├── 095_approval_workflow.sql           → approval_workflows, approval_templates
  ├── 069_create_incidents.sql            → incidents (跨 BC-07/BC-12)
```

### 1.3 上下文映射 (Context Map)

```
                    ┌─────────────────────┐
                    │    iam (BC-01)      │
                    │  身份与访问控制      │
                    └──────────┬──────────┘
                               │ ACL (防腐层)
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ tenant-org (BC-02)│ │ security-gov (BC-08)│ │ plugin-eco (BC-09)│
│ 多租户与组织      │ │ 安全与合规        │ │ 插件与扩展        │
│                  │ │                  │ │                  │
│ OHS ←───────┐   │ │                  │ │                  │
│             │   │ │   发布审计事件    │ │   订阅系统事件    │
└──────┬──────┘   │ │                  │ │                  │
       │          │ └──────────────────┘ └──────────────────┘
       │ ACL      │         │                      │
       ▼          │         ▼                      │
┌──────────────────┐ │                              │
│ pipeline (BC-03) │ │         ┌────────────────────┘
│ 流水线编排 ★核心 │ │         │
│                  │ │         │
│ 同步调用 →───────┼─┼─────────┼──────────────────────┐
│                  │ │         │                      │
│ 发布事件 ────────┼─┼─────────┼──────────────────────┤
└──────────────────┘ │         │                      │
       │ Events      │         │ Events               │ Events
       ▼             ▼         ▼                      ▼
┌─────────────┐ ┌──────────┐ ┌─────────────┐  ┌──────────────┐
│build-artifact│ │deploy-   │ │observability│  │ai-enhancement│
│ (BC-04)     │ │ release  │ │  (BC-07)    │  │   (BC-10)    │
│ 构建与制品   │ │(BC-05)   │ │ 可观测性    │  │ AI 增强      │
└─────────────┘ │ 部署发布  │ └──────┬──────┘  └──────────────┘
                └──────────┘         │
                       │             │
                       ▼             ▼
                ┌─────────────┐ ┌──────────────┐
                │infra-config │ │efficiency-   │
                │  (BC-06)    │ │ finops(BC-11)│
                │ 基础设施配置 │ │ 效能与成本   │
                └─────────────┘ └──────┬───────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │ticketing-    │
                               │ collab(BC-12)│
                               │ 工单与协作    │
                               └──────────────┘
```

**上下文关系类型**:

| 上游上下文 | 下游上下文 | 关系类型 | 通信方式 |
|---|---|---|---|
| iam | 所有上下文 | ACL (防腐层) | 同步 REST (权限验证) |
| tenant-org | 所有上下文 | OHS (公开主机服务) | 同步 REST (租户/团队信息) |
| pipeline | build-artifact | Partnership | 同步调用 (产物引用) |
| pipeline | deploy-release | 下游消费者 | 同步调用 + 事件 |
| pipeline | observability | 发布-订阅 | 异步事件 (pipeline.*) |
| pipeline | ai-enhancement | 发布-订阅 | 异步事件 |
| pipeline | efficiency-finops | 发布-订阅 | 异步事件 |
| pipeline | ticketing-collab | 发布-订阅 | 异步事件 |
| build-artifact | security-governance | 下游消费者 | 事件 (artifact.created → SBOM 扫描) |
| deploy-release | observability | Partnership | 同步 + 事件 |
| deploy-release | infra-config | 下游消费者 | 同步 REST |
| observability | ticketing-collab | 下游消费者 | 事件 (incident.detected → 创建工单) |
| observability | ai-enhancement | 下游消费者 | 事件 (alert.triggered → 诊断) |
| ai-enhancement | efficiency-finops | 发布-订阅 | 事件 (ai.analysis.completed) |
| security-governance | 所有上下文 | 发布-订阅 | 事件 (audit.*, policy.violated) |
| plugin-ecosystem | 所有上下文 | OHS | 事件订阅 + Webhook |

---

## 二、当前耦合度分析 (Current Coupling Analysis)

### 2.1 服务间调用分析

通过分析源码中的 import 语句，识别出以下主要跨服务调用模式:

#### 2.1.1 全局共享服务调用

| 被调用服务 | 调用方数量 | 调用模式 | 问题 |
|---|---|---|---|
| `EventBusService` | 15+ 个服务 | 直接 import `../event-bus-service` | 所有服务依赖同一 EventBus 实例 |
| `DatabasePool` | 50+ 个服务 | 直接 import `../database` | 共享同一数据库连接池 |
| `TenantIsolationService` | 全局中间件 | 在 routes.ts 中全局注册 | 所有路由共享租户隔离逻辑 |

#### 2.1.2 具体跨服务调用链路

```
PipelineEngine (engine/)
  └── 直接依赖 → PipelineService, PipelineRunService (services/pipeline/)
  └── 直接依赖 → StageExecutor (engine/)
  └── 直接依赖 → PipelineEventPublisher (events/)
  └── 注入依赖 → subPipelineService, artifactService, approvalGateService (undefined = 未配置)

SubPipelineService (services/pipeline/)
  └── 直接依赖 → PipelineService (services/pipeline/)

CanaryAnalysisService (services/canary-analysis/)
  └── 直接依赖 → EventBusService (services/event-bus-service)

ChatOps EventSubscriber (services/chatops/)
  └── 直接依赖 → EventBusService (services/event-bus-service)

IaC WorkspaceService (services/iac/)
  └── 直接依赖 → EventBusService (services/event-bus-service)

ChangeIntelligenceService (services/change-intelligence/)
  └── 直接依赖 → EventBusService (services/event-bus-service)

CmdbEventPublisher (services/cmdb/)
  └── 直接依赖 → EventBusService + DatabasePool

AIReviewService (services/ai-review/)
  └── 直接依赖 → EventBusService (any 类型)

PolicyEvaluationService (services/policy/)
  └── 直接依赖 → EventBusService

PluginManagerService (services/plugin-manager-service.ts)
  └── 直接依赖 → EventBusService

EphemeralEnvService (services/ephemeral-env-service.ts)
  └── 直接依赖 → EventBusService
```

#### 2.1.3 进程内调用分析

当前所有服务间调用都是 **进程内函数调用**（同一 Node.js 进程），不存在网络开销。这在微服务拆分后将变为网络调用，需要特别关注:

| 调用类型 | 当前模式 | 拆分后变化 |
|---|---|---|
| Controller → Service | 进程内 | 不变（同服务内） |
| Service → Repository → DB | 进程内 + 网络(到 DB) | 不变 |
| Service A → Service B (同 BC) | 进程内 | 不变（同微服务内） |
| Service A → Service B (跨 BC) | 进程内 | **变为网络调用 (REST/事件)** |
| Engine → Service | 进程内 | **变为网络调用** |
| EventPublisher → EventBus | 进程内 EventEmitter | **变为 NATS 网络调用** |

### 2.2 数据库耦合分析

#### 2.2.1 当前数据库状态

- **单一 PostgreSQL 数据库**: `orion_platform`
- **144 个 migration 文件** (001-144，含 rollback 后实际 70+ 个独立迁移)
- **366 次 CREATE TABLE** 语句（含部分迁移文件创建多张表）
- **估算约 120+ 张业务表**（考虑 ALTER TABLE 扩展）

#### 2.2.2 跨上下文表关联

当前所有表在同一个数据库中，存在以下跨域外键/引用关系:

| 源表 | 目标表 | 关联类型 | 跨 BC |
|---|---|---|---|
| pipeline_runs → pipelines | FK | 同 BC-03 |
| pipeline_runs → environments | 隐式引用 | BC-03 → BC-02 |
| deployments → pipelines | 隐式引用 | BC-05 → BC-03 |
| deployments → environments | 隐式引用 | BC-05 → BC-02 |
| tickets → users | 隐式引用 | BC-12 → BC-01 |
| audit_logs → users | 隐式引用 | BC-08 → BC-01 |
| tenant_users → tenants, users | FK | BC-02 → BC-01 |
| user_roles → users, roles | FK | BC-01 内部 |
| cost_records → projects | 隐式引用 | BC-11 → BC-02 |
| self_healing_incidents → tickets | 隐式引用 | BC-07 → BC-12 |
| plugin_executions → plugins | 隐式引用 | BC-09 内部 |
| canary_analyses → deployments | 隐式引用 | BC-05 内部 |
| approval_records → users | 隐式引用 | BC-12 → BC-01 |

#### 2.2.3 数据库表按限界上下文分类

| BC | 核心表 | 扩展表 | 预估总表数 |
|---|---|---|---|
| BC-01 iam | users, roles, permissions, role_permissions, user_roles, sessions, api_keys, refresh_tokens, jwt_key_rotation, token_blacklist, privacy_policies, secrets | tenant_users | ~12 |
| BC-02 tenant-org | tenants, tenant_quotas, projects, project_members, environments, product_lines, product_line_branches, product_line_releases, portal_documents, env_templates, env_resources | tenant_configs | ~12 |
| BC-03 pipeline | pipelines, pipeline_stages, pipeline_tasks, pipeline_runs, pipeline_run_logs, pipeline_run_variables, pipeline_versions, version_tags, version_baseline, pipeline_checkpoints, pipeline_triggers, trigger_conditions, pipeline_environments, pipeline_webhook_configs, sub_pipeline_invocations, quality_gates, quality_gate_results, runners, runner_jobs | pipeline_metrics | ~18 |
| BC-04 build-artifact | builds, build_pods, build_logs, artifact_registry, artifact_versions, artifact_tags, artifact_downloads, artifacts, artifact_metadata, artifact_lifecycle, sbom_documents, sbom_components, sbom_vulnerabilities, build_artifacts, build_stages, build_dependencies, build_caches, cache_keys, code_ownership, artifact_operations, artifact_promotions, artifact_scan_results, artifact_signatures, artifact_deployments, artifact_dependencies, artifact_usage_stats, artifact_quality_scores, artifact_version_tracking, shared_actions, internal_libraries, library_versions, library_dependencies | build_pod_templates | ~30 |
| BC-05 deploy-release | deployments, deployment_steps, risk_assessments, risk_predictions, dr_plans, dr_exercises, dr_executions, release_trains, release_candidates, release_signoffs, release_notes, canary_analyses, canary_metrics, canary_promotions, canary_alerts, canary_stages, canary_experiments, traffic_rules, traffic_splits, deployment_strategies, deployment_step_trackers, step_transition_logs | rollback_history | ~22 |
| BC-06 infra-config | code_repositories, repo_webhooks, backup_jobs, backup_schedules, backup_storage, configs, config_versions, ephemeral_envs, env_requests, env_access, iac_workspaces, iac_modules, iac_state_versions, iac_variables, iac_plans, iac_plan_results, namespace_pools, namespace_allocations, branch_policies, config_change_requests, ephemeral_environments, chaos_experiments, chaos_schedules, chaos_results, data_pipelines, pipeline_runs, pipeline_connections, clusters, cluster_groups, cluster_syncs, cloud_providers, cloud_resources, cloud_costs, config_items, config_relationships, config_snapshots, cross_domain_configs, domain_bindings, resource_definitions, resource_instances, environment_executors, approval_templates, approval_instances | iac_templates | ~40 |
| BC-07 observability | monitoring_alerts, alert_rules, alert_history, oncall_schedules, oncall_rotations, oncall_escalations, alert_suppression_rules, suppression_history, monitoring_rules, monitoring_channels, monitoring_metrics, self_healing_incidents, healing_actions, self_healing_audit_log, incidents, custom_alert_rules, rca_reports, silence_rules, performance_benchmarks, performance_regressions, perf_test_suites, perf_test_runs, perf_test_metrics, perf_alerts, healing_triggers | alert_analytics | ~25 |
| BC-08 security-governance | audit_logs, policy_definitions, policy_rules, policy_evaluations, policy_violations, policy_overrides, confirmations, confirmation_records, confirmation_templates, security_scans, scan_rules, scan_findings, supply_chain_policies, supply_chain_attestations, supply_chain_verifications, compliance_frameworks, compliance_controls, compliance_evidence, api_specifications, api_validations, api_violations, compliance_rules, compliance_reports, compliance_alerts, plugin_audit_logs, inline_script_approvals, inline_script_logs | audit_sequences | ~28 |
| BC-09 plugin-ecosystem | plugins, plugin_configs, plugin_versions, plugin_bindings, notifications, notification_channels, notification_records, webhook_configs, webhook_deliveries, skills, skill_versions, skill_bindings, cron_jobs, cron_executions, plugin_executions, notification_settings, event_subscriptions, event_logs, event_schemas, trigger_sources, trigger_rules, trigger_actions, plugin_installations | plugin_marketplace | ~22 |
| BC-10 ai-enhancement | knowledge_articles, knowledge_tags, agents, agent_tasks, agent_schedules, agent_executions, diagnostic_reports, diagnostic_rules, diagnostic_recommendations, knowledge_base_articles, knowledge_base_categories, knowledge_base_feedback, vector_store, vector_embeddings, vector_collections, llm_traces, llm_spans, ai_models, model_versions, model_performance_metrics, decision_explanations, decision_contexts, decision_feedback, test_reports | agent_profiles | ~24 |
| BC-11 efficiency-finops | efficiency_metrics, efficiency_reports, cost_records, cost_allocations, cost_budgets, cost_alerts, metrics, weekly_reports, engineer_profiles, cost_operations, optimization_recommendations, roi_analyses, efficiency_dashboards, efficiency_alerts, efficiency_goals | | ~15 |
| BC-12 ticketing-collab | approvals, approval_steps, approval_records, tickets, healing_tickets, ticket_assignments, ticket_comments, chatops_channels, chatops_commands, chatops_logs, chatops_bindings, ticket_workflows, ticket_states, ticket_transitions, ticket_automations, chatop_users, chatop_sessions, chatop_intents, chatop_conversations, chatop_analytics, chatop_feedback, auto_dispatch, transfer_records, sla_violations, engineer_ratings, dispatch_queues, dispatch_rules, approval_workflows, approval_templates, incidents | chatop_entities | ~30 |

### 2.3 关键耦合点总结

| # | 耦合点 | 影响范围 | 严重程度 |
|---|---|---|---|
| 1 | 共享 `DatabasePool` | 全部 98+ 服务 | 致命 — 拆分需要数据层分离 |
| 2 | 共享 `EventBusService` (内存 EventEmitter) | 15+ 服务 | 高 — 需要替换为 NATS |
| 3 | `routes.ts` 集中注册所有路由 | 48+ 路由模块 | 高 — 需要按服务拆分路由注册 |
| 4 | `PipelineEngine` 直接注入多个 Service | 引擎核心 | 高 — 引擎独立拆分 |
| 5 | `tenant-isolation` 全局中间件 | 全部路由 | 中 — 各服务需要独立租户隔离 |
| 6 | `ModuleManager` 统一管理模块生命周期 | 全部域模块 | 中 — 各服务独立生命周期 |
| 7 | 跨 BC 直接 import Service | 多处 | 高 — 需要改为 API/事件调用 |

---

## 三、提议的微服务拆分方案 (Proposed Service Split)

### 3.1 拆分总览

基于 DDD 限界上下文分析，提议将 `orion-platform-service` 拆分为 **8 个独立微服务**:

| # | 微服务名称 | 包含 BC | 核心职责 | 端口 | 团队 |
|---|---|---|---|---|---|
| 1 | `orion-iam-service` | BC-01 | 身份认证、RBAC、会话管理、API Key | 3010 | 平台基础团队 |
| 2 | `orion-tenant-service` | BC-02 | 租户、项目、环境、产品线 | 3020 | 平台基础团队 |
| 3 | `orion-pipeline-service` | BC-03 | 流水线编排引擎、执行调度 | 3030 | Pipeline 团队 |
| 4 | `orion-delivery-service` | BC-04 + BC-05 | 构建、制品、部署、金丝雀 | 3040 | 交付团队 |
| 5 | `orion-infra-service` | BC-06 | CMDB、配置管理、IaC、备份 | 3050 | SRE 团队 |
| 6 | `orion-observability-service` | BC-07 + BC-08 | 监控、告警、自愈、安全合规、审计 | 3060 | SRE + 安全团队 |
| 7 | `orion-ai-service` | BC-10 | AI Agent、LLM Trace、AI Review、向量 | 3070 | AI 团队 |
| 8 | `orion-collab-service` | BC-09 + BC-11 + BC-12 | 插件、通知、工单、审批、效能、FinOps | 3080 | 协作团队 |

### 3.2 每个微服务的详细设计

#### 服务 1: orion-iam-service (身份与访问控制)

**职责**: 平台统一身份认证中心，所有其他服务的认证依赖。

**包含模块**:
```
src/services/auth/
src/services/user/
src/services/role/
src/services/session/
src/services/api-key/
src/services/privacy/
src/repositories/RBACRuleRepository.ts
src/repositories/BlacklistedTokenRepository.ts
src/repositories/SecretRepository.ts
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `users` | 用户基础信息 |
| `roles` | 角色定义 |
| `permissions` | 权限定义 |
| `role_permissions` | 角色权限关联 |
| `user_roles` | 用户角色关联 |
| `sessions` | 用户会话 |
| `api_keys` | API Key |
| `refresh_tokens` | 刷新令牌 |
| `jwt_key_rotation` | JWT 密钥轮换 |
| `token_blacklist` | 令牌黑名单 |
| `privacy_policies` | 隐私策略 |
| `secrets` | 密钥存储 |

**API 端点**:
| 路径 | 方法 | 功能 |
|---|---|---|
| `/api/v1/users` | CRUD | 用户管理 |
| `/api/v1/users/{id}/login` | POST | 登录 |
| `/api/v1/roles` | CRUD | 角色管理 |
| `/api/v1/permissions/evaluate` | POST | 权限评估 |
| `/api/v1/sessions` | GET/DELETE | 会话管理 |
| `/api/v1/api-keys` | CRUD | API Key 管理 |

**通信协议**:
- 所有其他服务 **同步调用** iam-service 进行权限验证 (通过 API Gateway 前置过滤器)
- 用户创建/删除 → 发布 `user.*` 事件到 NATS

---

#### 服务 2: orion-tenant-service (多租户与组织)

**职责**: 租户生命周期管理、组织架构、环境管理。

**包含模块**:
```
src/services/tenant/
src/services/project/
src/services/environment/
src/services/product-line/
src/services/developer-portal/
src/repositories/TenantQuotaRepository.ts
src/repositories/EnvironmentRepository.ts
src/repositories/ProductLineRepository.ts
src/repositories/PortalDocumentRepository.ts
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `tenants` | 租户元数据 |
| `tenant_quotas` | 租户配额 |
| `projects` | 项目 |
| `project_members` | 项目成员 |
| `environments` | 环境 |
| `product_lines` | 产品线 |
| `product_line_branches` | 产品线分支 |
| `product_line_releases` | 产品线发布 |
| `portal_documents` | 开发者门户文档 |
| `env_templates` | 环境模板 |
| `env_resources` | 环境资源 |
| `env_allocations` | 环境分配 |

**API 端点**:
| 路径 | 方法 | 功能 |
|---|---|---|
| `/api/v1/tenants` | CRUD | 租户管理 |
| `/api/v1/projects` | CRUD | 项目管理 |
| `/api/v1/environments` | CRUD | 环境管理 |
| `/api/v1/product-lines` | CRUD | 产品线管理 |

**通信协议**:
- → iam-service: 同步 REST (权限验证)
- → 其他服务: 发布 `tenant.*`, `project.*`, `environment.*` 事件

---

#### 服务 3: orion-pipeline-service (流水线编排) — 核心域

**职责**: 流水线定义、编排、执行引擎。这是 Orion 平台的核心竞争力。

**包含模块**:
```
src/services/pipeline/ (全部)
src/services/adaptive-pipeline/
src/services/quality-gate/
src/services/scheduler/
src/engine/ (全部: PipelineEngine, StageExecutor, TaskRunner 等)
src/saga/ (PipelineSaga, SagaCoordinator)
src/events/PipelineEventPublisher.ts
src/events/types.ts
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `pipelines` | 流水线定义 |
| `pipeline_stages` | Stage 定义 |
| `pipeline_tasks` | Task 定义 |
| `pipeline_runs` | 执行记录 |
| `pipeline_run_logs` | 执行日志 |
| `pipeline_run_variables` | 执行变量 |
| `pipeline_versions` | 流水线版本 |
| `version_tags` | 版本标签 |
| `version_baseline` | 基线版本 |
| `pipeline_checkpoints` | 检查点 |
| `pipeline_triggers` | 触发器 |
| `trigger_conditions` | 触发条件 |
| `pipeline_environments` | 流水线环境 |
| `pipeline_webhook_configs` | Webhook 配置 |
| `sub_pipeline_invocations` | 子流水线调用 |
| `quality_gates` | 质量门禁 |
| `quality_gate_results` | 门禁结果 |
| `runners` | 执行器 |
| `runner_jobs` | 执行任务 |

**API 端点**:
| 路径 | 方法 | 功能 |
|---|---|---|
| `/api/v1/pipelines` | CRUD | 流水线管理 |
| `/api/v1/pipelines/{id}/run` | POST | 触发执行 |
| `/api/v1/pipelines/{id}/runs` | LIST | 执行历史 |
| `/api/v1/pipelines/{id}/runs/{runId}` | GET | 执行详情 |
| `/api/v1/pipelines/{id}/versions` | CRUD | 版本管理 |
| `/api/v1/pipeline-templates` | CRUD | 模板管理 |
| `/api/v1/pipeline/metrics` | GET | 指标看板 |
| `/api/v1/pipeline/queue` | GET | 队列状态 |

**通信协议**:
- → iam-service: 同步 REST (权限)
- → tenant-service: 同步 REST (租户/项目验证)
- → delivery-service: 同步 REST (构建产物获取) + 事件 (触发构建)
- → infra-service: 同步 REST (K8s 资源)
- 发布事件: `pipeline.run.*`, `pipeline.stage.*`, `pipeline.task.*`

---

#### 服务 4: orion-delivery-service (构建与交付)

**职责**: 代码构建、制品管理、部署发布、金丝雀分析。

**包含模块**:
```
src/services/build/
src/services/artifact/
src/services/artifact-ops/
src/services/internal-library/
src/services/sbom/
src/services/code-repo/
src/services/deploy/
src/services/smart-deploy/
src/services/canary-analysis/
src/services/canary-traffic/
src/services/disaster-recovery/ (部分)
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `builds`, `build_pods`, `build_logs` | 构建 |
| `build_artifacts`, `build_stages`, `build_dependencies` | 构建详情 |
| `build_caches`, `cache_keys` | 构建缓存 |
| `artifact_registry`, `artifact_versions`, `artifact_tags` | 制品注册 |
| `artifacts`, `artifact_metadata`, `artifact_lifecycle` | 制品管理 |
| `artifact_operations`, `artifact_promotions` | 制品操作 |
| `artifact_scan_results`, `artifact_signatures` | 制品扫描 |
| `artifact_version_tracking` | 版本追踪 |
| `sbom_documents`, `sbom_components`, `sbom_vulnerabilities` | SBOM |
| `internal_libraries`, `library_versions`, `library_dependencies` | 二方库 |
| `code_repositories`, `repo_webhooks` | 代码仓库 |
| `code_ownership` | 代码归属 |
| `deployments`, `deployment_steps` | 部署 |
| `deployment_strategies`, `deployment_step_trackers` | 部署策略 |
| `canary_analyses`, `canary_metrics`, `canary_promotions` | 金丝雀 |
| `canary_stages`, `canary_experiments`, `canary_alerts` | 金丝雀实验 |
| `traffic_rules`, `traffic_splits` | 流量管理 |
| `release_trains`, `release_candidates` | 发布列车 |
| `dr_plans`, `dr_exercises`, `dr_executions` | 灾备 |
| `shared_actions` | 共享动作 |

**通信协议**:
- → iam-service: 同步 REST
- → tenant-service: 同步 REST (环境验证)
- → pipeline-service: 事件订阅 (pipeline.run.completed → 触发部署)
- → observability-service: 事件 (deployment.started, deployment.completed)
- → infra-service: 同步 REST (K8s 部署)

---

#### 服务 5: orion-infra-service (基础设施)

**职责**: CMDB、配置管理、IaC、备份恢复、多集群管理。

**包含模块**:
```
src/services/cmdb/
src/services/config/
src/services/config-mgmt/
src/services/iac/
src/services/backup/
src/services/ephemeral-env/
src/services/multi-cloud/
src/services/federation/
src/services/k8s-provisioner/
src/services/namespace-pool/
src/services/data-pipeline/
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `configs`, `config_versions` | 配置管理 |
| `config_items`, `config_relationships`, `config_snapshots` | 配置项 |
| `config_change_requests` | 配置变更 |
| `iac_workspaces`, `iac_modules`, `iac_state_versions` | IaC 状态 |
| `iac_plans`, `iac_plan_results` | IaC 计划 |
| `iac_variables` | IaC 变量 |
| `backup_jobs`, `backup_schedules`, `backup_storage` | 备份 |
| `ephemeral_envs`, `ephemeral_environments` | 临时环境 |
| `namespace_pools`, `namespace_allocations` | 命名空间池 |
| `clusters`, `cluster_groups`, `cluster_syncs` | 集群联邦 |
| `cloud_providers`, `cloud_resources`, `cloud_costs` | 多云管理 |
| `chaos_experiments`, `chaos_schedules`, `chaos_results` | 混沌工程 |
| `data_pipelines`, `pipeline_connections` | 数据管道 |
| `resource_definitions`, `resource_instances` | 资源抽象 |
| `cross_domain_configs`, `domain_bindings` | 跨域配置 |

**通信协议**:
- → iam-service: 同步 REST
- → tenant-service: 同步 REST
- → pipeline-service: 同步 REST (K8s 资源供给)
- → observability-service: 事件 (infrastructure.changed)

---

#### 服务 6: orion-observability-service (可观测性与安全)

**职责**: 监控告警、自愈、安全合规、审计日志、OnCall 排班。

**包含模块**:
```
src/services/monitoring/
src/services/alert/
src/services/self-healing/
src/services/diagnostic/
src/services/incident/
src/services/escalation/
src/services/oncall/
src/services/performance/
src/services/observability/
src/services/security/
src/services/ai-security/
src/services/policy/
src/services/audit/
src/services/api-governance/
src/services/confirmation/
src/services/change-intelligence/ (部分 - 可观测部分)
src/services/risk-assessment/
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `monitoring_alerts`, `alert_rules`, `alert_history` | 监控告警 |
| `monitoring_rules`, `monitoring_channels`, `monitoring_metrics` | 监控规则 |
| `alert_suppression_rules`, `suppression_history` | 告警抑制 |
| `custom_alert_rules`, `rca_reports`, `silence_rules` | 可观测增强 |
| `self_healing_incidents`, `healing_actions` | 自愈 |
| `self_healing_audit_log`, `healing_triggers` | 自愈审计 |
| `incidents` | 故障管理 |
| `oncall_schedules`, `oncall_rotations`, `oncall_escalations` | OnCall |
| `diagnostic_reports`, `diagnostic_rules` | 诊断 |
| `performance_benchmarks`, `perf_test_runs` | 性能 |
| `audit_logs` | 审计日志 (大表，按月分区) |
| `policy_definitions`, `policy_rules`, `policy_evaluations` | 策略 |
| `security_scans`, `scan_rules`, `scan_findings` | 安全扫描 |
| `compliance_frameworks`, `compliance_reports` | 合规 |
| `supply_chain_policies`, `supply_chain_attestations` | 供应链安全 |
| `api_specifications`, `api_validations` | API 治理 |
| `confirmations`, `confirmation_records` | 人工确认 |
| `risk_assessments`, `risk_predictions` | 风险评估 |
| `plugin_audit_logs` | 插件审计 |

**通信协议**:
- → iam-service: 同步 REST
- → tenant-service: 同步 REST
- 事件订阅: `pipeline.*`, `deployment.*`, `infrastructure.*`
- 发布事件: `alert.triggered`, `incident.detected`, `audit.*`, `policy.violated`

---

#### 服务 7: orion-ai-service (AI 增强)

**职责**: AI Agent 编排、LLM Trace、AI Code Review、智能测试选择、向量搜索。

**包含模块**:
```
src/services/ai/
src/services/agent/
src/services/ai-review/
src/services/test-selector/
src/services/test-generation/
src/services/llm-trace/
src/services/model-version/
src/services/decision-explanation/
src/services/knowledge/ (部分)
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `agents`, `agent_tasks`, `agent_schedules`, `agent_executions` | Agent 编排 |
| `ai_models`, `model_versions`, `model_performance_metrics` | AI 模型 |
| `llm_traces`, `llm_spans` | LLM 调用链 |
| `diagnostic_reports`, `diagnostic_recommendations` | 诊断报告 |
| `decision_explanations`, `decision_contexts`, `decision_feedback` | 决策解释 |
| `test_reports` | 测试报告 |
| `vector_store`, `vector_embeddings`, `vector_collections` | 向量存储 |
| `knowledge_articles`, `knowledge_tags` | 知识文章 |

**通信协议**:
- → iam-service: 同步 REST
- 事件订阅: `pipeline.run.completed`, `code.pr.opened`, `alert.triggered`
- 发布事件: `ai.review.completed`, `ai.analysis.completed`, `diagnostic.completed`

---

#### 服务 8: orion-collab-service (协作与效能)

**职责**: 插件生态、通知协作、工单审批、效能分析、FinOps。

**包含模块**:
```
src/services/plugin/ (全部)
src/services/plugin-spi/
src/services/plugin-marketplace/
src/services/plugin-executor-service.ts
src/services/plugin-manager-service.ts
src/services/webhook/
src/services/cron/
src/services/skill/
src/services/notification/
src/services/multi-modal-trigger/
src/services/queue/
src/services/ticketing/
src/services/approval/
src/services/chatops/
src/services/efficiency/
src/services/finops/
src/services/cost/
src/services/cost-tracking/
src/services/ai-cost/
src/services/guardian/
src/services/change-intelligence/ (效能部分)
```

**数据所有权**:
| 表名 | 用途 |
|---|---|
| `plugins`, `plugin_configs`, `plugin_versions` | 插件管理 |
| `plugin_executions`, `plugin_installations` | 插件执行 |
| `notifications`, `notification_channels`, `notification_records` | 通知 |
| `notification_settings` | 通知设置 |
| `webhook_configs`, `webhook_deliveries` | Webhook |
| `skills`, `skill_versions`, `skill_bindings` | 技能 |
| `cron_jobs`, `cron_executions` | 定时任务 |
| `trigger_sources`, `trigger_rules`, `trigger_actions` | 触发器 |
| `event_subscriptions`, `event_logs`, `event_schemas` | 事件总线 |
| `tickets`, `healing_tickets`, `ticket_assignments` | 工单 |
| `ticket_workflows`, `ticket_states`, `ticket_transitions` | 工单工作流 |
| `approvals`, `approval_steps`, `approval_records` | 审批 |
| `chatops_channels`, `chatops_commands`, `chatops_logs` | ChatOps |
| `chatop_users`, `chatop_sessions`, `chatop_conversations` | ChatOps 增强 |
| `auto_dispatch`, `dispatch_queues`, `dispatch_rules` | 工单分派 |
| `efficiency_metrics`, `efficiency_reports` | 效能指标 |
| `cost_records`, `cost_allocations`, `cost_budgets` | 成本记录 |
| `cost_operations`, `optimization_recommendations`, `roi_analyses` | 成本运营 |
| `weekly_reports`, `engineer_profiles` | 周报/画像 |

**通信协议**:
- → iam-service: 同步 REST
- → tenant-service: 同步 REST
- 事件订阅: 几乎所有 BC 的事件（作为事件汇聚点）
- 发布事件: `notification.sent`, `ticket.created`, `approval.*`

### 3.3 服务间通信矩阵

| 调用方 → 被调用方 | iam | tenant | pipeline | delivery | infra | observability | ai | collab |
|---|---|---|---|---|---|---|---|---|
| **iam** | - | - | - | - | - | - | - | - |
| **tenant** | REST | - | - | - | - | - | - | - |
| **pipeline** | REST | REST | - | REST | REST | 事件 | 事件 | 事件 |
| **delivery** | REST | REST | 事件 | - | REST | 事件 | - | - |
| **infra** | REST | REST | REST | - | - | 事件 | - | - |
| **observability** | REST | REST | 事件 | 事件 | 事件 | - | 事件 | REST/事件 |
| **ai** | REST | - | 事件 | - | - | 事件 | - | 事件 |
| **collab** | REST | REST | 事件 | 事件 | 事件 | 事件 | 事件 | - |

---

## 四、迁移策略 (Migration Strategy)

### 4.1 总体路线： strangler fig pattern

采用**绞杀者模式**，分 6 个阶段逐步拆分，每阶段可独立回滚。

```
Phase 1: 基础设施准备 (Week 1-4)
Phase 2: 拆分 iam-service (Week 5-8)
Phase 3: 拆分 tenant-service (Week 9-12)
Phase 4: 拆分 pipeline-service (Week 13-18)
Phase 5: 拆分 delivery-service + infra-service (Week 19-24)
Phase 6: 拆分 observability-service + ai-service + collab-service (Week 25-30)
```

### 4.2 Phase 1: 基础设施准备 (Week 1-4)

**目标**: 为服务拆分建立基础设施，不改变业务代码。

| 任务 | 详细说明 | 产出物 |
|---|---|---|
| NATS JetStream 部署 | 部署 3 节点 NATS 集群 | NATS 集群可用 |
| EventBus 替换 | 将内存 `EventBusService` 改为 NATS 后端 | 所有事件通过 NATS |
| 服务注册中心 | 部署 Consul 或使用 Kubernetes Service | 服务发现可用 |
| API Gateway 增强 | 在 `orion-api-gateway` 中配置可路由到不同后端 | Gateway 路由配置 |
| 共享库抽取 | 抽取 `@orion/shared` 包 (类型定义、错误类、常量) | npm 包 @orion/shared |
| 数据库 Schema 分组 | 在现有 PostgreSQL 中按 BC 创建 Schema | `orion_iam`, `orion_tenant` 等 Schema |
| 迁移脚本开发 | 为每个 Schema 编写迁移脚本和回滚脚本 | SQL 迁移脚本 |

**数据库 Schema 分离步骤**:
```sql
-- 在现有 orion_platform 数据库中创建逻辑 Schema
CREATE SCHEMA IF NOT EXISTS orion_iam;
CREATE SCHEMA IF NOT EXISTS orion_tenant;
CREATE SCHEMA IF NOT EXISTS orion_pipeline;
CREATE SCHEMA IF NOT EXISTS orion_delivery;
CREATE SCHEMA IF NOT EXISTS orion_infra;
CREATE SCHEMA IF NOT EXISTS orion_observability;
CREATE SCHEMA IF NOT EXISTS orion_ai;
CREATE SCHEMA IF NOT EXISTS orion_collab;

-- 将现有表迁移到对应 Schema (示例)
ALTER TABLE users SET SCHEMA orion_iam;
ALTER TABLE roles SET SCHEMA orion_iam;
ALTER TABLE pipelines SET SCHEMA orion_pipeline;
-- ... 全部 120+ 张表
```

### 4.3 Phase 2: 拆分 iam-service (Week 5-8)

**策略**: iam 是最基础的依赖，且 API 边界最清晰。

| 步骤 | 操作 | 回滚方案 |
|---|---|---|
| 2.1 | 从 `orion-platform-service` 提取 `services/auth, user, role, session, api-key, privacy` | 保留原代码 |
| 2.2 | 创建独立项目 `orion-iam-service` | 保留 |
| 2.3 | 迁移对应的表到 `orion_iam` Schema | ALTER TABLE 回滚 |
| 2.4 | iam-service 连接 `orion_platform` 数据库的 `orion_iam` Schema | 配置切换 |
| 2.5 | 原 platform-service 通过 HTTP 调用 iam-service 的新 API (双写) | 关闭 HTTP，恢复进程内 |
| 2.6 | API Gateway 配置 `/api/v1/users`, `/api/v1/roles` 路由到 iam-service | 路由回 platform |
| 2.7 | 灰度切换：10% → 50% → 100% | Gateway 权重回滚 |
| 2.8 | 验证稳定后，从 platform-service 删除已迁移代码 | Git 恢复 |

**双写模式**:
```
原 platform-service:
  UserService → UserRepository → orion_iam.users (写)
  同时 → HTTP POST iam-service/api/v1/users (写)

读请求:
  Gateway 50% → platform-service (旧读)
  Gateway 50% → iam-service (新读)

数据一致性:
  每日定时对账脚本比对两边数据
```

### 4.4 Phase 3: 拆分 tenant-service (Week 9-12)

类似 Phase 2，拆分 `tenant, project, environment, product-line` 模块。

依赖: iam-service 必须先稳定运行。

### 4.5 Phase 4: 拆分 pipeline-service (Week 13-18) — 最关键

**特殊考虑**: Pipeline 是核心域，包含引擎 (`src/engine/`) 和 Saga (`src/saga/`)。

| 步骤 | 操作 |
|---|---|
| 4.1 | 提取 `services/pipeline/`, `engine/`, `saga/`, `events/` |
| 4.2 | `PipelineEngine` 保持独立进程 — 引擎本身不拆分 |
| 4.3 | `PipelineEventPublisher` 改为使用 NATS 而非内存 EventBus |
| 4.4 | 构建和部署相关 Service 暂时保留在 platform-service (通过 HTTP 调用) |
| 4.5 | 迁移 pipeline 相关 18 张表到 `orion_pipeline` Schema |
| 4.6 | Gateway 路由 `/api/v1/pipelines/*` → pipeline-service |

**引擎拆分特别注意**:
- `PipelineEngine` 当前直接 new `PipelineService`, `StageExecutor`
- 拆分后，Engine 需要改为通过 gRPC/REST 调用 delivery-service (构建产物) 和 infra-service (K8s 资源)
- TaskRunner 执行容器化 Task 时，需要调用 infra-service 的 K8s API

### 4.6 Phase 5-6: 其余服务拆分

Phase 5 (delivery + infra) 和 Phase 6 (observability + ai + collab) 遵循相同模式。

### 4.7 数据库拆分策略

#### 4.7.1 三个阶段

```
阶段 1 (当前):  单库单 Schema
    orion_platform
    ├── users
    ├── pipelines
    ├── artifacts
    └── ... 120+ 张表

阶段 2 (迁移中):  单库多 Schema
    orion_platform
    ├── orion_iam.*
    ├── orion_tenant.*
    ├── orion_pipeline.*
    └── ... 各 Schema 物理隔离

阶段 3 (最终):  多库
    orion_iam_db (PostgreSQL instance A)
    orion_tenant_db (PostgreSQL instance A)
    orion_pipeline_db (PostgreSQL instance B - 核心域独立)
    orion_delivery_db (PostgreSQL instance B)
    orion_infra_db (PostgreSQL instance C)
    orion_observability_db (PostgreSQL instance C)
    orion_ai_db (PostgreSQL instance C)
    orion_collab_db (PostgreSQL instance C)
```

#### 4.7.2 跨服务数据查询方案

| 场景 | 方案 | 说明 |
|---|---|---|
| 查询 "某用户的所有流水线" | pipeline-service 缓存 user info | 事件驱动更新 |
| 查询 "某租户的部署历史" | delivery-service 通过 tenant ID 过滤 | tenant_id 作为外键副本 |
| 审计日志关联用户 | observability-service 存储 user snapshot | 反范式存储 |
| 效能报表跨域数据 | collab-service 通过事件汇聚 | CQRS 读模型 |

#### 4.7.3 跨服务事务 — Saga 模式

当前已有 `src/saga/` 目录实现了 SagaCoordinator 和 PipelineSaga。拆分后:

```
租户创建 Saga:
  Step 1: tenant-service 创建租户 → 发布 TenantCreated
  Step 2: iam-service 初始化租户管理员角色 → 发布 RoleInitialized
  Step 3: collab-service 创建默认通知渠道 → 发布 ChannelCreated
  Step 4: observability-service 记录审计日志

  补偿:
    Step 4 失败 → 忽略 (审计可延迟)
    Step 3 失败 → 补偿: collab-service 删除渠道
    Step 2 失败 → 补偿: iam-service 删除角色 + Step 3 补偿
    Step 1 失败 → 终止
```

### 4.8 迁移期间测试策略

| 测试类型 | 迁移前 | 迁移中 | 迁移后 |
|---|---|---|---|
| 单元测试 | 进程内 mock | 不变 | 不变 |
| 集成测试 | 单 PostgreSQL | 单 PostgreSQL 多 Schema | 多数据库 |
| 契约测试 | 无 | **新增** (OpenAPI 契约) | 必需 |
| 端到端测试 | 单进程 | Gateway + 多服务 | 多服务 |
| 性能测试 | 基线 | 每次拆分后对比 | 目标: P99 < 250ms |
| 数据一致性 | 自动一致 | 对账脚本 | 最终一致性 |

---

## 五、风险评估 (Risk Assessment)

### 5.1 风险矩阵

| # | 风险 | 影响 | 概率 | 风险值 | 缓解措施 |
|---|---|---|---|---|---|
| R1 | **数据库拆分导致数据丢失** | 致命 | 低 | 高 | 迁移前全量备份；迁移脚本在测试环境演练 3 次以上；对账脚本每日执行 |
| R2 | **网络延迟增加导致 P99 超标** | 高 | 中 | 高 | 热点数据缓存 (Redis)；批量 API 合并调用；异步化非关键路径 |
| R3 | **循环依赖未完全消除** | 高 | 中 | 高 | CI 阶段依赖图扫描；架构评审门禁；禁止跨 BC 直接 import |
| R4 | **EventBus (NATS) 成为单点故障** | 高 | 低 | 中 | NATS 3 节点集群 + JetStream 持久化；降级为本地队列 |
| R5 | **拆分期间功能冻结影响业务** | 中 | 高 | 中 | 双写模式确保功能持续可用；灰度发布按流量比例而非功能 |
| R6 | **团队学习曲线导致效率下降** | 中 | 高 | 中 | 拆分前完成技术培训；提供 SDK 和示例代码；设立架构大使 |
| R7 | **API 兼容性问题导致前端故障** | 高 | 中 | 高 | 契约测试 (Pact)；前端 API 客户端版本锁定；向后兼容至少 2 个版本 |
| R8 | **Pipeline Engine 拆分后稳定性** | 致命 | 低 | 中 | Engine 作为最后拆分的服务；拆分前完成 1000 次压力测试 |

### 5.2 回滚方案

每个 Phase 都有明确的回滚检查点:

| Phase | 回滚触发条件 | 回滚操作 | 预估时间 |
|---|---|---|---|
| Phase 2 (iam) | 错误率 > 1% 持续 5 分钟 | Gateway 路由切回 platform-service | < 2 分钟 |
| Phase 3 (tenant) | 数据不一致 > 0.01% | 恢复进程内调用 + Schema 合并 | < 30 分钟 |
| Phase 4 (pipeline) | Engine 启动失败或 P99 > 500ms | 恢复进程内 Engine + 数据库 Schema 合并 | < 60 分钟 |
| Phase 5-6 | 任一服务持续不可用 | 对应服务回滚到 platform-service | < 30 分钟/服务 |

**全局回滚**: 如果整个拆分方案不可行，可以从 Git 恢复 `orion-platform-service` 到拆分前版本，所有数据通过合并 Schema 回滚到单库。

### 5.3 拆分成功指标

| 指标 | 当前 | 目标 | 测量方法 |
|---|---|---|---|
| 服务独立部署 | ❌ 全部耦合 | ✅ 8 个服务独立部署 | CI/CD 流水线 |
| 部署时间 | 25 分钟 | < 5 分钟/服务 | 部署脚本计时 |
| P99 延迟 | 200ms | < 250ms | Prometheus 监控 |
| 跨服务同步调用 | N/A | < 3 跳 | 链路追踪 (Jaeger) |
| 事件送达率 | N/A | > 99.99% | NATS 监控 |
| 数据一致性 | 100% (单库) | > 99.99% (对账) | 每日对账脚本 |
| 代码库规模 | ~50K 行 (单体) | < 10K 行/服务 | cloc 统计 |

---

## 六、附录

### 6.1 关键文件路径索引

| 类别 | 路径 | 说明 |
|---|---|---|
| 路由注册中心 | `/Users/heal/orion-design/orion-platform-service/src/api/routes.ts` | 48+ 路由模块注册 |
| 服务层 | `/Users/heal/orion-design/orion-platform-service/src/services/` | 98+ 个服务目录 |
| 仓储层 | `/Users/heal/orion-design/orion-platform-service/src/repositories/` | 98+ 个 Repository |
| 引擎 | `/Users/heal/orion-design/orion-platform-service/src/engine/` | PipelineEngine 等 12 个文件 |
| Saga | `/Users/heal/orion-design/orion-platform-service/src/saga/` | SagaCoordinator 等 9 个文件 |
| 事件 | `/Users/heal/orion-design/orion-platform-service/src/events/` | PipelineEventPublisher, types |
| 模型 | `/Users/heal/orion-design/orion-platform-service/src/models/` | 36 个领域模型 |
| 数据库迁移 | `/Users/heal/orion-design/orion-platform-service/src/db/migrations/` | 144 个迁移文件 |
| 现有拆分设计 | `/Users/heal/orion-design/docs/architecture/platform-service-split-design.md` | 3 服务拆分方案 (待评审) |
| 拆分实施 | `/Users/heal/orion-design/docs/architecture/platform-service-split-implementation.md` | 4 服务实施计划 (待评审) |
| 架构重构 | `/Users/heal/orion-design/docs/architecture/架构重构设计.md` | 核心域+支撑域方案 |
| 当前架构 | `/Users/heal/orion-design/docs/architecture/当前系统架构.md` | 真实架构状态 |

### 6.2 与现有拆分方案的对比

| 维度 | 现有方案 (split-design.md) | 本 DDD 方案 |
|---|---|---|
| 服务数量 | 4 个 (resource, tenant, governance, platform) | 8 个 |
| 拆分依据 | 职责分类 (资源/租户/安全) | DDD 限界上下文 |
| Pipeline 引擎 | 未涉及拆分 | 独立为 pipeline-service |
| AI 服务 | 未涉及 | 独立为 ai-service |
| 数据拆分 | 4 个数据库 | 8 个 Schema → 逐步到 8 个数据库 |
| 核心域保护 | 未明确 | pipeline-service 优先保护 |

现有方案的 4 服务拆分可以作为中期目标（Phase 2-3 完成后的状态），但长远来看需要进一步拆分 pipeline、delivery、ai 等核心域。

### 6.3 命名约定

| 服务 | 数据库 | Schema | NATS Stream |
|---|---|---|---|
| orion-iam-service | orion_iam_db | orion_iam | IAM_STREAM |
| orion-tenant-service | orion_tenant_db | orion_tenant | TENANT_STREAM |
| orion-pipeline-service | orion_pipeline_db | orion_pipeline | PIPELINE_STREAM |
| orion-delivery-service | orion_delivery_db | orion_delivery | DELIVERY_STREAM |
| orion-infra-service | orion_infra_db | orion_infra | INFRA_STREAM |
| orion-observability-service | orion_observability_db | orion_observability | OBSERVABILITY_STREAM |
| orion-ai-service | orion_ai_db | orion_ai | AI_STREAM |
| orion-collab-service | orion_collab_db | orion_collab | COLLAB_STREAM |

---

_分析完成日期: 2026-05-09_
_分析基于代码库实测，非设计文档推断_
