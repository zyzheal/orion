# Orion 交互链与样式规范扫描报告

> 扫描时间: 2026-05-22
> 扫描范围: orion-frontend/src/pages/ (531 有效文件)
> 规范来源: CLAUDE.md - Frontend Design Principles + Interaction Completeness Rules

## 一、全局统计

| 指标 | 数量 |
|------|------|
| 扫描文件数 | 531 |
| 异步函数总数 | 1618 |
| 缺 loading/setLoading | 32 |
| 缺 message.error 反馈 | 7 |
| 缺空状态引导 | 55 |
| 缺删除确认弹窗 | 56 |
| catch 为空 | 0 |
| 硬编码颜色 | 123 |
| 圆角违规 | 0 |
| 间距违规 | 0 |
| 阴影违规 | 8 |
| 标题不规范 | 31 |

## 二、按模块统计

| 模块 | 文件数 | 缺loading | 缺反馈 | 缺空状态 | 缺确认 | 颜色 | 圆角 | 间距 | 阴影 | 合规率 |
|------|--------|----------|--------|---------|--------|------|------|------|------|--------|
| AIAgents | 4 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 93.8% |
| AICostDashboard | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.9% |
| AIDashboard | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| AIDocManagement | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.5% |
| AIGateway | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| AIReview | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.9% |
| AISecurity | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| AgentDashboard | 7 | 2 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 91.1% |
| AgentRunDetail | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| AlertList | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ApiKeyManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ApprovalManagement | 4 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| Approvals | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ArtifactBrowser | 5 | 0 | 0 | 0 | 1 | 4 | 0 | 0 | 0 | 87.5% |
| ArtifactVersion | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Artifacts | 4 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 93.8% |
| AuditLog | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Backup | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| BuildEnv | 8 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 96.9% |
| CMDB | 8 | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 1 | 92.2% |
| CanaryAnalysis | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Capability | 4 | 0 | 0 | 1 | 3 | 0 | 0 | 0 | 0 | 87.5% |
| CapabilityAdmin | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ChangeIntelligence | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ChaosEngineering | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ChatOps | 14 | 2 | 3 | 1 | 1 | 7 | 0 | 0 | 0 | 87.5% |
| CodeMgmt | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.9% |
| ConfigManagement | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| ConfirmationWorkbench | 5 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 95.0% |
| Console | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| CronJobs | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| CronManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| DashboardCore | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 62.5% |
| DashboardNew | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| DeploymentDetail | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| DeploymentList | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Diagnostic | 6 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 93.8% |
| DigitalTwin | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| DocumentCenter | 5 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 97.5% |
| EfficiencyDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| EngineerDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Environments | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| EphemeralEnvDetail | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| EphemeralEnvList | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| EventBus | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| EventRegistry | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ExecutiveDashboard | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 75.0% |
| FinOpsDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| IacManagement | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.5% |
| InternalLibrary | 4 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 93.8% |
| KnowledgeBase | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| LLMTraceDashboard | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.5% |
| Login | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| ManagerDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| MetricsDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ModuleManager | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 95.8% |
| Monitoring | 6 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 97.9% |
| NotFound | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| NotificationCenter | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 87.5% |
| NotificationRules | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 62.5% |
| OnCall | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PRTriggerManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PipelineBudget | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PipelineDetail | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PipelineEditor | 3 | 1 | 0 | 1 | 2 | 1 | 0 | 0 | 0 | 79.2% |
| PipelineList | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| PipelineRunList | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PipelineRunLive | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PipelineVersionHistory | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| PluginManagement | 6 | 4 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 89.6% |
| PluginSPI | 4 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 93.8% |
| PolicyManagement | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| ProductLine | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Projects | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Queue | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| QueueTasks | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| RiskDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| RoleManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| RunnerManagement | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 87.5% |
| SbomDashboard | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| SbomDetail | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ScriptRunner | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| SecretsManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| SelfHealing | 7 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 98.2% |
| ServerError | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Sessions | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| SkillManagement | 8 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 95.3% |
| SubAppManagement | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| SubApps | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 87.5% |
| TaskTimeouts | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| TenantList | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 87.5% |
| TenantManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| TestReport | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| TestSelector | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| TicketDetail | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 87.5% |
| TicketList | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| UserManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| UserProfile | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| UserSettings | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| VectorStore | 6 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 95.8% |
| WebhookManagement | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| Workbench | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| WorkflowDependencies | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| WorkflowDesigner | 4 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 96.9% |
| WorkflowTasks | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| WorkflowTriggers | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| agent-svc | 8 | 2 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | 92.2% |
| ai-decision | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ai-decision-explanation | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| ai-svc | 16 | 0 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 96.9% |
| api-governance | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 62.5% |
| approval | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| approval-svc | 7 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 96.4% |
| artifact | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| artifact-ops | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| artifact-svc | 12 | 0 | 0 | 1 | 3 | 4 | 0 | 0 | 0 | 91.7% |
| audit-svc | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| autonomous-pipeline | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| canary-traffic | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| chaos | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| circuit-breaker | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| code-svc | 14 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 97.3% |
| community | 2 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 81.2% |
| community-svc | 2 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 81.2% |
| compliance | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| config-mgmt | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 87.5% |
| cost | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| cost-operations | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| data-pipeline | 1 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 12.5% |
| dba | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| deploy | 1 | 0 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 62.5% |
| deploy-svc | 3 | 0 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 87.5% |
| developer-portal | 1 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 50.0% |
| digital-twin | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 75.0% |
| disaster-recovery | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 75.0% |
| dr-svc | 2 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 87.5% |
| efficiency | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| efficiency-svc | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| env | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 87.5% |
| feature-flags | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| federation | 3 | 0 | 0 | 0 | 1 | 3 | 0 | 0 | 0 | 83.3% |
| federation-svc | 5 | 0 | 0 | 0 | 1 | 7 | 0 | 0 | 0 | 80.0% |
| finops-svc | 9 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 98.6% |
| gateway | 8 | 2 | 1 | 2 | 0 | 1 | 0 | 0 | 1 | 89.1% |
| governance-svc | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 62.5% |
| graph | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| inception | 1 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 62.5% |
| intelligence-svc | 11 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 98.9% |
| knowledge-svc | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| monitor-svc | 12 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 99.0% |
| multi-cloud | 2 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 75.0% |
| notify-svc | 9 | 1 | 0 | 1 | 0 | 5 | 0 | 0 | 0 | 90.3% |
| observability | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| orchestration | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 75.0% |
| pandawiki | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| performance | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| pipeline | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| pipeline-svc | 31 | 2 | 1 | 4 | 7 | 16 | 0 | 0 | 0 | 87.9% |
| pipeline-template | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 87.5% |
| platform-core | 44 | 1 | 0 | 2 | 5 | 15 | 0 | 0 | 2 | 92.9% |
| plugin-marketplace | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| plugin-svc | 11 | 4 | 0 | 1 | 2 | 1 | 0 | 0 | 0 | 90.9% |
| quality-gate | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 87.5% |
| rate-limiting | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| security-svc | 23 | 0 | 0 | 2 | 4 | 3 | 0 | 0 | 0 | 95.1% |
| skill-svc | 4 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 93.8% |
| supply-chain | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |
| test-mf | 1 | 0 | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 62.5% |
| ticket-svc | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 95.0% |
| trigger | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 75.0% |
| visor | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% |

## 三、详细问题清单

### AIAgents

- [P2] **pages/AIAgents/AgentDetail.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/AIAgents/AgentDetail.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/AIAgents/index.tsx**: 硬编码 boxShadow (行 214)

### AICostDashboard

- [P2] **pages/AICostDashboard/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### AIDashboard

- [P2] **pages/AIDashboard/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### AIDocManagement

- [P2] **pages/AIDocManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### AIReview

- [P1] **pages/AIReview/History.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/AIReview/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/AIReview/index.tsx**: 页面标题不规范 (行 0)

### AgentDashboard

- [P2] **pages/AgentDashboard/AgentDetailDrawer.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/AgentDashboard/AgentDetailDrawer.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/AgentDashboard/AgentRunList.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/AgentDashboard/AgentRunList.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/AgentDashboard/AgentTable.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P0] **pages/AgentDashboard/CreateAgentModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleCreate` (行 20)
- [P0] **pages/AgentDashboard/TriggerRunModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleTrigger` (行 20)

### AgentRunDetail

- [P1] **pages/AgentRunDetail/index.tsx**: 页面标题不规范 (行 0)

### ApprovalManagement

- [P0] **pages/ApprovalManagement/ApprovalRecordTable.tsx**: 异步函数缺 setLoading 状态
-   - `handleApprove` (行 136)
-   - `handleReject` (行 146)
-   - `handleCommentSubmit` (行 163)
- [P0] **pages/ApprovalManagement/FlowConfigForm.tsx**: 异步函数缺 setLoading 状态
-   - `handleCreate` (行 78)
-   - `handleEdit` (行 112)
-   - `handleDelete` (行 138)
- [P2] **pages/ApprovalManagement/FlowConfigForm.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/ApprovalManagement/TimeoutConfig.tsx**: 异步函数缺 setLoading 状态
-   - `handleCreate` (行 58)
-   - `handleEdit` (行 85)
-   - `handleDelete` (行 112)

### ArtifactBrowser

- [P1] **pages/ArtifactBrowser/TraceabilityChainView.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 121)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 147)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 162)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 173)
- [P1] **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 页面标题不规范 (行 0)

### Artifacts

- [P2] **pages/Artifacts/ArtifactDetail.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/Artifacts/ArtifactDetail.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/Artifacts/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### BuildEnv

- [P2] **pages/BuildEnv/BuildLogViewer.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P2] **pages/BuildEnv/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### CMDB

- [P2] **pages/CMDB/AuditLogPage.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/CMDB/CITablePage.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/CMDB/ImpactAnalysisPage.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/CMDB/IntegrationPage.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/CMDB/TopologyPage.tsx**: 硬编码 boxShadow (行 95)
- [P1] **pages/CMDB/TopologyPage.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/CMDB/WebTerminalPage.tsx**: 硬编码颜色 `#1e1e1e` (行 109)
- [P1] **pages/CMDB/WebTerminalPage.tsx**: 硬编码颜色 `#1e1e1e` (行 386)
- [P2] **pages/CMDB/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### Capability

- [P1] **pages/Capability/CapabilityList.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/Capability/RoleCapabilityMapping.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/Capability/UserCapabilityMapping.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/Capability/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### ChatOps

- [P0] **pages/ChatOps/ApprovalConfig.tsx**: 异步函数缺 setLoading 状态
-   - `handleSave` (行 299)
- [P0] **pages/ChatOps/ApprovalConfig.tsx**: 异步函数缺 message.error 错误反馈
- [P0] **pages/ChatOps/AuditLogViewer.tsx**: 异步函数缺 message.error 错误反馈
- [P1] **pages/ChatOps/ChatDashboard.tsx**: 硬编码颜色 `#999` (行 134)
- [P1] **pages/ChatOps/ChatDashboard.tsx**: 硬编码颜色 `#999` (行 137)
- [P1] **pages/ChatOps/ChatDashboard.tsx**: 硬编码颜色 `#52c41a` (行 226)
- [P1] **pages/ChatOps/ChatDashboard.tsx**: 硬编码颜色 `#722ed1` (行 245)
- [P0] **pages/ChatOps/ChatOpsSettings.tsx**: 异步函数缺 setLoading 状态
-   - `handlePlatformSave` (行 293)
-   - `handleSave` (行 422)
-   - `handleDNDSave` (行 439)
- [P1] **pages/ChatOps/ChatOpsSettings.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/ChatOps/ChatOpsSettings.tsx**: 硬编码颜色 `#999` (行 251)
- [P1] **pages/ChatOps/SmartRecommend.tsx**: 页面标题不规范 (行 0)
- [P0] **pages/ChatOps/index.chat.tsx**: 异步函数缺 message.error 错误反馈
- [P2] **pages/ChatOps/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/ChatOps/index.tsx**: 硬编码颜色 `#3370e6` (行 88)
- [P1] **pages/ChatOps/index.tsx**: 硬编码颜色 `#3370e6` (行 89)

### CodeMgmt

- [P2] **pages/CodeMgmt/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### ConfigManagement

- [P1] **pages/ConfigManagement/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### ConfirmationWorkbench

- [P0] **pages/ConfirmationWorkbench/NotificationSettings.tsx**: 异步函数缺 setLoading 状态
-   - `handleSave` (行 51)
- [P2] **pages/ConfirmationWorkbench/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### DashboardCore

- [P0] **pages/DashboardCore/index.tsx**: 异步函数缺 setLoading 状态
- [P0] **pages/DashboardCore/index.tsx**: 异步函数缺 message.error 错误反馈
- [P1] **pages/DashboardCore/index.tsx**: 硬编码颜色 `#52c41a` (行 157)

### Diagnostic

- [P1] **pages/Diagnostic/SessionDetail.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/Diagnostic/Trigger.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/Diagnostic/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/Diagnostic/index.tsx**: 页面标题不规范 (行 0)

### DocumentCenter

- [P0] **pages/DocumentCenter/SyncPanel.tsx**: 异步函数缺 setLoading 状态
-   - `handleSync` (行 98)

### EphemeralEnvDetail

- [P1] **pages/EphemeralEnvDetail/index.tsx**: 页面标题不规范 (行 0)

### ExecutiveDashboard

- [P1] **pages/ExecutiveDashboard/index.tsx**: 硬编码颜色 `#888` (行 257)
- [P1] **pages/ExecutiveDashboard/index.tsx**: 硬编码颜色 `#888` (行 277)

### IacManagement

- [P2] **pages/IacManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### InternalLibrary

- [P0] **pages/InternalLibrary/LibraryDetail.tsx**: 异步函数缺 setLoading 状态
-   - `handleCheck` (行 82)
- [P1] **pages/InternalLibrary/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### LLMTraceDashboard

- [P2] **pages/LLMTraceDashboard/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### Login

- [P0] **pages/Login/index.tsx**: 异步函数缺 setLoading 状态
-   - `handleSubmit` (行 53)

### ModuleManager

- [P1] **pages/ModuleManager/ValidationReport.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### Monitoring

- [P2] **pages/Monitoring/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/Monitoring/index.tsx**: 页面标题不规范 (行 0)

### NotificationCenter

- [P1] **pages/NotificationCenter/index.tsx**: 硬编码颜色 `#666` (行 731)

### NotificationRules

- [P1] **pages/NotificationRules/index.tsx**: 硬编码颜色 `#0089FF` (行 56)
- [P1] **pages/NotificationRules/index.tsx**: 硬编码颜色 `#2BAE67` (行 57)
- [P1] **pages/NotificationRules/index.tsx**: 硬编码颜色 `#3370FF` (行 58)

### PipelineEditor

- [P1] **pages/PipelineEditor/StageItem.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P0] **pages/PipelineEditor/StageModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleOk` (行 152)
- [P2] **pages/PipelineEditor/StageModal.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/PipelineEditor/StageModal.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/PipelineEditor/StageModal.tsx**: 硬编码颜色 `#999` (行 726)

### PipelineList

- [P1] **pages/PipelineList/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### PluginManagement

- [P0] **pages/PluginManagement/PluginCreateModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleInstall` (行 46)
- [P2] **pages/PluginManagement/PluginCreateModal.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/PluginManagement/PluginDetail.tsx**: 异步函数缺 setLoading 状态
-   - `handleSaveConfig` (行 56)
- [P1] **pages/PluginManagement/PluginDetail.tsx**: 页面标题不规范 (行 0)
- [P0] **pages/PluginManagement/PluginLifecycle.tsx**: 异步函数缺 setLoading 状态
-   - `handleExecute` (行 35)
- [P0] **pages/PluginManagement/PluginList.tsx**: 异步函数缺 setLoading 状态
-   - `handleToggleStatus` (行 111)
-   - `handleUpdate` (行 139)
-   - `handleDelete` (行 160)

### PluginSPI

- [P1] **pages/PluginSPI/SPIConfig.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/PluginSPI/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### PolicyManagement

- [P1] **pages/PolicyManagement/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### RunnerManagement

- [P1] **pages/RunnerManagement/index.tsx**: 硬编码颜色 `#8c8c8c` (行 474)

### SelfHealing

- [P1] **pages/SelfHealing/History.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/SelfHealing/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/SelfHealing/index.tsx**: 页面标题不规范 (行 0)

### SkillManagement

- [P1] **pages/SkillManagement/AuditHistory.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/SkillManagement/SkillSubmission.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/SkillManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### SubAppManagement

- [P0] **pages/SubAppManagement/index.tsx**: 异步函数缺 setLoading 状态
-   - `handleSubmit` (行 117)
-   - `handleDelete` (行 154)
-   - `handleToggleStatus` (行 164)

### SubApps

- [P1] **pages/SubApps/index.tsx**: 硬编码 boxShadow (行 142)

### TenantList

- [P1] **pages/TenantList/index.tsx**: 硬编码颜色 `#3370E6` (行 502)

### TicketDetail

- [P2] **pages/TicketDetail/TicketComments.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/TicketDetail/TicketComments.tsx**: 硬编码 boxShadow (行 441)

### TicketList

- [P1] **pages/TicketList/DispatchPanel.tsx**: 页面标题不规范 (行 0)

### UserProfile

- [P1] **pages/UserProfile/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### UserSettings

- [P0] **pages/UserSettings/index.tsx**: 异步函数缺 setLoading 状态
-   - `handleProfileUpdate` (行 146)
-   - `handlePasswordChange` (行 163)
-   - `handleNotificationSave` (行 178)
- [P1] **pages/UserSettings/index.tsx**: 页面标题不规范 (行 0)

### VectorStore

- [P2] **pages/VectorStore/CollectionDetail.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/VectorStore/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### WorkflowDesigner

- [P2] **pages/WorkflowDesigner/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### agent-svc

- [P2] **pages/agent-svc/AgentDashboard/AgentDetailDrawer.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/agent-svc/AgentDashboard/AgentDetailDrawer.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/agent-svc/AgentDashboard/AgentRunList.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/agent-svc/AgentDashboard/AgentRunList.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/agent-svc/AgentDashboard/AgentTable.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P0] **pages/agent-svc/AgentDashboard/CreateAgentModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleCreate` (行 20)
- [P0] **pages/agent-svc/AgentDashboard/TriggerRunModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleTrigger` (行 20)

### ai-svc

- [P2] **pages/ai-svc/AIDocManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P2] **pages/ai-svc/LLMTraceDashboard/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P2] **pages/ai-svc/VectorStore/CollectionDetail.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/ai-svc/VectorStore/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### api-governance

- [P1] **pages/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#52c41a` (行 281)
- [P1] **pages/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#52c41a` (行 305)
- [P1] **pages/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#888` (行 485)

### approval-svc

- [P0] **pages/approval-svc/ConfirmationWorkbench/NotificationSettings.tsx**: 异步函数缺 setLoading 状态
-   - `handleSave` (行 51)
- [P2] **pages/approval-svc/ConfirmationWorkbench/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### artifact

- [P1] **pages/artifact/ArtifactPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### artifact-svc

- [P1] **pages/artifact-svc/ArtifactBrowser/TraceabilityChainView.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 121)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 147)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 162)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 硬编码颜色 `#999` (行 173)
- [P1] **pages/artifact-svc/ArtifactBrowser/VersionCompareDrawer.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/artifact-svc/Artifacts/ArtifactDetail.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/artifact-svc/Artifacts/ArtifactDetail.tsx**: 页面标题不规范 (行 0)
- [P1] **pages/artifact-svc/Artifacts/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/artifact-svc/artifact/ArtifactPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### code-svc

- [P2] **pages/code-svc/BuildEnv/BuildLogViewer.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P2] **pages/code-svc/BuildEnv/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P2] **pages/code-svc/CodeMgmt/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### community

- [P1] **pages/community/CommunityAdvancedPage.tsx**: 硬编码颜色 `#888` (行 208)
- [P1] **pages/community/CommunityAdvancedPage.tsx**: 硬编码颜色 `#888` (行 216)
- [P1] **pages/community/CommunityPage.tsx**: 硬编码颜色 `#52c41a` (行 340)

### community-svc

- [P1] **pages/community-svc/community/CommunityAdvancedPage.tsx**: 硬编码颜色 `#888` (行 208)
- [P1] **pages/community-svc/community/CommunityAdvancedPage.tsx**: 硬编码颜色 `#888` (行 216)
- [P1] **pages/community-svc/community/CommunityPage.tsx**: 硬编码颜色 `#52c41a` (行 340)

### config-mgmt

- [P1] **pages/config-mgmt/ConfigMgmtPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### data-pipeline

- [P1] **pages/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 346)
- [P1] **pages/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#52c41a` (行 351)
- [P1] **pages/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 467)
- [P1] **pages/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 469)
- [P1] **pages/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#52c41a` (行 493)

### deploy

- [P1] **pages/deploy/DeployPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/deploy/DeployPage.tsx**: 硬编码颜色 `#52c41a` (行 851)
- [P1] **pages/deploy/DeployPage.tsx**: 硬编码颜色 `#52c41a` (行 1226)

### deploy-svc

- [P1] **pages/deploy-svc/deploy/DeployPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/deploy-svc/deploy/DeployPage.tsx**: 硬编码颜色 `#52c41a` (行 886)
- [P1] **pages/deploy-svc/deploy/DeployPage.tsx**: 硬编码颜色 `#52c41a` (行 1314)

### developer-portal

- [P1] **pages/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#1677ff` (行 309)
- [P1] **pages/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#52c41a` (行 522)
- [P1] **pages/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#8c8c8c` (行 531)
- [P1] **pages/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#1677ff` (行 617)

### digital-twin

- [P1] **pages/digital-twin/DigitalTwinPage.tsx**: 硬编码颜色 `#52c41a` (行 384)
- [P1] **pages/digital-twin/DigitalTwinPage.tsx**: 硬编码颜色 `#1677ff` (行 389)

### disaster-recovery

- [P1] **pages/disaster-recovery/DisasterRecoveryPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/disaster-recovery/DisasterRecoveryPage.tsx**: 硬编码颜色 `#52c41a` (行 173)

### dr-svc

- [P1] **pages/dr-svc/disaster-recovery/DisasterRecoveryPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/dr-svc/disaster-recovery/DisasterRecoveryPage.tsx**: 硬编码颜色 `#52c41a` (行 240)

### env

- [P1] **pages/env/EnvironmentPage.tsx**: 硬编码颜色 `#52c41a` (行 619)

### federation

- [P1] **pages/federation/ExecutorManagementPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/federation/ExecutorManagementPage.tsx**: 硬编码颜色 `#52c41a` (行 223)
- [P1] **pages/federation/FederationPage.tsx**: 硬编码颜色 `#52c41a` (行 343)
- [P1] **pages/federation/FederationPage.tsx**: 硬编码颜色 `#1677ff` (行 348)

### federation-svc

- [P1] **pages/federation-svc/federation/ExecutorManagementPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/federation-svc/federation/ExecutorManagementPage.tsx**: 硬编码颜色 `#52c41a` (行 224)
- [P1] **pages/federation-svc/federation/FederationPage.tsx**: 硬编码颜色 `#52c41a` (行 344)
- [P1] **pages/federation-svc/federation/FederationPage.tsx**: 硬编码颜色 `#1677ff` (行 349)
- [P1] **pages/federation-svc/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 197)
- [P1] **pages/federation-svc/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 203)
- [P1] **pages/federation-svc/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 209)
- [P1] **pages/federation-svc/multi-cloud/MultiCloudPage.tsx**: 硬编码颜色 `#52c41a` (行 247)

### finops-svc

- [P2] **pages/finops-svc/AICostDashboard/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### gateway

- [P2] **pages/gateway/Console/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/gateway/DashboardCore/index.tsx**: 异步函数缺 setLoading 状态
- [P0] **pages/gateway/DashboardCore/index.tsx**: 异步函数缺 message.error 错误反馈
- [P1] **pages/gateway/DashboardCore/index.tsx**: 硬编码颜色 `#52c41a` (行 157)
- [P2] **pages/gateway/DashboardNew/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/gateway/Login/index.tsx**: 异步函数缺 setLoading 状态
-   - `handleSubmit` (行 20)
- [P1] **pages/gateway/Login/index.tsx**: 硬编码 boxShadow (行 55)

### governance-svc

- [P1] **pages/governance-svc/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#52c41a` (行 281)
- [P1] **pages/governance-svc/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#52c41a` (行 305)
- [P1] **pages/governance-svc/api-governance/ApiGovernancePage.tsx**: 硬编码颜色 `#888` (行 485)

### inception

- [P1] **pages/inception/InceptionPage.tsx**: 硬编码颜色 `#595959` (行 188)
- [P1] **pages/inception/InceptionPage.tsx**: 硬编码颜色 `#3370E6` (行 240)
- [P1] **pages/inception/InceptionPage.tsx**: 硬编码颜色 `#8c8c8c` (行 328)

### intelligence-svc

- [P2] **pages/intelligence-svc/AIReview/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### monitor-svc

- [P2] **pages/monitor-svc/Monitoring/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### multi-cloud

- [P1] **pages/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 197)
- [P1] **pages/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 203)
- [P1] **pages/multi-cloud/MultiCloudAdvancedPage.tsx**: 硬编码颜色 `#888` (行 209)
- [P1] **pages/multi-cloud/MultiCloudPage.tsx**: 硬编码颜色 `#52c41a` (行 246)

### notify-svc

- [P0] **pages/notify-svc/ChatOps/ChatOpsSettings.tsx**: 异步函数缺 setLoading 状态
-   - `handleSave` (行 115)
-   - `handleDNDSave` (行 132)
-   - `handleDNDToggle` (行 155)
- [P1] **pages/notify-svc/ChatOps/SmartRecommend.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/notify-svc/ChatOps/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/notify-svc/NotificationCenter/index.tsx**: 硬编码颜色 `#3370E6` (行 677)
- [P1] **pages/notify-svc/NotificationCenter/index.tsx**: 硬编码颜色 `#666` (行 733)
- [P1] **pages/notify-svc/NotificationRules/index.tsx**: 硬编码颜色 `#0089FF` (行 56)
- [P1] **pages/notify-svc/NotificationRules/index.tsx**: 硬编码颜色 `#2BAE67` (行 57)
- [P1] **pages/notify-svc/NotificationRules/index.tsx**: 硬编码颜色 `#3370FF` (行 58)

### orchestration

- [P1] **pages/orchestration/OrchestrationPage.tsx**: 硬编码颜色 `#1677ff` (行 409)
- [P1] **pages/orchestration/OrchestrationPage.tsx**: 硬编码颜色 `#52c41a` (行 427)

### pipeline-svc

- [P1] **pages/pipeline-svc/ApkCredentials/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/pipeline-svc/ApkUploadHistory/index.tsx**: 硬编码颜色 `#3f8600` (行 208)
- [P1] **pages/pipeline-svc/PipelineEditor/StageItem.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P0] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleOk` (行 244)
- [P2] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 硬编码颜色 `#999` (行 1091)
- [P1] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 硬编码颜色 `#999` (行 1196)
- [P1] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 硬编码颜色 `#999` (行 1310)
- [P1] **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 硬编码颜色 `#999` (行 1425)
- [P0] **pages/pipeline-svc/PipelineList/BatchActions.tsx**: 异步函数缺 setLoading 状态
-   - `handleBatchAction` (行 21)
- [P2] **pages/pipeline-svc/PipelineList/TemplateSelector.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/pipeline-svc/PipelineList/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/pipeline-svc/PipelineRunLive/index.tsx**: 硬编码颜色 `#000` (行 138)
- [P1] **pages/pipeline-svc/PipelineVersionHistory/YamlDiffViewer.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P0] **pages/pipeline-svc/cache/CacheConfigPage.tsx**: 异步函数缺 message.error 错误反馈
- [P1] **pages/pipeline-svc/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 346)
- [P1] **pages/pipeline-svc/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#52c41a` (行 351)
- [P1] **pages/pipeline-svc/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 467)
- [P1] **pages/pipeline-svc/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#1677ff` (行 469)
- [P1] **pages/pipeline-svc/data-pipeline/DataPipelinePage.tsx**: 硬编码颜色 `#52c41a` (行 493)
- [P1] **pages/pipeline-svc/orchestration/OrchestrationPage.tsx**: 硬编码颜色 `#1677ff` (行 409)
- [P1] **pages/pipeline-svc/orchestration/OrchestrationPage.tsx**: 硬编码颜色 `#52c41a` (行 427)
- [P2] **pages/pipeline-svc/pipeline-editor/canvas/PipelineCanvas.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/pipeline-svc/pipeline-editor/canvas/PipelineCanvas.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/pipeline-svc/pipeline-editor/canvas/StageNode.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/pipeline-svc/trigger/TriggerPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/pipeline-svc/trigger/TriggerPage.tsx**: 硬编码颜色 `#52c41a` (行 358)

### pipeline-template

- [P0] **pages/pipeline-template/PipelineTemplatePage.tsx**: 异步函数缺 message.error 错误反馈

### platform-core

- [P1] **pages/platform-core/CMDB/index.tsx**: 硬编码 boxShadow (行 606)
- [P1] **pages/platform-core/CanaryAnalysis/index.tsx**: 硬编码颜色 `#3370E6` (行 331)
- [P1] **pages/platform-core/ConfigManagement/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/platform-core/EventBus/index.tsx**: 硬编码颜色 `#3370E6` (行 284)
- [P2] **pages/platform-core/IacManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/platform-core/InternalLibrary/LibraryDetail.tsx**: 异步函数缺 setLoading 状态
-   - `handleCheck` (行 82)
- [P1] **pages/platform-core/InternalLibrary/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/platform-core/ModuleManager/ValidationReport.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/platform-core/PolicyManagement/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/platform-core/ProductLine/index.tsx**: 硬编码颜色 `#3370E6` (行 919)
- [P1] **pages/platform-core/RoleManagement/index.tsx**: 硬编码颜色 `#3370E6` (行 418)
- [P1] **pages/platform-core/RunnerManagement/index.tsx**: 硬编码颜色 `#8c8c8c` (行 474)
- [P1] **pages/platform-core/SecretsManagement/index.tsx**: 硬编码颜色 `#3370E6` (行 334)
- [P2] **pages/platform-core/SubApps/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/platform-core/SubApps/index.tsx**: 硬编码 boxShadow (行 81)
- [P1] **pages/platform-core/TenantManagement/index.tsx**: 硬编码颜色 `#3370E6` (行 172)
- [P1] **pages/platform-core/config-mgmt/ConfigMgmtPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/platform-core/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#1677ff` (行 309)
- [P1] **pages/platform-core/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#52c41a` (行 522)
- [P1] **pages/platform-core/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#8c8c8c` (行 531)
- [P1] **pages/platform-core/developer-portal/DeveloperPortalPage.tsx**: 硬编码颜色 `#1677ff` (行 617)
- [P1] **pages/platform-core/digital-twin/DigitalTwinPage.tsx**: 硬编码颜色 `#52c41a` (行 384)
- [P1] **pages/platform-core/digital-twin/DigitalTwinPage.tsx**: 硬编码颜色 `#1677ff` (行 389)
- [P1] **pages/platform-core/env/EnvironmentPage.tsx**: 硬编码颜色 `#52c41a` (行 547)
- [P1] **pages/platform-core/quality-gate/QualityGatePage.tsx**: 硬编码颜色 `#52c41a` (行 418)

### plugin-svc

- [P0] **pages/plugin-svc/PluginManagement/PluginCreateModal.tsx**: 异步函数缺 setLoading 状态
-   - `handleInstall` (行 46)
- [P2] **pages/plugin-svc/PluginManagement/PluginCreateModal.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P0] **pages/plugin-svc/PluginManagement/PluginDetail.tsx**: 异步函数缺 setLoading 状态
-   - `handleSaveConfig` (行 56)
- [P1] **pages/plugin-svc/PluginManagement/PluginDetail.tsx**: 页面标题不规范 (行 0)
- [P0] **pages/plugin-svc/PluginManagement/PluginLifecycle.tsx**: 异步函数缺 setLoading 状态
-   - `handleExecute` (行 35)
- [P0] **pages/plugin-svc/PluginManagement/PluginList.tsx**: 异步函数缺 setLoading 状态
-   - `handleToggleStatus` (行 111)
-   - `handleUpdate` (行 139)
-   - `handleDelete` (行 160)
- [P1] **pages/plugin-svc/PluginManagement/index.tsx**: 硬编码颜色 `#3370E6` (行 138)
- [P1] **pages/plugin-svc/PluginSPI/SPIConfig.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/plugin-svc/PluginSPI/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)

### quality-gate

- [P1] **pages/quality-gate/QualityGatePage.tsx**: 硬编码颜色 `#52c41a` (行 418)

### security-svc

- [P1] **pages/security-svc/ABACPolicy/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/security-svc/ABACPolicy/index.tsx**: 硬编码颜色 `#1890ff` (行 109)
- [P1] **pages/security-svc/Diagnostic/SessionDetail.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/security-svc/Diagnostic/Trigger.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/security-svc/Diagnostic/index.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/security-svc/PermissionAudit/index.tsx**: 硬编码颜色 `#1890ff` (行 184)
- [P1] **pages/security-svc/PermissionAudit/index.tsx**: 硬编码颜色 `#7C5CFC` (行 272)
- [P1] **pages/security-svc/ProjectMember/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/security-svc/SelfHealing/History.tsx**: 页面标题不规范 (行 0)
- [P2] **pages/security-svc/SelfHealing/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### skill-svc

- [P1] **pages/skill-svc/SkillManagement/SkillSubmission.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P2] **pages/skill-svc/SkillManagement/index.tsx**: 列表组件缺空状态引导 (<Empty>)

### test-mf

- [P1] **pages/test-mf/TestMFLoader/index.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/test-mf/TestMFLoader/index.tsx**: 硬编码颜色 `#3370E6` (行 172)
- [P1] **pages/test-mf/TestMFLoader/index.tsx**: 硬编码颜色 `#8c8c8c` (行 275)

### ticket-svc

- [P2] **pages/ticket-svc/TicketDetail/TicketComments.tsx**: 列表组件缺空状态引导 (<Empty>)
- [P1] **pages/ticket-svc/TicketDetail/TicketComments.tsx**: 硬编码 boxShadow (行 441)
- [P1] **pages/ticket-svc/TicketList/DispatchPanel.tsx**: 页面标题不规范 (行 0)

### trigger

- [P1] **pages/trigger/TriggerPage.tsx**: 删除/销毁操作缺确认弹窗 (Popconfirm/Modal.confirm)
- [P1] **pages/trigger/TriggerPage.tsx**: 硬编码颜色 `#52c41a` (行 357)

## 四、优先级修复汇总

### P0 - 交互完整性缺失 (必须修复)

- **pages/AgentDashboard/CreateAgentModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/AgentDashboard/TriggerRunModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ApprovalManagement/ApprovalRecordTable.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ApprovalManagement/FlowConfigForm.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ApprovalManagement/TimeoutConfig.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ChatOps/ApprovalConfig.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ChatOps/ApprovalConfig.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/ChatOps/AuditLogViewer.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/ChatOps/ChatOpsSettings.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/ChatOps/index.chat.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/ConfirmationWorkbench/NotificationSettings.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/DashboardCore/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/DashboardCore/index.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/DocumentCenter/SyncPanel.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/InternalLibrary/LibraryDetail.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/Login/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/PipelineEditor/StageModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/PluginManagement/PluginCreateModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/PluginManagement/PluginDetail.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/PluginManagement/PluginLifecycle.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/PluginManagement/PluginList.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/SubAppManagement/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/UserSettings/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/agent-svc/AgentDashboard/CreateAgentModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/agent-svc/AgentDashboard/TriggerRunModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/approval-svc/ConfirmationWorkbench/NotificationSettings.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/gateway/DashboardCore/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/gateway/DashboardCore/index.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/gateway/Login/index.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/notify-svc/ChatOps/ChatOpsSettings.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/pipeline-svc/PipelineList/BatchActions.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/pipeline-svc/cache/CacheConfigPage.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/pipeline-template/PipelineTemplatePage.tsx**: 异步函数缺少 message.error 错误反馈
- **pages/platform-core/InternalLibrary/LibraryDetail.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/plugin-svc/PluginManagement/PluginCreateModal.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/plugin-svc/PluginManagement/PluginDetail.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/plugin-svc/PluginManagement/PluginLifecycle.tsx**: 异步函数缺少 setLoading/loading 状态
- **pages/plugin-svc/PluginManagement/PluginList.tsx**: 异步函数缺少 setLoading/loading 状态

### P1 - 样式规范违规 (建议修复)

- **硬编码颜色**: 所有 `color: '#xxx'` 应使用 `colors.xxx` Token
- **圆角违规**: borderRadius 应使用 `componentRadius.*` (card=12, modal=16, button=6)
- **阴影违规**: boxShadow 应使用 `shadows.*` Token
- **pages/AIAgents/index.tsx**: 行 214 硬编码 boxShadow
- **pages/AgentDashboard/AgentTable.tsx**: 删除操作缺少确认弹窗
- **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 删除操作缺少确认弹窗
- **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 行 121 硬编码颜色 `#999`
- **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 行 147 硬编码颜色 `#999`
- **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 行 162 硬编码颜色 `#999`
- **pages/ArtifactBrowser/VersionCompareDrawer.tsx**: 行 173 硬编码颜色 `#999`
- **pages/Artifacts/index.tsx**: 删除操作缺少确认弹窗
- **pages/CMDB/TopologyPage.tsx**: 行 95 硬编码 boxShadow
- **pages/CMDB/WebTerminalPage.tsx**: 行 109 硬编码颜色 `#1e1e1e`
- **pages/CMDB/WebTerminalPage.tsx**: 行 386 硬编码颜色 `#1e1e1e`
- **pages/Capability/CapabilityList.tsx**: 删除操作缺少确认弹窗
- **pages/Capability/RoleCapabilityMapping.tsx**: 删除操作缺少确认弹窗
- **pages/Capability/UserCapabilityMapping.tsx**: 删除操作缺少确认弹窗
- **pages/ChatOps/ChatDashboard.tsx**: 行 134 硬编码颜色 `#999`
- **pages/ChatOps/ChatDashboard.tsx**: 行 137 硬编码颜色 `#999`
- **pages/ChatOps/ChatDashboard.tsx**: 行 226 硬编码颜色 `#52c41a`
- **pages/ChatOps/ChatDashboard.tsx**: 行 245 硬编码颜色 `#722ed1`
- **pages/ChatOps/ChatOpsSettings.tsx**: 删除操作缺少确认弹窗
- **pages/ChatOps/ChatOpsSettings.tsx**: 行 251 硬编码颜色 `#999`
- **pages/ChatOps/index.tsx**: 行 88 硬编码颜色 `#3370e6`
- **pages/ChatOps/index.tsx**: 行 89 硬编码颜色 `#3370e6`
- **pages/ConfigManagement/index.tsx**: 删除操作缺少确认弹窗
- **pages/DashboardCore/index.tsx**: 行 157 硬编码颜色 `#52c41a`
- **pages/Diagnostic/SessionDetail.tsx**: 删除操作缺少确认弹窗
- **pages/Diagnostic/Trigger.tsx**: 删除操作缺少确认弹窗
- **pages/ExecutiveDashboard/index.tsx**: 行 257 硬编码颜色 `#888`
- **pages/ExecutiveDashboard/index.tsx**: 行 277 硬编码颜色 `#888`
- **pages/InternalLibrary/index.tsx**: 删除操作缺少确认弹窗
- **pages/ModuleManager/ValidationReport.tsx**: 删除操作缺少确认弹窗
- **pages/NotificationCenter/index.tsx**: 行 731 硬编码颜色 `#666`
- **pages/NotificationRules/index.tsx**: 行 56 硬编码颜色 `#0089FF`
- **pages/NotificationRules/index.tsx**: 行 57 硬编码颜色 `#2BAE67`
- **pages/NotificationRules/index.tsx**: 行 58 硬编码颜色 `#3370FF`
- **pages/PipelineEditor/StageItem.tsx**: 删除操作缺少确认弹窗
- **pages/PipelineEditor/StageModal.tsx**: 删除操作缺少确认弹窗
- **pages/PipelineEditor/StageModal.tsx**: 行 726 硬编码颜色 `#999`
- **pages/PipelineList/index.tsx**: 删除操作缺少确认弹窗
- **pages/PluginSPI/SPIConfig.tsx**: 删除操作缺少确认弹窗
- **pages/PluginSPI/index.tsx**: 删除操作缺少确认弹窗
- **pages/PolicyManagement/index.tsx**: 删除操作缺少确认弹窗
- **pages/RunnerManagement/index.tsx**: 行 474 硬编码颜色 `#8c8c8c`
- **pages/SkillManagement/AuditHistory.tsx**: 删除操作缺少确认弹窗
- **pages/SkillManagement/SkillSubmission.tsx**: 删除操作缺少确认弹窗
- **pages/SubApps/index.tsx**: 行 142 硬编码 boxShadow
- **pages/TenantList/index.tsx**: 行 502 硬编码颜色 `#3370E6`
- **pages/TicketDetail/TicketComments.tsx**: 行 441 硬编码 boxShadow
- **pages/UserProfile/index.tsx**: 删除操作缺少确认弹窗
- **pages/VectorStore/index.tsx**: 删除操作缺少确认弹窗
- **pages/agent-svc/AgentDashboard/AgentTable.tsx**: 删除操作缺少确认弹窗

... 还有 137 项

### P2 - 体验优化 (可选)

- **pages/AIAgents/AgentDetail.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AICostDashboard/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AIDashboard/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AIDocManagement/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AIReview/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AgentDashboard/AgentDetailDrawer.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/AgentDashboard/AgentRunList.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ApprovalManagement/FlowConfigForm.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/Artifacts/ArtifactDetail.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/BuildEnv/BuildLogViewer.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/BuildEnv/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/CMDB/AuditLogPage.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/CMDB/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/Capability/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ChatOps/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/CodeMgmt/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ConfirmationWorkbench/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/Diagnostic/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/IacManagement/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/LLMTraceDashboard/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/Monitoring/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/PipelineEditor/StageModal.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/PluginManagement/PluginCreateModal.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/SelfHealing/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/SkillManagement/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/TicketDetail/TicketComments.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/VectorStore/CollectionDetail.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/WorkflowDesigner/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/agent-svc/AgentDashboard/AgentDetailDrawer.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/agent-svc/AgentDashboard/AgentRunList.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ai-svc/AIDocManagement/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ai-svc/LLMTraceDashboard/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/ai-svc/VectorStore/CollectionDetail.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/approval-svc/ConfirmationWorkbench/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/artifact-svc/Artifacts/ArtifactDetail.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/code-svc/BuildEnv/BuildLogViewer.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/code-svc/BuildEnv/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/code-svc/CodeMgmt/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/finops-svc/AICostDashboard/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/gateway/Console/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/gateway/DashboardNew/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/intelligence-svc/AIReview/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/monitor-svc/Monitoring/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/notify-svc/ChatOps/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/pipeline-svc/PipelineEditor/StageModal.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/pipeline-svc/PipelineList/TemplateSelector.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/pipeline-svc/pipeline-editor/canvas/PipelineCanvas.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/pipeline-svc/pipeline-editor/canvas/StageNode.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/platform-core/IacManagement/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮
- **pages/platform-core/SubApps/index.tsx**: 列表为空时建议添加 <Empty> + 引导按钮

... 还有 5 项
