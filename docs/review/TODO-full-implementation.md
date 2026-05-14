# Orion 全量功能实现待办清单

> 创建日期: 2026-05-06
> 方案: 0 外部组件，完全基于现有能力增强
> 总工期: 18-28 周（2 人并行）
> 来源: docs/superpowers/specs/2026-05-06-orion-full-implementation-plan.md

---

## 第一期（18-24 周）— 核心价值

### 工作流 1：数据持久化补齐（4-6 周）
- [x] 3 个 artifact-ops 服务域从 Map() 迁移到 PostgreSQL Repository 模式 (ArtifactOperationService, ArtifactRetentionService, ArtifactScanService)
- [ ] 剩余 37 个服务域从 Map() 迁移到 PostgreSQL Repository 模式
- [ ] 数据持久化覆盖率从 46% 提升至 100%
- [ ] 每个服务域标准步骤：创建 Repository → 修改 Service 注入 → 单元测试 → 集成测试
- [ ] 涉及模块：agent, agent-profile, agent-run, ai-degradation, ai-review, auth(TokenBlacklist), canary-traffic, canary-analysis, chatops, cmdb-integration, config(RedisCache), consistency, cost-tracking, database, deployment-window, developer-portal, digital-twin, ephemeral-env, environment, federation, health, k8s-provisioner, model-version, multi-cloud, multi-modal-trigger, nats-registry, output-validation, performance, pipeline-budget, pipeline-template, pipeline-version, plugin(4), plugin-marketplace, plugin-spi, product-line, quality-gate, risk-assessment, risk-engine, scheduler, smart-deploy, test-generation, test-selector, types

### 工作流 2：监控中心（1-2 周）
- [ ] monitoring(8) + metrics(3) + alert(8) 前端开发
- [ ] 复用 9 个图表组件：TrendLineChart, GaugeChart, PieChart, BarChart 等
- [ ] 新增 API：GET /api/v1/metrics/query, GET /api/v1/monitoring/dashboard, GET /api/v1/alerts/recent
- [ ] 页面内容：系统健康、QPS 趋势、响应时间分布、服务排名、告警列表

### 工作流 3：CI/CD 可视化（1-2 周）
- [ ] pipeline(16) + deploy(13) + build(13) 前端开发
- [ ] WebSocket 实时日志推送
- [ ] 新增 API：GET /api/v1/pipelines/:id/logs, WS /api/v1/pipelines/:id/logs/stream
- [ ] 页面内容：流水线列表、详情、一键触发、构建产物、部署历史

### 工作流 4：效率仪表盘（1 周）
- [ ] efficiency(9) + finops(13) + cost(8) 前端开发
- [ ] DORA 四指标：部署频率、Lead Time、变更失败率、MTTR
- [ ] 页面内容：成本趋势、预算使用率、SaaS 成本

### 工作流 5：功能域管理（1 周）
- [ ] ModuleManager 4 层架构前端
- [ ] 109 个模块开关控制、依赖可视化、启动顺序、验证报告
- [ ] API 已有，仅需前端

### 工作流 6：限流熔断（1-2 周）
- [ ] cockatiel（Node.js 原生）限流熔断
- [ ] @fastify/rate-limit + Redis 存储完善
- [ ] 新增 API：GET/POST /api/v1/rate-limits, GET /api/v1/circuit-breakers

### 工作流 7：后端审计中间件（1 周）
- [ ] Fastify onSend hook 拦截 POST/PUT/DELETE
- [ ] 链式哈希不可篡改存储（已有 AuditLogChain）
- [ ] 新增 API：GET /api/v1/audit-logs, GET /api/v1/audit-logs/:id, GET /api/v1/audit-logs/verify

### 工作流 8：RLS 租户隔离（1 周）
- [ ] PostgreSQL 行级安全，6 张核心表
- [ ] ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- [ ] 双重防护：API 层 + DB 层

### 工作流 9：高级 CI/CD（2-3 周）
- [ ] 流水线模板库（PipelineTemplateService）
- [ ] 智能测试选择（test-selector）
- [ ] 构建缓存优化（BuildCacheService）

### 工作流 10：Feature Flag 增强（1 周）
- [ ] 按租户/用户组灰度
- [ ] tenant_feature_flags 表
- [ ] FeatureFlagEvaluator 服务

### 工作流 11：AI/Agent 域（3-4 周）🔴 最高优先级
- [ ] 后端：ai(18), agent(5), knowledge(6), skill(6) Repository 迁移（12 文件）
- [ ] 前端 20+ 页面：AgentDashboard(7), AIReview(6), AICostDashboard(6), LLMTraceDashboard(5), AIDocManagement(5), SkillManagement(4), KnowledgeBase, AIGateway, AISecurity, VectorStore(6), AgentRunDetail
- [ ] AI 决策链路增强、Agent 生命周期管理、知识库 RAG 增强

### 工作流 15：CI/CD 增强（2-3 周）
- [ ] 后端：canary-analysis(5), canary-traffic(8), smart-deploy(10), deployment-window, adaptive-pipeline
- [ ] 前端 6+ 页面：CanaryAnalysis, CanaryTrafficPage, DeployPage, PipelineBudgetPage, PipelineTemplatePage, PipelineVersionPage
- [ ] 金丝雀分析引擎、智能部署策略

### 工作流 14：安全合规（1-2 周）
- [ ] 后端：policy(7), privacy(5), ai-security, auth 增强
- [ ] 前端 4 页面：PolicyManagement, AISecurity, ApiKeyManagement, CompliancePage

### 工作流 16：平台扩展（3-4 周）
- [ ] 后端：plugin*(26), community, developer-portal, project(6), queue(6), scheduler(6), webhook(6), multi-modal-trigger
- [ ] 前端 15+ 页面：PluginManagement(6), PluginSPI(4), PluginMarketplacePage, CommunityPage, DeveloperPortalPage, CronManagement, WebhookManagement, TestSelector, TriggerPage

---

## 第二期（12-16 周）— 完整覆盖

### 工作流 12：事件工单（3-4 周）
- [ ] 后端：ticketing(17), chatops(16), notification(6), escalation(3) Repository 迁移（8 文件）
- [ ] 前端 16+ 页面：ChatOps(5), TicketList(3), TicketDetail(2), Approvals, NotificationCenter, ConfirmationWorkbench(5)
- [ ] 通知渠道实现（DingTalk/WeChat/Email/SMS）、工单 SLA 引擎

### 工作流 13：基础设施管理（4-5 周）
- [ ] 后端：iac(7), multi-cloud(5), cmdb(6), code-repo(11), environment(10), federation(3), ephemeral-env(2)
- [ ] 前端 30+ 子页面：IaCManagement(5), CodeMgmt(5), CMDB, Environments, EphemeralEnv(2), MultiCloudPage, FederationPage, DigitalTwin, DisasterRecovery

### 工作流 17：事件总线+跨域编排（3-4 周）
- [ ] 后端：event-bus(4), event-bus-service(1079行), change-intelligence(4), digital-twin(10), risk-assessment(9), risk-engine(6), data-pipeline(5), performance(6), degradation(5), incident
- [ ] 前端 12+ 页面：EventBus, ChangeIntelligence, DigitalTwin, DataPipelinePage, PerformancePage, OrchestrationPage, RiskDashboard

---

## C 级页面 API 对接专项

- [ ] A 级页面增强（13 个，8-15 人天）
- [ ] B 级页面 Mock→API（12 个，8-12 人天）
- [ ] C 级页面完整开发（84 个，55-85 人天）
- [ ] 后端缺失 API 开发（~25 个，15-25 人天）

---

## 完成后代码评审

- [ ] 架构安全性审查
- [ ] 代码质量审查
- [ ] 测试覆盖率验证
- [ ] API 路径一致性检查

---

*总工期: 18-28 周（2 人并行）*
*0 外部组件，完全基于现有能力增强*
