# Orion 全量功能实现规划（0 外部组件方案）

> 版本: 1.0
> 日期: 2026-05-06
> 来源: 领域专家团评审 + Brainstorming 深度分析
> 约束: 0 外部基础设施，完全基于现有能力增强

---

## 一、系统现状

### 1.1 后端

| 维度 | 数量 | 说明 |
|------|------|------|
| 服务模块 | 109 个 | `src/services/` 下 495 个 .ts 文件 |
| API 路由 | 99 个 | `src/api/` 下 99 个路由文件 |
| 已有 Repository | ~50 个服务域 | 74 文件已有 Repository 实现 |
| 使用 Map() 存储 | ~40+ 个服务域 | 148 文件仍有 Map() |
| 持久化覆盖率 | ~46% | 从 Map()→Repository 需迁移 |
| EventBus | 1079 行 | NATS JetStream + in-memory fallback |
| ModuleManager | 4 层架构 | Core/Domain/Service/Feature，已实现 |

### 1.2 前端

| 维度 | 数量 | 说明 |
|------|------|------|
| 页面组件 | 109 个目录，213 个 .tsx/.ts 文件 | `orion-frontend/src/pages/` |
| 路由注册 | 162 条 | `router/routes.ts` |
| 图表组件 | 9 个 | Bar/Gauge/Pie/Sankey/StatCard/Timeline/TrendLine/Heatmap/TreeMap |
| 布局组件 | 2 个 | DashboardLayout + MetricCard |
| 技术栈 | React 18 + Vite + Ant Design 5 + Zustand + ECharts 6 | 已确认 |

### 1.3 页面分级

| 级别 | 数量 | 占比 | 特征 |
|------|------|------|------|
| **A 级：真实 API** | 13 个 | 12% | 已调用 `/api/v1/` 端点 |
| **B 级：Mock 数据** | 12 个 | 11% | 使用 `__mocks__/` 静态数据 |
| **C 级：空壳/框架** | 84 个 | 77% | 仅 UI 框架，无数据源 |

---

## 二、缺失域分析（专家团评审覆盖率 44%）

### 2.1 7 大缺失域（61 个模块）

| 缺失域 | 模块数 | 严重度 | 说明 |
|--------|--------|--------|------|
| AI/Agent 域 | 12 | 🔴 致命 | 平台核心主张 "AI-driven DevOps" 中枢 |
| 平台扩展域 | 11 | 🟡 重要 | 插件/社区/开发者门户/SBOM/Webhook 等 |
| 基础设施管理域 | 8 | 🟡 重要 | IaC/多云/CMDB/环境管理等 |
| 跨域编排域 | 8 | 🟡 重要 | 降级/数字孪生/风险管理等 |
| CI/CD 增强域 | 5 | 🟠 需补充 | 金丝雀/智能部署/部署窗口 |
| 工单协作域 | 4 | 🟠 需补充 | 工单/ChatOps/通知/升级 |
| 事件总线域 | 2 | 🟢 可后做 | event-bus + event-bus-service |

### 2.2 已覆盖模块（方案 C，48 个）

数据持久化补齐（40 服务域）、监控中心、CI/CD 可视化、效率仪表盘、功能域管理、限流熔断、后端审计中间件、RLS 租户隔离、高级 CI/CD、Feature Flag 增强。

---

## 三、全量工作流（12 个工作流）

### 工作流 1-10：方案 C 范围

| # | 工作流 | 内容 | 工期 |
|---|--------|------|------|
| 1 | 数据持久化补齐 | 40 服务域 Map→Repository | 4-6 周 |
| 2 | 监控中心 | monitoring + metrics + alert 前端 | 1-2 周 |
| 3 | CI/CD 可视化 | pipeline + deploy + build 前端 | 1-2 周 |
| 4 | 效率仪表盘 | efficiency + finops + cost 前端 | 1 周 |
| 5 | 功能域管理 | ModuleManager 前端 | 1 周 |
| 6 | 限流熔断 | cockatiel + @fastify/rate-limit | 1-2 周 |
| 7 | 后端审计中间件 | Fastify hook 审计 | 1 周 |
| 8 | RLS 租户隔离 | PostgreSQL 行级安全 | 1 周 |
| 9 | 高级 CI/CD | 模板 + 智能测试 + 缓存 | 2-3 周 |
| 10 | Feature Flag 增强 | 按租户灰度 | 1 周 |

### 工作流 11：AI/Agent 域（新增）

**后端（2-3 周）**：
- ai(18), agent(5), knowledge(6), skill(6) — Repository 迁移（12 文件）
- AI 决策链路增强、Agent 生命周期管理、知识库 RAG 增强

**前端（3-4 周，20+ 页面）**：
- AgentDashboard(7), AIReview(6), AICostDashboard(6), LLMTraceDashboard(5)
- AIDocManagement(5), SkillManagement(4), KnowledgeBase, AIGateway, AISecurity
- AIDecisionPage, VectorStore(6), AgentRunDetail
- **状态**：全部 C 级或 B 级，无真实 API

### 工作流 12：事件响应与工单协作（新增）

**后端（2-3 周）**：
- ticketing(17), chatops(16), notification(6), escalation(3) — Repository 迁移（8 文件）
- 通知渠道实现（DingTalk/WeChat/Email/SMS）、工单 SLA 引擎

**前端（2-3 周，16+ 页面）**：
- ChatOps(5), TicketList(3), TicketDetail(2), Approvals, NotificationCenter
- ConfirmationWorkbench(5), PolicyManagement, CompliancePage
- **状态**：Ticket 系列 B 级，其余 C 级

### 工作流 13：基础设施管理（新增）

**后端（2-3 周）**：
- iac(7), multi-cloud(5), cmdb(6), code-repo(11), environment(10), federation(3), ephemeral-env(2), k8s-provisioner
- Repository 迁移（10 文件）、多云资源抽象、IaC Terraform 执行器

**前端（3-4 周，30+ 子页面）**：
- IaCManagement(5), CodeMgmt(5), CMDB, Environments, EphemeralEnv(2)
- MultiCloudPage, FederationPage, DigitalTwin, DisasterRecovery
- **状态**：全部 C 级

### 工作流 14：安全合规（新增）

**后端（1-2 周）**：
- policy(7), privacy(5), ai-security, auth 增强
- 策略评估引擎、隐私合规检查

**前端（1 周，4 页面）**：
- PolicyManagement, AISecurity, ApiKeyManagement, CompliancePage
- **状态**：全部 C 级

### 工作流 15：CI/CD 增强（新增）

**后端（2 周）**：
- canary-analysis(5), canary-traffic(8), smart-deploy(10), deployment-window, adaptive-pipeline
- 金丝雀分析引擎、智能部署策略

**前端（1-2 周，6+ 页面）**：
- CanaryAnalysis, CanaryTrafficPage, DeployPage
- PipelineBudgetPage, PipelineTemplatePage, PipelineVersionPage
- **状态**：3 个未注册路由，3 个 C 级

### 工作流 16：平台扩展（新增）

**后端（2-3 周）**：
- plugin(5), plugin-marketplace(6), plugin-spi(10), plugin-executor, plugin-manager
- community, developer-portal, internal-library, project(6), queue(6), sbom(10), scheduler(6), webhook(6), multi-modal-trigger
- Repository 迁移（15 文件）

**前端（2-3 周，15+ 页面）**：
- PluginManagement(6), PluginSPI(4), PluginMarketplacePage
- CommunityPage, DeveloperPortalPage, InternalLibrary(4), ProductLine(A), SbomDashboard(A)
- CronManagement, WebhookManagement, TestSelector, TriggerPage
- **状态**：Plugin 系列 B/C 混合，其余 C 级

### 工作流 17：事件总线 + 跨域编排（新增）

**后端（2-3 周）**：
- event-bus(4), event-bus-service(1079行), change-intelligence(4), confirmation(4), consistency, output-validation, quality-gate, degradation(5), degradation-config, incident, data-pipeline(5), digital-twin(10), risk-assessment(9), risk-engine(6), performance(6)
- Repository 迁移（12 文件）

**前端（2-3 周，12+ 页面）**：
- EventBus(B), ChangeIntelligence, DigitalTwin, DisasterRecovery, DataPipelinePage
- PerformancePage, OrchestrationPage, RiskDashboard, SupplyChainPage
- ApiGovernancePage, QualityGatePage
- **状态**：EventBus B 级，其余 C 级

---

## 四、C 级页面 API 对接详细分析

### 4.1 A 级页面（13 个，已有真实 API，需增强）

| 页面 | 已有 API | 需增强 |
|------|----------|--------|
| PipelineList/Detail/Editor | /api/v1/pipelines/* | WebSocket 日志、模板、批量操作 |
| DeploymentList/Detail | /api/v1/deployments/* | 回滚、时间线可视化 |
| AlertList | /api/v1/alerts | 关联图、根因分析 |
| AgentDashboard | /api/v1/agents/* | 生命周期管理 |
| Artifacts(4子页面) | /api/v1/artifacts/* | 制品下载/预览 |
| SbomDashboard/Detail | /api/v1/sbom/* | 依赖投毒检测 |
| TenantManagement | /api/v1/tenants/* | 配额管理 |
| ConfigManagement | /api/v1/config/* | 版本对比 |
| AuditLog | /api/v1/audit/* | 链式哈希验证 |
| RoleManagement | /api/v1/roles/* | 权限矩阵 |
| ProductLine | /api/v1/product-lines | 产品线关联 |
| InternalLibrary(4子页面) | /api/v1/internal-libraries/* | 内部库发布 |

### 4.2 B 级页面（12 个，Mock→真实 API）

| 页面 | Mock 文件 | 需对接 API | 难度 |
|------|----------|-----------|------|
| ExecutiveDashboard | mockBIData.ts | /api/v1/efficiency/executive | ⭐⭐ |
| ManagerDashboard | mockBIData.ts | /api/v1/efficiency/manager | ⭐⭐ |
| EngineerDashboard | mockBIData.ts | /api/v1/efficiency/engineer | ⭐⭐ |
| NotificationCenter | mockNotificationData.ts | /api/v1/notifications/* | ⭐ |
| DashboardCore | mockBIData.ts | /api/v1/dashboard | ⭐⭐ |
| PluginManagement | mockPluginData.ts | /api/v1/plugins/* | ⭐⭐ |
| TicketList(3子页面) | mockTicketData.ts | /api/v1/tickets/* | ⭐⭐⭐ |
| TicketDetail(2子页面) | mockTicketData.ts | /api/v1/tickets/:id/* | ⭐⭐⭐ |
| PipelineDetail(部分) | mockData.ts | /api/v1/pipelines/:id | ⭐ |
| VectorStore(6子页面) | utils.ts mock | /api/v1/vector-store/* | ⭐⭐ |
| EventBus | mockData.ts | /api/v1/eventbus/* | ⭐⭐⭐ |

### 4.3 C 级页面（84 个，完整开发）

#### 监控与 AI 域（20+ 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| Monitoring(6子页面) | /api/v1/monitoring/* | ⭐⭐⭐ |
| Diagnostic(5子页面) | /api/v1/diagnostic/* | ⭐⭐⭐ |
| SelfHealing(6子页面) | /api/v1/self-healing/* | ⭐⭐⭐ |
| LLMTraceDashboard(5子页面) | /api/v1/llm-trace/* | ⭐⭐⭐ |
| AICostDashboard(6子页面) | /api/v1/ai-cost/* | ⭐⭐⭐ |
| AIDocManagement(5子页面) | /api/v1/ai-docs/* | ⭐⭐⭐ |
| AIReview(6子页面) | /api/v1/ai-review/* | ⭐⭐ |
| AIGateway, AISecurity, AIDecisionPage, MetricsDashboard, Observability(3), PerformancePage, RiskDashboard | 各域 API | ⭐⭐⭐ |

#### 平台管理域（15+ 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| PluginSPI(4子页面) | /api/v1/plugin-spi/* | ⭐⭐⭐ |
| IaCManagement(5子页面) | /api/v1/iac/* | ⭐⭐⭐ |
| CodeMgmt(5子页面) | /api/v1/code-repos/* | ⭐⭐ |
| CMDB, WebhookManagement, CronManagement, Queue, OnCall, Sessions, UserManagement, ApiKeyManagement | 各域 API | ⭐⭐ |

#### 协作与工单域（10+ 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| ChatOps(5子页面) | /api/v1/chatops/* | ⭐⭐⭐⭐ |
| Approvals, ApprovalPage, ConfirmationWorkbench(5子页面) | /api/v1/approvals/* | ⭐⭐ |
| PolicyManagement, CompliancePage | /api/v1/policies/* | ⭐⭐ |

#### 效率成本域（5 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| EfficiencyDashboard, EfficiencyPage | /api/v1/efficiency/* | ⭐⭐ |
| FinOpsDashboard, CostOperationsPage, BudgetGuardPage | /api/v1/finops/*, /api/v1/cost/* | ⭐⭐ |

#### 基础设施域（15+ 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| Environments, EnvironmentPage | /api/v1/environments/* | ⭐⭐ |
| EphemeralEnvList, EphemeralEnvDetail | /api/v1/ephemeral-env/* | ⭐⭐ |
| MultiCloudPage, FederationPage, DigitalTwin, DisasterRecoveryPage, DataPipelinePage | 各域 API | ⭐⭐⭐ |
| Backup, OrchestrationPage, SupplyChainPage, ApiGovernancePage | 各域 API | ⭐⭐ |

#### CI/CD 增强域（6 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| PipelineBudgetPage, PipelineTemplatePage, PipelineVersionPage | /api/v1/pipeline-budget/*, /api/v1/pipeline-template/*, /api/v1/pipeline-version/* | ⭐⭐ |
| DeployPage, CanaryAnalysis, CanaryTrafficPage, ChaosExperimentPage | /api/v1/deploy/*, /api/v1/canary/*, /api/v1/chaos/* | ⭐⭐⭐ |

#### 开发者生态域（10+ 页面）

| 页面 | 需后端 API | 难度 |
|------|-----------|------|
| SkillManagement(4子页面) | /api/v1/skills/* | ⭐⭐ |
| CommunityPage, DeveloperPortalPage, TriggerPage | /api/v1/community/*, /api/v1/triggers | ⭐⭐ |
| AgentRunDetail, KnowledgeBase, ChangeIntelligence, TestSelector, QualityGatePage, AutonomousPipelinePage, PluginMarketplacePage | 各域 API | ⭐⭐ |

---

## 五、工时汇总

### 5.1 按工作流

| 工作流 | 后端 | 前端 | 总计 |
|--------|------|------|------|
| 1-10（方案 C） | 6-8 周 | 8-13 周 | 14-21 周 |
| 11 AI/Agent | 2-3 周 | 3-4 周 | 3-4 周 |
| 12 事件工单 | 2-3 周 | 2-3 周 | 3-4 周 |
| 13 基础设施 | 2-3 周 | 3-4 周 | 4-5 周 |
| 14 安全合规 | 1-2 周 | 1 周 | 1-2 周 |
| 15 CI/CD 增强 | 2 周 | 1-2 周 | 2-3 周 |
| 16 平台扩展 | 2-3 周 | 2-3 周 | 3-4 周 |
| 17 事件总线+跨域 | 2-3 周 | 2-3 周 | 3-4 周 |

### 5.2 API 对接工作量

| 类别 | 数量 | 工作量 |
|------|------|--------|
| A 级页面增强 | 13 个 | 8-15 人天 |
| B 级页面 Mock→API | 12 个 | 8-12 人天 |
| C 级页面完整开发 | 84 个 | 55-85 人天 |
| 后端缺失 API | ~25 个 | 15-25 人天（后端） |
| **总计** | | **71-112 人天 ≈ 14-22 周（2 人并行）** |

### 5.3 总计（可并行优化）

| 维度 | 串行 | 可并行 |
|------|------|--------|
| 总后端工作量 | 19-24 周 | 12-16 周（2 人） |
| 总前端工作量 | 22-30 周 | 14-20 周（2 人） |
| 总工期 | 30-45 周 | **18-28 周（前后端并行）** |

---

## 六、分两期实施建议

### 第一期（18-24 周）— 核心价值

包含：工作流 1-10（方案 C 全量）+ 工作流 11（AI/Agent）+ 工作流 15（CI/CD 增强）+ 工作流 14（安全合规）+ 工作流 16（平台扩展高频部分）

**交付物**：
- 100% 数据持久化覆盖率
- 全量 AI/Agent 域（平台差异化核心）
- 完整 CI/CD 可视化
- 安全合规基础
- 核心平台扩展（插件、社区、Webhook 等）

### 第二期（12-16 周）— 完整覆盖

包含：工作流 12（事件工单）+ 工作流 13（基础设施管理）+ 工作流 17（事件总线+跨域编排）+ 剩余 C 级页面对接

**交付物**：
- 完整事件响应与工单协作闭环
- 全量基础设施管理（IaC/多云/CMDB/环境）
- 事件总线集成
- 跨域编排完整能力

---

## 七、API 对接策略

推荐 **策略 A：逐域对接** — 按功能域分组，先完成一个域的所有页面对接，再进入下一个域。

**优点**：
- 每个域可独立验证，风险分散
- 前后端可同步推进（后端先开发域 API，前端对接）
- 每完成一个域即交付可用功能

**执行顺序**：
1. AI/Agent 域（最高优先级，平台核心）
2. CI/CD 增强域（已有后端支持，快速交付）
3. 安全合规（4 页面，快速交付）
4. 事件工单（用户高频操作）
5. 平台扩展（插件/社区/Webhook）
6. 基础设施管理（IaC/多云/CMDB）
7. 事件总线+跨域编排

---

*版本: 1.0*
*日期: 2026-05-06*
*来源: 领域专家团评审 + Brainstorming 深度分析*
