# P0 全量实施蓝图 — 分批持久化方案

> **日期**: 2026-04-23
> **状态**: 待批准
> **目标**: 按 3 阶段消除 18 项 P0 缺失，核心路径为数据持久化

## 总体架构

```
Phase 0 (3项, 准备) ──→ Phase 1 (3批, 55个文件) ──→ Phase 2 (4项功能) ──→ Phase 3 (3项架构)
     ↓                      ↓                          ↓                     ↓
连接池 + 模板           低→中→高持久化               周报+版本+RLS          微前端+Gateway+分离
43 SQL表 → 53表          55 Map→SQL, 15保留           + SBOM+适配器
```

## Phase 0 — 基础设施准备

### 0.1 数据库连接池 + 通用 Repository 模板

**问题**: 现有 2 个 Repository 各自手写 SQL，无统一基类
**方案**:
- `src/db/connection-pool.ts` — `pg.Pool` 封装，支持健康检查
- `src/db/base-repository.ts` — 泛型类 `BaseRepository<T>` 提供 `findById`, `findAll`, `create`, `update`, `delete`（5个方法）
- `src/db/query-builder.ts` — 参数化查询构建器（防 SQL 注入）
- 每个新 Repository 继承 BaseRepository，实现特有查询方法

**依赖**: `pg`（已有 `package.json` 依赖）
**新增文件**: 3 个
**影响**: 所有 Phase 1 持久化任务

### 0.2 审计链存储方案

**问题**: `AuditLogChain.ts` 用 2 个 Map 存储链式条目
**方案**:
- 已有 migration `013_create_audit_logs.sql`
- 新建 `AuditRepository`（追加模式：只 INSERT，不 UPDATE/DELETE）
- `chainHash` 字段保证链完整性
- 验证时按 `sequenceNumber` 顺序扫描

**新增文件**: 1 个 Repository + 1 个 Service

### 0.3 迁移脚本补全

**问题**: 43 个 migration 文件，部分表缺失
**方案**: 新增约 10 个 migration SQL 覆盖以下领域：
- `tenant_quotas` — 租户配额
- `namespace_pools` — 命名空间池
- `cost_budgets` — 成本预算
- `ticketing` — 工单完整表
- `monitoring_channels` — 通知渠道
- `canary_runs` — Canary 分析
- `sbom_documents` — SBOM 文档
- `backup_plans` — 备份计划
- `ephemeral_envs` — 临时环境
- `agent_profiles` — Agent 配置

**新增文件**: ~10 个 SQL 文件

## Phase 1 — 数据持久化（核心，55 个文件）

### Batch 1 — 低难度（20 个，纯 CRUD）

**范围**: 配额类、配置类、基础实体

| # | 服务 | Map 文件 | Repository 表 |
|---|------|----------|--------------|
| 1 | TenantQuotaService | quotas, usage | tenant_quotas |
| 2 | BudgetService (cost) | budgets, cost_records | cost_budgets |
| 3 | AlertSuppressionService | maintenance_windows, known_issues | alert_suppression_rules |
| 4 | CronSchedulerService | jobs, executions | cron_jobs |
| 5 | SkillService | skills (内存部分) | skills (补充) |
| 6 | PolicyService | policies, evaluations | policy_evaluations |
| 7 | RiskAssessmentService | assessment_history | risk_assessments |
| 8 | SbomVulnerabilityService | results | sbom_vulnerabilities |
| 9 | SbomWaiverService | waivers | sbom_waivers |
| 10 | AgentProfileService | profiles | agent_profiles |
| 11 | PluginRegistry | plugins (补充) | plugins (补充) |
| 12 | EphemeralEnvService | environments | ephemeral_environments |
| 13 | NotificationService | channels, escalation_policies | notification_channels |
| 14 | AlertRuleEngine | rules (补充) | alert_rules (补充) |
| 15 | BackupRepository | backups | backups (补充) |
| 16 | ConfigRepository | configs | configs (补充) |
| 17 | DeploymentHistoryService | deployments | deployments (补充) |
| 18 | RollbackService | rollbacks | rollback_history |
| 19 | PlanService (IaC) | plans | iac_plans |
| 20 | PluginExecutorService | executions | plugin_executions |

**改造模式**: `Map<K,V>` → `class XxxRepository extends BaseRepository<Xxx>` → SQL CRUD

### Batch 2 — 中难度（20 个，列表/时间窗/聚合）

**范围**: 工单系统、成本追踪、构建/部署、诊断

| # | 服务 | 难点 |
|---|------|------|
| 21 | TicketWorkflowService | workflow_history (一对多), SLA tracking |
| 22 | DispatchQueueManager | 队列状态 + 分配历史 |
| 23 | LoadBalancer / DispatchEngine | 工程师画像 + 负载统计 |
| 24 | TicketBIService | 分析聚合查询 |
| 25 | TicketRelationAnalyzer | 工单关系图 |
| 26 | CloudCostCollector | 时间窗口聚合 |
| 27 | SaaSCostTracker | 订阅 + 费用追踪 |
| 28 | BuildCacheService | 构建配置 + 条目 |
| 29 | BuildLogService | 日志流数据 |
| 30 | ArtifactService (build) | 制品元数据 |
| 31 | RecoveryService (backup) | 恢复计划 + 执行记录 |
| 32 | BackupVerifier | 验证记录 |
| 33 | DiagnosticAgentService | 诊断报告 |
| 34 | DiagnosticEngine | 会话 + 症状（嵌套） |
| 35 | CanaryAnalysisService | 分析运行 + ML 结果 |
| 36 | ChangeIntelligenceService | 变更报告 + 影响服务 |
| 37 | GitOpsService | 文件内容 + GitOps 配置 |
| 38 | ExecutionService (ChatOps) | 执行记录 + 会话 |
| 39 | TestFailurePredictor | 测试历史统计 |
| 40 | TestDependencyAnalyzer | 测试套件 + 代码映射 |

### Batch 3 — 高难度 + 保留 Map（10 个）

**高难度 5 个**:
| # | 服务 | 方案 |
|---|------|------|
| 41 | MetricCollector | PostgreSQL 分区表（按月）或 TimescaleDB 扩展 |
| 42 | VectorStore | 已有 Map 实现，预留 Milvus 接口 |
| 43 | AuditLogChain | 追加模式 + 链验证（Phase 0.2 已完成） |
| 44 | ReplicationLagMonitor | 历史数据分区表 |
| 45 | EventHandler (efficiency) | 流水线记录（大量数据） |

**保留 Map 15 个（无需持久化）**:
- AlertDeduplication, AlertCorrelation（缓存）
- AIGateway 运行时状态, AIDegradationRouter（缓存）
- AI RuleEngine（运行时规则匹配）
- PluginLifecycleManager（钩子注册）
- PluginSandbox（活动执行）
- DeploymentStrategyEngine（流量状态）
- ChatOps CommandService（命令注册）
- Health（健康检查计数）
- ReadTrafficManager（运行时计数）
- DatabaseFailoverHandler（最后告警时间）
- NATS Registry（运行时服务发现）
- K8s Provisioner（命名空间标记）

## Phase 2 — 独立功能模块（4 项）

### 2.1 自动周报模块

**文件**: `src/services/weekly-report/` + `src/api/weekly-report-routes.ts`
**功能**:
- 数据源: DORA metrics + Pipeline runs + Alert history + Ticket stats + FinOps
- 输出: Markdown 格式 + JSON 结构化数据
- 路由: `POST /api/v1/weekly-report/generate`, `GET /api/v1/weekly-report/history/:id`
- 定时: CronSchedulerService 触发（每周五）

### 2.2 API 版本管理

**方案**: URL 路径版本化
- 现有路由全部挂载在 `/api/v1/` 下（已有）
- `client.ts` baseURL 从 `/api` 改为 `/api/v1`
- 路由注册时检查版本前缀一致性
- 未来 `/v2/` 可独立实现，与 v1 并存

### 2.3 RLS 行级安全

**方案 B: 应用层中间件拦截**
- 新建 `src/middleware/tenant-context.ts` — Fastify 中间件
- 从 JWT `x-tenant-id` header 提取租户 ID
- 注入到查询上下文：`BaseRepository.findAll()` 自动追加 `WHERE tenant_id = ?`
- 对已有 Repository 逐层注入

### 2.4 其余功能模块

| 项 | 文件 | 说明 |
|---|------|------|
| SBOM 生成 | `src/services/sbom/SbomGenerator.ts` | 扫描制品依赖生成 SBOM |
| 外部适配器 | `src/services/adapters/` | Harbor/Nexus/Gerrit REST 适配器 |
| IaC 漂移检测 | `src/services/iac/DriftDetector.ts` | 对比 Terraform state vs 实际资源 |
| 插件执行 | `src/services/plugin/PluginExecutor.ts` | 沙箱内执行插件 |

## Phase 3 — 架构级改造（3 项，长期）

### 3.1 微前端架构

- wujie 框架已就位
- 拆分 7 个子应用：pipeline, monitoring, ticketing, finops, iac, skill, admin
- 基座应用处理路由、认证、全局状态

### 3.2 API Gateway 限流/熔断

- `orion-api-gateway` 已有基础
- 新增: 令牌桶限流、滑动窗口限流、熔断器
- 集成 Prometheus metrics

### 3.3 服务物理分离

- Docker Compose 定义：platform-service, api-gateway, ai-service, visor
- K8s Deployment + Service 定义
- 服务发现 via NATS 或 K8s DNS

## 执行顺序总结

```
Phase 0 (本周)
├── 0.1 数据库连接池 + BaseRepository
├── 0.2 审计链存储方案
└── 0.3 迁移脚本补全

Phase 1 (下周起)
├── Batch 1: 20 个低难度 CRUD（按领域分组并行）
├── Batch 2: 20 个中难度（需额外查询设计）
└── Batch 3: 5 个高难度 + 15 个保留 Map

Phase 2 (Phase 1 完成后)
├── 2.1 自动周报
├── 2.2 API 版本管理
├── 2.3 RLS 行级安全
└── 2.4 其余功能模块

Phase 3 (长期规划)
├── 3.1 微前端架构
├── 3.2 API Gateway 限流/熔断
└── 3.3 服务物理分离
```

## 成功标准

- 55 个 Map→SQL 转换完成，测试覆盖率 > 80%
- 所有新增 Repository 继承 BaseRepository
- 10 个新 migration SQL 通过
- 周报模块可生成 Markdown 报告
- RLS 中间件自动注入 tenant_id
- 31 个现有 P0 测试继续通过
