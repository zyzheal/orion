# Orion 微前端拆分评估与功能样式补全报告

> 扫描时间: 2026-05-22
> 扫描范围: 8 大菜单模块 + 微前端配置 + 独立服务目录
> 规范来源: CLAUDE.md + Orion统一规范汇总.md
> 总页面文件: 540 个 .tsx（排除 __tests__/__mocks__/shared）
> 主页面入口: 93 个 index.tsx / *.Page.tsx

---

## 一、微前端拆分评估

### 全局子应用现状

当前微前端架构已从 Wujie 迁移至 Orion-MF（2026-05-21 完成）。子应用配置改为从后端 `/api/v1/subapps` 动态读取，通过 `SubAppRouteDynamic` 组件按需加载。

**已配置子应用（从 subappStore 动态读取）**：
- 通过 `microfront/apps.ts` + `subappStore.ts` 管理
- 后端通过 `/api/v1/subapps` 返回配置
- 前端通过 `SubAppRouteDynamic` 组件加载 `:subAppKey/*` 路由

**已嵌入主应用的页面**：所有非 `:subAppKey/*` 路由（routes.tsx 中 80+ 条具体路由）

### 全局维度统计

| 维度 | 数值 | 说明 |
|------|------|------|
| 总页面文件 | 540 | 排除测试/模拟/共享 |
| 主页面入口 | 93 | index.tsx 或 *.Page.tsx |
| 菜单子项总数 | 77 | 8 大菜单的 children 总和 |
| 独立后端服务 | 35 | orion-*-svc/ + orion-*-service/ |
| 已有子应用注册 | 动态 | 从后端读取，运行时配置 |
| 使用 colors Token | 250+ 文件 | 色彩系统普及率高 |
| 使用 DataState/Empty | 49 文件 | 空状态覆盖率 ~53% |
| 缺失 Empty 组件 | 85/93 主页 | ~91% 缺失空状态 |
| 缺失 loading 状态 | 18/93 主页 | ~19% 缺失 |
| 使用 batch 选择 | 13 文件 | 批量操作覆盖率低 |

### 按模块详细评估

#### 1. 工作台 (/workbench)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /dashboard | DashboardNew/index.tsx | 639 | 工作台首页，已对接 API |
| /workbench | Workbench/WorkbenchPage.tsx | 720 | 个人工作台，已对接 API |
| /dashboard/engineer | EngineerDashboard/index.tsx | 491 | 个人看板 |
| /dashboard/executive | ExecutiveDashboard/index.tsx | 499 | 总览看板 |
| /dashboard/manager | ManagerDashboard/index.tsx | 429 | 经理看板 |
| /tickets | TicketList/index.tsx | 1317 | 工单列表 |
| /tickets/:id | TicketDetail/index.tsx | 1358 | 工单详情 |
| /product-lines | ProductLine/index.tsx | 1122 | 产品线管理 |
| /projects | Projects/index.tsx | 658 | 项目管理 |
| /efficiency-dashboard | EfficiencyDashboard/index.tsx | 625 | 效能分析 |
| /risk-dashboard | RiskDashboard/index.tsx | 527 | 风险看板 |

**模块总计**：11 页面，~8,385 行

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 3 | 11 页面但总行数 ~8.4k，中等规模 |
| 团队独立性 | 2 | 同一团队维护，无独立团队 |
| 技术栈差异 | 1 | 与主应用完全一致 |
| 部署频率 | 2 | 作为平台核心，变更频率中等 |
| 故障隔离 | 2 | 页面独立加载，不直接影响主框架 |
| 独立后端 | 3 | 部分依赖 orion-ticket-svc |

**建议**: 继续嵌入
**优先级**: P2 (无需拆分)
**理由**: 代码规模适中，页面多为 Dashboard 视图类页面，技术栈一致，无独立维护团队。工作台是用户入口页面，嵌入主应用体验最佳。

---

#### 2. 控制台 (/console)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /console | Console/index.tsx | 285 | 控制台首页 |
| /console/plugins | PluginManagement/index.tsx | 1054 | 插件管理（含 6 子页面） |
| /console/settings | feature-flags/FeatureFlagsPage.tsx | 721 | 功能开关 |
| /console/users | UserManagement/index.tsx | 812 | 用户管理 |
| /console/subapps | SubAppManagement/index.tsx | 511 | 子应用管理 |
| /console/capabilities | Capability/ (4 子页面) | 1998 | 能力管理 |
| /console/triggers | WorkflowTriggers/index.tsx | 384 | Trigger 管理 |
| /console/iac | IacManagement/ (5 子页面) | 1505 | IaC 管理 |
| /console/build-env | BuildEnv/ (8 子页面) | 2272 | 构建环境 |
| /console/code-mgmt | CodeMgmt/ (6 子页面) | 1890 | 代码管理 |
| /console/confirmations | ConfirmationWorkbench/ (5 子页面) | 1060 | 人工确认 |
| /console/pipeline-budget | PipelineBudget/index.tsx | 457 | 流水线预算 |
| /console/quality-gates | quality-gate/QualityGatePage.tsx | 654 | 质量门禁 |
| /console/pr-triggers | PRTriggerManagement/index.tsx | 455 | PR Trigger |
| /console/modules | ModuleManager/index.tsx | 966 | 模块管理 |
| /console/runners | RunnerManagement/index.tsx | 673 | Runner 池管理 |
| /console/api-keys | ApiKeyManagement/index.tsx | 221 | API Key 管理 |
| /console/notification-rules | NotificationRules/index.tsx | 402 | 通知规则 |
| /console/webhooks | WebhookManagement/index.tsx | 301 | Webhook 管理 |
| /console/cron | CronManagement/index.tsx | 284 | 定时任务 |
| /console/scripts | ScriptRunner/index.tsx | 198 | 脚本执行 |
| /console/rate-limiting | rate-limiting/RateLimitingPage.tsx | 519 | 限流管理 |
| /console/circuit-breaker | circuit-breaker/CircuitBreakerPage.tsx | 616 | 熔断管理 |
| /console/feature-flags | feature-flags/FeatureFlagsPage.tsx | 721 | 功能开关 |

**模块总计**：~24 页面（含子页面 ~50+），~16,000+ 行

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 5 | 50+ 子页面，16k+ 行，最大模块 |
| 团队独立性 | 3 | 平台配置类，可能由不同人员维护 |
| 技术栈差异 | 1 | 与主应用一致 |
| 部署频率 | 4 | 配置类页面变更频率高，独立部署可减少影响 |
| 故障隔离 | 4 | 控制台功能多，某个配置页面崩溃不应影响其他 |
| 独立后端 | 3 | 多数调用 orion-platform-service |

**建议**: 部分拆分为子应用
**优先级**: P1 (建议拆分)
**拆分目标**:
- IaC Management (5 页面, 1505 行) — P1
- BuildEnv Management (8 页面, 2272 行) — P1
- Plugin Management (6 页面, 1054 行) — P1
- Code Management (6 页面, 1890 行) — P1

其余小型配置页面（功能开关、API Key、Cron 等）继续嵌入。

---

#### 3. 交付 (/delivery)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /pipelines | PipelineList/index.tsx | 252 | 流水线列表 |
| /pipelines/:id | PipelineDetail/index.tsx | 1037 | 流水线详情 |
| /pipelines/new | PipelineEditor/index.tsx | 1636 | 流水线编辑器 |
| /pipelines/:id/runs | PipelineRunList/index.tsx | 430 | 运行列表 |
| /pipelines/:id/runs/:runId | PipelineRunLive/index.tsx | 765 | 实时日志 |
| /pipelines/:id/versions | PipelineVersionHistory/index.tsx | 229 | 版本历史 |
| /pipelines/monitor | pipeline-svc/PipelineMonitor | ~500+ | 流水线监控 |
| /deployments | DeploymentList/index.tsx | 308 | 部署列表 |
| /deployments/:id | DeploymentDetail/index.tsx | 387 | 部署详情 |
| /canary-analysis | CanaryAnalysis/index.tsx | 656 | 灰度分析 |
| /change-intelligence | ChangeIntelligence/index.tsx | 552 | 变更智能 |
| /console/code-mgmt | CodeMgmt/ (6 子页面) | 1890 | 代码管理 |
| /artifacts | Artifacts/index.tsx | 1330 | 制品管理 |
| /artifacts/browser | ArtifactBrowser/ (5 子页面) | 1330 | 制品浏览器 |
| /artifacts/versions | ArtifactVersion/index.tsx | 272 | 制品版本 |
| /internal-libraries | InternalLibrary/ (4 子页面) | 1570 | 二方库管理 |
| /test-selector | TestSelector/index.tsx | 434 | 测试管理 |
| /secrets | SecretsManagement/index.tsx | 503 | 密钥管理 |
| /pipeline-templates | pipeline-template/PipelineTemplatePage.tsx | 383 | 流水线模板 |

**模块总计**：~19 页面（含子页面 ~35+），~13,000+ 行

**独立后端**: `orion-pipeline-svc/` (15,455 行代码, 32 文件)

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 5 | 35+ 子页面，13k+ 行，代码量最大之一 |
| 团队独立性 | 4 | CI/CD 领域通常由专门团队维护 |
| 技术栈差异 | 2 | 与主应用一致 |
| 部署频率 | 5 | CI/CD 变更最频繁 |
| 故障隔离 | 5 | Pipeline 引擎崩溃不应影响工作台/监控 |
| 独立后端 | 5 | 有独立 orion-pipeline-svc (15k+ 行) |

**建议**: 独立子应用
**优先级**: P0 (必须拆分)
**理由**: 最大模块之一，有独立后端服务 (orion-pipeline-svc)，变更频率最高，故障影响面大。拆分为独立子应用可显著减少主应用 bundle 体积和故障影响范围。

---

#### 4. 可观测性 (/observability)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /observability/monitoring | monitor-svc/Monitoring/ (6 子页面) | 1854 | 监控中心 |
| /alerts | AlertList/index.tsx | 656 | 告警列表 |
| /metrics-dashboard | MetricsDashboard/index.tsx | 502 | 指标看板 |
| /observability/diagnostic | security-svc/Diagnostic/ (6 子页面) | 1668 | 诊断中心 |
| /observability/self-healing | SelfHealing/ (7 子页面) | 1551 | 自愈系统 |

**模块总计**：5 页面组（含子页面 ~20），~5,200+ 行

**独立后端**: `orion-monitor-svc/` (5,244 行), `orion-security-svc/` (6,614 行), `orion-selfhealing-svc/`

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 4 | 20 子页面，5.2k+ 行 |
| 团队独立性 | 4 | SRE/运维团队独立维护 |
| 技术栈差异 | 2 | 前端一致 |
| 部署频率 | 4 | 监控规则/告警策略频繁变更 |
| 故障隔离 | 5 | 监控崩溃不应影响交付/工作台 |
| 独立后端 | 5 | 2 个独立后端服务 |

**建议**: 独立子应用
**优先级**: P0 (必须拆分)
**理由**: 已有独立后端服务 (monitor-svc, security-svc)，监控/诊断是自包含领域，SRE 团队可能独立迭代。

---

#### 5. AI 平台 (/ai)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /ai/gateway | AIGateway/index.tsx | 286 | AI 网关 |
| /ai/dashboard | AIDashboard/index.tsx | 42 | AI 仪表盘 |
| /ai/provider | AIDashboard (复用) | 42 | Provider 管理 |
| /ai/agents | AIAgents/ (4 子页面) | 680 | Agent 管理 |
| /ai/security | AISecurity/index.tsx | 906 | AI 安全 |
| /ai/review | AIReview/ (6 子页面) | 1322 | AI 代码评审 |
| /ai/docs | 重定向到 /knowledge | - | AI 文档 |
| /ai/knowledge | 重定向到 /knowledge | - | 知识库 |
| /ai/chatops | ChatOps/ (14 子页面) | 5667 | ChatOps |
| /ai/trace | LLMTraceDashboard/ (5 子页面) | 913 | LLM Trace |
| /ai/cost | AICostDashboard/ (6 子页面) | 1722 | AI 成本 |

**模块总计**：~10 页面组（含子页面 ~40+），~11,500+ 行

**独立后端**: `orion-ai-svc/` (3,267 行), `orion-ai-service/` (Python)

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 5 | 40+ 子页面，11.5k+ 行 |
| 团队独立性 | 5 | AI 团队通常独立 |
| 技术栈差异 | 3 | Python 后端，前端有独立 Chat 界面 |
| 部署频率 | 5 | AI 模型/功能迭代最快 |
| 故障隔离 | 5 | AI 功能崩溃不应影响 CI/CD/监控 |
| 独立后端 | 5 | 2 个独立后端 (Python + Node) |

**建议**: 独立子应用
**优先级**: P0 (必须拆分)
**理由**: AI 是独立领域，有独立 Python 后端，ChatOps 是最大的单页面组 (14 文件, 5.6k 行)，AI 团队需要独立迭代和部署。

---

#### 6. 基础设施 (/infra)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /environments | Environments/index.tsx | 667 | 环境管理 |
| /ephemeral-envs | EphemeralEnvList/index.tsx | 694 | 临时环境 |
| /ephemeral-envs/:id | EphemeralEnvDetail/index.tsx | 592 | 临时环境详情 |
| /console/build-env | BuildEnv/ (8 子页面) | 2272 | 构建环境 |
| /console/iac | IacManagement/ (5 子页面) | 1505 | IaC 管理 |
| /queue | Queue/index.tsx | 654 | 队列管理 |
| /vector-store | VectorStore/ (6 子页面) | 1036 | 向量存储 |
| /eventbus | EventBus/index.tsx | 439 | 事件总线 |
| /cmdb | CMDB/ (8 子页面) | 3551 | 配置管理 |
| /cmdb/topology | CMDB/TopologyPage.tsx | (含在 CMDB) | 拓扑图 |
| /cmdb/integration | CMDB/IntegrationPage.tsx | (含在 CMDB) | 集成资源 |
| /cmdb/terminal | CMDB/WebTerminalPage.tsx | (含在 CMDB) | Web 终端 |
| /cmdb/batch-exec | CMDB/BatchExecPage.tsx | (含在 CMDB) | 批量执行 |
| /cmdb/audit | CMDB/ (审计日志子页面) | (含在 CMDB) | 操作审计 |
| /sessions | Sessions/index.tsx | 487 | 会话管理 |
| /backup | Backup/index.tsx | 638 | 备份恢复 |
| /oncall | OnCall/index.tsx | 797 | 值班管理 |

**模块总计**：~17 页面（含子页面 ~30+），~13,000+ 行

**独立后端**: `orion-cmdb-service/` + `orion-cmdb-svc/` (Go)

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 5 | 30+ 子页面，13k+ 行，CMDB 单模块 3.5k 行 |
| 团队独立性 | 4 | 运维/基础设施团队独立 |
| 技术栈差异 | 2 | 前端一致 |
| 部署频率 | 3 | 基础设施变更频率中等 |
| 故障隔离 | 5 | CMDB/终端崩溃不应影响其他模块 |
| 独立后端 | 5 | Go 语言独立后端 |

**建议**: 独立子应用
**优先级**: P0 (必须拆分)
**理由**: CMDB 是大型独立模块 (8 页面, 3.5k 行)，有 Go 语言独立后端服务，Web 终端/批量执行等功能需要特殊依赖。

---

#### 7. 治理 (/governance)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /policies | PolicyManagement/index.tsx | 572 | 策略管理 |
| /audit-log | AuditLog/index.tsx | 316 | 审计日志 |
| /sbom | SbomDashboard/index.tsx | 435 | SBOM 总览 |
| /sbom/:id | SbomDetail/index.tsx | 440 | SBOM 详情 |
| /tenant-list | TenantList/index.tsx | 994 | 租户列表 |
| /tenant-management | TenantManagement/index.tsx | 739 | 租户配额 |
| /roles | RoleManagement/index.tsx | 433 | 角色管理 |
| /config-management | ConfigManagement/index.tsx | 1084 | 配置管理 |
| /approvals | Approvals/index.tsx | 779 | 审批流 |
| /console/approvals | ApprovalManagement/ (4 子页面) | 1634 | 审批管理 |
| /workflows | WorkflowDesigner/ (4 子页面) | 2366 | 工作流设计器 |
| /workflow-tasks | WorkflowTasks/index.tsx | 623 | 工作流任务 |
| /workflow-dependencies | WorkflowDependencies/index.tsx | 677 | 工作流依赖 |
| /event-registry | EventRegistry/index.tsx | 734 | 事件注册 |
| /task-timeouts | TaskTimeouts/index.tsx | 376 | 任务超时 |
| /finops | FinOpsDashboard/index.tsx | 528 | 成本分析 |

**模块总计**：~16 页面（含子页面 ~20+），~12,700+ 行

**独立后端**: `orion-governance-svc/`, `orion-finops-svc/` (3,899 行)

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 4 | 20+ 子页面，12.7k+ 行 |
| 团队独立性 | 3 | 安全/治理团队可能独立 |
| 技术栈差异 | 2 | 前端一致 |
| 部署频率 | 3 | 策略/审批变更频率中等 |
| 故障隔离 | 4 | 工作流/审批崩溃影响范围大 |
| 独立后端 | 4 | 有独立 finops-svc |

**建议**: 部分拆分为子应用
**优先级**: P1 (建议拆分)
**拆分目标**:
- Workflow Designer (4 页面, 2366 行) — P1
- Approval Management (4 页面, 1634 行) — P2
- Tenant Management + Role Management — P2

---

#### 8. 生态 (/ecosystem)

**页面清单**：

| 路由 | 页面文件 | 代码行数 | 说明 |
|------|---------|---------|------|
| /documents | 重定向到 /knowledge | - | 文档中心 |
| /skills | SkillManagement/ (8 子页面) | 2563 | Skill 市场 |
| /plugin-spi | PluginSPI/ (4 子页面) | 950 | SPI 扩展点 |
| /knowledge | KnowledgeBase/ (通过 PandaWiki) | - | 知识库 |

**模块总计**：~3 页面组（含子页面 ~12），~3,500+ 行

**独立后端**: `orion-skill-svc/` (812 行), `orion-knowledge-svc/` (PandaWiki 集成), `orion-plugin-svc/` (2,245 行), `orion-community-svc/`

**6 维度评分**：

| 维度 | 评分(1-5) | 依据 |
|------|----------|------|
| 代码规模 | 3 | 12 子页面，3.5k+ 行，中等 |
| 团队独立性 | 4 | 生态/市场团队独立 |
| 技术栈差异 | 3 | 有 PandaWiki (Java) 独立服务 |
| 部署频率 | 4 | Skill/插件市场频繁迭代 |
| 故障隔离 | 4 | 生态功能不影响核心业务 |
| 独立后端 | 4 | 3 个独立后端服务 |

**建议**: 独立子应用（已标记 `isDynamicSubApps: true`）
**优先级**: P1 (已有拆分机制)
**理由**: 已在 menuConfigStore 中标记 `isDynamicSubApps: true`，表示从后端动态获取子应用列表。Skill 市场和 SPI 扩展适合独立迭代。

---

### 拆分实施路线图

| 批次 | 模块 | 拆分内容 | 工作量 | 依赖 | 时间线 |
|------|------|---------|--------|------|--------|
| **Phase 1** | 交付 (/delivery) | Pipeline + Artifacts + Test 拆分为独立子应用 | 大 | 需或ion-pipeline-svc API 稳定 | 2-3 周 |
| **Phase 1** | AI 平台 (/ai) | ChatOps + AI Review + AI Cost 拆分为独立子应用 | 大 | 需 AI 服务 API 稳定 | 2-3 周 |
| **Phase 1** | 基础设施 (/infra) | CMDB + 环境管理 拆分为独立子应用 | 大 | 需 CMDB Go 服务 API 稳定 | 2-3 周 |
| **Phase 2** | 可观测性 (/observability) | 监控 + 诊断 + 自愈 拆分为独立子应用 | 中 | 需 monitor-svc API 稳定 | 1-2 周 |
| **Phase 2** | 控制台 (/console) | IaC + BuildEnv + Plugin + Code 拆分为独立子应用 | 中 | 各子服务 API 稳定 | 1-2 周 |
| **Phase 2** | 治理 (/governance) | Workflow Designer + Approval 拆分为独立子应用 | 中 | 审批服务 API 稳定 | 1-2 周 |
| **Phase 3** | 生态 (/ecosystem) | Skill 市场 + SPI 扩展 拆分为独立子应用 | 小 | subapp 动态注册完善 | 1 周 |
| **Phase 3** | 工作台 (/workbench) | 不拆分，保持嵌入 | 无 | - | - |

---

## 二、功能补全清单

### 工作台 (/workbench)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| DashboardNew | 有 | 有 | 缺失(使用 Alert 替代) | 有 | 有 | 无需求 | 无 | 无 | 无 | 缺失 | 0.5d |
| WorkbenchPage | 有 | 有 | 有 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0d |
| EngineerDashboard | 有 | 有 | 有(Result) | 有(DataState) | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 0d |
| ExecutiveDashboard | 有 | 有 | 有(Result) | 有(DataState) | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 0d |
| ManagerDashboard | 有 | 有 | 缺失 | 缺失 | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| TicketList | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0d |
| TicketDetail | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| ProductLine | 有 | 有 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0d |
| Projects | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| EfficiencyDashboard | 有 | 缺失 | 缺失 | 有(DataState) | 无需求 | 无 | 无 | 有 | 无 | 缺失 | 0.5d |
| RiskDashboard | 有 | 缺失 | 缺失 | 缺失 | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |

### 控制台 (/console)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| Console | 有 | 有 | 缺失 | 有 | 有 | 无需求 | 无 | 无 | 无 | 缺失 | 0.5d |
| PluginManagement | 有 | 有 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| FeatureFlagsPage | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| UserManagement | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| SubAppManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| IacManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| BuildEnv | 有 | 有 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| CodeMgmt | 有 | 有 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| ConfirmationWorkbench | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| Capability | 有 | 缺失 | 有 | 缺失 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| RunnerManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| ApiKeyManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| NotificationRules | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| WebhookManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| CronManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| ScriptRunner | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| RateLimiting | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| CircuitBreaker | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| ModuleManager | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |

### 交付 (/delivery)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| PipelineList | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| PipelineDetail | 有 | 有 | 有 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0d |
| PipelineEditor | 有 | 缺失 | 有 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| PipelineRunList | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| PipelineRunLive | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 有 | 无 | 缺失 | 0.5d |
| PipelineVersionHistory | 有 | 缺失 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 缺失 | 0.5d |
| PipelineMonitor | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| DeploymentList | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| DeploymentDetail | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| CanaryAnalysis | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 有 | 缺失 | 0.5d |
| ChangeIntelligence | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| Artifacts | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| ArtifactBrowser | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 缺失 | 0d |
| InternalLibrary | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| TestSelector | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| SecretsManagement | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |

### 可观测性 (/observability)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| Monitoring | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| AlertList | 有 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| MetricsDashboard | 有 | 缺失 | 缺失 | 缺失 | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| Diagnostic | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| SelfHealing | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |

### AI 平台 (/ai)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| AIGateway | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 1d |
| AIAgents | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| AIReview | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| AISecurity | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 1d |
| ChatOps | 有 | 缺失 | 部分有 | 有 | 有 | 无 | 有 | 有 | 无 | 缺失 | 0.5d |
| LLMTraceDashboard | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| AICostDashboard | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 有 | 有 | 缺失 | 0.5d |
| AIDocManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |

### 基础设施 (/infra)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| Environments | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| EphemeralEnvList | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| Queue | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| VectorStore | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| EventBus | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| CMDB | 有 | 缺失 | 部分有 | 有 | 有 | 有 | 有 | 无 | 无 | 缺失 | 0.5d |
| Sessions | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| Backup | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| OnCall | 有 | 缺失 | 有 | 缺失 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |

### 治理 (/governance)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| PolicyManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| AuditLog | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 有 | 无 | 缺失 | 0.5d |
| SbomDashboard | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 有 | 无 | 缺失 | 0.5d |
| TenantList | 有 | 缺失 | 缺失 | 缺失 | 有 | 有 | 有 | 有 | 无 | 缺失 | 0.5d |
| TenantManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| RoleManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| ConfigManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| Approvals | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| ApprovalManagement | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| WorkflowDesigner | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| WorkflowTasks | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| FinOpsDashboard | 有 | 缺失 | 缺失 | 缺失 | 有 | 无 | 有 | 有 | 有 | 缺失 | 0.5d |

### 生态 (/ecosystem)

| 页面 | 缺失标题 | 缺失副标题 | 缺失空状态 | 缺失加载 | 缺失反馈 | 缺失批量 | 缺失搜索 | 缺失导出 | 缺失报表 | 缺失权限 | 预估工时 |
|------|---------|-----------|-----------|---------|---------|---------|---------|---------|---------|---------|---------|
| SkillManagement | 有 | 有 | 缺失 | 有 | 有 | 无 | 有 | 无 | 无 | 缺失 | 0.5d |
| PluginSPI | 有 | 缺失 | 缺失 | 有 | 有 | 无 | 无 | 无 | 无 | 缺失 | 0.5d |
| KnowledgeBase | 缺失 | 缺失 | 缺失 | 缺失 | 无需求 | 无 | 无 | 无 | 无 | 缺失 | 1d |

---

## 三、样式补全清单

### 按菜单模块

#### 工作台 (/workbench)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| DashboardNew | 无(使用 Card) | 无 | 无需求 | 无 | 无 | 无 | 有(#f0f0f0 硬编码) | 无 | 有(24px 非 token) | 0.5d |
| WorkbenchPage | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有(16px/24px 非 token) | 0.5d |
| EngineerDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| ExecutiveDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| ManagerDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |
| TicketList | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| TicketDetail | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| ProductLine | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| Projects | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| EfficiencyDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| RiskDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |

#### 控制台 (/console)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| Console | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |
| PluginManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| FeatureFlagsPage | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| UserManagement | 无 | 无 | 有 | 无 | 无 | 无 | 无 | 无 | 有 | 0.5d |
| IacManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| BuildEnv | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| CodeMgmt | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| ApiKeyManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| CronManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| RateLimiting | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| CircuitBreaker | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |

#### 交付 (/delivery)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| PipelineList | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| PipelineDetail | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| PipelineEditor | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| PipelineRunList | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| PipelineRunLive | 无 | 无 | 无需求 | 无 | 无 | 有(boxShadow 非 token) | 无 | 无 | 无 | 0.25d |
| Artifacts | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| InternalLibrary | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| TestSelector | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 0d |
| CanaryAnalysis | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| ChangeIntelligence | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |

#### 可观测性 (/observability)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| Monitoring | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| AlertList | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| Diagnostic | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| SelfHealing | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| MetricsDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |

#### AI 平台 (/ai)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| AIGateway | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |
| AIAgents | 无 | 无 | 无 | 无 | 无 | 有(boxShadow 非 token) | 无 | 无 | 有 | 0.5d |
| AIReview | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| AISecurity | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |
| ChatOps | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| LLMTraceDashboard | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| AICostDashboard | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |

#### 基础设施 (/infra)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| Environments | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| CMDB | 无 | 无 | 无 | 无 | 无 | 有(boxShadow 非 token) | 无 | 无 | 有 | 0.5d |
| VectorStore | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| OnCall | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| Backup | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 无 | 有 | 0.5d |
| EventBus | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |

#### 治理 (/governance)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| PolicyManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| TenantList | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| TenantManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| ConfigManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| WorkflowDesigner | 无 | 无 | 无需求 | 无 | 无 | 有(boxShadow 非 token) | 无 | 无 | 有 | 0.5d |
| Approvals | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| FinOpsDashboard | 无 | 无 | 无需求 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |

#### 生态 (/ecosystem)

| 页面 | 缺失 Card 样式 | 缺失 Table 样式 | 缺失 Form 布局 | 缺失 Button 样式 | 缺失 Modal 样式 | 缺失阴影 | 颜色违规 | 圆角违规 | 间距违规 | 预估工时 |
|------|--------------|---------------|---------------|----------------|---------------|---------|---------|---------|---------|---------|
| SkillManagement | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| PluginSPI | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 有 | 0.25d |
| KnowledgeBase | 缺失(无 Card) | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 有 | 有 | 有 | 1d |

---

## 四、汇总

### 总工作量

| 类别 | 页面数 | P0 | P1 | P2 | 总工时 |
|------|--------|----|----|----|--------|
| 微前端拆分 | 8 模块 | 4 模块 | 3 模块 | 1 模块 | 8-12 周 |
| 功能补全 | ~120 页面 | 12 | 45 | 63 | ~35 人天 |
| 样式补全 | ~120 页面 | 0 | 25 | 95 | ~20 人天 |
| **合计** | **~120 页面** | **-** | **-** | **-** | **~60 人天 + 8-12 周拆分** |

### 按菜单

| 菜单 | 功能补全工时 | 样式补全工时 | 微前端拆分工时 | 总计 |
|------|-------------|-------------|---------------|------|
| 工作台 (/workbench) | 3d | 3d | 0d | 6d |
| 控制台 (/console) | 9d | 3d | 2w | 14d + 2w |
| 交付 (/delivery) | 6d | 2d | 3w | 10d + 3w |
| 可观测性 (/observability) | 2.5d | 1.25d | 2w | 5.5d + 2w |
| AI 平台 (/ai) | 4.5d | 2.5d | 3w | 8.5d + 3w |
| 基础设施 (/infra) | 5d | 2d | 3w | 9d + 3w |
| 治理 (/governance) | 6d | 2d | 2w | 10d + 2w |
| 生态 (/ecosystem) | 1.5d | 0.75d | 1w | 3.5d + 1w |

### 关键发现

1. **空状态覆盖严重不足**：91% 的主页面缺失 `Empty` 组件，仅 49 个文件使用了 Empty
2. **权限控制几乎全线缺失**：所有页面均未实现前端权限拦截（`usePermission` 仍为 TODO）
3. **批量操作覆盖低**：仅 13 个页面实现了 `rowSelection` 批量选择
4. **Token 系统采用率高但间距仍有硬编码**：colors Token 使用率 ~95%，但 spacing 仍大量使用 `16`/`24` 等硬编码数值
5. **微前端拆分优先级明确**：交付、AI 平台、基础设施、可观测性 4 个模块具备 P0 拆分条件（独立后端 + 大规模代码 + 高部署频率）
6. **工作台无需拆分**：代码规模适中，用户入口页面，嵌入主应用体验最佳
7. **生态模块已具备动态子应用机制**：`isDynamicSubApps: true` 已标记，只需完善子应用注册流程
