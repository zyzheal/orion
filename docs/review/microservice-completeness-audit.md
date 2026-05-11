# 后端拆分完整性与前端覆盖审计报告

> 审计日期: 2026-05-11
> 审计范围: 15 微服务拆分合理性、剩余模块分析、前端页面/API 覆盖

## 1. 15 个微服务拆分合理性评估

### ✅ 拆分合理的模块 (15/15)

| 微服务 | 代码量 | 前端页面数 | API 客户端 | 拆分评价 |
|--------|--------|-----------|-----------|---------|
| **ticket-svc** | 11,051 行 | 2 (TicketList, TicketDetail) | ticketing.ts | ✅ 独立工单域 |
| **finops-svc** | 8,265 行 | 4 (FinOps, cost, cost-operations, AICostDashboard) | finops.ts, cost-operations.ts, bi.ts | ✅ 独立 FinOps 域 |
| **code-svc** | 12,255 行 | 4 (CodeMgmt, BuildEnv, TestReport, TestSelector) | code-mgmt.ts, build-env.ts, testReports.ts, test-selector.ts | ✅ 完整 CI/CD 域 |
| **plugin-svc** | 3,983 行 | 3 (PluginManagement, PluginSPI, plugin-marketplace) | pluginApi.ts, plugin-spi.ts, plugins.ts | ✅ 插件域完整 |
| **ai-svc** | 12,487 行 | 8 (AIGateway, ai-decision, AIReview, AISecurity, VectorStore, LLMTraceDashboard, AIReview, ai-decision-explanation) | ai-gateway.ts, ai-decision.ts, ai-review.ts, ai-security.ts, vector-store.ts, llm-trace.ts, ai-cost.ts | ✅ AI 域最大且完整 |
| **security-svc** | 4,747 行 | 5 (RiskDashboard, SbomDashboard, supply-chain, PolicyManagement, quality-gate) | risk.ts, sbom.ts, supply-chain.ts, policies.ts, quality-gate.ts | ✅ 安全域完整 |
| **artifact-svc** | 2,013 行 | 4 (Artifacts, ArtifactBrowser, Artifacts, ArtifactVersion) | artifacts.ts, artifact-ops.ts, artifactVersions.ts | ✅ 制品域完整 |
| **efficiency-svc** | 4,652 行 | 4 (EfficiencyDashboard, efficiency, EngineerDashboard, ExecutiveDashboard) | efficiency.ts | ✅ 效能度量完整 |
| **dr-svc** | 5,446 行 | 2 (Backup, disaster-recovery) | backup.ts, disaster-recovery.ts | ✅ 灾备域完整 |
| **federation-svc** | 2,681 行 | 2 (federation, multi-cloud) | federation.ts, multi-cloud.ts | ✅ 多云联邦完整 |
| **pipeline-svc** | 14,991 行 | 15 (pipeline, PipelineDetail, PipelineEditor, PipelineList, PipelineRunList, PipelineRunLive, PipelineVersionHistory, PipelineBudget, pipeline-template, autonomous-pipeline, data-pipeline, canary-traffic, CanaryAnalysis, PRTriggerManagement, trigger) | pipelines.ts, pipelineRuns.ts, pipeline-budget.ts, pipeline-templates.ts, pipeline-versions.ts, autonomous-pipeline.ts, data-pipeline.ts, canary-analysis.ts, canary-traffic.ts, prTriggers.ts, triggers.ts | ✅ 流水线域最大最完整 |
| **deploy-svc** | 4,034 行 | 3 (deploy, DeploymentList, DeploymentDetail) | deployments.ts | ✅ 部署域完整 |
| **monitor-svc** | 1,990 行 | 8 (Monitoring, AlertList, OnCall, SelfHealing, observability, performance, Queue, NotificationCenter) | monitoring.ts, alerts.ts, oncall.ts, self-healing.ts, observability.ts, performance.ts, queue.ts, notifications.ts, notificationRules.ts | ✅ 监控域最广泛 |
| **intelligence-svc** | 715 行 (Python) | 2 (Diagnostic, ChangeIntelligence) | diagnostic.ts, change-intelligence.ts | ✅ AI 智能分析完整 |
| **agent-svc** | 2,037 行 | 3 (AgentDashboard, AgentRunDetail, RunnerManagement) | agents.ts, runners.ts | ✅ Agent 域完整 |

**结论: 15 个微服务的拆分是合理的** — 每个服务都有明确的业务边界、对应的前端页面和 API 客户端。

## 2. 还需要拆分的模块分析

### platform-service 剩余 55 个服务目录

按业务域分组：

#### IAM/Auth 域 (6 个服务, 32 文件) — 建议保留在 platform-core

| 模块 | 文件数 | 前端页面 | API 客户端 | 建议 |
|------|--------|---------|-----------|------|
| tenant | 10 | TenantManagement | tenant.ts | 保留 (平台内核) |
| role | 3 | RoleManagement | roles.ts | 保留 (平台内核) |
| user | 3 | UserManagement | users.ts | 保留 (平台内核) |
| api-key | 3 | ApiKeyManagement | api-key.ts | 保留 (平台内核) |
| privacy | 5 | - | - | 保留 (平台内核) |
| session | 3 | Sessions | session.ts | 保留 (平台内核) |
| auth | 4 | Login | auth.ts | 保留 (平台内核) |

**理由**: IAM 是平台核心身份层，拆分价值低，耦合度高。

#### 基础设施域 (4 个服务, 12 文件) — 建议保留

| 模块 | 文件数 | 前端页面 | API 客户端 | 建议 |
|------|--------|---------|-----------|------|
| project | 3 | Projects | projects.ts | 保留 |
| environment | 4 | Environments, env | environments.ts | 保留 |
| ephemeral-env | 1 | EphemeralEnvList, EphemeralEnvDetail | ephemeral-envs.ts | 保留 |
| product-line | 1 | ProductLine | product-lines.ts | 保留 |

**理由**: 基础设施是跨租户的平台能力，不适合独立微服务。

#### 配置域 (3 个服务, 22 文件) — 建议保留

| 模块 | 文件数 | 前端页面 | API 客户端 | 建议 |
|------|--------|---------|-----------|------|
| config | 7 | ConfigManagement, feature-flags | config.ts, feature-flags.ts | 保留 |
| config-mgmt | 13 | config-mgmt | config-mgmt.ts | 保留 |
| scheduler | 5 | CronManagement | cron.ts | 可考虑独立 |

#### 前端页面存在但后端仍在 platform-service 的模块

| 前端页面 | 后端模块 (platform-service) | API 客户端 | 拆分建议 |
|---------|---------------------------|-----------|---------|
| ChatOps | chatops (17 文件) | chatops.ts | ⚠️ 可独立 (通信域) |
| WebhookManagement | webhook (3 文件) | webhook.ts | 保留 (轻量) |
| NotificationCenter | notification (5 文件) | notifications.ts, notificationRules.ts | ⚠️ 可独立 (已有 orion-notify-svc) |
| EventBus | event-bus (3 文件) | eventbus.ts | 保留 (平台内核) |
| Approvals/approval | approval (6 文件) | approvals.ts | ⚠️ 可独立 |
| ConfirmationWorkbench | confirmation (1 文件) | confirmations.ts | 保留 (轻量) |
| CMDB | cmdb (6 文件) | cmdb.ts | 保留 (平台内核) |
| community | community (4 文件) | community.ts | 保留 (实验性，已有 orion-community-svc) |
| IacManagement | iac (4 文件) | iac.ts | 保留 |
| api-governance | api-governance (5 文件) | api-governance.ts | 保留 (已有 orion-governance-svc) |
| DigitalTwin/digital-twin | digital-twin (7 文件) | digital-twin.ts | 保留 (实验性) |
| ModuleManager | module-lifecycle (4 文件) | module-manager.ts | 保留 (平台内核) |
| SkillManagement | skill (3 文件) | skills.ts | 保留 (轻量，已有 orion-skill-svc) |
| KnowledgeBase | knowledge (3 文件) | knowledge.ts | 保留 (已有 orion-knowledge-svc) |
| InternalLibrary | internal-library (1 文件) | internal-library.ts | 保留 |
| SecretsManagement | degradation (2 文件) | secrets.ts | ⚠️ 可独立 |

#### 前端有页面但后端模块名称不匹配的

| 前端页面 | 可能对应后端 | API 客户端 | 状态 |
|---------|------------|-----------|------|
| ChaosEngineering/chaos/circuit-breaker | guardian (4 文件) | chaos.ts, circuit-breaker.ts | ⚠️ 后端代码少 |
| rate-limiting | - | rate-limiting.ts | ✅ API 有但后端无独立模块 |
| DeveloperPortal | developer-portal (1 文件) | developer-portal.ts | ⚠️ 后端代码少 |
| ModelVersions | model-version (2 文件) | - | ⚠️ 无独立 API |
| PipelineEditor | - | - | ✅ 已归入 pipeline-svc |
| TicketList/TicketDetail | - | ticketing.ts | ✅ 已归入 ticket-svc |
| FinOpsDashboard | - | finops.ts | ✅ 已归入 finops-svc |

## 3. 前端视觉模块覆盖情况

### 覆盖完整的服务 (15/15) ✅

| 微服务 | 前端页面 | API 客户端 | 覆盖状态 |
|--------|---------|-----------|---------|
| ticket-svc | 2 | 1 | ✅ 完整 |
| finops-svc | 4 | 3 | ✅ 完整 |
| code-svc | 4 | 4 | ✅ 完整 |
| plugin-svc | 3 | 3 | ✅ 完整 |
| ai-svc | 8 | 7 | ✅ 完整 |
| security-svc | 5 | 5 | ✅ 完整 |
| artifact-svc | 4 | 3 | ✅ 完整 |
| efficiency-svc | 4 | 1 | ✅ 完整 |
| dr-svc | 2 | 2 | ✅ 完整 |
| federation-svc | 2 | 2 | ✅ 完整 |
| pipeline-svc | 15 | 11 | ✅ 完整 |
| deploy-svc | 3 | 1 | ✅ 完整 |
| monitor-svc | 8 | 9 | ✅ 完整 |
| intelligence-svc | 2 | 2 | ✅ 完整 |
| agent-svc | 3 | 2 | ✅ 完整 |

**前端页面总数**: 123 个目录
**前端 API 客户端总数**: 97 个文件
**Mock 数据残留**: 4 个页面 (ArtifactBrowser, OnCall, RoleManagement, UserManagement) — 需清理

## 4. 发现与建议

### 建议拆分的模块 (可选)

| 模块 | 理由 | 优先级 |
|------|------|--------|
| **chatops** | 17 文件，有独立前端和 API 客户端，已有 Gateway 路由 | P2 |
| **notification** | 5 文件 + orion-notify-svc 已存在 | P2 (已有独立服务) |
| **approval** | 6 文件，有独立前端和 API 客户端 | P3 |
| **secrets** | 安全管理子域，有独立前端页面 | P3 |

### 建议保留在 platform-core 的模块

- IAM/Auth (tenant/role/user/api-key/privacy/session/auth) — 平台身份层
- 基础设施 (project/environment/product-line) — 跨租户能力
- 配置 (config/config-mgmt) — 平台配置管理
- 事件总线 (event-bus) — 平台事件层
- CMDB — 配置管理数据库

### 需要清理的前端 Mock 数据

1. **RoleManagement** — MOCK_ROLES 和 MOCK_USER_ASSIGNMENTS 硬编码
2. **UserManagement** — MOCK_USERS 硬编码
3. **ArtifactBrowser** — generateMockVersions 兜底逻辑
4. **OnCall** — Fallback users 兜底逻辑

### 总结

**15 个微服务的拆分是合理的且前端覆盖完整**。剩余 55 个 platform-service 服务目录中，大部分是平台内核功能（IAM、基础设施、配置），不建议进一步拆分。只有 chatops/notification/approval 3 个模块有独立拆分的价值，但优先级不高。
