# 灰度流量详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 6. 灰度流量
> **目标成熟度**: L2 → L2.5
> **关键交付**: 自动推进策略

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- CanaryAnalysisService（`services/canary-analysis/CanaryAnalysisService.ts`）
- PrometheusClient 指标采集
- SmartDeployService 部署策略引擎
- 灰度分析 API（`api/canary-analysis-routes.ts`）

**不足**：
- 灰度流量比例需手动调整
- 无自动推进策略（基于指标自动调整流量比例）
- 无自动熔断（异常指标自动回滚）
- 缺少灰度实验模板

### 1.2 Phase 3 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 自动推进 | 基于指标自动调整灰度流量比例 | L2.5 |
| 自动熔断 | 异常指标自动回滚到稳定版本 | L2.5 |
| 灰度策略模板 | 预置渐进式/激进式/保守式灰度策略 | L2.5 |
| 流量路由 | 基于 header/cookie/用户分组的精准路由 | L2.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| G1 | 支持 3 种灰度策略模板：渐进式(5→10→25→50→100%)、激进式(25→50→100%)、保守式(1→2→5→10→25→50→100%) | API 测试 |
| G2 | 自动推进基于 3+ 指标：错误率、P99 延迟、CPU 使用率 | 集成测试 |
| G3 | 单步推进间隔可配置（默认 5 分钟） | API 测试 |
| G4 | 异常熔断：错误率 > 1% 或 P99 > 基线 2x 自动回滚 | 集成测试 |
| G5 | 流量路由支持 header 匹配、用户 ID 分组、百分比分流 | 集成测试 |
| G6 | 灰度分析报告含指标趋势、推进时间线、最终决策 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/canary
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/deployments` | 创建灰度部署 | `CreateCanaryDeployment` | `{ id, service, strategy }` |
| GET | `/deployments/:id` | 获取灰度部署详情 | - | `CanaryDeployment` |
| POST | `/deployments/:id/promote` | 手动推进 | `{ targetPercent? }` | `{ status, currentPercent }` |
| POST | `/deployments/:id/rollback` | 手动回滚 | `{ reason? }` | `{ success }` |
| GET | `/deployments/:id/metrics` | 获取实时指标 | - | `{ baseline, canary, comparison }` |
| GET | `/strategies` | 获取策略模板 | - | `{ data: StrategyTemplate[] }` |
| GET | `/deployments/:id/report` | 获取灰度报告 | - | `CanaryReport` |

```typescript
interface CanaryDeployment {
  id: string;
  serviceId: string;
  serviceName: string;
  strategy: string;               // 'progressive' | 'aggressive' | 'conservative' | 'custom'
  baselineVersion: string;
  canaryVersion: string;
  currentPercent: number;         // 当前灰度流量比例
  steps: CanaryStep[];
  currentStepIndex: number;
  status: 'pending' | 'analyzing' | 'promoting' | 'paused' | 'completed' | 'rolled_back';
  autoPromote: boolean;
  autoRollback: boolean;
  rollbackThresholds: RollbackThresholds;
  startedAt: Date;
  estimatedCompletionAt?: Date;
}

interface CanaryStep {
  percent: number;
  durationMinutes: number;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  metrics?: CanaryMetrics;
}

interface RollbackThresholds {
  errorRatePercent: number;       // 错误率阈值
  p99LatencyMultiplier: number;   // P99 延迟倍数
  cpuPercent: number;             // CPU 使用率阈值
}

interface CanaryMetrics {
  errorRate: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  cpuPercent: number;
  memoryPercent: number;
  requestPerSecond: number;
  successRate: number;
}

interface CanaryComparison {
  metric: string;
  baseline: number;
  canary: number;
  difference: number;
  withinThreshold: boolean;
}

interface CanaryReport {
  deploymentId: string;
  totalSteps: number;
  completedSteps: number;
  finalPercent: number;
  decision: 'promoted' | 'rolled_back' | 'in_progress';
  decisionReason: string;
  metricsHistory: CanaryMetrics[];
  timeline: { timestamp: Date; event: string; details: string }[];
  durationMs: number;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  steps: { percent: number; durationMinutes: number }[];
  rollbackThresholds: RollbackThresholds;
  recommendedFor: string[];
}
```

## 四、数据库变更

```sql
-- Migration 106: Canary Traffic Management
CREATE TABLE IF NOT EXISTS canary_deployments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  service_id            UUID NOT NULL,
  service_name          VARCHAR(200),
  strategy              VARCHAR(50) NOT NULL,
  baseline_version      VARCHAR(100),
  canary_version        VARCHAR(100),
  current_percent       INT DEFAULT 0,
  steps                 JSONB NOT NULL,
  current_step_index    INT DEFAULT 0,
  status                VARCHAR(20) DEFAULT 'pending',
  auto_promote          BOOLEAN DEFAULT true,
  auto_rollback         BOOLEAN DEFAULT true,
  rollback_thresholds   JSONB NOT NULL,
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_canary_deployments_tenant ON canary_deployments(tenant_id);
CREATE INDEX idx_canary_deployments_status ON canary_deployments(status);

CREATE TABLE IF NOT EXISTS canary_metrics_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id         UUID NOT NULL REFERENCES canary_deployments(id) ON DELETE CASCADE,
  step_index            INT,
  metrics               JSONB NOT NULL,
  comparison            JSONB DEFAULT '{}',
  recorded_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_canary_metrics_deployment ON canary_metrics_history(deployment_id, recorded_at DESC);
```

## 五、前端设计

**路由**: `/canary-deployments`

```
┌─────────────────────────────────────────────┐
│  灰度发布                                    │
├─────────────────────────────────────────────┤
│  api-gateway v1.2.0 → v1.3.0               │
│  策略: 渐进式  当前: 25%  状态: 推进中       │
├─────────────────────────────────────────────┤
│  推进进度                                    │
│  5% ✅ → 10% ✅ → 25% 🔄 → 50% ░░ → 100% ░░ │
│           下一步: 50%  (预计 15:30)          │
├─────────────────────────────────────────────┤
│  实时指标对比                                │
│  ┌────────────┐ ┌────────────┐              │
│  │ 错误率     │ │ P99 延迟   │              │
│  │ 基线: 0.2% │ │ 基线: 120ms│              │
│  │ 灰度: 0.3% │ │ 灰度: 135ms│              │
│  │ ✅ 正常    │ │ ✅ 正常    │              │
│  └────────────┘ └────────────┘              │
│                                              │
│  [手动推进] [暂停] [回滚]                     │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/CanaryDeployments/index.tsx` | 新建 | 灰度发布主页面 |
| `src/components/CanaryProgress/index.tsx` | 新建 | 推进进度组件 |
| `src/components/MetricsComparison/index.tsx` | 新建 | 指标对比组件 |
| `src/api/canary.ts` | 修改 | 增强灰度 API 调用 |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 12 | AutoPromoter、RollbackDecider、StrategyEngine |
| 集成测试 | 5 | 自动推进完整流程、自动熔断触发 |
| E2E 测试 | 3 | 前端创建灰度→监控→推进/回滚 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 指标采集间隔 | 30s |
| 推进决策延迟 | < 5s |
| 回滚执行时间 | < 60s |
| 最大并发灰度部署 | 5 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 自动推进策略 | 3 | 1 | 2 |
| 自动熔断 | 2 | 1 | 1 |
| 策略模板 | 1 | 1 | 0.5 |
| 流量路由 | 2 | 2 | 1.5 |
| **合计** | **8** | **5** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
