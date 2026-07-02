# 自治流水线详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 自治流水线
> **目标成熟度**: L1 → L1.5
> **关键交付**: 自修复（自动重试）、智能错误分类、自适应超时

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- **PipelineEngine** (`engine/PipelineEngine.ts`)：DAG 有向无环图编排，Stage 依赖关系驱动执行顺序
- **StageExecutor** (`engine/StageExecutor.ts`)：Stage 级别执行，支持条件执行（`if` 表达式）
- **自动重试**：Stage 级别 `retry_count` 配置，简单重试机制
- **执行取消**：`cancelExecution` 支持
- **SelfHealingService** (`services/self-healing/SelfHealingService.ts`)：自愈引擎，含策略匹配（HealingStrategyEngine）、动作执行（HealingActionExecutor）、守护机制（SelfHealingGuardian）、审批工作流，PostgreSQL Repository 持久化
- **SelfHealingGuardian**：风暴抑制（Storm Suppression）、双重审批配置

**不足**：
- Pipeline 重试仅为简单重复执行，无错误分类（网络/超时/代码缺陷导致失败的处理方式不同）
- 重试策略配置不灵活（仅 `retry_count`，无指数退避、最大间隔、重试条件）
- 无自适应超时（超时阈值硬编码，不根据历史执行数据动态调整）
- 自愈引擎（SelfHealingService）独立于 Pipeline Engine，未集成到 Pipeline 执行链路
- 无执行模式推荐（基于历史数据推荐最优执行策略）

### 1.2 Phase 2 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 智能错误分类 | 自动识别失败类型（transient/permanent/flaky），差异化处理 | L1.5 |
| 自适应重试 | 基于错误类型的重试策略（指数退避/条件重试/跳过） | L1.5 |
| 自适应超时 | 根据历史执行数据动态调整超时阈值 | L1.5 |
| 自愈集成 | Pipeline 失败自动触发 SelfHealingService | L1.5 |
| 执行模式推荐 | 基于历史数据推荐最优执行策略 | L1.5 |

## 二、验收标准

### 2.1 智能错误分类

| # | 标准 | 验证方式 |
|---|------|----------|
| E1 | 自动识别 transient 错误（网络抖动/超时/临时资源不足） | 单元测试 |
| E2 | 自动识别 permanent 错误（编译失败/语法错误/配置错误） | 单元测试 |
| E3 | 自动识别 flaky 错误（间歇性失败，历史上有时成功） | 单元测试 |
| E4 | 错误分类准确率 > 90%（基于预设测试集） | 集成测试 |
| E5 | 支持自定义错误分类规则 | API 测试 |

### 2.2 自适应重试

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | transient 错误：指数退避重试（base 30s, max 300s, max 5 次） | 集成测试 |
| R2 | permanent 错误：不重试，直接标记失败 | 集成测试 |
| R3 | flaky 错误：条件重试（最多 3 次，间隔 60s） | 集成测试 |
| R4 | 支持用户配置重试策略覆盖默认行为 | API 测试 |
| R5 | 重试历史可追溯（每次重试的原因、结果、耗时） | 前端验证 |

### 2.3 自适应超时

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 超时阈值基于最近 20 次执行的 P95 延迟 × 2 | 单元测试 |
| T2 | 最少超时阈值 30s，最大 3600s | 单元测试 |
| T3 | 首次执行使用默认超时（300s） | 单元测试 |
| T4 | Stage 级别独立超时计算 | 集成测试 |

### 2.4 自愈集成

| # | 标准 | 验证方式 |
|---|------|----------|
| H1 | Pipeline Run 失败自动创建 SelfHealing incident | 集成测试 |
| H2 | 低置信度自愈策略需人工审批后执行 | 集成测试 |
| H3 | 自愈成功后自动重试 Pipeline Stage | 集成测试 |
| H4 | 自愈失败后升级（escalate）到人工处理 | 集成测试 |

### 2.5 执行模式推荐

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 推荐最优并发策略（串行/并行/混合） | API 测试 |
| M2 | 推荐最优重试策略（基于历史失败率） | API 测试 |
| M3 | 推荐最优资源分配（CPU/Memory） | API 测试 |
| M4 | 推荐理由可解释（基于历史数据） | 前端验证 |

## 三、API 设计

### 3.1 错误分类 API

```
Base: /api/v1/pipelines/error-classification
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/classify` | 分类错误类型 | `ErrorClassificationInput` | `{ errorType, confidence, recommendation }` |
| GET | `/rules` | 获取分类规则列表 | - | `{ data: ClassificationRule[] }` |
| POST | `/rules` | 创建分类规则 | `ClassificationRuleInput` | `{ id, pattern, errorType }` |
| PUT | `/rules/:id` | 更新分类规则 | `ClassificationRuleInput` | `{ id, updated }` |
| DELETE | `/rules/:id` | 删除分类规则 | - | `{ success }` |

**ErrorClassificationInput 结构**:

```typescript
interface ErrorClassificationInput {
  errorMessage: string;
  exitCode?: number;
  stageName: string;
  pipelineId: string;
  context?: Record<string, unknown>;
}

interface ErrorClassificationResult {
  errorType: 'transient' | 'permanent' | 'flaky';
  confidence: number;
  matchedRule?: string;
  recommendation: string;
  historicalFailureRate: number;
}
```

### 3.2 重试策略 API

```
Base: /api/v1/pipelines/:pipelineId/retry-policy
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/retry-policy` | 获取重试策略配置 | - | `RetryPolicyConfig` |
| PUT | `/retry-policy` | 更新重试策略配置 | `RetryPolicyConfig` | `{ updated }` |
| GET | `/runs/:runId/retry-history` | 获取重试历史 | - | `{ data: RetryAttempt[] }` |

**RetryPolicyConfig 结构**:

```typescript
interface RetryPolicyConfig {
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  baseDelayMs: number;
  maxDelayMs: number;
  retryConditions: {
    transient: { enabled: boolean; maxRetries: number };
    permanent: { enabled: boolean; maxRetries: number };
    flaky: { enabled: boolean; maxRetries: number; intervalMs: number };
  };
  timeoutStrategy: 'static' | 'adaptive';
  staticTimeoutMs?: number;
}

interface RetryAttempt {
  id: string;
  runId: string;
  stageId: string;
  attempt: number;
  errorType: 'transient' | 'permanent' | 'flaky';
  errorMessage: string;
  delayMs: number;
  startedAt: Date;
  completedAt: Date;
  status: 'success' | 'failed' | 'skipped';
}
```

### 3.3 自适应超时 API

```
Base: /api/v1/pipelines/:pipelineId/timeout
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/timeout` | 获取当前超时配置 | - | `TimeoutConfig` |
| GET | `/timeout/estimate` | 预估超时阈值 | query: stageName | `{ estimatedTimeoutMs, basis }` |

**TimeoutConfig 结构**:

```typescript
interface TimeoutConfig {
  strategy: 'static' | 'adaptive';
  defaultTimeoutMs: number;
  adaptiveConfig?: {
    sampleSize: number;           // 用于计算的最近执行次数
    multiplier: number;           // P95 × multiplier
    minTimeoutMs: number;
    maxTimeoutMs: number;
  };
  stageTimeouts: Record<string, number>;  // Stage 级别覆盖
}
```

### 3.4 执行推荐 API

```
Base: /api/v1/pipelines/:pipelineId/recommendations
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/recommendations` | 获取执行推荐 | - | `{ concurrency, retry, resource, explanation }` |
| POST | `/recommendations/:id/apply` | 应用推荐 | - | `{ applied, pipelineId }` |

**Recommendation 结构**:

```typescript
interface ExecutionRecommendation {
  concurrency: {
    recommended: 'sequential' | 'parallel' | 'hybrid';
    reason: string;
    estimatedTimeSavings: number;    // ms
    confidence: number;
  };
  retry: {
    recommendedMaxRetries: number;
    recommendedBackoff: 'exponential' | 'linear' | 'fixed';
    historicalFailureRate: number;
    reason: string;
  };
  resource: {
    recommendedCPU: number;
    recommendedMemoryMB: number;
    currentCPU: number;
    currentMemoryMB: number;
    reason: string;
  };
  explanation: string;
  basedOnRuns: number;               // 基于多少历史 Run
}
```

## 四、数据库变更

### 4.1 新增表：pipeline_error_classification

```sql
CREATE TABLE IF NOT EXISTS pipeline_error_classification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  run_id          UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id        VARCHAR(100),
  error_message   TEXT NOT NULL,
  exit_code       INT,
  error_type      VARCHAR(20) NOT NULL,           -- transient/permanent/flaky
  confidence      DECIMAL(3,2),
  matched_rule    VARCHAR(200),
  recommendation  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_error_tenant ON pipeline_error_classification(tenant_id);
CREATE INDEX idx_pipeline_error_run ON pipeline_error_classification(run_id);
CREATE INDEX idx_pipeline_error_type ON pipeline_error_classification(error_type, created_at DESC);
```

### 4.2 新增表：pipeline_retry_history

```sql
CREATE TABLE IF NOT EXISTS pipeline_retry_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  run_id          UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage_id        VARCHAR(100) NOT NULL,
  attempt_number  INT NOT NULL,
  error_type      VARCHAR(20) NOT NULL,
  error_message   TEXT,
  delay_ms        INT,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  duration_ms     INT,

  UNIQUE(run_id, stage_id, attempt_number)
);
CREATE INDEX idx_pipeline_retry_run ON pipeline_retry_history(run_id, stage_id);
CREATE INDEX idx_pipeline_retry_status ON pipeline_retry_history(status, created_at DESC);
```

### 4.3 新增表：pipeline_timeout_configs

```sql
CREATE TABLE IF NOT EXISTS pipeline_timeout_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  strategy        VARCHAR(20) NOT NULL DEFAULT 'adaptive',
  default_timeout_ms BIGINT NOT NULL DEFAULT 300000,
  adaptive_sample_size INT DEFAULT 20,
  adaptive_multiplier DECIMAL(3,1) DEFAULT 2.0,
  adaptive_min_ms BIGINT DEFAULT 30000,
  adaptive_max_ms BIGINT DEFAULT 3600000,
  stage_timeouts  JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(pipeline_id)
);
```

### 4.4 新增表：pipeline_classification_rules

```sql
CREATE TABLE IF NOT EXISTS pipeline_classification_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  pattern         TEXT NOT NULL,                  -- Regex pattern
  pattern_type    VARCHAR(20) DEFAULT 'regex',    -- regex/keyword
  error_type      VARCHAR(20) NOT NULL,
  priority        INT NOT NULL DEFAULT 100,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_classify_tenant ON pipeline_classification_rules(tenant_id, enabled);
```

### 4.5 修改表：pipeline_runs

```sql
ALTER TABLE pipeline_runs
  ADD COLUMN IF NOT EXISTS error_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS self_healing_incident_id UUID REFERENCES self_healing_incidents(id),
  ADD COLUMN IF NOT EXISTS adaptive_timeout_ms BIGINT;
```

### 4.6 迁移脚本

```sql
-- Migration 087: 自治流水线增强
-- 智能错误分类、自适应重试、自适应超时、自愈集成
```

## 五、前端设计

### 5.1 Pipeline 重试配置页面

**路由**: `/pipelines/:id/retry-config`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  重试策略配置  Pipeline: my-app-ci          │
├─────────────────────────────────────────────┤
│                                              │
│  错误分类规则                                │
│  ┌────────────────────────────────────────┐  │
│  │ 类型       │ 最大重试 │ 策略           │  │
│  │ Transient  │    5     │ 指数退避 (30s) │  │
│  │ Permanent  │    0     │ 不重试         │  │
│  │ Flaky      │    3     │ 固定间隔 60s   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  重试策略                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 退避策略: [指数退避 ▼]                  │  │
│  │ 基础延迟: [30] 秒                       │  │
│  │ 最大延迟: [300] 秒                      │  │
│  │ 最大重试: [5] 次                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  超时策略                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 策略: [● 自适应] [○ 固定]              │  │
│  │ 采样数量: [20] 次                       │  │
│  │ 乘数: [2.0]x P95                       │  │
│  │ 最小: [30s]  最大: [3600s]             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [保存配置] [重置为默认]                      │
└─────────────────────────────────────────────┘
```

### 5.2 重试历史页面

**路由**: `/pipelines/:id/runs/:runId/retry-history`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  重试历史  Run #1234                         │
├─────────────────────────────────────────────┤
│  最终结果: ✅ 成功（第 3 次尝试）              │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 尝试 │ Stage    │ 错误类型 │ 耗时  │结果│  │
│  ├────────────────────────────────────────┤  │
│  │  1   │ Build    │ transient │ 15s  │ ❌ │  │
│  │      │ Network timeout, retrying...    │  │
│  ├────────────────────────────────────────┤  │
│  │  2   │ Build    │ transient │ 45s  │ ❌ │  │
│  │      │ Network timeout, retrying...    │  │
│  ├────────────────────────────────────────┤  │
│  │  3   │ Build    │ -         │ 12s  │ ✅ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  重试时间线                                   │
│  ┌────────────────────────────────────────┐  │
│  │ Attempt 1  ━━━━━ 30s wait  ━━━━━  Attempt 2 │  │
│  │                                      60s wait  │  │
│  │                              ━━━━━  Attempt 3 │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 自愈集成页面

**路由**: `/pipelines/:id/runs/:runId/healing`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  自愈状态  Run #1234                         │
├─────────────────────────────────────────────┤
│                                              │
│  触发原因: Stage "Build" 失败 (permanent)     │
│  自愈状态: ⏳ 等待审批                        │
│                                              │
│  自愈策略                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 策略名: Clear Build Cache & Retry       │  │
│  │ 置信度: 78%                            │  │
│  │ 动作:                                   │  │
│  │   1. rm -rf node_modules               │  │
│  │   2. npm ci                             │  │
│  │   3. Retry Build Stage                 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  审批链                                       │
│  ┌────────────────────────────────────────┐  │
│  │ Requested: 2026-05-05 10:30            │  │
│  │ Status: Pending (admin approval needed) │  │
│  │ [批准] [拒绝] [查看详情]                │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.4 执行推荐页面

**路由**: `/pipelines/:id/recommendations`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  执行推荐  Pipeline: my-app-ci              │
├─────────────────────────────────────────────┤
│  基于最近 45 次 Run 分析                      │
│                                              │
│  并发策略推荐                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 推荐: 并行执行                           │  │
│  │ 原因: Test 和 Lint Stage 无依赖关系      │  │
│  │ 预估节省: 45s                           │  │
│  │ 置信度: 92%                             │  │
│  │ [应用推荐]                              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  重试策略推荐                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 当前: maxRetries=3, backoff=exponential │  │
│  │ 推荐: maxRetries=5 (Build 失败率 18%)    │  │
│  │ [应用推荐]                              │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.5 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/PipelineRetryConfig/index.tsx` | 新建 | 重试策略配置页面 |
| `src/pages/RetryHistory/index.tsx` | 新建 | 重试历史页面 |
| `src/pages/PipelineHealing/index.tsx` | 新建 | 自愈集成页面 |
| `src/pages/PipelineRecommendations/index.tsx` | 新建 | 执行推荐页面 |
| `src/api/pipelineRetry.ts` | 新建 | 重试 API 客户端 |
| `src/components/RetryTimeline/index.tsx` | 新建 | 重试时间线组件 |
| `src/components/ErrorTypeBadge/index.tsx` | 新建 | 错误类型标签组件 |
| `src/pages/PipelineRunDetail/index.tsx` | 修改 | 增加重试/自愈入口 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| ErrorClassifier | `services/pipeline/ErrorClassifier.ts` | transient/permanent/flaky 分类（12 cases） |
| RetryStrategyEngine | `services/pipeline/RetryStrategyEngine.ts` | 指数退避/条件重试/跳过（10 cases） |
| AdaptiveTimeoutCalculator | `services/pipeline/AdaptiveTimeoutCalculator.ts` | P95计算/边界条件/首次执行（8 cases） |
| SelfHealingIntegration | `services/pipeline/SelfHealingIntegration.ts` | 触发自愈/审批流转/结果处理（8 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| transient 错误自修复 | 模拟网络超时 → 自动重试（指数退避） → 最终成功 |
| permanent 错误不重试 | 模拟编译失败 → 检测为 permanent → 直接失败不重试 |
| 自愈集成流程 | Pipeline 失败 → 创建 SelfHealing incident → 审批 → 自愈 → 重试成功 |
| 自适应超时计算 | 插入 20 条历史数据 → 验证超时阈值正确计算 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 重试配置 E2E | 配置重试策略 → 触发失败 → 验证重试行为符合配置 |
| 自愈审批 E2E | Pipeline 失败 → 自愈等待审批 → 审批通过 → 验证重试成功 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 错误分类延迟 | < 50ms |
| 重试策略计算 | < 10ms |
| 自适应超时计算 | < 20ms（基于 20 条历史数据） |
| 自愈触发延迟 | < 500ms |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 重试策略修改权限 | 需 admin 权限 |
| 自愈动作审批 | 生产环境自愈需双审批 |
| 审计日志 | 错误分类/重试/自愈动作均记录审计日志 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 错误分类规则 | 可配置、可扩展、支持热更新 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 智能错误分类 | 2 | 1 | 1 |
| 自适应重试 | 2 | 2 | 1 |
| 自适应超时 | 1 | 1 | 0.5 |
| 自愈集成 | 1.5 | 1.5 | 1 |
| 执行推荐 | 1 | 1.5 | 0.5 |
| **合计** | **7.5** | **7** | **4** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
