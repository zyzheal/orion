# AI 决策引擎详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: AI 决策引擎
> **目标成熟度**: L2 → L2.5
> **关键交付**: 决策解释、模型版本管理

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- **AIGateway** (`services/ai/AIGateway.ts`)：健康检查、熔断器模式（CLOSED/OPEN/HALF_OPEN）、指标收集、Prompt 注入检测和清洗
- **RuleEngine** (`services/ai/RuleEngine.ts`)：16 个场景的降级规则，支持条件匹配（eq/neq/gt/regex 等运算符）、模板执行、函数执行、审计日志
- **AIDegradationRouter** (`services/ai/AIDegradationRouter.ts`)：多级降级策略路由（rule-engine → template → cache → manual → default），16 个 P0/P1 场景全覆盖
- **RiskAssessmentService** (`services/risk-engine/RiskAssessmentService.ts`)：XGBoost 26 特征 + SHAP 可解释性 + PostgreSQL Repository 持久化
- **DiagnosticAgentService** (`services/diagnostic/DiagnosticAgentService.ts`)：症状关联分析、根因识别、知识库模式匹配、NATS 事件订阅

**不足**：
- 无决策解释能力（AI 输出为什么做出该决策，缺乏可解释性）
- 无模型版本管理（RiskAssessmentService 的 model version 硬编码为 `v2.1.0`，无版本切换/对比/回滚能力）
- AIGateway 的降级策略配置为代码硬编码（`DEFAULT_DEGRADATION_CONFIGS`），无运行时动态调整
- 决策质量无评估闭环（无法衡量决策准确性并持续优化）
- RuleEngine 审计日志仅存储在内存（`this.auditLog` 数组），无持久化

### 1.2 Phase 2 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 决策解释 | 每次 AI 决策附带解释（SHAP 值、规则匹配路径、置信度依据） | L2.5 |
| 模型版本管理 | 模型注册、版本切换、A/B 测试、回滚到历史版本 | L2.5 |
| 降级策略动态配置 | 运行时调整降级策略，无需代码变更 | L2.5 |
| 决策质量评估 | 决策准确率追踪、反馈收集、持续优化 | L2.5 |
| 审计日志持久化 | RuleEngine 和 AIGateway 审计日志写入 PostgreSQL | L2.5 |

## 二、验收标准

### 2.1 决策解释

| # | 标准 | 验证方式 |
|---|------|----------|
| E1 | AI 决策响应包含 `explanation` 字段 | API 测试 |
| E2 | 解释包含 SHAP 贡献值（Top 3 特征） | API 测试 |
| E3 | 解释包含规则匹配路径（匹配的规则 ID 和条件） | API 测试 |
| E4 | 解释包含置信度计算依据 | API 测试 |
| E5 | RiskAssessmentService 的 SHAP 解释可查询历史 | API 测试 |

### 2.2 模型版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 模型注册含版本号、类型、特征列表 | API 测试 |
| M2 | 支持设置活跃模型（仅一个模型处于 active 状态） | API 测试 |
| M3 | 支持 A/B 测试（流量分流比例配置） | API 测试 |
| M4 | 支持回滚到历史版本 | API 测试 |
| M5 | 模型版本切换不影响正在执行的请求 | 集成测试 |
| M6 | 模型元数据包含训练数据版本、精度指标 | API 测试 |

### 2.3 降级策略动态配置

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 运行时更新降级策略配置，即时生效 | API 测试 |
| D2 | 支持添加/删除场景降级配置 | API 测试 |
| D3 | 配置变更写入审计日志 | 代码审查 |
| D4 | 支持导出/导入降级策略配置（JSON） | API 测试 |

### 2.4 决策质量评估

| # | 标准 | 验证方式 |
|---|------|----------|
| Q1 | 支持对决策结果提交反馈（correct/incorrect/partially） | API 测试 |
| Q2 | 按场景/模型版本统计决策准确率 | API 测试 |
| Q3 | 准确率趋势可视化（7/30/90 天） | 前端验证 |
| Q4 | 低准确率场景自动标记并告警 | 集成测试 |

### 2.5 审计日志持久化

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | RuleEngine 审计日志写入 `ai_audit_logs` 表 | 迁移脚本 |
| A2 | AIGateway 决策事件写入 `ai_audit_logs` 表 | 迁移脚本 |
| A3 | 审计日志按 tenant_id 隔离 | API 测试 |
| A4 | 支持按场景/时间范围查询审计日志 | API 测试 |

## 三、API 设计

### 3.1 模型版本管理 API

```
Base: /api/v1/ai/models
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/` | 注册模型版本 | `ModelRegistration` | `{ id, version, type, status }` |
| GET | `/` | 获取模型列表 | query: type, status, page, limit | `{ data: ModelVersion[], total }` |
| GET | `/:id` | 获取模型详情 | - | `{ ...ModelVersion, metrics, trainingInfo }` |
| POST | `/:id/activate` | 激活模型 | `{ force?: boolean }` | `{ id, status: 'active', previousActiveId }` |
| POST | `/:id/ab-test` | 配置 A/B 测试 | `{ trafficPercent: number, compareToId: string }` | `{ id, abTestConfig }` |
| DELETE | `/:id` | 软删除模型 | - | `{ success }` |

**ModelVersion 结构**:

```typescript
interface ModelVersion {
  id: string;
  name: string;
  type: 'risk-assessment' | 'code-review' | 'test-selection' | 'diagnostic' | 'custom';
  version: string;                // semver: "2.2.0"
  status: 'registered' | 'testing' | 'active' | 'archived';
  features: string[];             // 特征列表
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  trainingInfo: {
    datasetVersion: string;
    trainingDate: Date;
    samplesCount: number;
    framework: string;            // 'xgboost' | 'llm' | 'rule-engine'
  };
  createdAt: Date;
  createdBy: string;
}
```

### 3.2 决策解释 API

```
Base: /api/v1/ai/decisions
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/:decisionId/explanation` | 获取决策解释 | - | `{ explanation, shapValues, rulePath }` |
| POST | `/:decisionId/feedback` | 提交决策反馈 | `{ rating, comment }` | `{ success }` |
| GET | `/quality` | 决策质量统计 | query: scenario, days, modelId | `{ accuracy, totalDecisions, byScenario }` |
| GET | `/quality/trend` | 决策质量趋势 | query: scenario, days | `{ data: [{ date, accuracy, count }] }` |

**DecisionExplanation 结构**:

```typescript
interface DecisionExplanation {
  decisionId: string;
  scenario: string;
  modelId: string;
  modelVersion: string;
  confidence: number;
  explanation: {
    summary: string;                     // 自然语言解释
    topFactors: ShapFactor[];            // Top 3 贡献特征
    ruleMatchPath?: RulePathStep[];      // 规则引擎匹配路径
    alternativeOutcomes?: string[];      // 其他可能的输出
  };
  evaluatedAt: Date;
}

interface ShapFactor {
  feature: string;
  value: number | string;
  contribution: number;    // SHAP 值，正=增加风险
  direction: 'positive' | 'negative';
}

interface RulePathStep {
  ruleId: string;
  ruleName: string;
  condition: string;
  matched: boolean;
}
```

### 3.3 降级策略动态配置 API

```
Base: /api/v1/ai/degradation
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/configs` | 获取降级策略配置 | query: scenario | `{ data: DegradationConfig[] }` |
| PUT | `/configs/:scenario` | 更新降级策略配置 | `DegradationConfigInput` | `{ scenario, updated }` |
| POST | `/configs/import` | 导入降级策略配置 | `DegradationConfig[]` | `{ imported, failed }` |
| GET | `/configs/export` | 导出降级策略配置 | - | JSON 数组 |

**DegradationConfigInput 结构**:

```typescript
interface DegradationConfigInput {
  scenario: string;
  strategy: 'rule-engine' | 'template' | 'cache' | 'manual' | 'default';
  fallbackStrategies: string[];
  ruleSet?: string;
  templateName?: string;
  cacheTTL?: number;
  notifyOnDegradation: boolean;
  defaultResponse?: Record<string, unknown>;
}
```

### 3.4 审计日志 API

```
Base: /api/v1/ai/audit
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 查询审计日志 | query: scenario, type, from, to, page, limit | `{ data: AuditLog[], total }` |
| GET | `/:id` | 获取审计日志详情 | - | `{ ...AuditLog }` |

## 四、数据库变更

### 4.1 新增表：ai_model_versions

```sql
CREATE TABLE IF NOT EXISTS ai_model_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  model_type      VARCHAR(50) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'registered',
  features        TEXT[] NOT NULL DEFAULT '{}',
  accuracy        DECIMAL(4,3),
  precision       DECIMAL(4,3),
  recall          DECIMAL(4,3),
  f1_score        DECIMAL(4,3),
  dataset_version VARCHAR(50),
  training_date   TIMESTAMPTZ,
  samples_count   INT,
  framework       VARCHAR(50),
  model_artifact  TEXT,                -- S3 path or inline
  metadata        JSONB DEFAULT '{}',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ,

  UNIQUE(tenant_id, model_type, version)
);
CREATE INDEX idx_ai_models_type_status ON ai_model_versions(tenant_id, model_type, status);
```

### 4.2 新增表：ai_ab_tests

```sql
CREATE TABLE IF NOT EXISTS ai_ab_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  model_type      VARCHAR(50) NOT NULL,
  baseline_model_id UUID REFERENCES ai_model_versions(id),
  candidate_model_id UUID REFERENCES ai_model_versions(id),
  traffic_percent INT NOT NULL DEFAULT 50,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  results         JSONB,
  created_by      UUID REFERENCES users(id),

  UNIQUE(tenant_id, model_type) WHERE status = 'running'
);
CREATE INDEX idx_ai_ab_tests_status ON ai_ab_tests(tenant_id, status);
```

### 4.3 新增表：ai_decisions

```sql
CREATE TABLE IF NOT EXISTS ai_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scenario        VARCHAR(100) NOT NULL,
  model_id        UUID REFERENCES ai_model_versions(id),
  input_hash      VARCHAR(64) NOT NULL,          -- SHA-256 of input
  output          JSONB NOT NULL,
  confidence      DECIMAL(4,3),
  explanation     JSONB,                         -- 决策解释
  shap_values     JSONB,                         -- SHAP 贡献值
  rule_match_path JSONB,                         -- 规则匹配路径
  latency_ms      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_decisions_tenant ON ai_decisions(tenant_id, scenario);
CREATE INDEX idx_ai_decisions_scenario ON ai_decisions(scenario, created_at DESC);
CREATE INDEX idx_ai_decisions_input_hash ON ai_decisions(input_hash);
```

### 4.4 新增表：ai_decision_feedback

```sql
CREATE TABLE IF NOT EXISTS ai_decision_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id     UUID NOT NULL REFERENCES ai_decisions(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  rating          VARCHAR(20) NOT NULL,           -- correct/incorrect/partially
  comment         TEXT,
  corrected_output JSONB,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_feedback_decision ON ai_decision_feedback(decision_id);
CREATE INDEX idx_ai_feedback_tenant ON ai_decision_feedback(tenant_id);
```

### 4.5 新增表：ai_audit_logs

```sql
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scenario        VARCHAR(100) NOT NULL,
  event_type      VARCHAR(50) NOT NULL,           -- decision/degradation/circuit_breaker/model_switch
  source          VARCHAR(50) NOT NULL,           -- ai-gateway/rule-engine/degradation-router
  input_summary   JSONB,
  output_summary  JSONB,
  latency_ms      INT,
  error           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_audit_tenant ON ai_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_audit_scenario ON ai_audit_logs(scenario, created_at DESC);
CREATE INDEX idx_ai_audit_source ON ai_audit_logs(source);
```

### 4.6 新增表：ai_degradation_configs

```sql
CREATE TABLE IF NOT EXISTS ai_degradation_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scenario        VARCHAR(100) NOT NULL UNIQUE,
  strategy        VARCHAR(50) NOT NULL,
  fallback_strategies TEXT[] DEFAULT '{}',
  rule_set        VARCHAR(100),
  template_name   VARCHAR(100),
  cache_ttl       INT DEFAULT 300000,
  notify_on_degradation BOOLEAN DEFAULT false,
  default_response JSONB,
  created_by      UUID REFERENCES users(id),
  updated_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_degradation_tenant ON ai_degradation_configs(tenant_id, scenario);
```

### 4.7 迁移脚本

```sql
-- Migration 086: AI 决策引擎增强
-- 模型版本管理、决策解释、降级策略动态配置、审计持久化
```

## 五、前端设计

### 5.1 AI 决策仪表盘

**路由**: `/ai-decisions/dashboard`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  AI 决策引擎仪表盘                            │
├─────────────────────────────────────────────┤
│                                              │
│  总览 (最近 7 天)                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 决策数  │ │ 准确率  │ │ 平均延迟 │        │
│  │  12,450 │ │  94.2%  │ │   45ms  │        │
│  │ ↑ 8.3%  │ │ ↑ 1.5%  │ │ ↓ 12ms  │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  活跃模型                                     │
│  ┌────────────────────────────────────────┐  │
│  │ Risk Assessment  v2.2.0 [Active]       │  │
│  │ Code Review      v1.5.0 [Active]       │  │
│  │ Test Selection   v1.0.0 [Testing-10%]  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  场景准确率 Top/Bottom                        │
│  ┌────────────────────────────────────────┐  │
│  │ Risk Assessment    97.3%  ✅            │  │
│  │ Code Review        95.1%  ✅            │  │
│  │ Root Cause Diag    89.4%  ⚠️            │  │
│  │ Auto Scheduling    82.1%  ⚠️            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  决策质量趋势 (30 天)                         │
│  ┌────────────────────────────────────────┐  │
│  │ 📈 折线图: 91% → 92% → 93% → 94% → 94%  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 模型版本管理页面

**路由**: `/ai-decisions/models`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  模型版本管理                    [注册模型]  │
├─────────────────────────────────────────────┤
│  筛选: [全部类型▼] [全部状态▼]                │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Risk Assessment                         │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ v2.2.0  [Active]  F1: 0.94        │ │  │
│  │ │ 2026-05-01  XGBoost  26 features  │ │  │
│  │ │ [设为活跃] [A/B测试] [详情] [归档]   │ │  │
│  │ ├────────────────────────────────────┤ │  │
│  │ │ v2.1.0  [Archived]  F1: 0.91      │ │  │
│  │ │ 2026-04-15  XGBoost  26 features  │ │  │
│  │ │ [对比] [详情] [删除]               │ │  │
│  │ └────────────────────────────────────┘ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  A/B 测试中                                   │
│  ┌────────────────────────────────────────┐  │
│  │ Test Selection: v1.0 vs v1.1           │  │
│  │ 流量: 90% → v1.0  10% → v1.1          │  │
│  │ v1.0 准确率: 88.5%  v1.1 准确率: 91.2% │  │
│  │ [结束测试] [调整流量] [查看结果]        │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 降级策略配置页面

**路由**: `/ai-decisions/degradation`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  降级策略配置                    [导入配置]  │
├─────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Scenario: aegis-risk-assessment        │  │
│  │ 主策略: [rule-engine ▼]                │  │
│  │ 备选: [cache, default ▼]               │  │
│  │ 规则集: [aegis-risk-assessment-rules]  │  │
│  │ 缓存TTL: [300000] ms                   │  │
│  │ 通知: [✓] 降级时发送通知               │  │
│  │ [保存] [重置]                          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Scenario: code-review                  │  │
│  │ 主策略: [rule-engine ▼]                │  │
│  │ 备选: [template, default ▼]            │  │
│  │ 规则集: [code-review-rules]            │  │
│  │ 缓存TTL: [300000] ms                   │  │
│  │ 通知: [ ] 降级时发送通知               │  │
│  │ [保存] [重置]                          │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.4 决策详情与解释页面

**路由**: `/ai-decisions/decisions/:id`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  决策详情: risk-prd-12345                     │
├─────────────────────────────────────────────┤
│                                              │
│  决策结果                                     │
│  风险等级: 🔴 High (Score: 0.72)             │
│  置信度: 0.91                                │
│  模型: Risk Assessment v2.2.0               │
│                                              │
│  决策解释                                     │
│  ┌────────────────────────────────────────┐  │
│  │ "此变更被判定为高风险，主要因素是：      │  │
│  │  1. 影响范围大 (blast_radius=0.8)       │  │
│  │     贡献 +0.12 到风险评分               │  │
│  │  2. 服务层级关键 (service_tier=0.9)     │  │
│  │     贡献 +0.11 到风险评分               │  │
│  │  3. 存在破坏性变更 (has_breaking=1)     │  │
│  │     贡献 +0.08 到风险评分               │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  SHAP 贡献图                                  │
│  ┌────────────────────────────────────────┐  │
│  │ blast_radius    |████████████| +0.12   │  │
│  │ service_tier    |███████████|  +0.11   │  │
│  │ hasBreaking     |████████|     +0.08   │  │
│  │ test_coverage   |█████|       -0.05   │  │
│  │ author_exp      |███|        -0.02   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  规则匹配路径                                 │
│  ┌────────────────────────────────────────┐  │
│  │ ✓ risk-high-critical-assets: 匹配      │  │
│  │   affectedAssets contains production   │  │
│  │   changeType in [deployment,...]       │  │
│  │   → action: riskLevel = high           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  反馈                                         │
│  [✓ 正确] [✗ 错误] [~ 部分正确]               │
│  备注: [_________________________________]    │
│  [提交反馈]                                   │
└─────────────────────────────────────────────┘
```

### 5.5 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/AIDecisionDashboard/index.tsx` | 新建 | AI 决策仪表盘 |
| `src/pages/AIModelManagement/index.tsx` | 新建 | 模型版本管理 |
| `src/pages/AIDegradationConfig/index.tsx` | 新建 | 降级策略配置 |
| `src/pages/AIDecisionDetail/index.tsx` | 新建 | 决策详情与解释 |
| `src/pages/AIAuditLogs/index.tsx` | 新建 | 审计日志查询 |
| `src/api/aiDecision.ts` | 新建 | AI 决策 API 客户端 |
| `src/components/ShapChart/index.tsx` | 新建 | SHAP 贡献图组件 |
| `src/components/ModelDiff/index.tsx` | 新建 | 模型版本对比组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| ModelVersionService | `services/ai/ModelVersionService.ts` | 注册/激活/A-B测试/回滚（15 cases） |
| DecisionExplanationService | `services/ai/DecisionExplanationService.ts` | SHAP解释/规则路径/置信度依据（10 cases） |
| DegradationConfigService | `services/ai/DegradationConfigService.ts` | CRUD/导入导出/即时生效（8 cases） |
| DecisionQualityService | `services/ai/DecisionQualityService.ts` | 反馈处理/准确率计算/趋势统计（10 cases） |
| AIGateway (增强) | `services/ai/AIGateway.ts` | 决策解释注入/审计日志持久化（6 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 模型切换完整流程 | 注册 v2.3 → A/B 测试 → 验证流量分流 → 激活 → 验证旧模型降级 |
| 决策解释完整性 | 触发风险评估 → 获取解释 → 验证 SHAP 值和规则路径正确 |
| 降级策略热更新 | 更新配置 → 触发降级 → 验证使用新策略 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 模型管理 E2E | 注册模型 → A/B 测试 → 查看结果 → 激活 → 验证活跃模型变更 |
| 决策解释 E2E | 查看决策详情 → 阅读解释 → 提交反馈 → 验证准确率更新 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 决策响应延迟 | < 100ms（含解释生成） |
| 模型切换延迟 | < 1s（不影响正在执行的请求） |
| 审计日志写入 | < 10ms（异步写入，不阻塞决策） |
| 模型列表查询 | < 200ms（含指标计算） |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 模型管理权限 | 注册/激活模型需 admin 权限，查看需 member 权限 |
| 决策反馈权限 | 提交反馈需 member 权限，按 tenant_id 隔离 |
| 审计日志不可篡改 | 审计日志 INSERT ONLY，无 UPDATE/DELETE 权限 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 类型安全 | TypeScript strict mode |
| 模型注册表 | 统一 model registry 管理所有 AI 模型 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 模型版本管理 | 2 | 2 | 1 |
| 决策解释 | 2 | 2 | 1 |
| 降级策略动态配置 | 1 | 1.5 | 0.5 |
| 决策质量评估 | 1.5 | 1.5 | 1 |
| 审计日志持久化 | 0.5 | 1 | 0.5 |
| **合计** | **7** | **8** | **4** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 编写中_
