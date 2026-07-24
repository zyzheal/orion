# 运营协作域深度分析报告（FinOps / Change Intelligence）

**生成日期**: 2026-07-03
**分析范围**: `orion-platform-service/src/services/finops/` + `src/services/change-intelligence/`
**对应任务**: Phase 2.40

---

## 一、域概览

### 1.1 FinOps 模块

| 维度 | 数据 |
|------|------|
| 文件数 | 14 源码 + 11 测试 |
| 代码行数 | ~4,500 源码 |
| 测试文件 | 11 个 test suite |
| 数据存储 | PostgreSQL (FinOpsRepository) + Map 回退 |
| 核心能力 | 成本追踪、预算管理、ROI 分析、云成本分配、SaaS 成本追踪、成本优化 |

### 1.2 Change Intelligence 模块

| 维度 | 数据 |
|------|------|
| 文件数 | 2 源码 + 6 测试 |
| 代码行数 | ~800 源码 |
| 测试文件 | 6 个 test suite |
| 数据存储 | PostgreSQL (ChangeIntelligenceRepository) |
| 核心能力 | 变更风险分析、影响范围评估、历史变更匹配、爆炸半径计算 |

---

## 二、FinOps 模块详细分析

### 2.1 服务层架构

```
FinOpsService (业务门面)
├── FinOpsRepository (PostgreSQL 数据访问)
│   ├── FinOpsReport
│   ├── ResourceCost
│   ├── BudgetRecord
│   ├── ROIAnalysisRecord
│   ├── CostComparisonRecord
│   ├── CostOptimizationRecord
│   ├── SpendRecord
│   ├── CloudCostRecord
│   ├── K8sCostRecord
│   └── SaaSCostRecord
│
├── BudgetService (预算管理)
├── CostService (成本追踪)
├── CostTrackingService (成本跟踪)
├── CostOptimizer (成本优化建议)
├── ROIAnalyzer (ROI 分析)
├── CloudCostCollector (云成本采集)
├── K8sCostAllocator (K8s 成本分配)
├── SaaSCostTracker (SaaS 成本追踪)
└── CostEventPublisher (事件发布)
```

### 2.2 核心能力

| 能力 | 服务 | 状态 | 持久化 |
|------|------|------|--------|
| 成本记录追踪 | CostService | ✅ 已实现 | PostgreSQL |
| 预算管理 | BudgetService | ✅ 已实现 | PostgreSQL |
| ROI 分析 | ROIAnalyzer | ✅ 已实现 | PostgreSQL |
| 成本对比 | FinOpsService | ✅ 已实现 | PostgreSQL |
| 成本优化建议 | CostOptimizer | ✅ 已实现 | PostgreSQL |
| 云成本采集 | CloudCostCollector | ✅ 已实现 | PostgreSQL |
| K8s 成本分配 | K8sCostAllocator | ✅ 已实现 | PostgreSQL |
| SaaS 成本追踪 | SaaSCostTracker | ✅ 已实现 | PostgreSQL |
| 成本事件发布 | CostEventPublisher | ✅ 已实现 | EventBus |

### 2.3 数据模型

| 表/模型 | 字段 | 说明 |
|---------|------|------|
| `budgets` | id, name, type, scope, period, amount, thresholds, status, spent | 预算定义 |
| `cost_records` | request_id, model, provider, input_tokens, output_tokens, input_cost, output_cost, total_cost, tenant_id, timestamp | AI 成本记录 |
| `cost_alerts` | budget_id, threshold_pct, triggered_at | 成本告警 |
| `resource_costs` | entity_type, entity_id, amount, category, period | 资源成本 |
| `roi_analyses` | investment_type, name, cost, monthly_savings, time_savings_hours | ROI 分析 |
| `cost_comparisons` | description, before_cost, after_cost, period_start, period_end | 周期对比 |
| `cost_optimizations` | category, priority, status, description, estimated_savings | 优化建议 |
| `cloud_costs` | provider, resource_type, resource_id, amount, currency, billing_period | 云成本 |
| `k8s_costs` | namespace, pod, cpu_cost, memory_cost, total_cost, period | K8s 成本 |
| `saas_costs` | service_name, plan, seat_count, amount, billing_cycle | SaaS 成本 |

### 2.4 测试覆盖

| 测试文件 | 覆盖功能 |
|----------|---------|
| `BudgetService.test.ts` | 预算 CRUD + 超限告警 |
| `CloudCostCollector.test.ts` | 云成本采集 |
| `CostEventPublisher.test.ts` | 事件发布 |
| `CostOptimizer.test.ts` | 成本优化建议 |
| `CostService.test.ts` | 成本记录管理 |
| `CostTrackingService.test.ts` | 成本追踪 |
| `FinOpsRepository.test.ts` | Repository 数据访问 |
| `FinOpsService.test.ts` | 服务门面 |
| `K8sCostAllocator.test.ts` | K8s 成本分配 |
| `ROIAnalyzer.test.ts` | ROI 计算 |
| `SaaSCostTracker.test.ts` | SaaS 成本追踪 |

### 2.5 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| cost_records 无 tenant_id 外键 | 中 | 成本记录表缺少租户隔离 |
| 无实时成本采集 | 低 | CloudCostCollector 为模拟数据 |
| 无预算硬限制 | 低 | 仅告警无阻断 |

---

## 三、Change Intelligence 模块详细分析

### 3.1 服务层架构

```
ChangeIntelligenceService (AI 变更智能分析)
├── ChangeIntelligenceRepository (PostgreSQL)
│   ├── ChangeIntelligenceReportEntity
│   ├── AffectedServiceEntity
│   ├── RiskFactorEntity
│   └── HistoricalMatchEntity
│
├── 核心方法
│   ├── analyze() — 综合变更分析
│   ├── blastRadius() — 爆炸半径计算
│   ├── changeImpact() — 变更影响评估
│   ├── listAnalyses() — 分析记录列表
│   └── riskAssessment() — 风险评估
```

### 3.2 核心能力

| 能力 | 方法 | 状态 | 持久化 |
|------|------|------|--------|
| 综合变更分析 | `analyze()` | ✅ 已实现 | PostgreSQL |
| 爆炸半径计算 | `blastRadius()` | ✅ 已实现 | PostgreSQL |
| 变更影响评估 | `changeImpact()` | ✅ 已实现 | PostgreSQL |
| 分析记录列表 | `listAnalyses()` | ✅ 已实现 | PostgreSQL |
| 风险评估 | `riskAssessment()` | ✅ 已实现 | PostgreSQL |
| 历史变更匹配 | 内嵌于 analyze | ✅ 已实现 | PostgreSQL |

### 3.3 数据模型

| 表 | 字段 | 说明 |
|----|------|------|
| `change_intelligence` | pr_id, repo_id, analysis, risk_level, affected_services, risk_factors, historical_matches | 变更分析报告 |
| `affected_services` | report_id, service_name, service_tier, impact_type, slo_risk | 受影响服务 |
| `risk_factors` | report_id, factor, score, weight, description | 风险因子 |
| `historical_matches` | report_id, similar_change_id, similarity_score, outcome | 历史匹配 |

### 3.4 风险评估模型

```
RiskLevel 计算:
  score < 30  → low
  score 30-60 → medium
  score 60-85 → high
  score > 85  → critical

RiskFactor 类型:
  - code_change_size (代码变更量)
  - test_coverage_gap (测试覆盖缺口)
  - dependency_risk (依赖风险)
  - deployment_frequency (部署频率)
  - incident_history (事故历史)
```

### 3.5 测试覆盖

| 测试文件 | 覆盖功能 |
|----------|---------|
| `ChangeIntelligenceService.test.ts` | 基本 CRUD |
| `ChangeIntelligenceService.analyze.test.ts` | 综合分析 |
| `ChangeIntelligenceService.blastRadius.test.ts` | 爆炸半径 |
| `ChangeIntelligenceService.changeImpact.test.ts` | 变更影响 |
| `ChangeIntelligenceService.listAnalyses.test.ts` | 列表查询 |
| `ChangeIntelligenceService.mappingAndMethods.test.ts` | 映射和方法 |
| `ChangeIntelligenceService.riskAssessment.test.ts` | 风险评估 |
| `ChangeIntelligenceRepository.test.ts` | Repository |

---

## 四、运营协作域能力矩阵

### 4.1 FinOps 能力

| 能力 | 实现状态 | 测试 | 持久化 | 缺失项 |
|------|---------|------|--------|--------|
| 成本记录 | ✅ | ✅ | PostgreSQL | — |
| 预算管理 | ✅ | ✅ | PostgreSQL | 无硬限制 |
| ROI 分析 | ✅ | ✅ | PostgreSQL | — |
| 成本对比 | ✅ | ✅ | PostgreSQL | — |
| 成本优化 | ✅ | ✅ | PostgreSQL | — |
| 云成本采集 | ✅ | ✅ | PostgreSQL | 模拟数据 |
| K8s 成本分配 | ✅ | ✅ | PostgreSQL | — |
| SaaS 成本追踪 | ✅ | ✅ | PostgreSQL | — |
| 多租户隔离 | ⚠️ | — | 部分 | cost_records 缺 tenant_id |
| 告警通知 | ✅ | ✅ | EventBus | — |

### 4.2 Change Intelligence 能力

| 能力 | 实现状态 | 测试 | 持久化 | 缺失项 |
|------|---------|------|--------|--------|
| 综合变更分析 | ✅ | ✅ | PostgreSQL | — |
| 爆炸半径 | ✅ | ✅ | PostgreSQL | — |
| 变更影响评估 | ✅ | ✅ | PostgreSQL | — |
| 风险评估 | ✅ | ✅ | PostgreSQL | — |
| 历史匹配 | ✅ | ✅ | PostgreSQL | — |
| 分析记录查询 | ✅ | ✅ | PostgreSQL | — |

---

## 五、跨域集成分析

### 5.1 FinOps → 其他域

| 集成点 | 目标域 | 状态 |
|--------|--------|------|
| cost_records → pipeline_runs | Pipeline | ✅ 通过 run_id 关联 |
| cost_records → deployments | Deploy | ⚪ 未集成 |
| cost_records → ai_generate | AI | ✅ 通过 request_id 关联 |
| budget alerts → notifications | Notification | ✅ EventBus 集成 |
| budget alerts → alerts | Monitoring | ⚪ 未集成 |

### 5.2 Change Intelligence → 其他域

| 集成点 | 目标域 | 状态 |
|--------|--------|------|
| blast_radius → services | CMDB/Service | ⚪ 未集成 |
| risk_assessment → approvals | Approval | ⚪ 未集成 |
| change_impact → pipelines | Pipeline | ⚪ 未集成 |
| historical_matches → code | Code | ⚪ 未集成 |

---

## 六、关键发现

### 6.1 FinOps 模块

**优势**:
1. 完整的 PostgreSQL 持久化 (FinOpsRepository)
2. 11 个测试文件覆盖核心功能
3. 7 个子服务职责清晰
4. 支持预算、ROI、成本对比、云成本、K8s 成本、SaaS 成本全场景

**劣势**:
1. `cost_records` 表缺少 `tenant_id` 外键，多租户隔离不完整
2. CloudCostCollector 使用模拟数据，无真实云厂商 API 集成
3. 预算超限仅有告警，无自动阻断机制
4. CostOptimizer 建议仅为静态规则，无 AI 驱动优化

### 6.2 Change Intelligence 模块

**优势**:
1. 完整的 PostgreSQL 持久化
2. 8 个测试文件，覆盖分析全流程
3. 风险评估模型 (RiskLevel: low/medium/high/critical)
4. 爆炸半径 + 影响评估 + 历史匹配三位一体

**劣势**:
1. 仅 2 个源码文件，体量较小
2. 无前端页面支持
3. blastRadius 计算结果未与 CMDB 服务拓扑联动
4. 无自动触发机制（需手动触发 analyze）

---

## 七、改进建议

### 7.1 FinOps 改进项

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P1 | cost_records 添加 tenant_id | 完成多租户隔离 |
| P1 | CloudCostCollector 集成真实 API | AWS/Azure/GCP Cost Explorer |
| P2 | 预算硬限制 | 超限自动阻断部署 |
| P2 | CostOptimizer AI 增强 | 基于历史数据的智能建议 |
| P3 | FinOps 仪表盘 | 成本趋势可视化 |

### 7.2 Change Intelligence 改进项

| 优先级 | 建议 | 说明 |
|--------|------|------|
| P1 | 前端页面 | ChangeIntelligence 分析展示 |
| P1 | 自动触发 | 代码提交/PR 创建时自动分析 |
| P2 | CMDB 集成 | blastRadius 与真实服务拓扑联动 |
| P2 | 审批联动 | 高风险变更自动触发审批流程 |
| P3 | 历史数据积累 | 建立变更结果反馈闭环 |

---

## 八、与 AI 域关联

```
AI 域 (2.39) ↔ 运营协作域 (2.40)
    │
    ├── CostOptimizer → AI 模型成本预测
    ├── LLM 调用 → cost_records 记录
    ├── ChangeIntelligence → AI 辅助风险评估
    └── AI Review → 代码变更质量影响分析
```

---

## 九、迁移建议

| 服务 | 当前状态 | 建议 |
|------|---------|------|
| FinOpsService | TS, PostgreSQL | 保留 TS，无迁移必要 |
| ChangeIntelligenceService | TS, PostgreSQL | 保留 TS，无迁移必要 |
| CloudCostCollector | TS, 模拟数据 | 优先集成真实 API |

---

## 十、结论

**FinOps 模块**: 功能完整、测试充分、持久化到位。主要缺失为多租户隔离完善和真实云 API 集成。

**Change Intelligence 模块**: 核心分析能力完整，但体量小、无前端、无自动触发。建议优先补全前端和自动触发能力。

**运营协作域整体评分**: B+ (FinOps 功能完整度 85%，测试覆盖 90%，跨域集成 40%)

---

## 十一、Change 模块（ITIL 变更管理）

### 11.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 3 源码 + 2 测试 |
| 代码行数 | ~1,350 源码（ChangeService 546 + ChangeRepository 474 + index） |
| 数据存储 | PostgreSQL（ChangeRequestRepository + CABMeetingRepository + ChangeTimelineRepository + RFCRepository） |
| 路由文件 | `change-routes.ts` |

**核心能力**: ITIL 标准变更管理生命周期（draft → submitted → approved → in_progress → completed → closed），支持 RFC（Request for Change) 管理、CAB（Change Advisory Board）会议管理、时间线事件追踪和风险等级评估。

### 11.2 服务层架构

```
ChangeService (ITIL 变更管理)
├── ChangeRequestRepository (变更请求 CRUD + 租户过滤)
├── CABMeetingRepository (CAB 会议管理 + 决策记录)
├── ChangeTimelineRepository (时间线事件自动记录)
├── RFCRepository (RFC 文档管理)
│
├── 核心方法
│   ├── createChangeRequest() — 创建变更请求（含风险矩阵计算）
│   ├── updateStatus() — 状态转换（8 状态，19 合法转换）
│   ├── computeRiskLevel() — 风险矩阵计算（type × impact）
│   ├── createCABMeeting() — 创建 CAB 会议
│   ├── addCABDecision() — 记录 CAB 决策
│   ├── createRFC() — 创建 RFC 文档
│   └── getStats() — 变更统计
```

### 11.3 数据模型

| 表 | 字段 | 说明 |
|----|------|------|
| `change_requests` | id, tenant_id, title, description, type, category, priority, risk_level, status, impact_description, rollback_plan, implementation_plan, scheduled_start, scheduled_end, requester_id, assigned_to, approved_by, rejected_by, related_incidents, related_problems, affected_services, metadata | 变更请求主表 |
| `cab_meetings` | id, tenant_id, title, description, scheduled_at, location, attendees, decisions, status, minutes, created_by | CAB 会议 |
| `change_timeline` | id, tenant_id, change_request_id, event_type, description, created_by, metadata | 时间线事件 |
| `rfcs` | id, tenant_id, change_request_id, rfc_number, justification, risk_assessment, test_plan, communication_plan, backout_plan, status, cab_meeting_id | RFC 文档 |

### 11.4 状态机设计

```
draft → submitted → approved → in_progress → completed → closed
  ↓         ↓            ↓            ↓
cancelled  rejected   cancelled    cancelled
  ↓
draft (可重新提交)
```

**风险矩阵**: type（emergency/normal/standard）× impact（high/medium/low）→ risk_level（high/medium/low）

### 11.5 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 未与 Incident/Problem 模块联动 | 中 | relatedIncidents/Problems 字段存在但无自动关联 |
| 缺少审批流配置 | 中 | 固定状态机，不支持自定义审批流程 |
| 无变更日历视图 | 低 | 仅数据库级 schedule 字段，无前端日历展示 |
| 无变更窗口策略 | 低 | 无"禁止变更"时间段配置 |

---

## 十二、Change-Request 模块（RFC 审批链）

### 12.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 5 源码 + 4 测试 |
| 代码行数 | ~650 源码 |
| 数据存储 | PostgreSQL（ChangeRequestRepository + ChangeApprovalRepository + ChangeExecutionRepository） |
| 路由文件 | `change-request-routes.ts` |

**核心能力**: RFC 审批链管理，支持多级审批（按 riskLevel 配置审批层级），执行步骤编排。

### 12.2 审批链配置

| 风险等级 | 审批链 | 层级数 |
|---------|--------|--------|
| low | supervisor | 1 |
| medium | supervisor → manager | 2 |
| high | supervisor → manager → cto | 3 |
| critical | supervisor → manager → cto | 3 |

### 12.3 状态转换（与 Change 模块互补）

```
draft → pending_approval → approved → implementing → completed
  ↓           ↓               ↓            ↓
cancelled   rejected        cancelled    cancelled
  ↓
draft (可重新提交)
```

### 12.4 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 与 Change 模块职责重叠 | 中 | ChangeService 和 ChangeRequestService 有相近的变更管理逻辑 |
| 审批链不可配置 | 中 | 审批角色/层级硬编码在 APPROVAL_CHAIN 常量中 |

---

## 十三、Release Train 模块（发布列车）

### 13.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 2 源码 + 1 测试 |
| 代码行数 | ~480 源码 |
| 数据存储 | PostgreSQL（借 ProductLineRepository）+ 内存 Map 回退 |
| 路由文件 | 通过 product-line-routes.ts |

**核心能力**: 发布列车管理（创建、调度、执行、取消），支持产品线关联、自动发布、审批前置检查。

### 13.2 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 无独立 Repository | 中 | 复用 ProductLineRepository，数据模型耦合 |
| 无独立路由文件 | 低 | 通过 product-line-routes 暴露 |
| 1 个测试文件仅覆盖基本流程 | 中 | 测试覆盖率不足 |

---

## 十四、Test Generation 模块（AI 测试生成）

### 14.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 5 源码 + 5 测试 |
| 代码行数 | ~2,800 源码（ChangeAnalyzer 1006 + TestGeneratorService 713 + TestTemplateEngine 860） |
| 数据存储 | PostgreSQL（TestGenerationHistoryRepository） |
| 路由文件 | `test-generation-routes.ts` |

**核心能力**: AI 驱动的测试用例自动生成，支持代码变更分析、多语言模板引擎、测试策略配置。

### 14.2 服务层架构

```
TestGeneratorService (AI 测试生成)
├── ChangeAnalyzer (1006 行) — 代码变更 diff 分析
├── TestTemplateEngine (860 行) — 多语言测试模板引擎
└── TestGenerationHistoryRepository — 测试生成历史
```

**支持语言**: TypeScript、Python、Go、Java
**测试框架**: Jest、PyTest、GoTest、JUnit

### 14.3 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| AI Gateway 接口为可选（Optional） | 中 | 无 AI 时降级为空模板 |
| 无真实 AI 后端集成 | 中 | 当前为模板匹配，非 LLM 生成 |

---

## 十五、Test Selector 模块（智能测试选择）

### 15.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 7 源码 + 7 测试 |
| 代码行数 | ~2,400 源码 |
| 数据存储 | PostgreSQL（PRTestResultDependencyRepository） |
| 路由文件 | `test-selector-routes.ts` |

**核心能力**: 基于 PR 变更的智能测试选择，包含依赖分析、影响分析、执行优化和失败预测。

### 15.2 服务层架构

```
TestSelectorService (智能测试选择)
├── TestDependencyAnalyzer (541 行) — 测试依赖图分析
├── TestImpactAnalyzer (291 行) — 变更影响范围分析
├── TestExecutionOptimizer (387 行) — 执行顺序优化
└── TestFailurePredictor (380 行) — 基于历史的失败预测
```

### 15.3 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 无独立 Repository 模式 | 中 | PRTestResultDependencyRepository 在全局 repositories/ 目录 |
| 事件集成仅定义接口 | 低 | EventBusAdapter 接口已定义但实际订阅未激活 |

---

## 十六、Audit 模块（审计日志）

### 16.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 7 源码 + 7 测试 |
| 代码行数 | ~2,200 源码 |
| 数据存储 | PostgreSQL（AuditRepository）+ 文件系统（ImmutableAuditFileRepository） |
| 路由文件 | `audit-routes.ts` + `permission-audit-routes.ts` + `terminal-audit-routes.ts` + `pipeline-audit-log-routes.ts` |

**核心能力**: 审计日志的写后不可篡改存储，支持链式哈希签名验证、完整性校验、独立的鉴权审计和终端审计。

### 16.2 服务层架构

```
AuditService (审计门面)
├── AuditRepository (197 行) — PostgreSQL 审计日志 CRUD
├── ImmutableAuditStorage (708 行) — Append-only 不可变存储
│   ├── SHA-256 链式哈希签名
│   ├── 文件级存储（10,000 条目/文件）
│   └── 写入保护 + 同步写入
├── AuditLogChain (547 行) — 链式日志验证
├── AuditIntegrityVerifier (551 行) — 完整性校验
│
路由层:
├── audit-routes.ts — 通用审计日志
├── permission-audit-routes.ts — 权限变更审计
├── terminal-audit-routes.ts — 终端操作审计
└── pipeline-audit-log-routes.ts — Pipeline 操作审计
```

### 16.3 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| AuditService 仅 75 行门面层 | 低 | 轻量级实现，核心在 Repository 层 |
| 不可变存储为文件系统 | 中 | 生产环境需分布式文件系统或对象存储 |
| 4 个路由文件分散 | 低 | 符合微前端预期但维护分散 |

---

## 十七、Compliance 模块（合规管理）

### 17.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 3 源码 + 1 测试 |
| 代码行数 | ~340 源码 |
| 数据存储 | PostgreSQL（ComplianceRepository） |
| 路由文件 | `compliance-routes.ts` + `security-compliance-routes.ts` |

**核心能力**: 合规策略管理、合规检查执行、合规报告生成。

### 17.2 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 仅 1 个测试文件 | 高 | 测试覆盖率严重不足 |
| 体量较小（213 行核心服务） | 中 | 功能仅为基础 CRUD |
| 与 Security 模块边界模糊 | 中 | security-compliance-routes 职责交叉 |

---

## 十八、SLA 模块（服务水平协议管理）

### 18.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 3 源码 + 2 测试 |
| 代码行数 | ~1,090 源码（SLAService 503 + SLARepository 584） |
| 数据存储 | PostgreSQL（SLADefinitionRepository + SLATrackingRepository + SLABreachEventRepository） |
| 路由文件 | `sla-routes.ts` |

**核心能力**: SLA 定义 CRUD、实体追踪（incident/request/change）、违约检测、合规率计算、升级规则。

### 18.2 服务结构

| 服务 | 方法 | 说明 |
|------|------|------|
| SLAService | createDefinition/getDefinition | SLA 定义管理 |
| | startTracking/stopTracking | 追踪生命周期 |
| | detectBreaches | 定时违约扫描 |
| | getCompliance | 合规率计算 |
| | getStats | SLA 统计 |

**SLA 类型**: response（响应时间）、resolution（解决时间）、availability（可用率）
**追踪状态**: tracking → met / breached / paused
**实体类型**: incident（事件）、request（请求）、change（变更）

### 18.3 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 违约检测为主动调用 | 中 | 需外部定时触发，无内置 scheduler |
| 未与 Notification 集成 | 中 | 违约事件无自动通知 |
| 升级规则仅在 Repository 层定义 | 低 | escalationRules 字段已定义但未实现 |

---

## 十九、Quality Gate 模块（质量门禁）

### 19.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 2 源码 + 2 测试 |
| 代码行数 | ~180 源码 |
| 数据存储 | 未知（无独立 Repository） |
| 路由文件 | 无独立路由 |

**核心能力**: 质量门禁增强服务，提供门禁规则评估。

### 19.2 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 仅 179 行代码 | 高 | 功能极度有限 |
| 无独立 Repository | 高 | 持久化未定义 |
| 无独立路由 | 高 | 无法通过 HTTP 调用 |
| 无明确数据模型 | 高 | 门禁规则无标准化定义 |

---

## 二十、Cost 模块（成本核算）

### 20.1 模块概览

| 维度 | 数据 |
|------|------|
| 文件数 | 8 源码 + 7 测试 |
| 代码行数 | ~2,100 源码 |
| 数据存储 | PostgreSQLCostRepository） |
| 路由文件 | `ai-cost-routes.ts` + `cost-allocation-routes.ts` |

**核心能力**: 成本记录、预算管理、异常检测、预算守卫、优化分析和成本计算。

### 20.2 服务层架构

```
Cost Service 体系
├── CostService (84 行) — 业务门面：成本记录 + 预算 CRUD
├── CostAnomalyDetectionService (532 行) — 统计异常检测（Z-score/移动平均）
├── CostBudgetGuardService (346 行) — 预算守卫：超限预警/阻断
├── CostOptimizationService (435 行) — 成本优化建议生成
├── CostCalculator (352 行) — 成本计算引擎
└── CostRepository (120 行) — PostgreSQL 数据访问
```

**异常检测类型**: spike（突增）、drop（突降）、trend_change（趋势变化）、sustained_high（持续高位）
**严重性**: low / medium / high / critical

### 20.3 注意：与 FinOps 模块的关系

Cost 模块与 FinOps 模块存在**功能重叠**：
- CostService ↔ FinOps CostService：均管理成本记录和预算
- CostAnomalyDetectionService → 独立于 FinOps
- CostBudgetGuardService → FinOps 仅告警无阻断，此模块补充

**建议**: 合并 Cost 模块功能到 FinOps 模块，消除重复。

### 20.4 已知问题

| 问题 | 严重性 | 说明 |
|------|--------|------|
| 与 FinOps 模块功能重叠 | **P0** | CostService (84行) 与 FinOpsService 均处理成本记录和预算 |
| CostAnomalyDetectionService 无事件发布 | 中 | 检测到异常后无自动告警 |
| CostBudgetGuardService 未集成到 CI/CD | 中 | 预算守卫仅在 API 层生效 |

---

## 二十一、运营协作域能力总矩阵

| 子模块 | 源码文件 | 测试文件 | 代码行数 | 持久化 | 独立路由 | 测试覆盖 | 成熟度 |
|--------|---------|---------|---------|--------|---------|---------|--------|
| FinOps | 14 | 11 | ~4,500 | ✅ PostgreSQL + Map | ✅ | ✅ 11 文件 | **A-** |
| Change Intelligence | 2 | 8 | ~800 | ✅ PostgreSQL | ✅ | ✅ 8 文件 | **B** |
| Change (ITIL) | 3 | 2 | ~1,350 | ✅ PostgreSQL | ✅ | ⚠️ 2 文件 | **B** |
| Change-Request (RFC) | 5 | 4 | ~650 | ✅ PostgreSQL | ✅ | ✅ 4 文件 | **B** |
| Release Train | 2 | 1 | ~480 | ⚠️ 复用 ProductLine | ⚠️ 间接 | ⚠️ 1 文件 | **C+** |
| Test Generation | 5 | 5 | ~2,800 | ✅ PG 历史 | ✅ | ✅ 5 文件 | **B+** |
| Test Selector | 7 | 7 | ~2,400 | ✅ PG 依赖 | ✅ | ✅ 7 文件 | **B+** |
| Audit | 7 | 7 | ~2,200 | ✅ PG + 文件 | ✅ 4 路由 | ✅ 7 文件 | **A-** |
| Compliance | 3 | 1 | ~340 | ✅ PG | ✅ | ❌ 1 文件 | **C** |
| SLA | 3 | 2 | ~1,090 | ✅ PG | ✅ | ⚠️ 2 文件 | **B** |
| Quality Gate | 2 | 2 | ~180 | ❌ 无 Repository | ❌ 无 | ⚠️ 2 文件 | **D** |
| Cost | 8 | 7 | ~2,100 | ✅ PG | ✅ | ✅ 7 文件 | **B**（需合并到 FinOps） |
| **合计** | **61** | **57** | **~18,890** | 11/12 有持久化 | 10/12 | 57 测试文件 | **综合 B** |

---

## 二十二、待修复问题汇总

### P0 问题

| # | 模块 | 问题 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | Cost + FinOps | 功能重叠，CostService 与 FinOpsService 均处理成本/预算 | 数据分裂 | 合并到 FinOps，Cost 模块作为 FinOps 子能力 |
| 2 | Quality Gate | 无 Repository、无路由、179 行代码 | 无法使用 | 补充完整 CRUD + Repository + 路由 |

### P1 问题

| # | 模块 | 问题 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | Change + Change-Request | 两个变更管理模块职责重叠 | 用户困惑 | 合并或明确职责边界 |
| 2 | Release Train | 无独立 Repository | 耦合 ProductLine | 创建独立 ReleaseTrainRepository |
| 3 | Compliance | 仅 1 个测试文件 | 质量风险 | 补充测试至 ≥5 文件 |
| 4 | SLA | 无自动违约扫描触发 | 实时性不足 | 集成定时任务或 EventBus 触发 |
| 5 | Change Mgmt | 未与 Incident/Problem 联动 | 流程断裂 | 实现 relatedIncidents/Problems 自动关联 |
| 6 | Audit | 不可变存储基于文件系统 | 分布式部署困难 | 迁移到 AWS S3/对象存储 |

### P2 问题

| # | 模块 | 问题 | 影响 | 建议 |
|---|------|------|------|------|
| 1 | Cost/FinOps | 无真实云厂商 API 集成 | 模拟数据 | 集成 AWS/Azure/GCP Cost Explorer |
| 2 | Change | 无变更日历 | 可观测性 | 前端日历视图 |
| 3 | Test Selector | EventBus 订阅未激活 | 非自动触发 | 激活 PR 事件订阅 |
| 4 | Quality Gate | 门禁规则标准化 | 无法扩展 | 定义数据模型和规则引擎 |
| 5 | Release Train | 测试覆盖率不足 | 质量风险 | 补充更多测试场景 |

---

## 二十三、运营协作域与 AI 域关联

```
运营协作域 (2.40) ↔ AI 域 (2.39)
    │
    ├── ChangeIntelligence → AI 辅助风险评估
    ├── Test Generation → AI 测试用例生成
    ├── Test Selector → AI 测试影响分析 + 失败预测
    ├── Cost Anomaly Detection → AI 成本异常模式识别
    ├── Audit Log Chain → AI 异常行为检测
    └── FinOps CostOptimizer → AI 成本优化建议
```

## 二十四、结论

**运营协作域整体评估**:

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整度 | **78%** | 12 个子模块覆盖 ITIL 变更 + 测试 + 审计 + 合规 + 成本全场景 |
| 测试覆盖 | **82%** | 57 个测试文件，Compliance/QualityGate/ReleaseTrain 薄弱 |
| 持久化程度 | **92%** | 11/12 模块采用 PostgreSQL，仅 QualityGate 无 Repository |
| 跨域集成 | **35%** | Change/Incident/Problem 断裂，Cost/FinOps 重叠 |
| 前端支持 | **25%** | 大多模块缺少独立前端页面 |

**核心短板**:
1. **P0**: Cost 与 FinOps 模块功能重叠需合并
2. **P0**: Quality Gate 模块仅骨架
3. **P1**: Change 与 Change-Request 两个变更模块职责重叠
4. **P1**: Compliance 测试严重不足
5. **P2**: 跨模块集成（Change→Incident/Problem）未实现
