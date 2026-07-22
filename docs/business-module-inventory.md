# Orion 平台综合业务模块清单

**生成日期**: 2026-07-02
**服务模块总数**: 145 (带 barrel export)
**后端路由总数**: 175
**前端页面总数**: 201
**数据来源**: `orion-platform-service/src/services/`, `orion-platform-service/src/api/`, `orion-frontend/src/pages/`

---

## 统计概览

| 分类 | 数量 | 说明 |
|------|------|------|
| 带 barrel export 的服务目录 | 145 | 有 `index.ts` 导出 |
| 后端路由文件 | 175 | `api/*-routes.ts` |
| 前端页面目录 | 201 | `orion-frontend/src/pages/` |
| 精确匹配 (route-page) | 50 | 命名直接对应 |
| 命名差异匹配 | 41 | 命名不一致但功能对应 |
| 后端有路由无前端 | 84 | 内部 API 或待开发 |
| 前端有页面无后端 | 109 | 微前端/mock/功能重叠 |
| **整体匹配率** | **~52%** | 91/175 有对应前端 |

---

## 按领域分组

### 1. AI 与智能 (AI & Intelligence)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| ai | AIGateway, AIDiagnosisService | AI 网关、诊断、推理 | ai-gateway-routes.ts, ai-decision-routes.ts | AIDashboard/, AICostDashboard/, AIGateway/ |
| ai-review | AIReviewService | AI 代码评审 | ai-review-routes.ts | AIReview/ |
| ai-agents | AgentService, AgentRunService | AI Agent 生命周期 | ai-agent-routes.ts | AIAgents/, AgentDashboard/ |
| ai-training | DualEngineService | 双引擎 AI 训练 | dual-engine-routes.ts | (待确认) |
| mlops | MLOpsService | MLOps 全生命周期 | mlops-routes.ts | mlops/ |
| llm-trace | LLMTraceService | LLM 调用追踪 | llm-trace-routes.ts | LLMTraceDashboard/ |
| decision-explanation | DecisionExplanationService | AI 决策可解释性 | decision-explanation-routes.ts | ai-decision-explanation/ |
| ai-security | PromptSecurity | Prompt 安全检测 | ai-security-routes.ts | AISecurity/ |

### 2. 开发与交付 (Development & Delivery)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| pipeline | PipelineService, PipelineRunService | Pipeline CRUD、执行、触发 | pipeline-*-routes.ts | PipelineList/, PipelineEditor/, PipelineDetail/ |
| workflow | WorkflowService | 工作流引擎 | workflow-*-routes.ts | WorkflowDesigner/ |
| code-repo | BranchPolicyService, CodeOwnershipService | 代码仓库策略、所有权 | code-repo-routes.ts | CodeMgmt/, code-svc/ |
| build | BuildService | 构建环境、缓存、日志 | build-env-routes.ts | BuildEnv/ |
| iac | IacService | 基础设施即代码 | iac-routes.ts | IacManagement/ |
| deploy | DeployService, ProgressiveDeployService | 部署、渐进式、紧急部署 | deploy-routes.ts | Deploy/, DeploymentList/ |
| artifact | ArtifactService | 制品管理、版本控制 | artifact-routes.ts | Artifacts/, ArtifactBrowser/ |
| test-selector | TestSelectorService | 测试选择器 | test-selector-routes.ts | TestSelector/ |
| quality-gate | QualityGateService | 质量门禁 | quality-gate-routes.ts | (待确认) |

### 3. 运维与可观测性 (Operations & Observability)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| monitoring | MonitoringService, MetricCollector | 监控配置、指标收集 | monitoring-routes.ts | monitor-svc/ |
| alert | AlertCorrelationService, RootCauseAnalysisService | 告警关联、去重、根因分析 | alert-routes.ts | AlertList/ |
| incident | IncidentService | 事件管理 | incident-routes.ts | Incident/ |
| problem | ProblemService | 问题管理、根因分析 | problem-routes.ts | Problem/ |
| change | ChangeService | 变更管理 | change-routes.ts | ChangeManagement/ |
| change-request | ChangeRequestService | 变更请求 | change-request-routes.ts | ChangeRequestManagement/ |
| change-intelligence | ChangeIntelligenceService | 变更智能分析 | change-intelligence-routes.ts | ChangeIntelligence/ |
| cmdb | CmdbService, TopologyService | CMDB、拓扑关系 | cmdb-routes.ts | CMDB/ |
| disaster-recovery | DisasterRecoveryService | 灾难恢复 | disaster-recovery-routes.ts | disaster-recovery/ |
| backup | BackupService | 备份管理 | backup-routes.ts | Backup/ |
| runbook | RunbookService | 运维手册 | runbook-routes.ts | RunbookManagement/ |
| chaos-engineering | ChaosEngineeringService | Chaos 工程、故障注入 | chaos-routes.ts | ChaosEngineering/, chaos/ |
| self-healing | SelfHealingService | 自愈管理 | self-healing-routes.ts | SelfHealing/ |
| canary-analysis | CanaryAnalysisService | 灰度分析 | canary-analysis-routes.ts | CanaryAnalysis/ |
| canary-traffic | CanaryTrafficService | 灰度流量 | canary-traffic-routes.ts | canary-traffic/ |
| circuit-breaker | CircuitBreakerService | 熔断器 | circuit-breaker-routes.ts | circuit-breaker/ |
| efficiency | DoraMetricsService | DORA 指标、效率报告 | efficiency-routes.ts | EfficiencyDashboard/ |
| performance | PerformanceService | 性能管理 | performance-routes.ts | performance/ |
| capacity | CapacityService | 容量规划 | capacity-routes.ts | capacity-planning/ |
| apm | ApmService | 应用性能管理 | apm-routes.ts | apm/ |
| tracing | TracingService | 链路追踪 | tracing-routes.ts | (待确认) |
| middleware-ops | MiddlewareOpsService | 中间件运维 | middleware-ops-routes.ts | middleware-ops/ |

### 4. 安全与合规 (Security & Compliance)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| auth | AuthService, AuthzService | 认证、授权、SSO | auth-enhanced-routes.ts, sso-*-routes.ts | Console/ |
| security | SecurityService | 安全策略、漏洞扫描 | security-compliance-routes.ts | security-svc/ |
| compliance | ComplianceService | 合规管理 | compliance-routes.ts | compliance/ |
| audit | AuditService | 审计日志 | audit-routes.ts | AuditLog/, AuditLogs/ |
| privacy | PrivacyService | 隐私管理 | privacy-routes.ts | (待确认) |
| secret | SecretsService | 密钥管理 | secret-routes.ts | SecretsManagement/ |
| policy | PolicyService | 策略管理 | policy-routes.ts | PolicyManagement/ |
| abac-policy | AbacPolicyService | ABAC 策略 | abac-policy-routes.ts | (待确认) |
| notification-policy | NotificationPolicyService | 通知策略 | notification-policy-routes.ts | NotificationRules/ |
| risk | RiskService, RiskEngineService | 风险管理、风险引擎 | risk-routes.ts | RiskDashboard/ |
| sbom | SbomService | SBOM 软件物料清单 | sbom-routes.ts | SbomDashboard/ |
| supply-chain | SupplyChainService | 供应链安全 | supply-chain-routes.ts | (待确认) |

### 5. 数据与平台 (Data & Platform)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| finops | FinOpsService, CostAllocationService | 成本管理、成本分配 | finops-routes.ts | finops-svc/, AICostDashboard/ |
| billing | BillingService | 计费管理 | billing-routes.ts | billing/ |
| data-pipeline | DataPipelineService | 数据管道 | data-pipeline-routes.ts | data-pipeline/ |
| data-lineage | DataLineageService | 数据血缘 | data-lineage-routes.ts | data-lineage/ |
| data-quality | DataQualityService | 数据质量 | data-quality-routes.ts | data-quality/ |
| metadata | MetadataService | 元数据管理 | metadata-routes.ts | metadata/ |
| vector-store | VectorStoreService | 向量存储 | vector-store-routes.ts | VectorStore/ |
| database | DatabaseService | 数据库管理 | dba-routes.ts | dba/ |
| dba | DbaService | DBA 工具 | dba-routes.ts | dba/ |
| report-designer | ReportDesignerService | 报表设计器 | report-designer-routes.ts | ReportDesigner/ |
| message-queue | MessageQueueService | 消息队列管理 | message-queue-routes.ts | (待确认) |
| cache | CacheService | 缓存管理 | cache-routes.ts, cache-cleanup-routes.ts | cache-monitor/ |
| session | SessionService | 会话管理 | session-routes.ts | Sessions/ |

### 6. 组织与协作 (Organization & Collaboration)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| tenant | TenantService, TenantIsolationService | 租户管理、隔离、配额 | tenant-routes.ts | TenantList/ |
| user | UserService, UserTokenService | 用户管理、Token | user-routes.ts, user-token-routes.ts | UserManagement/, UserProfile/ |
| team | TeamService | 团队管理 | team-routes.ts | (待确认) |
| project | ProjectService | 项目管理 | project-routes.ts | Projects/ |
| role | RoleService | 角色管理 | role-routes.ts | RoleManagement/ |
| permission | PermissionService | 权限管理 | permission-audit-routes.ts | Capability/, CapabilityAdmin/ |
| community | CommunityService, CommunityAdvancedService | 社区、贡献、最佳实践 | community-routes.ts | community/ |
| sla | SLAService | SLA 管理 | sla-routes.ts | SLA/ |

### 7. 基础设施与平台 (Infrastructure & Platform)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| environment | EnvironmentService | 环境管理 | environment-routes.ts | env/, Environments/ |
| ephemeral-env | EphemeralEnvService | 临时环境 | ephemeral-env-routes.ts | EphemeralEnvList/ |
| config | ConfigVersionService, ConfigSearchService | 配置管理、GitOps | config-routes.ts | ConfigManagement/ |
| multi-cloud | MultiCloudService | 多云管理 | multi-cloud-routes.ts | multi-cloud/ |
| federation | FederationService | 联邦管理 | federation-routes.ts | (待确认) |
| cross-domain-orchestration | CrossDomainOrchestrator | 跨域编排 | cross-domain-routes.ts | (待确认) |
| integration | IntegrationService | 集成管理 | integration-routes.ts | (待确认) |
| api-market | ApiMarketService | API 市场 | api-market-routes.ts | api-governance/ |
| api-governance | ApiGovernanceService, ApiContractService | API 治理、契约 | api-governance-routes.ts | api-governance/ |
| digital-twin | DigitalTwinService | 数字孪生 | digital-twin-routes.ts | DigitalTwin/ |
| event-bus | EventBusService | 事件总线 | eventbus-routes.ts | EventBus/ |
| event-trigger | EventTriggerService | 事件触发器 | event-trigger-routes.ts | trigger/, EventRegistry/ |
| hook-chain | HookChainService | Hook 链 | hook-chain-routes.ts | (待确认) |
| handler-registry | HandlerRegistryService | 处理器注册表 | handler-registry-routes.ts | (待确认) |
| plugin | PluginService, PluginManagerService | 插件管理、市场 | plugin-routes.ts | plugin-svc/, PluginManagement/ |
| skill | SkillService | 技能管理 | skill-routes.ts | skill-svc/, SkillManagement/ |
| form | FormService | 表单管理 | (待确认) | (待确认) |
| process-step | ProcessDefinitionService | 流程定义与实例 | process-step-routes.ts | ProcessStep/ |

### 8. 业务应用 (Business Applications)

| 服务目录 | 核心类/接口 | 功能描述 | 路由文件 | 前端页面 |
|---------|-----------|---------|---------|---------|
| approval | ApprovalService, ApprovalFlowEngine | 审批工作流 | approval-routes.ts | ApprovalManagement/, approval/ |
| ticketing | TicketingService | 工单管理 | ticketing-routes.ts | ticket-svc/, TicketList/, TicketDetail/ |
| confirmation | ConfirmationService | 确认工作台 | confirmation-routes.ts | ConfirmationWorkbench/ |
| rdm | RDMService, SprintBoardService | RDM、Sprint 看板 | sprint-routes.ts | SprintBoard/, rdm/ |
| release-train | ReleaseTrainService | Release Train | release-train-routes.ts | (待确认) |
| script-library | ScriptLibraryService | 脚本库 | script-library-routes.ts | ScriptLibrary/, ScriptRunner/ |
| workbench | WorkbenchService | 工作台 | workbench-routes.ts | Workbench/, DashboardNew/ |
| developer-portal | DeveloperPortalService | 开发者门户 | developer-portal-routes.ts | developer-portal/ |
| subapp | SubAppService | 子应用管理 | subapp-routes.ts | SubApps/, SubAppManagement/ |
| lowcode | LowcodeService | 低代码平台 | (待确认) | (待确认) |
| smart-deploy | SmartDeployService | 智能部署 | (集成在 deploy) | (待确认) |

---

## 关键发现

### 1. 模块成熟度分布
- **高成熟度 (有 Service + Repository + Route + 前端)**: ~120 个模块
- **部分实现 (有 Service + Route，缺前端)**: ~40 个模块
- **仅后端实现 (有 Route，缺前端页面)**: ~84 个路由
- **仅前端存在 (微前端/mock)**: ~109 个页面

### 2. Barrel Export 覆盖率
- **有 index.ts barrel 导出**: 145 个服务目录
- **无 index.ts**: ~20 个服务仅有主 .ts 文件

### 3. 前后端匹配度
- **精确匹配**: 50 条 (28.6%)
- **命名差异匹配**: 41 条 (23.4%)
- **匹配率**: 52% (91/175)
- **后端有路由无前端**: 84 条 (48.0%)
- **前端有页面无后端**: 109 条 (62.3%)

### 4. 领域分布
- **AI 与智能**: 12 个服务
- **开发与交付**: 15 个服务
- **运维与可观测性**: 22 个服务
- **安全与合规**: 14 个服务
- **数据与平台**: 18 个服务
- **组织与协作**: 8 个服务
- **基础设施与平台**: 24 个服务
- **业务应用**: 12 个服务

---

## 后续工作建议

1. **补充 barrel export**: 为无 `index.ts` 的 ~20 个服务补充 barrel 导出
2. **前端页面补全**: 针对 84 个有路由无前端的模块，按优先级开发前端页面
3. **命名统一**: 41 个命名差异的模块建议统一命名规范
4. **微前端拆分**: 将 109 个前端页面中属于同一服务的整合为微前端子应用
5. **持久化迁移**: 继续将剩余服务从 Map 迁移到 PostgreSQL Repository 模式
6. **文档补充**: 为每个服务补充详细的 JSDoc 和 API 文档

---

## 附录：数据来源

- 服务列表: `orion-platform-service/src/services/`
- 路由列表: `orion-platform-service/src/api/*-routes.ts`
- 前端页面: `orion-frontend/src/pages/`
- 现有映射: `docs/frontend-backend-mapping.md`
