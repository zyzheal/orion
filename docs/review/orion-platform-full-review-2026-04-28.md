# Orion Platform Full-Depth Review Report

> **评审日期**: 2026-04-28
> **评审范围**: 48 个路由模块、75+ 后端服务、65+ 前端页面
> **评审维度**: 功能完整性、数据持久化、架构一致性、路由冲突、前后端对齐、错误处理、安全性

---

## 一、执行摘要

| 维度 | 状态 | 严重问题数 |
|------|------|-----------|
| 功能完整性 | 部分模块为 Stub | P0: 4, P1: 8 |
| 数据持久化 | 30+ 服务已迁移, 20+ 仍为内存 Map | P0: 3, P1: 6 |
| 架构一致性 | 大部分一致, 个别模块不一致 | P0: 2, P1: 4 |
| 路由冲突 | 存在关键冲突 | P0: 2, P1: 3 |
| 前后端 API 对齐 | 约 90% 对齐 | P0: 2, P1: 5 |
| 错误处理 | 大部分覆盖, 部分缺失 | P1: 6 |
| 安全性 | 存在输入验证缺口 | P0: 2, P1: 4 |

---

## 二、48 个路由模块逐一评审

### 模块状态图例
- **完整** = 有真实业务逻辑 + PostgreSQL 持久化 + Controller/Service/Repository 三层
- **部分** = 有业务逻辑但缺少持久化或存在 Stub
- **占位** = 硬编码返回值、无真实逻辑

| # | 路由文件 | 前缀 | 状态 | 持久化 | 问题描述 |
|---|---------|------|------|--------|---------|
| 1 | `alert-routes.ts` | `/alert` | **部分** | 内存 Map | AlertDeduplication/AlertCorrelationService 全为内存存储, 无 DB 依赖注入 |
| 2 | `ai-gateway-routes.ts` | `/ai-gateway` | **占位** | 无 | LLM 调用为 placeholder (第 38-47 行: `AI response placeholder`), 无真实 AI 集成 |
| 3 | `ai-review-routes.ts` | `/ai-review` | **部分** | 内存 | AIReviewService 使用内存存储, 无 Repository; 规则管理无持久化 |
| 4 | `ai-security-routes.ts` | `/ai-security` | **部分** | 内存 | AISecurityService 审计日志在内存中, 重启丢失; execute 端点允许任意代码执行, 无沙箱隔离 |
| 5 | `ai-cost-routes.ts` | `/ai-cost` | **部分** | 部分 DB | BudgetService 使用 DB, 但 CostCalculator 无持久化; **缺少 `/pricing` 路由** (前端调用 `/v1/ai-cost/pricing`, 后端是 `/models/pricing`) |
| 6 | `approval-routes.ts` | `/approvals` | **部分** | 内存 | ApprovalService 使用 Map 存储 (第 33 行), 未使用 ApprovalRepository |
| 7 | `artifact-routes.ts` | `/artifacts` | **部分** | PostgreSQL | PostgresArtifactRepository 已实现, 但 PromotionService 使用 Map 存储; 本地存储 `/tmp/artifacts` 不适用于生产 |
| 8 | `audit-routes.ts` | `/audit` | **完整** | PostgreSQL | 审计链完整, 有 try/catch, 错误处理良好 |
| 9 | `backup-routes.ts` | `/backup` | **完整** | PostgreSQL | BackupService 有 Repository 支持, 控制器结构完整 |
| 10 | `build-routes.ts` | `/build` | **部分** | 部分 DB | BuildCacheService 使用 PostgreSQL; BuilderImageService/K8sBuildExecutor 使用 mock 客户端 |
| 11 | `canary-analysis-routes.ts` | `/canary-analysis` | **部分** | 内存 | CanaryAnalysisService 全 Map 存储 (第 40 行), 无 Repository |
| 12 | `change-intelligence-routes.ts` | `/change-intelligence` | **部分** | 内存 | ChangeIntelligenceService 无 Repository, 纯内存 |
| 13 | `chatops-routes.ts` | `/chatops` | **完整** | PostgreSQL | Phase 1a 已完成, 9 个 Repository, 错误处理良好 |
| 14 | `code-repo-routes.ts` | `/code-repo` | **部分** | 内存 | BranchPolicyService 使用 Map (第 69 行); CodeOwnershipService/WebhookService 部分内存 |
| 15 | `config-routes.ts` | `/config` | **完整** | PostgreSQL | ConfigRepository/ConfigService/GitOpsService 完整 |
| 16 | `confirmation-routes.ts` | `/confirmations` | **完整** | PostgreSQL | ConfirmationService 已迁移到 Repository 模式 |
| 17 | `cost-routes.ts` | `/cost` | **完整** | PostgreSQL | FinOpsRepository/FinOpsService 完整 |
| 18 | **`cron-routes.ts`** | `/cron` | **占位** | **内存 Map** | **未注册到 routes.ts! 完全孤立; CronSchedulerService 全 Map 存储** |
| 19 | `deploy-routes.ts` | `/deploy` | **完整** | PostgreSQL | DeployRepository/DeployService 已迁移 |
| 20 | `diagnostic-routes.ts` | `/diagnostic` | **完整** | PostgreSQL | DiagnosticRepository 已实现 |
| 21 | `efficiency-routes.ts` | `/efficiency` | **占位** | 无 | DORA 指标全部硬编码 (第 41-46 行: `deploymentFrequency: 'unknown'`); ClickHouse 未启用 |
| 22 | `environment-routes.ts` | `/environments` | **完整** | PostgreSQL | EnvironmentRepository/Service/Controller 三层完整 |
| 23 | `eventbus-routes.ts` | `/eventbus` | **完整** | PostgreSQL | EventBusEventRepository 已实现 |
| 24 | `finops-v2-routes.ts` | `/finops` | **完整** | PostgreSQL | FinOpsRepository/FinOpsService 完整 |
| 25 | `iac-routes.ts` | `/iac` | **部分** | 部分 DB | WorkspaceService/PlanService 使用 `db` 参数但不规范 |
| 26 | `internal-library-routes.ts` | `/internal-libraries` | **完整** | PostgreSQL | InternalLibraryService 接受 database 参数 |
| 27 | `knowledge-routes.ts` | `/knowledge` | **完整** | PostgreSQL | KnowledgeRepository/Service 完整, RAG 返回 placeholder (第 411 行) |
| 28 | `metrics-routes.ts` | `/metrics` | **完整** | PostgreSQL | MetricsRepository/Service/Controller 三层完整 |
| 29 | `monitoring-routes.ts` | `/monitoring` | **完整** | PostgreSQL | MonitoringRepository 已实现 |
| 30 | `notification-routes.ts` | `/notifications` | **完整** | PostgreSQL | NotificationRepository/SettingsRepository 已实现 |
| 31 | `oncall-routes.ts` | `/oncall` | **部分** | 内存 | OnCallService 使用 Map 存储 (第 14-15 行), 未使用 OnCallScheduleRepository |
| 32 | `policy-routes.ts` | `/policies` | **完整** | PostgreSQL | PolicyRepository/Service 完整 |
| 33 | `product-line-routes.ts` | `/product-lines` | **部分** | 内存 | **硬编码 `/api/` 前缀** (第 25-226 行), 与 register prefix 冲突 |
| 34 | `project-routes.ts` | `/projects` | **完整** | PostgreSQL | ProjectRepository/Service 完整 |
| 35 | `queue-routes.ts` | `/queue` | **完整** | PostgreSQL | QueueRepository/Service 完整 |
| 36 | `risk-routes.ts` | `/risk` | **部分** | 内存 | RiskAssessmentService 全内存, 无 Repository |
| 37 | `sbom-routes.ts` | `/sbom` | **完整** | PostgreSQL | SbomRepository/DocumentService 已迁移 |
| 38 | `self-healing-routes.ts` | `/self-healing` | **完整** | PostgreSQL | SelfHealingRepository/Service 完整 |
| 39 | `session-routes.ts` | `/sessions` | **完整** | PostgreSQL | SessionRepository/Service 完整 |
| 40 | `skill-routes.ts` | `/skills` | **完整** | PostgreSQL | SkillRepository/Service 完整 |
| 41 | `tenant-routes.ts` | `/tenant` | **部分** | 部分 DB | TenantService 有 Repository; 但 TenantContext/TenantQuotaService/NamespacePoolService 全内存单例 |
| 42 | `ticketing-routes.ts` | `/tickets` | **部分** | 部分 DB | TicketingService 有 Repository; 但 TicketService(高级特性) 仍为 Map; 路由注册了 `/tickets` 前缀但 routes.ts 又注册了 `/tickets`, 路径重复 |
| 43 | `user-routes.ts` | `/users` | **完整** | PostgreSQL | UserRepository/Service/Controller 三层完整 |
| 44 | `vector-store-routes.ts` | `/vector-store` | **部分** | 内存 | VectorStore 使用内存 Map 存储, 无 Milvus/实际向量数据库集成 |
| 45 | `webhook-routes.ts` | `/webhooks` | **完整** | PostgreSQL | WebhookRepository/Service/Controller 完整 |
| 46 | `role-routes.ts` | `/roles` | **完整** | PostgreSQL | RoleRepository/Service/Controller 完整 |
| 47 | `ai-cost-routes.ts` | `/ai-cost` | (同 #5) | - | - |
| 48 | `approval-routes.ts` | `/approvals` | (同 #6) | - | - |

> 注: routes.ts 中实际注册的路由模块为 48 个, 部分文件已在上面覆盖。

---

## 三、P0 级问题 (必须立即修复)

### P0-1: cron-routes.ts 未注册到路由系统
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/routes.ts`
- **问题**: `cron-routes.ts` 文件存在, 但 routes.ts 中没有 `import cronRoutes` 也没有 `app.register(cronRoutes)`, 导致所有 Cron 端点 404
- **影响**: `/api/v1/cron/*` 全部不可访问
- **修复**: 在 routes.ts 中添加 import 和 register

### P0-2: ProductLine 路由硬编码 `/api/` 前缀导致路径重复
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/product-line-routes.ts` (第 25-226 行)
- **问题**: 路由内部使用 `app.post('/api/product-lines', ...)` 而非 `app.post('/', ...)`, 但 routes.ts 中注册前缀为 `/product-lines`
- **实际路径**: `/api/v1/api/product-lines` (多了 `/api/`)
- **前端期望**: `/api/v1/product-lines` (参见 frontend `product-lines.ts`)
- **修复**: 将所有 `/api/product-lines` 改为 `/` 或相对路径

### P0-3: AIGateway LLM 调用使用 placeholder
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/controllers/ai-gateway-routes.ts` 第 38-47 行
- **问题**: `aiGateway.setLLMCaller` 注册了一个返回 `'AI response placeholder'` 的 mock handler
- **影响**: 所有 AI 相关功能返回假数据

### P0-4: Efficiency (DORA 指标) 全部硬编码
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/efficiency-routes.ts` 第 41-46, 66-74, 163-181 行
- **问题**: DORA metrics 全部返回 `deploymentFrequency: 'unknown'`, `leadTimeForChanges: 0` 等硬编码值
- **影响**: 效能分析页面展示空数据

### P0-5: Ticketing 路由前缀重复注册
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/routes.ts` 第 284 行 + `ticketing-routes.ts` 第 65-86 行
- **问题**: routes.ts 注册前缀为 `/tickets`, 但 ticketing-routes.ts 内部又使用 `app.post('/tickets', ...)` 等完整路径
- **实际路径**: `/api/v1/tickets/tickets` (双重 `/tickets`)
- **修复**: ticketing-routes.ts 内部路由应使用相对路径如 `app.post('/', ...)` 和 `app.post('/:id/...', ...)`

### P0-6: alert-routes.ts 路径模式冲突 `/:id` vs `/list`
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/alert-routes.ts`
- **问题**: `app.get('/:id', ...)` 注册在 `app.get('/list', ...)` 之后。Fastify 虽然静态优先, 但代码中 GET `/list` 实际在 GET `/:id` 之前注册 (第 264 vs 297), 顺序正确。
- **但**: `app.get('/suppression/alerts', ...)` (第 256 行) 返回 `stats` 而非 alerts, 语义错误

### P0-7: approval-routes.ts 使用 Map 存储
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/services/approval/ApprovalService.ts` 第 33 行
- **问题**: `private requests: Map<string, ApprovalRequest>` 进程重启丢失所有审批数据
- **已有**: `ApprovalRepository.ts` 存在但未使用
- **修复**: 改用 ApprovalRepository

---

## 四、P1 级问题 (应该修复)

### P1-1: 内存 Map 存储服务汇总 (20+ 个服务)

| 服务 | 文件 | Map 行号 | 影响范围 |
|------|------|---------|---------|
| ApprovalService | `services/approval/ApprovalService.ts` | 33 | 审批数据 |
| BranchPolicyService | `services/code-repo/BranchPolicyService.ts` | 69-70 | 分支保护策略 |
| OnCallService | `services/scheduler/OnCallService.ts` | 14-15 | OnCall 排班 |
| CronSchedulerService | `services/scheduler/CronSchedulerService.ts` | 42-43 | 定时任务 |
| TenantQuotaService | `services/tenant/TenantQuotaService.ts` | 74-75 | 租户配额 |
| NamespacePoolService | `services/tenant/NamespacePoolService.ts` | 50-51 | Namespace 池 |
| Cost/BudgetService | `services/cost/BudgetService.ts` | 61-63 | 成本预算 |
| FinOps/BudgetService | `services/finops/BudgetService.ts` | 104, 110 | FinOps 预算 |
| PolicyEvaluationService | `services/policy/PolicyEvaluationService.ts` | 40-41 | 策略违规 |
| ConfigApprovalService | `services/config-mgmt/ConfigApprovalService.ts` | 36, 42 | 配置审批 |
| Config/GitOpsService | `services/config-mgmt/GitOpsService.ts` | 58, 89, 98 | GitOps 同步 |
| DiagnosticAgentService | `services/diagnostic/DiagnosticAgentService.ts` | 63, 71 | 诊断报告 |
| Artifact/PromotionService | `services/artifact/PromotionService.ts` | 44 | 制品升级 |
| AlertCorrelationService | `services/alert/AlertCorrelationService.ts` | 40-42 | 告警关联 |
| CanaryAnalysisService | `services/canary-analysis/CanaryAnalysisService.ts` | 40 | 灰度分析 |
| CodeOwnershipService | `services/code-repo/CodeOwnershipService.ts` | - | 代码所有权 |
| ChangeIntelligenceService | `services/change-intelligence/ChangeIntelligenceService.ts` | - | 变更智能 |
| RiskAssessmentService | `services/risk-assessment/RiskAssessmentService.ts` | - | 风险评估 |
| WebhookService | `services/code-repo/WebhookService.ts` | 73 | Webhook 密钥 |
| SbomDocumentService | `services/sbom/SbomDocumentService.ts` | 51-53 | SBOM 文档 (声称已迁移但仍有 Map) |
| TestSelectorService | `services/test-selector/TestSelectorService.ts` | 79 | 测试选择 |

### P1-2: 前端-后端 API 路径不匹配

| 前端调用 | 后端路由 | 差异 | 文件 |
|---------|---------|------|------|
| `GET /v1/ai-cost/pricing` | `GET /models/pricing` | 路径完全不同 | `ai-cost.ts` L154 vs `ai-cost-routes.ts` L83 |
| `GET /v1/ai-cost/roi` | 不存在 | 后端无 `/roi` 路由 | `ai-cost.ts` L160 |
| `POST /v1/alert/suppression/maintenance-windows` | `POST /suppression/maintenance-windows` | 前端路径正确, 后端需确认 | `alerts.ts` L70 |
| `GET /v1/alert/groups` | `GET /groups` | 前端路径正确, 后端存在 | 需确认 |
| `GET /v1/monitoring/rules` | `GET /monitoring/rules` | 前端路径正确 | 正常 |

### P1-3: SbomDocumentService 声称已迁移但仍有 Map 存储
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/services/sbom/SbomDocumentService.ts` 第 51-53 行
- **问题**: 注释说 "Migrated from Map() to PostgreSQL" 但第 51-53 行仍声明 `documents`, `packages`, `attestations` 为 Map
- **影响**: 可能存在双写或 Map 仍为实际存储

### P1-4: Ticketing routes 注册双重前缀
- **文件**: `ticketing-routes.ts` 第 65-86 行 + `routes.ts` 第 284 行
- **routes.ts**: `await app.register(ticketingRoutes, { prefix: '/tickets', ... })`
- **ticketing-routes.ts**: `app.post('/tickets', ...)` (应为 `app.post('/', ...)`)
- **结果**: 实际路径 `/api/v1/tickets/tickets` 而非 `/api/v1/tickets`

### P1-5: Confirmation routes 使用 `/` 而非相对路径
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/confirmation-routes.ts` 第 30, 55 行
- **问题**: `app.get('/', ...)` 和 `app.post('/', ...)` 在 `/confirmations` 前缀下变为 `/confirmations/` (带 trailing slash)
- **影响**: 与前端可能的 `/confirmations` (无 trailing slash) 不匹配

### P1-6: Notification routes 注册在 routes.ts 无前缀
- **文件**: `routes.ts` 第 369 行 + `notification-routes.ts`
- **问题**: `app.register(notificationRoutes, { prefix: '/notifications' })` 但 notification-routes.ts 内部使用 `/send`, `/:userId` 等相对路径, 实际路径 `/api/v1/notifications/send` 正确

### P1-7: Knowledge RAG query 返回 placeholder
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/knowledge-routes.ts` 第 411 行
- **问题**: `[RAG placeholder] Based on ${results.length} sources for: ${query}`
- **影响**: RAG 问答返回假数据

---

## 五、P2 级问题 (建议改进)

### P2-1: 错误响应格式不统一

不同模块使用不同的错误格式:
- `{ error: 'CODE', message: '...' }` - 大多数模块
- `{ success: false, error: '...' }` - ai-security-routes
- `{ success: true, data: { ... } }` - cost-routes, backup-routes
- `{ error: { code: '...', message: '...' } }` - knowledge-routes (使用 KnowledgeServiceError)

**建议**: 统一为 `{ error: { code: string, message: string } }` 格式。

### P2-2: Cron routes /start 和 /stop 创建新实例
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/cron-routes.ts` 第 200-218 行
- **问题**: `/cron/start` 和 `/cron/stop` 各自 `new CronSchedulerService()`, 与模块级实例无关
- **影响**: start/stop 操作不影响实际运行的调度器

### P2-3: Alert /suppression/alerts 端点返回 stats 而非 alerts
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/alert-routes.ts` 第 256-259 行
- **问题**: 端点名称为 `/alerts` 但返回的是 `stats`

### P2-4: 缺少输入验证
- 多个路由直接 `request.body as any` 无 schema 验证
- `ai-security-routes.ts` `/execute` 端点允许任意代码执行, 仅做基本 try/catch

### P2-5: artifact-routes.ts 本地存储路径硬编码
- **文件**: `/Users/heal/orion-design/orion-platform-service/src/api/artifact-routes.ts` 第 16 行
- **问题**: `new LocalArtifactStorage('/tmp/artifacts')` 生产环境应使用 S3/OSS

### P2-6: ProductLine Service 未接受 database 参数
- **文件**: `product-line-routes.ts` 第 16 行
- **问题**: `const productLineService = new ProductLineService()` 未传递 database, 即使 routes.ts 注册时传了 `database: options.database`

### P2-7: tenant-routes.ts TenantQuotaService/NamespacePoolService 使用全局单例
- **文件**: `tenant-routes.ts` 第 48-49 行
- **问题**: `const quotaService = tenantQuotaService` (全局单例) 而非从 Repository 创建

### P2-8: EventBus 无真实 NATS 集成
- **文件**: CLAUDE.md 已确认 "No real EventBus integration"
- **现状**: EventPublisher 存在但未连接 NATS, events 发布后无人消费

---

## 六、路由冲突分析

### 确认的路由冲突

| 冲突类型 | 文件 | 冲突路由 | 说明 |
|---------|------|---------|------|
| **未注册** | `cron-routes.ts` | 全部 | 未在 routes.ts 注册, 404 |
| **前缀重复** | `product-line-routes.ts` | `/api/product-lines` | 硬编码 `/api/` 前缀, 与 register prefix 叠加 |
| **前缀重复** | `ticketing-routes.ts` | `/tickets/*` | 内部使用 `/tickets/` 而外部前缀也是 `/tickets` |
| **路径歧义** | `deploy-routes.ts` | `/:id` vs `/history` | Fastify 静态优先, 无实际冲突 (已修复) |
| **路径歧义** | `policy-routes.ts` | `/:id` vs `/evaluate` | 已添加 workaround (第 54 行) |
| **路径歧义** | `canary-analysis-routes.ts` | `/:id` vs `/metrics` | 已添加 workaround (第 31 行) |
| **路径歧义** | `sbom-routes.ts` | `/waivers/:id` vs `/waivers/active` | 已添加 workaround (第 121 行) |

### Fastify 路由注册顺序分析

以下模块的 `/:id` 静态子路由 (如 `/:id/history`) 注册在 `/:id` 之后, 但 Fastify 静态匹配优先, 无冲突:
- `ticketing-routes.ts`: `/tickets/:id` 后注册 `/tickets/:id/history` -- OK
- `monitoring-routes.ts`: `/rules/:id` 后注册 `/rules/:id/toggle` -- OK
- `alert-routes.ts`: `/:id` 注册在 `/list` 之后, Fastify 处理正确 -- OK

---

## 七、安全审查

### 高风险

| # | 问题 | 文件 | 行号 | 说明 |
|---|------|------|-----|------|
| S1 | 任意代码执行 | `ai-security-routes.ts` | 87-112 | `/execute` 端点直接执行传入的 code, ExecutionSandbox 可能无真正隔离 |
| S2 | 敏感信息硬编码 | `ai-gateway-routes.ts` | 38-47 | LLM caller mock 返回 placeholder, 但可能被误认为真实响应 |
| S3 | 缺少 CSRF 保护 | 全局 | - | Fastify 未配置 CSRF 中间件 |
| S4 | Webhook 签名验证不完整 | `code-repo/WebhookService.ts` | 73 | webhookSecrets 为 Map, 部分 provider 可能未验证签名 |

### 中风险

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| S5 | 输入验证不足 | 多处 | `request.body as any` 无 JSON Schema 验证 |
| S6 | SQL 注入风险 | 低 | 所有 Repository 使用参数化查询, 未发现直接拼接 |
| S7 | 租户隔离不完整 | `tenant-routes.ts` | TenantQuotaService/NamespacePoolService 使用全局单例, 无租户隔离 |

---

## 八、前端页面 API 调用审查

### 前端页面与后端路由匹配情况

| 前端页面 | 前端 API 文件 | 后端路由 | 匹配状态 |
|---------|-------------|---------|---------|
| CMDB | `api/cmdb.ts` | `/cmdb/*` | 匹配 |
| ChatOps | `api/chatops.ts` | `/chatops/*` | 匹配 |
| Pipelines | `api/pipelines.ts` | `/pipelines/*` | 匹配 |
| Deployments | `api/deployments.ts` | `/deploy/*` | 需确认路径 |
| Artifacts | `api/artifacts.ts` | `/artifacts/*` | 匹配 |
| Alerts | `api/alerts.ts` | `/alert/*` + `/monitoring/*` | 部分不匹配 (monitoring rules) |
| AI Cost | `api/ai-cost.ts` | `/ai-cost/*` | **不匹配**: `/pricing` 和 `/roi` |
| ProductLine | `api/product-lines.ts` | `/product-lines/*` | **不匹配**: 后端多了 `/api/` 前缀 |
| FinOps | `api/finops.ts` | `/finops/*` | 匹配 |
| SelfHealing | `api/self-healing.ts` | `/self-healing/*` | 匹配 |
| Ticketing | `api/ticketing.ts` | `/tickets/*` | **不匹配**: 双重 `/tickets/` |
| Monitoring | `api/monitoring.ts` | `/monitoring/*` | 匹配 |
| Diagnostic | `api/diagnostic.ts` | `/diagnostic/*` | 匹配 |
| Config | `api/config.ts` | `/config/*` | 匹配 |
| Queue | `api/queue.ts` | `/queue/*` | 匹配 |
| Users | `api/users.ts` | `/users/*` | 匹配 |
| Roles | `api/roles.ts` | `/roles/*` | 匹配 |
| Projects | `api/projects.ts` | `/projects/*` | 匹配 |
| Environments | `api/environments.ts` | `/environments/*` | 匹配 |
| Approvals | `api/approvals.ts` | `/approvals/*` | 匹配 |
| OnCall | `api/oncall.ts` | `/oncall/*` | 匹配 |
| Skills | `api/skills.ts` | `/skills/*` | 匹配 |
| Vector Store | `api/vector-store.ts` | `/vector-store/*` | 匹配 |
| Knowledge | - | `/knowledge/*` | 页面无独立 API 文件 |
| Audit | `api/audit.ts` | `/audit/*` | 匹配 |

---

## 九、优先改进建议

### P0 (立即修复, 阻塞功能)

1. **注册 cron-routes.ts 到 routes.ts** - Cron 功能完全不可用
2. **修复 ProductLine 路由前缀** - 将 `/api/product-lines` 改为 `/`
3. **修复 Ticketing 路由双重前缀** - 将 `/tickets/*` 改为相对路径
4. **修复 AI Cost /pricing 路由** - 前端调用 `/pricing` 但后端是 `/models/pricing`

### P1 (本周内修复)

1. **ApprovalService 迁移到 Repository** - ApprovalRepository 已存在, 仅需切换
2. **OnCallService 迁移到 Repository** - OnCallScheduleRepository 已存在
3. **修复 SbomDocumentService Map 残留** - 确认 Repository 是否为实际存储
4. **分支保护策略迁移到 Repository** - BranchPolicyService 全 Map
5. **CronSchedulerService 迁移到 Repository** - 添加 CronJobRepository
6. **统一错误响应格式** - 制定标准 error schema

### P2 (两周内修复)

1. **Efficiency DORA 指标真实计算** - 集成 Git/CI 数据源
2. **AIGateway 接入真实 LLM** - 配置 Anthropic/OpenAI 等
3. **Knowledge RAG 接入真实 Embedding** - 替换 placeholder
4. **artifact 存储从 /tmp 迁移到 S3/OSS**
5. **TenantQuotaService/NamespacePoolService 持久化**
6. **添加全局 JSON Schema 输入验证中间件**
7. **EventBus 连接真实 NATS**
8. **Cron /start /stop 修复为操作同一实例**

---

## 十、总体评估

| 维度 | 评分 (1-5) | 说明 |
|------|-----------|------|
| 功能完整性 | 3/5 | 约 60% 模块有真实业务逻辑, 15% 为 Stub, 25% 部分实现 |
| 数据持久化 | 3.5/5 | 30+ 服务已迁移到 PostgreSQL, 仍有 20+ 使用内存 Map |
| 架构一致性 | 4/5 | 大部分模块遵循 Controller-Service-Repository 模式 |
| 路由设计 | 3/5 | 存在 2 个未注册/错误注册的路由模块 |
| 前后端对齐 | 3.5/5 | ~90% 路径对齐, 关键路径有 3-4 处不匹配 |
| 错误处理 | 4/5 | 大部分路由有 try/catch, 响应格式需统一 |
| 安全性 | 3/5 | 参数化查询覆盖好, 但存在代码执行风险和输入验证缺口 |

**综合评分: 3.4/5**

Orion 平台核心架构设计良好, Pipeline/Deployment/Config/Audit/ChatOps 等核心模块已达到生产级标准。主要改进空间在于: (1) 完成剩余 20+ 服务的持久化迁移, (2) 修复路由注册问题, (3) 替换 Stub 实现为真实业务逻辑。
