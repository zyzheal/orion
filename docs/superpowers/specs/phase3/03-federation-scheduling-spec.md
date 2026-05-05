# 联邦调度详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 3. 联邦调度
> **目标成熟度**: L0 → L1
> **关键交付**: 多执行器联邦（Tekton 集成）

## 一、功能描述

### 1.1 现状评估 (L0)

Orion 当前 Pipeline 执行：
- 单进程 PipelineEngine 执行所有 Stage/Task
- 无分布式执行能力
- 无跨集群调度

**不足**：
- 所有构建在单节点执行，无法水平扩展
- 无法利用多集群资源（不同 region、不同规格的 K8s 集群）
- 无执行器注册/健康检查/负载均衡机制

### 1.2 Phase 3 目标 (L1)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 执行器联邦 | 注册/发现/健康检查多个 Tekton 执行器 | L1 |
| 智能调度 | 基于资源、地理位置、标签的任务分发 | L1 |
| Tekton 集成 | PipelineRun 映射到 Tekton PipelineRun CRD | L1 |
| 执行状态聚合 | 跨执行器的 Pipeline 状态统一视图 | L1 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| F1 | 支持注册 3+ Tekton 执行器（不同 cluster） | API 测试 |
| F2 | 执行器心跳机制（30s 间隔），超时标记不健康 | 集成测试 |
| F3 | 调度策略支持：round-robin、resource-based、label-match | 单元测试 |
| F4 | Pipeline Stage 可指定 executor label | API 测试 |
| F5 | Tekton PipelineRun CRD 生成与提交 | 集成测试 |
| F6 | 跨执行器 Pipeline 状态聚合显示 | 前端验证 |
| F7 | 执行器故障自动迁移到其他执行器 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/federation
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/executors` | 获取执行器列表 | - | `{ data: Executor[], total }` |
| POST | `/executors` | 注册执行器 | `RegisterExecutor` | `{ id, name, status }` |
| GET | `/executors/:id` | 获取执行器详情 | - | `Executor` |
| DELETE | `/executors/:id` | 注销执行器 | - | `{ success }` |
| POST | `/executors/:id/heartbeat` | 执行器心跳 | `{ load, capabilities }` | `{ accepted }` |
| GET | `/schedule` | 获取调度决策 | query: pipelineId, stageId | `{ executorId, reason }` |
| GET | `/status` | 获取联邦状态总览 | - | `{ executors, activeRuns, queued }` |

```typescript
interface Executor {
  id: string;
  name: string;
  clusterId: string;
  region: string;
  status: 'active' | 'inactive' | 'draining' | 'unhealthy';
  capabilities: string[];        // ['docker', 'k8s', 'linux', 'windows']
  labels: Record<string, string>; // 调度标签
  load: ExecutorLoad;
  lastHeartbeat: Date;
  registeredAt: Date;
}

interface ExecutorLoad {
  cpuPercent: number;
  memoryPercent: number;
  activeRuns: number;
  maxConcurrentRuns: number;
  queueLength: number;
}

interface ScheduleRequest {
  pipelineId: string;
  stageId: string;
  requiredLabels?: Record<string, string>;
  resourceRequirements?: {
    cpu: number;
    memoryMB: number;
    diskGB: number;
  };
}

interface ScheduleResult {
  executorId: string;
  executorName: string;
  clusterId: string;
  reason: string;
  estimatedWaitMs: number;
}

interface FederationStatus {
  totalExecutors: number;
  activeExecutors: number;
  unhealthyExecutors: number;
  activeRuns: number;
  queuedRuns: number;
  averageWaitTimeMs: number;
}
```

## 四、数据库变更

```sql
-- Migration 103: Federation Scheduling
CREATE TABLE IF NOT EXISTS federation_executors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  cluster_id            VARCHAR(100),
  region                VARCHAR(50),
  status                VARCHAR(20) DEFAULT 'inactive',
  capabilities          TEXT[] DEFAULT '{}',
  labels                JSONB DEFAULT '{}',
  max_concurrent_runs   INT DEFAULT 10,
  api_endpoint          VARCHAR(500),
  api_token_ref         VARCHAR(200),  -- K8s Secret reference
  last_heartbeat        TIMESTAMPTZ,
  registered_at         TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_federation_executors_tenant ON federation_executors(tenant_id);
CREATE INDEX idx_federation_executors_status ON federation_executors(status);

CREATE TABLE IF NOT EXISTS federation_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id       UUID NOT NULL REFERENCES pipeline_runs(id),
  executor_id           UUID NOT NULL REFERENCES federation_executors(id),
  stage_id              VARCHAR(100),
  status                VARCHAR(20) DEFAULT 'queued',
  tekton_pipeline_run   VARCHAR(100),  -- Tekton CRD name
  scheduled_at          TIMESTAMPTZ DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  error_message         TEXT
);
CREATE INDEX idx_federation_runs_executor ON federation_runs(executor_id, status);
CREATE INDEX idx_federation_runs_pipeline ON federation_runs(pipeline_run_id);

CREATE TABLE IF NOT EXISTS executor_heartbeat_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_id           UUID NOT NULL REFERENCES federation_executors(id) ON DELETE CASCADE,
  cpu_percent           DECIMAL(5,2),
  memory_percent        DECIMAL(5,2),
  active_runs           INT,
  queue_length          INT,
  recorded_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_executor_heartbeat_executor ON executor_heartbeat_log(executor_id, recorded_at DESC);
```

## 五、前端设计

**路由**: `/federation`

```
┌─────────────────────────────────────────────┐
│  联邦调度                                    │
├─────────────────────────────────────────────┤
│  执行器: 4 在线 / 1 异常 | 活跃 Run: 12      │
├─────────────────────────────────────────────┤
│  执行器列表                                  │
│  ┌────────────────────────────────────────┐  │
│  │ tekton-us-east  ✅  active  load: 45%  │  │
│  │   Region: us-east-1  Runs: 4/10        │  │
│  ├────────────────────────────────────────┤  │
│  │ tekton-eu-west  ✅  active  load: 72%  │  │
│  │   Region: eu-west-1  Runs: 7/10        │  │
│  ├────────────────────────────────────────┤  │
│  │ tekton-ap-south ⚠️ unhealthy  心跳超时  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  调度统计                                    │
│  平均等待: 2.3s | 成功率: 99.2% | 迁移: 3    │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Federation/index.tsx` | 新建 | 联邦调度主页面 |
| `src/api/federation.ts` | 新建 | 联邦调度 API 调用 |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | Scheduler、ExecutorRegistry、HealthChecker |
| 集成测试 | 6 | 执行器注册→调度→执行→状态回传 |
| E2E 测试 | 3 | 前端管理执行器→触发 Pipeline→查看调度结果 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 调度决策延迟 | < 100ms |
| 心跳超时检测 | 90s（3 次心跳丢失） |
| 执行器故障迁移 | < 30s |
| 最大支持执行器数 | 20 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 执行器注册/心跳 | 3 | 1 | 1 |
| 智能调度器 | 3 | - | 2 |
| Tekton 集成 | 3 | - | 1 |
| 状态聚合 | 1 | 2 | 1 |
| **合计** | **10** | **3** | **5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
