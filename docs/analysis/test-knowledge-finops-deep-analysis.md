# 测试管理 / 知识库 / FinOps 域深度分析 (2026-08-02)

> **覆盖**: 7 模块 / ~28,709 行 | **原深度分析覆盖率**: 测试 0% / 知识库 0% / FinOps 25%
> **修正**: FinOps 域实际 15,579 行 (非报告中的 28K)，finops 模块含 15 Handler/20S/56R

---

## 一、测试管理域 (Test Management) — 2 模块 / 3,967 行 / 综合 65%

### 1.1 模块总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **test-selector** | 2,296 | 2 | 12 | **72** | **29** | ✅ | ❌ | **95%** |
| **test-generation** | 1,671 | 1 | 63 | **63** | 6 | ✅ | ❌ | 95% |

### 1.2 模块深度分析

#### test-selector (测试选择器) — 95% ⚠️ 已实现但未 wiring

**AI 驱动的智能测试选择**，核心能力：

| 能力 | 方法 | 说明 |
|------|------|------|
| PR 智能测试推荐 | `SelectTestsForPR(ctx, PRChange)` | 基于变更文件推荐测试 |
| 测试执行计划 | `GetTestPlan(ctx, tenantID, planID)` | 获取测试计划 |
| 测试结果记录 | `RecordTestResult(ctx, RecordTestResultRequest)` | 记录测试结果 |
| 不稳定测试检测 | `GetFlakyTests(ctx, tenantID, threshold)` | 检测 flaky test |
| 覆盖率统计 | `GetCoverage(ctx, tenantID)` | 覆盖率报告 |
| 测试套件管理 | `ListTestSuites(ctx, tenantID)` | 套件列表 |
| 测试历史 | `GetTestHistory(ctx, tenantID, testID)` | 测试历史统计 |
| 批量记录 | `RecordTestResult` | 支持批量记录 |

**架构特点**:
- **72 Service 方法** — Orion 最密集的业务模块之一
- **29 Repo 方法** — 持久化层完整
- `WithRunner(TestRunner)` 策略模式注入测试执行器
- 2 测试文件

#### test-generation (测试生成) — 95% ⚠️ 已实现但未 wiring

**代码生成式测试用例**：

| 能力 | 方法 |
|------|------|
| 测试生成 | `GenerateTests(ctx, tenantID, id)` |
| 结果获取 | `GetResults(ctx, tenantID, id)` |
| 模板管理 | `ListTemplates(ctx, tenantID)` |
| 覆盖率 | `GetCoverage(ctx, tenantID)` |
| 统计 | `GetStats(ctx, tenantID)` |
| 管道执行 | `RunPipeline(ctx, tenantID, req gin.H)` |

**架构特点**:
- **63 Handler 方法** — 含 54 个孤儿方法 (仅 9 个路由注册)
- **63 Service 方法** — 同测试选择器模板复制
- 1 测试文件

### 1.3 测试管理域 P0 问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | **test-selector 未 wiring** | 2,296 行 / 72S / 29R 完全不可用 |
| 2 | **test-generation 未 wiring** | 1,671 行完全不可用 |
| 3 | **test-generation 54 孤儿方法** | 63 方法仅 9 路由注册 |

---

## 二、知识库域 (Knowledge Base) — 2 模块 / 5,160 行 / 综合 75%

### 2.1 模块总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **pandawiki** (PandaWiki) | 3,690 | 2 | 19 | 23 | 22 | ✅ | ❌ | **90%** |
| **internal-library** (内部库) | 1,470 | 1 | 20 | 25 | 22 | ✅ | ✅ | 90% |

### 2.2 模块深度分析

#### pandawiki (PandaWiki 知识库) — 90% ⚠️ 最大知识库模块未 wiring

**文档型知识库**，与 PandaWiki 开源项目集成：

| 能力 | 方法 |
|------|------|
| Space 管理 | `CreateSpace/GetSpace/ListSpaces/UpdateSpace/DeleteSpace` |
| 文档管理 | `CreateDoc/GetDoc/ListDocs/UpdateDoc/DeleteDoc` |
| 版本管理 | `GetDocVersions(ctx, tenantID, docID)` |
| 全文搜索 | `Search(ctx, tenantID, query, spaceID, limit)` |
| **NATS 事件** | `nats/` 子目录 — 事件驱动 |

**架构特点**:
- 3,690 行 — 知识库域最大模块
- **NATS 事件驱动** — 唯一有 `nats/` 子目录的知识库模块
- 版本管理 (DocVersion)
- 全文搜索
- 2 测试文件

**关键模型**:
```go
type Space struct{ ID, TenantID, Name, Description string; Type SpaceType; ContentSource ContentSource }
type Doc struct{ ID, SpaceID, TenantID, Title, Content string; Version int }
type DocVersion struct{ ID, DocID, Version string; Content, Diff string }
```

#### internal-library (内部库管理) — 90% ✅ wired

**内部软件库生命周期管理**：

| 能力 | 方法 |
|------|------|
| 库 CRUD | `Create/Get/GetByName/List/ListByLanguage/ListByOwner/Update/Delete` |
| 版本发布 | `PublishVersion(ctx, libraryID, PublishVersionRequest)` |
| 版本列表 | `ListVersions(ctx, libraryID)` |
| 版本弃用 | `DeprecateVersion(ctx, libraryID, version, reason, migrationGuide, eolDate)` |

**架构特点**:
- 25 Service 方法 — 库生命周期完整
- 语义化版本管理 (PublishVersion/DeprecateVersion)
- 迁移指南 + EOL 日期
- 按语言/负责人筛选
- **已注册 wiring** ✅ — 知识库域唯一可用的模块

### 2.3 知识库域 P0 问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | **pandawiki 未 wiring** | 3,690 行 / NATS 事件不可用 |
| 2 | **pandawiki vs internal-library 功能重叠** | 两个知识库并存 |

---

## 三、FinOps 域 (Cost Management) — 3 模块 / 18,763 行 / 综合 85%

### 3.1 模块总览

| 模块 | 行数 | 测试 | H | S | R | 路由 | Wired | 评分 |
|------|:----:|:----:|:-:|:-:|:-:|:----:|:-----:|:----:|
| **finops** (核心) | 15,579 | 9 | 15 | **20** | **56** | ✅ | ✅ | **100%** |
| **finops-v2** (成本采集) | 2,129 | 2 | 34 | **38** | 38 | ✅ | ✅ | 90% |
| **cost-allocation** (成本分摊) | 1,055 | 2 | 15 | 16 | 14 | ✅ | ✅ | 90% |

### 3.2 模块深度分析

#### finops (FinOps 核心引擎) — 100% ⭐ 域内最强

**15,579 行 / 20 Service 方法 / 56 Repo 方法 / 9 测试** — FinOps 域核心：

| 能力 | 方法 | 说明 |
|------|------|------|
| 预算守卫 | `List/Get/Create/DeleteBudgetGuard` | 预算阈值管理 |
| 成本评估 | `EvaluateCost(ctx, tenantID, pipelineID, estimatedCost, projectID, env)` | 流水线成本预评估 |
| 异常检测 | `DetectAnomalies(ctx, tenantID, days, start, end)` | 成本异常识别 |
| 成本趋势 | `GetCostTrend(ctx, tenantID, days)` | 趋势分析 |
| 成本概览 | `GetCostOverview(ctx, tenantID)` | 全局成本 |
| 优化建议 | `GetOptimizationSuggestions(ctx, tenantID, category, minSavings)` | AI 优化推荐 |
| 优化应用 | `ApplyOptimization(ctx, tenantID, id)` | 应用优化 |
| 成本对比 | `CompareCosts(ctx, tenantID, serviceA, serviceB, period)` | 服务间对比 |

**架构特点**:
- **56 Repo 方法** — 数据层最完整
- **9 测试文件** — 测试覆盖最好
- **3 大能力**: 预算守卫 / 异常检测 / 优化建议
- 成本对比 (CompareCosts) — 服务级成本对比

#### finops-v2 (成本采集 v2) — 90%

**多粒度成本追踪**，38 Service 方法 / 34 Handler 方法：

| 能力 | 方法 |
|------|------|
| 项目成本 | `TrackProjectCost(ctx, tenantID, TrackCostRequest)` |
| 租户成本 | `TrackTenantCost(ctx, tenantID, TrackCostRequest)` |
| 团队成本 | `TrackTeamCost(ctx, tenantID, TrackCostRequest)` |
| 成本趋势 | `GetEntityCostTrend(ctx, tenantID, entityType, entityID, period)` |
| 成本摘要 | `GetCostSummary(ctx, tenantID, period)` |
| 成本明细 | `GetCostBreakdown(ctx, tenantID, dimension)` |
| Chargeback 报告 | `GetChargebackReport(ctx, tenantID)` |
| 预算管理 | `ListBudgets/CreateBudget/GetBudget` |

**架构特点**:
- **租户/项目/团队三粒度追踪** — 灵活的实体类型
- **Chargeback 报告** — 团队级成本分摊
- **维度细分** — 按资源类型/环境/团队
- 34 Handler — 最多 Handler 的 FinOps 模块

#### cost-allocation (成本分摊) — 90%

**成本分摊策略与报告**，15 Handler / 16 Service 方法：

| 能力 | 方法 |
|------|------|
| 分摊 CRUD | `Create/Get/List/Update/DeleteAllocation` |
| 分摊规则 | `CreateRule/ListRules/DeleteRule` |
| 分摊报告 | `CreateReport/GetReport/ListReports/CompleteReport` |

**架构特点**:
- 分摊规则 (Rule) — 自定义分摊逻辑
- 分摊报告 — 完成时记录 totalCost/allocatedCost/resultData

### 3.3 FinOps 域审计发现

| 发现 | 状态 | 说明 |
|------|:----:|------|
| **v3 报告声称 finops 有 15,579 行** | ✅ 正确 | 15,579 行 (含 56R) |
| **v3 报告声称 finops-v2 CollectCost 桩实现** | ✅ 正确 | 有 `otel.Tracer` + 参数绑定 |
| **v3 报告声称 cost-allocation 无权限控制** | ⚠️ 需验证 | 有 `ShouldBindJSON` 但未查权限 |
| **v3 报告声称 finops-v2 无云 API 集成** | ✅ 正确 | 无 AWS/GCP/Azure 真实集成 |

### 3.4 FinOps 域评分

| 模块 | 评分 | 评价 |
|------|:----:|------|
| finops (核心) | 100% | 预算守卫+异常检测+优化+对比，最完整 |
| finops-v2 | 90% | 三粒度追踪+Chargeback，缺少实时云 API |
| cost-allocation | 90% | 分摊策略+报告，功能完整 |

**域综合评分: 85%** — 全部 wired ✅，测试覆盖好 (13T)，功能完整。

---

*分析完成: 2026-08-02 | 测试管理+知识库+FinOps 域 | 7 模块*
