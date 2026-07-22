# 性能工程详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 10. 性能工程
> **目标成熟度**: L1 → L1.5
> **关键交付**: 性能基线

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前性能相关能力：
- 效能分析 API（`api/efficiency-routes.ts`）
- DORA 指标计算（EfficiencyDashboardService）
- 基础监控指标采集

**不足**：
- 无性能基线定义与追踪
- 无自动化性能回归检测
- 无性能测试管理
- 无性能趋势分析与告警

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 性能基线 | 定义/追踪关键服务的性能基线 | L1.5 |
| 回归检测 | 每次部署自动检测性能回归 | L1.5 |
| 性能测试管理 | 性能测试场景定义/执行/结果管理 | L1.5 |
| 性能趋势 | 历史性能趋势分析与告警 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| PE1 | 性能基线覆盖 4 类指标：P50/P95/P99 延迟、吞吐量、错误率、资源使用 | API 测试 |
| PE2 | 基线按服务+环境维度定义 | API 测试 |
| PE3 | 部署后自动对比基线，回归 > 10% 触发告警 | 集成测试 |
| PE4 | 支持性能测试场景定义（并发数、持续时间、请求类型） | API 测试 |
| PE5 | 性能报告含百分位延迟、吞吐量、资源使用趋势 | 前端验证 |
| PE6 | 性能回归阻断：关键服务回归 > 20% 阻断发布 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/performance
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/baselines` | 获取性能基线 | query: serviceId | `{ data: PerformanceBaseline[] }` |
| POST | `/baselines` | 创建性能基线 | `CreateBaseline` | `{ id, serviceId }` |
| PUT | `/baselines/:id` | 更新性能基线 | `CreateBaseline` | `{ ... }` |
| GET | `/baselines/:id/check` | 检查当前性能 vs 基线 | - | `{ comparison, regressions }` |
| POST | `/tests` | 创建性能测试 | `CreatePerfTest` | `{ id, name }` |
| POST | `/tests/:id/run` | 执行性能测试 | - | `{ runId, status }` |
| GET | `/tests/:id/runs/:runId` | 获取测试结果 | - | `PerfTestRun` |
| GET | `/trends` | 获取性能趋势 | query: serviceId, metric, period | `{ data: TrendPoint[] }` |
| POST | `/regression-check` | 部署后回归检查 | `{ serviceId, version }` | `{ regressions, blocked }` |

```typescript
interface PerformanceBaseline {
  id: string;
  serviceId: string;
  serviceName: string;
  environment: string;
  metrics: PerfMetrics;
  version: string;         // 基线对应的版本
  createdAt: Date;
  createdBy: string;
}

interface PerfMetrics {
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputRps: number;
  errorRatePercent: number;
  cpuPercent: number;
  memoryPercent: number;
}

interface BaselineComparison {
  metric: keyof PerfMetrics;
  baseline: number;
  current: number;
  difference: number;      // 百分比变化
  isRegression: boolean;
  severity: 'none' | 'warning' | 'critical';
}

interface PerfTest {
  id: string;
  name: string;
  description: string;
  serviceId: string;
  scenario: {
    concurrentUsers: number;
    rampUpSeconds: number;
    durationSeconds: number;
    requests: PerfTestRequest[];
  };
  passCriteria: {
    maxP99LatencyMs: number;
    maxErrorRatePercent: number;
    minThroughputRps: number;
  };
}

interface PerfTestRequest {
  method: string;
  path: string;
  weight: number;          // 请求权重
}

interface PerfTestRun {
  id: string;
  testId: string;
  status: 'running' | 'completed' | 'failed';
  results: {
    totalRequests: number;
    successRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    throughputRps: number;
    avgCpuPercent: number;
    avgMemoryPercent: number;
  };
  passed: boolean;
  failures: string[];
  startedAt: Date;
  completedAt?: Date;
}
```

## 四、数据库变更

```sql
-- Migration 110: Performance Engineering
CREATE TABLE IF NOT EXISTS performance_baselines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  service_id            VARCHAR(100) NOT NULL,
  service_name          VARCHAR(200),
  environment           VARCHAR(50),
  metrics               JSONB NOT NULL,
  version               VARCHAR(100),
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_perf_baselines_service ON performance_baselines(service_id, environment);

CREATE TABLE IF NOT EXISTS performance_tests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  service_id            VARCHAR(100),
  scenario              JSONB NOT NULL,
  pass_criteria         JSONB NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_perf_tests_tenant ON performance_tests(tenant_id);

CREATE TABLE IF NOT EXISTS performance_test_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id               UUID NOT NULL REFERENCES performance_tests(id) ON DELETE CASCADE,
  status                VARCHAR(20) DEFAULT 'running',
  results               JSONB,
  passed                BOOLEAN,
  failures              TEXT[] DEFAULT '{}',
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_perf_test_runs_test ON performance_test_runs(test_id, started_at DESC);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  service_id            VARCHAR(100),
  version               VARCHAR(100),
  metrics               JSONB NOT NULL,
  recorded_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_perf_snapshots_service ON performance_snapshots(service_id, recorded_at DESC);
```

## 五、前端设计

**路由**: `/performance`

```
┌─────────────────────────────────────────────┐
│  性能工程                                    │
├─────────────────────────────────────────────┤
│  性能基线对比                                │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│  │ P99 延迟   │ │ 吞吐量     │ │ 错误率   │  │
│  │ 基线: 120ms│ │ 基线: 500  │ │ 基线: 0.2│  │
│  │ 当前: 135ms│ │ 当前: 480  │ │ 当前: 0.3│  │
│  │ ⚠️ +12%   │ │ ✅ -4%    │ │ ⚠️ +50% │  │
│  └────────────┘ └────────────┘ └──────────┘  │
│                                              │
│  性能测试                        [创建测试]   │
│  ┌────────────────────────────────────────┐  │
│  │ API 压测  100 并发  5 分钟  ✅ 通过     │  │
│  │ 首页加载  50 并发  3 分钟  ⚠️ 慢 10%   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [趋势分析] [回归检查] [性能报告]              │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Performance/index.tsx` | 新建 | 性能工程主页面 |
| `src/pages/PerformanceTrends/index.tsx` | 新建 | 性能趋势页面 |
| `src/components/PerfBaselineCard/index.tsx` | 新建 | 基线对比卡片 |
| `src/api/performance.ts` | 新建 | 性能工程 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 12 | BaselineCalculator、RegressionDetector、PerfTestRunner |
| 集成测试 | 4 | 基线创建→回归检测→告警完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 回归检测延迟 | < 5s |
| 基线计算 | < 1s |
| 性能测试执行 | 后台异步 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 性能基线 | 2 | 1 | 1 |
| 回归检测 | 2 | 1 | 1 |
| 性能测试 | 2 | 2 | 2 |
| 趋势分析 | 1 | 1 | 0.5 |
| **合计** | **7** | **5** | **4.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
