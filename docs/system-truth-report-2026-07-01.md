# Orion 系统真实状态报告

**生成日期**: 2026-07-01
**分析方法**: codegraph 索引 + grok 热点 + Glob/Grep 全量扫描
**基准文档**: CLAUDE.md | docs/orion-system-deep-analysis-2026-07-01.md | INDEX.md

---

## 1. 三文档偏差对照（核心发现）

### 1.1 关键指标偏差

| 指标 | CLAUDE.md (2026-05-15) | 深度分析报告 (2026-07-01) | 实际代码 (2026-07-01) | 偏差最大来源 |
|------|------------------------|------------------------|---------------------|-------------|
| `src/services/` 子目录 | 101 | 139 | **139** | CLAUDE.md 过期 38 个 |
| 有 `index.ts` 的服务 | — | — | **100** | — |
| 无 `index.ts` 但有源码 | — | — | **38** | 报告未覆盖 |
| 空服务目录 | — | — | **1** (`types`) | — |
| 前端 `pages/` 目录 | 149 | 202 | **202** | CLAUDE.md 差 53 |
| 前端 `.tsx` 源文件 | — | — | **739** | 报告未统计 |
| 前端 `.ts` 源文件 | — | — | **345** | 报告未统计 |
| 前端 API 客户端 | — | — | **239** | 报告未统计 |
| `api/*-routes.ts` | 104 | 175 | **175** | CLAUDE.md 差 71 |
| 微服务总数 | 35→87(已修正) | 37 TS + 47 Go | **87** | 报告用旧数据 |
| 微服务 `go.mod` | — | — | **47/47** | — |
| 微服务 `main.go` | — | — | **0/47** | 全部无入口文件 |

### 1.2 偏差分析

| 文档 | 偏差率 | 主要问题 |
|------|--------|---------|
| **CLAUDE.md** | 高 | 多个指标过期（101 vs 139 services，149 vs 202 pages，104 vs 175 routes） |
| **深度分析报告** | 中 | 微服务数字仍用旧数据（37+47 而非 87），前端页面数正确 |
| **INDEX.md** | 中 | services 目录数正确（135），但 pages 149 过期，缺少微服务指标 |

### 1.3 关键发现：微服务全部是蓝图

**47/47 Go 微服务有 `go.mod` 但 0 个有 `main.go`** — 这意味着所有 Go 微服务都是**编译单元而非可执行服务**。它们只能作为库被 `orion-platform-service` 引用，不能独立部署。

---

## 2. 真实系统结构

### 2.1 后端单体 (`orion-platform-service`)

```
src/
├── api/                    # 175 个路由文件（实际生效）
│   ├── *-routes.ts         # 路由定义
│   └── controllers/        # 请求处理器
├── services/               # 139 个服务目录
│   ├── 有 index.ts: 100    #  barrel 导出完整
│   ├── 有源码无 index.ts: 38 # 缺少 barrel 导出
│   └── 空目录: 1 (types)   # 仅类型定义
├── engine/                 # Pipeline 执行引擎
│   ├── PipelineEngine.ts   # Facade（11 个 collaborator）
│   ├── StageOrchestrator.ts # Stage 编排
│   ├── StageExecutor.ts    # Task 执行
│   └── PipelineCheckpointManager.ts
├── repositories/           # 数据访问层（250+ 文件）
├── models/                 # 数据模型
├── saga/                   # Saga 编排
├── events/                 # 事件发布
├── db/                     # 数据库 + 迁移
└── middleware/             # 认证/鉴权/日志
```

### 2.2 前端 (`orion-frontend`)

```
src/
├── pages/                  # 202 个页面目录
├── api/                    # 239 个 API 客户端
├── components/             # 共享组件
├── microfront/             # Orion-MF 微前端配置
├── stores/                 # 状态管理
├── router/                 # 路由配置
├── tokens/                 # Design Token 体系
└── hooks/                  # 自定义 Hooks
```

### 2.3 微服务蓝图（87 个）

| 类型 | 数量 | 可独立部署 | 有 go.mod | 有 main.go |
|------|------|-----------|-----------|-----------|
| TS 蓝图 | 37 | ❌ | — | — |
| Go 蓝图 | 47 | ❌ | ✅ 47/47 | ❌ 0/47 |
| Python 蓝图 | 2 | ❌ | — | — |
| Rust 蓝图 | 1 | ❌ | — | — |
| **Go 生产服务** | **1** | ✅ | — | — |

---

## 3. 模块功能分析（按业务域）

### 3.1 核心引擎层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **Pipeline** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | PipelineEngine  delegating 到 11 个 collaborator；StageOrchestrator 有 resolveServiceParameters + recordStageAudit |
| **Deploy** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | DeployService + DeployRepository；支持回滚 |
| **Code** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | CodeRepoService + CommitStatusService |
| **Artifact** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | ArtifactService + ArtifactRepository |
| **Approval** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | ApprovalGateService + 工作流集成 |
| **Lowcode** | 🟡 80% | 🟡 75% | Go 仅 3 端点 | WorkflowEngine + ProcessStep；Go 版严重不足 |
| **Ticketing** | ✅ 90% | 🟡 75% | TS+Go 蓝图 | TicketService(1245行) + 4 Repository + 完整 API |

### 3.2 智能运维层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **ChatOps** | ✅ 85% | ✅ 85% | TS+Go 蓝图 | 13 个服务文件 + 22 个测试；CommandRouter/SSE/Webhook 完整 |
| **Monitoring** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | MetricCollector + AlertRuleEngine + TracingService |
| **Alert** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | AlertNotificationService + AlertRuleEngine |
| **SelfHealing** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | 包含 Incident 嵌套实现 |
| **Diagnostic** | ✅ 完整 | ✅ 完整 | — | DiagnosticService |

### 3.3 数据管理层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **CMDB** | ✅ 完整 | ✅ 完整 | Go 生产 | orion-cmdb-service（唯一 Go 生产服务） |
| **Knowledge** | ✅ 完整 | ✅ 完整 | TS+Go+Py 蓝图 | PandaWiki fork + 知识库服务 |
| **DigitalTwin** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | 最近迁移到 PostgreSQL |
| **DataQuality** | 🟡 有服务 | 🟡 有页面 | — | DataQualityService |
| **DataLineage** | 🟡 有服务 | 🟡 有页面 | — | DataLineageService |
| **SBOM** | 🟡 有服务 | ❌ 无页面 | — | SBOMService |

### 3.4 业务服务层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **FinOps** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | 12 个服务文件；CloudCostCollector + K8sCostAllocator + ROIAnalyzer |
| **Efficiency** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | EfficiencyService + DORA 指标 |
| **Security** | ✅ 完整 | ✅ 完整 | TS+Go+Rust 蓝图 | SecurityScanner + SupplyChain + ComplianceFramework |
| **Audit** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | PipelineAuditLogService + AuditLogService |
| **RBAC** | 🟡 有服务 | 🟡 有页面 | — | role/permission 服务存在 |

### 3.5 平台能力层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **AI/MLOps** | ✅ 完整 | ✅ 完整 | Python+TS+Go | orion-ai-service (Python) 权威；ai-svc (TS) 蓝图 |
| **Compliance** | 🟡 有服务 | 🟡 有页面 | — | ComplianceFrameworkService |
| **Chaos** | 🟡 有服务 | 🟡 有页面 | — | ChaosEngineeringService |
| **Canary** | ✅ 完整 | ✅ 完整 | Go 蓝图 | CanaryAnalysis + canary-traffic |
| **Federation** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | 最近迁移到 PostgreSQL |
| **Plugin** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | PluginSPI + PluginMarketplace |

### 3.6 基础设施层

| 模块 | 后端状态 | 前端状态 | 微服务 | 代码特征 |
|------|---------|---------|--------|---------|
| **Config** | ✅ 完整 | ✅ 完整 | TS+Go 蓝图 | ConfigManagement + GitOps |
| **Secret** | ✅ 完整 | ❌ 无页面 | TS+Go 蓝图 | SecretsService + SecretRepository |
| **Scheduler** | ✅ 完整 | ✅ 完整 | Go 蓝图 | SchedulerService |
| **Runner** | 🟡 有服务 | ❌ 无页面 | TS+Go 蓝图 | RunnerService |
| **Capacity** | 🟡 有服务 | 🟡 有页面 | Go 蓝图 | CapacityService |
| **IaC** | ✅ 完整 | ✅ 完整 | — | IacManagement |
| **Serverless** | 🟡 有服务 | 🟡 有页面 | — | ServerlessService |

---

## 4. 前端-后端映射分析

### 4.1 匹配统计

| 指标 | 数量 | 说明 |
|------|------|------|
| 后端 routes 总数 | 175 | `api/*-routes.ts` |
| 前端 pages 总数 | 202 | `pages/*/` 目录 |
| **精确匹配** | **35** | 名称完全一致的模块 |
| 后端有 routes 无前端 | **140** | 需要补充前端 |
| 前端有页面无后端 routes | **167** | 可能是 mock 数据或微前端子应用 |

### 4.2 关键发现

**匹配率极低（35/175 = 20%）**，主要原因：

1. **命名不一致**：后端用 `approval-routes`，前端用 `approval-svc/` + `Approvals/`
2. **微前端子应用**：前端 `ai-svc/`、`code-svc/` 等通过 Orion-MF 加载，不经过主后端
3. **Mock 数据页面**：部分前端页面使用 mock 数据，未对接真实 API
4. **历史遗留**：部分前端页面是旧版本，未与后端路由对齐

### 4.3 典型命名映射关系

| 后端 routes | 前端 pages | 映射关系 |
|------------|-----------|---------|
| `approval-routes.ts` | `approval-svc/` + `Approvals/` | 命名不一致 |
| `chatops-routes.ts` | `notify-svc/ChatOps/` | 服务归属不同 |
| `ticketing-routes.ts` | `ticket-svc/TicketList/` | 微前端模式 |
| `pipeline-routes.ts` | `pipeline-svc/PipelineList/` | 微前端模式 |
| `ai-gateway-routes.ts` | `ai-svc/AIGateway/` | 微前端模式 |

---

## 5. 系统架构全景（实际）

### 5.1 模块依赖关系（codegraph temporal coupling）

```
高耦合模块组：
├── Pipeline 引擎组
│   ├── PipelineEngine ↔ StageOrchestrator (co-changes: 4)
│   └── StageOrchestrator → StageExecutor → TaskRunner
├── Ticket Go 微服务组
│   ├── analytics ↔ analyzer (co-changes: 4)
│   ├── analytics ↔ dispatch (co-changes: 4)
│   ├── analytics ↔ sla (co-changes: 4)
│   ├── analytics ↔ workflow (co-changes: 4)
│   └── 内部 7 个文件全部强耦合
```

### 5.2 热点文件（PageRank）

```
Top 热点（代码变更最频繁）:
1. orion-feature-flag-svc-go/cmd/server/main.go
2. orion-feature-flag-svc-go/internal/handler/handler.go
3. orion-feature-flag-svc-go/internal/repository/feature_flag_repository.go
```

> 注：Go 微服务中 feature-flag 是唯一有完整 main.go + handler + repository 的服务，说明它是 Go 迁移的样板。

### 5.3 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Orion 平台真实架构                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐  │
│  │ orion-frontend│    │ orion-api-    │    │ orion-platform-     │  │
│  │ React+Vite    │◄──►│ gateway       │◄──►│ service             │  │
│  │ 202 页面      │    │ Fastify       │    │ 139 services        │  │
│  │ 239 API       │    │ 路由转发+认证  │    │ 175 routes          │  │
│  │ Orion-MF      │    │               │    │ 100 有 barrel 导出   │  │
│  └───────────────┘    └───────────────┘    └───────────┬─────────┘  │
│                                                        │            │
│  ┌─────────────────────────────────────────────────────┼─────────┐  │
│  │                                                     │ 微服务   │  │
│  │                                                     │ 蓝图     │  │
│  │                                                     │ 87 个    │  │
│  │                                                     │ 不可独立  │  │
│  └─────────────────────────────────────────────────────┴─────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                              数据层                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ PostgreSQL  │  │ NATS JetStream│ │ Redis       │  │ ES        │  │
│  │ 主数据库     │  │ 事件总线      │  │ 缓存/会话    │  │ 日志/搜索  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 反向缺口分析

### 6.1 后端有 routes 但前端无页面（140 个）

**分类**：

| 类别 | 数量 | 典型模块 |
|------|------|---------|
| 后端完整但前端缺失 | ~60 | abac-policy, ai-agent, ai-cost, ai-gateway, ai-review, ai-security, alert, backup, cache, canary-analysis, capacity, change, channel, chaos-enhanced, ci-type, config-mgmt-enhanced, confirmation, cost-allocation, cron, cross-domain, decision-explanation, degradation, dependency-coordination, diagnostic, dual-engine, env-profile, environment, ephemeral-env, escalation, event-trigger, event-trigger-registry, feature-flag, form, guardian, hook-chain, i18n, incident, inspection, integration, internal-library, issue, knowledge-enhanced, llm-trace-enhanced, message-queue, metadata, middleware-ops, mlops, model-version, multi-cloud-enhanced, notification-enhanced, observability, output-validation, performance, permission, pipeline-enhanced, policy, privacy, problem, process-step-enhanced, project, quality-gate-enhanced, queue, release-train, report-designer, risk-assessment, risk-engine, rbac, runbook, sbom, script-library, security-enhanced, self-healing-enhanced, serverless, service-catalog, sla, smart-deploy, subapp, team, test-generation, ticket-enhanced, tool, user-enhanced, vector-store-enhanced, version-archive, webhook-enhanced, workbench |
| 通过微前端加载 | ~40 | ai-svc, code-svc, approval-svc, artifact-svc, audit-svc, config-mgmt, notification-svc, pipeline-svc, ticket-svc |
| 有页面但命名不匹配 | ~40 | 见 4.3 映射表 |

### 6.2 前端有页面但后端无 routes（167 个）

**原因分析**：

| 类别 | 数量 | 说明 |
|------|------|------|
| 微前端子应用 | ~40 | 通过 Orion-MF 独立加载，不经过主后端 |
| Mock 数据页面 | ~30 | 使用本地 mock，未对接 API |
| 命名不匹配 | ~97 | 前后端命名不一致，实际路由存在但名称不同 |

### 6.3 关键缺口

| 优先级 | 缺口 | 影响 | 建议 |
|--------|------|------|------|
| P0 | 140 个后端 routes 无对应前端页面 | 大量功能无法通过 UI 访问 | 分批补充前端页面 |
| P1 | 命名不一致导致"假缺口" | 实际存在但无法发现 | 建立前后端命名映射表 |
| P1 | 38 个服务无 barrel 导出 | 模块间引用困难 | 补充 index.ts |
| P2 | 47 个 Go 微服务无 main.go | 无法独立部署 | 确认是否真的需要独立部署 |
| P2 | SBOM 无前端 | 软件物料清单管理缺失 UI | 补充前端页面 |
| P2 | Secret 无前端 | 密钥管理无法通过 UI 操作 | 补充前端页面 |

---

## 7. 三文档需要更新的内容

### 7.1 CLAUDE.md（最高优先级）

| 指标 | 当前值 | 应改为 | 行号 |
|------|--------|--------|------|
| services 目录数 | 101 | 139 | ~48 |
| 前端 pages | 149 | 202 | ~126 |
| 后端 routes | 104 | 175 | ~128 |
| 微服务总数 | 35→87(已修正) | 87 | ~28 |
| 微服务详细说明 | 缺少 | 添加命名约定 | ~26-35 |

### 7.2 深度分析报告

| 指标 | 当前值 | 应改为 | 位置 |
|------|--------|--------|------|
| TS 微服务数 | 37 | 37（正确） | 表头 |
| Go 微服务数 | 47 | 47（正确） | 表头 |
| 微服务描述 | "有真实实现代码" | "蓝图，无 main.go，不可独立部署" | 第 3 节 |
| 代码行数 | 182,431 (TS) + 80,447 (Go) | 需重算 | 表 3.1 |
| ChatOps 前端 | 20% | 85% | 补充 3 节 |

### 7.3 INDEX.md

| 指标 | 当前值 | 应改为 | 位置 |
|------|--------|--------|------|
| 后端服务目录 | 135 | 139 | 表格 |
| 前端页面 | 149 | 202 | 表格 |
| 后端路由 | 104 | 175 | 表格 |
| 微服务指标 | 缺失 | 添加 87 个微服务 | 新增行 |

---

## 8. 优先级修复建议

### 立即执行（P0）

| # | 修复项 | 影响 |
|---|--------|------|
| 1 | 更新 CLAUDE.md 所有过期指标 | 所有后续分析以此为基准 |
| 2 | 建立前后端命名映射表 | 消除 97 个"假缺口" |
| 3 | 修正深度分析报告中微服务可部署性描述 | 避免误导 |

### 近期执行（P1）

| # | 修复项 | 影响 |
|---|--------|------|
| 4 | 补充 38 个无 index.ts 服务的 barrel 导出 | 改善模块间引用 |
| 5 | 建立前端页面与后端 routes 的正式映射 | 便于后续开发 |
| 6 | 更新 INDEX.md 指标 | 文档权威性 |

### 中期执行（P2）

| # | 修复项 | 影响 |
|---|--------|------|
| 7 | 确认 Go 微服务是否真的需要独立部署 | 影响 47 个目录的未来方向 |
| 8 | 补充缺失前端页面（SBOM、Secret、Runner） | 功能完整性 |
| 9 | 统一命名规范 | 减少混淆 |

---

## 9. 附录

### A. 后端 services 完整清单（139 个）

```
adaptive-pipeline, agent, ai, ai-agents, ai-review, ai-training,
alert, alert-breaker, api-governance, api-key, api-market,
approval, artifact, artifact-ops, audit, auth, authz,
backup, billing, build, cache, cache-monitor, canary-analysis,
capability, capacity, change, change-intelligence, change-request,
channel, chaos-engineering, chatops, circuit-breaker, code-repo,
cmdb, community, community-advanced, compliance, config,
config-mgmt, config-mgmt-enhanced, confirmation, consistency,
cost, cross-domain-orchestration, data-lineage, data-quality,
database, dba, ddos-protection, decision-explanation, degradation,
degradation-config, deploy, deployment-window, diagnostic,
digital-twin, disaster-recovery, dual-engine, efficiency,
environment, ephemeral-env, escalation, event-trigger,
event-trigger-registry, federation, finops, form, guardian,
handler-registry, hook-chain, i18n, iac, incident, index,
inline-script, inspection, integration, internal-library, issue,
knowledge, llm-trace, lowcode, message-queue, metadata,
middleware-ops, mlops, model-version, module-lifecycle,
monitoring, multi-cloud, multi-modal-trigger, notification,
notification-policy, observability, output-validation,
performance, permission, pipeline, plugin, plugin-marketplace,
plugin-spi, policy, privacy, problem, process-step, product-line,
project, quality-gate, queue, rdm, release-train, report-designer,
risk-assessment, risk-engine, role, runbook, sbom, scheduler,
script-library, security, self-healing, serverless,
service-catalog, session, sla, smart-deploy, subapp, team,
tenant, test-generation, test-selector, ticketing, tool,
user, vector-store, vectorize-rules, version-archive, webhook,
workbench
```

### B. 后端 routes → 前端 pages 精确映射（35 个匹配）

```
abac-policy, ai-decision, ai-gateway, ai-review, ai-security,
approval, approval-svc, artifact, artifact-svc, audit, audit-svc,
chatops, code-svc, community-svc, config-mgmt, confirmation,
cost, debug, deploy, diagnostic, digital-twin, efficiency,
environment, escalation, federation, finops, form, iac, incident,
integration, llm-trace, lowcode, message-queue, monitor-svc,
multi-cloud, notification, notify-svc, pipeline, pipeline-svc,
quality-gate, release-train, risk, rbac, scheduler, script-library,
security-svc, self-healing, serverless, skill, skill-svc,
smart-deploy, ticket, ticket-svc
```

### C. 无 index.ts 但有源码的服务（38 个）

```
artifact-ops(3), authz(5), billing(1), canary-analysis(2),
capacity(1), change-intelligence(1), change-request(4), change(2),
cmdb(7), config(7), confirmation(1), consistency(1),
data-pipeline(4), dba(1), developer-portal(5), ephemeral-env(1),
incident(2), inspection(1), internal-library(1), issue(1),
lowcode(10), message-queue(1), metadata(1), middleware-ops(1),
mlops(1), permission(1), problem(1), product-line(1), rdm(4),
release-train(1), report-designer(5), script-library(5),
serverless(1), service-catalog(1), sla(2), smart-deploy(7),
types(1), workbench(1)
```
