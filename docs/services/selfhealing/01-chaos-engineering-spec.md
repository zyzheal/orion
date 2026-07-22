# 混沌工程详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 1. 混沌工程
> **目标成熟度**: L1 → L1.5
> **关键交付**: 发布前验证、韧性评分

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已具备基础韧性能力：
- 部署回滚（RollbackService）
- 灰度发布（CanaryAnalysisService）
- 健康检查（/healthz 端点）
- 基础告警（AlertCorrelationService）

**不足**：
- 无主动故障注入机制，无法在发布前验证系统韧性
- 无系统性故障演练（网络延迟、服务宕机、资源耗尽）
- 无韧性评分量化指标
- 故障恢复能力依赖人工发现，非自动化验证

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 故障注入引擎 | 注入网络延迟、服务宕机、CPU/内存压力 | L1.5 |
| 发布前验证 | 在 staging 环境自动运行混沌测试 | L1.5 |
| 韧性评分 | 基于故障恢复时间/成功率计算韧性分数 | L1.5 |
| 实验管理 | 混沌实验定义/执行/结果追踪 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 支持 4+ 故障类型：网络延迟、服务宕机、CPU 压力、内存压力 | 集成测试 |
| C2 | 混沌实验支持 scope 定义（tenant/service/environment） | API 测试 |
| C3 | 发布前验证 Pipeline 集成：PR merge 前自动运行混沌测试 | 集成测试 |
| C4 | 韧性评分 0-100，基于 MTTR、成功率、错误预算 | API 测试 |
| C5 | 实验支持自动回滚（故障注入后自动恢复） | 集成测试 |
| C6 | 实验报告含时间线、影响范围、恢复时间 | 前端验证 |
| C7 | 支持安全护栏：production 环境需手动确认才可注入 | 单元测试 |

## 三、API 设计

```
Base: /api/v1/chaos
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/experiments` | 获取实验列表 | query: status, scope | `{ data: ChaosExperiment[], total }` |
| POST | `/experiments` | 创建混沌实验 | `CreateChaosExperiment` | `{ id, name, status }` |
| GET | `/experiments/:id` | 获取实验详情 | - | `ChaosExperiment` |
| POST | `/experiments/:id/run` | 执行实验 | `{ dryRun?: boolean }` | `{ runId, status, startedAt }` |
| GET | `/runs/:runId` | 获取执行结果 | - | `ChaosRun` |
| POST | `/runs/:runId/rollback` | 手动回滚 | `{ reason?: string }` | `{ success }` |
| GET | `/resilience-score` | 获取韧性评分 | query: serviceId?, tenantId? | `{ score, mttrMs, successRate, errorBudget }` |
| POST | `/pre-release-verify` | 发布前验证 | `{ serviceId, environment, pipelineId }` | `{ verificationId, status, result }` |

```typescript
interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  scope: {
    tenantId: string;
    serviceId?: string;
    environment: 'staging' | 'production';
  };
  faults: ChaosFault[];
  steadyStateHypothesis: string; // 稳态假设描述
  autoRollback: boolean;
  createdAt: Date;
  createdBy: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
}

interface ChaosFault {
  type: 'network_latency' | 'service_down' | 'cpu_stress' | 'memory_stress' | 'disk_full';
  target: string; // service name or pod selector
  config: Record<string, unknown>;
  durationMs: number;
  delayMs: number; // 故障注入延迟
}

interface ChaosRun {
  id: string;
  experimentId: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  timeline: ChaosEvent[];
  metrics: {
    mttrMs: number;
    affectedServices: string[];
    errorCount: number;
    recovered: boolean;
  };
  startedAt: Date;
  endedAt?: Date;
}

interface ChaosEvent {
  timestamp: Date;
  type: 'inject' | 'detect' | 'recover' | 'rollback';
  service: string;
  details: string;
}

interface ResilienceScore {
  score: number;          // 0-100
  mttrMs: number;         // 平均恢复时间
  successRate: number;    // 故障期间成功率
  errorBudget: number;    // 剩余错误预算
  lastIncidentAt: Date;
  trend: 'improving' | 'stable' | 'degrading';
}
```

## 四、数据库变更

```sql
-- Migration 101: Chaos Engineering
CREATE TABLE IF NOT EXISTS chaos_experiments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  scope                 JSONB NOT NULL,
  faults                JSONB NOT NULL,
  steady_state_hypothesis TEXT,
  auto_rollback         BOOLEAN DEFAULT true,
  status                VARCHAR(20) DEFAULT 'draft',
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_chaos_experiments_tenant ON chaos_experiments(tenant_id);

CREATE TABLE IF NOT EXISTS chaos_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id         UUID NOT NULL REFERENCES chaos_experiments(id) ON DELETE CASCADE,
  status                VARCHAR(20) DEFAULT 'running',
  timeline              JSONB DEFAULT '[]',
  metrics               JSONB NOT NULL DEFAULT '{}',
  started_at            TIMESTAMPTZ DEFAULT now(),
  ended_at              TIMESTAMPTZ
);
CREATE INDEX idx_chaos_runs_experiment ON chaos_runs(experiment_id, started_at DESC);

CREATE TABLE IF NOT EXISTS resilience_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  service_id            UUID,
  score                 INT NOT NULL,
  mttr_ms               INT,
  success_rate          DECIMAL(5,4),
  error_budget          DECIMAL(5,4),
  trend                 VARCHAR(20),
  calculated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_resilience_scores_tenant ON resilience_scores(tenant_id, calculated_at DESC);
```

## 五、前端设计

**路由**: `/chaos-engineering`

```
┌─────────────────────────────────────────────┐
│  混沌工程                        [创建实验]  │
├─────────────────────────────────────────────┤
│  韧性评分: 78/100  [▓▓▓▓▓▓▓▓░░]  ↑ 稳定    │
├─────────────────────────────────────────────┤
│  实验列表                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 网络延迟测试 staging  ✅ 已完成         │  │
│  │   影响: api-gateway  MTTR: 45s         │  │
│  ├────────────────────────────────────────┤  │
│  │ 服务宕机测试 staging  🔄 运行中         │  │
│  │   影响: user-service  已注入 30s       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [发布前验证] → 选择服务 → 自动运行混沌测试   │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/ChaosEngineering/index.tsx` | 新建 | 混沌工程主页面 |
| `src/pages/ChaosExperiment/index.tsx` | 新建 | 实验详情/执行页面 |
| `src/components/ResilienceGauge/index.tsx` | 新建 | 韧性评分仪表 |
| `src/api/chaos.ts` | 新建 | 混沌工程 API 调用 |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | FaultInjector、ResilienceCalculator、ExperimentService |
| 集成测试 | 8 | 故障注入→检测→恢复完整流程 |
| E2E 测试 | 4 | 前端创建实验→执行→查看结果 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 故障注入延迟 | < 100ms |
| 韧性评分计算 | < 5s |
| Production 安全护栏 | 必须二次确认 + 审计日志 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 故障注入引擎 | 4 | - | 2 |
| 实验管理 | 2 | 1 | 1 |
| 韧性评分 | 2 | 1 | 1 |
| 发布前验证 | 1 | 1 | 1 |
| **合计** | **9** | **3** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
