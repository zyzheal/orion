# 数字孪生详细规格 (Phase 4)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 1. 数字孪生 (Digital Twin)
> **目标成熟度**: L1 → L2
> **关键交付**: 生产镜像、流量回放、变更沙箱

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Pipeline 执行历史与状态追踪（PostgreSQL）
- 基础设施配置管理（Terraform 状态存储）
- 基础监控集成（Prometheus 查询）
- 部署记录（DeploymentRepository）

**不足**：
- 无生产环境镜像/快照能力
- 无流量录制与回放机制
- 变更无法在隔离沙箱中预验证
- 无生产配置副本用于安全测试

### 1.2 Phase 4 目标 (L2) — 长期愿景

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 生产镜像 | 对生产环境状态（配置、拓扑、依赖版本）生成快照 | L2 |
| 流量回放 | 录制生产流量，在测试环境脱敏回放 | L2 |
| 变更沙箱 | 基于生产镜像创建隔离沙箱，预验证变更 | L1.5 |
| 状态对比 | 对比生产快照与当前环境状态差异 | L1.5 |

## 二、验收标准

### 2.1 生产镜像

| # | 标准 | 验证方式 |
|---|------|----------|
| T1 | 支持对指定租户/项目/环境生成生产快照 | API 测试 |
| T2 | 快照包含：配置、服务拓扑、依赖版本、环境变量（脱敏） | API 测试 |
| T3 | 快照可导出为 YAML 包，包含版本签名 | 集成测试 |
| T4 | 快照恢复后环境拓扑与原始一致（服务数量/连接关系） | 集成测试 |

### 2.2 流量回放

| # | 标准 | 验证方式 |
|---|------|----------|
| R1 | 支持配置流量录制规则（路径前缀、时间窗口） | API 测试 |
| R2 | 录制流量自动脱敏（PII、token、密码字段） | 单元测试 |
| R3 | 支持在测试环境按录制倍速回放 | 集成测试 |
| R4 | 回放结果对比（预期 vs 实际：状态码、响应结构） | 前端验证 |

### 2.3 变更沙箱

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 基于生产快照创建隔离 K8s Namespace 沙箱 | 集成测试 |
| S2 | 沙箱网络与生产完全隔离 | 安全审查 |
| S3 | 变更在沙箱中执行后可一键销毁 | API 测试 |

## 三、API 设计

```
Base: /api/v1/digital-twin
```

### 3.1 生产快照 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/snapshots` | 创建生产快照 | `SnapshotCreateInput` | `{ id, status, createdAt }` |
| GET | `/snapshots` | 快照列表 | query: tenantId, env, status, page, limit | `{ data: Snapshot[], total }` |
| GET | `/snapshots/:id` | 快照详情 | - | `{ id, environment, components[], topology, createdAt }` |
| GET | `/snapshots/:id/export` | 导出快照包 | - | YAML 文件流（ZIP） |
| DELETE | `/snapshots/:id` | 删除快照 | - | `{ success }` |
| POST | `/snapshots/:id/restore` | 恢复到指定快照 | `{ targetEnv, dryRun?: boolean }` | `{ restoreId, status }` |

### 3.2 流量录制与回放 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/traffic/recording` | 开始流量录制 | `{ sourceEnv, pathPrefix, durationMinutes, desensitizationRules }` | `{ recordingId, status }` |
| GET | `/traffic/recording/:id` | 录制状态 | - | `{ id, status, requestCount, sizeBytes }` |
| POST | `/traffic/recording/:id/stop` | 停止录制 | - | `{ id, status, requestCount }` |
| GET | `/traffic/recordings` | 录制历史 | query: sourceEnv, status, page, limit | `{ data: TrafficRecording[], total }` |
| POST | `/traffic/replay` | 发起流量回放 | `{ recordingId, targetEnv, speedMultiplier, parallelism }` | `{ replayId, status }` |
| GET | `/traffic/replay/:id` | 回放状态 | - | `{ id, status, progress, matchedCount, mismatchedCount }` |
| GET | `/traffic/replay/:id/report` | 回放对比报告 | - | `{ summary, mismatches[], durationMs }` |

### 3.3 TypeScript 接口

```typescript
interface SnapshotCreateInput {
  tenantId: string;
  environment: string;          // 'production' | 'staging'
  scope?: string[];             // 快照范围（默认全量）
  includeTraffic?: boolean;     // 是否包含流量样本
  note?: string;
}

interface Snapshot {
  id: string;
  tenantId: string;
  environment: string;
  status: 'creating' | 'ready' | 'failed' | 'restoring';
  components: SnapshotComponent[];
  topology: Record<string, string[]>;  // service -> dependencies
  sizeBytes: number;
  createdBy: string;
  createdAt: Date;
  note?: string;
}

interface SnapshotComponent {
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue';
  version: string;
  replicas: number;
  envVars: Record<string, string>;     // 已脱敏
  configMapRefs: string[];
}

interface TrafficRecording {
  id: string;
  tenantId: string;
  sourceEnv: string;
  status: 'recording' | 'completed' | 'stopped' | 'failed';
  requestCount: number;
  sizeBytes: number;
  pathPrefixes: string[];
  desensitizationRules: string[];
  startedAt: Date;
  completedAt?: Date;
}

interface ReplayResult {
  id: string;
  recordingId: string;
  targetEnv: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;           // 0-100
  matchedCount: number;
  mismatchedCount: number;
  skippedCount: number;
  startedAt: Date;
  completedAt?: Date;
}
```

## 四、数据库变更

### 4.1 新增表：twin_snapshots

```sql
-- Migration 116: Digital twin snapshots
CREATE TABLE IF NOT EXISTS twin_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'creating',
  components      JSONB NOT NULL DEFAULT '[]',
  topology        JSONB NOT NULL DEFAULT '{}',
  size_bytes      BIGINT DEFAULT 0,
  storage_path    VARCHAR(500),
  created_by      UUID REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_twin_snapshots_tenant ON twin_snapshots(tenant_id);
CREATE INDEX idx_twin_snapshots_env ON twin_snapshots(environment);
CREATE INDEX idx_twin_snapshots_status ON twin_snapshots(status);
```

### 4.2 新增表：traffic_recordings

```sql
CREATE TABLE IF NOT EXISTS traffic_recordings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_env            VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'recording',
  path_prefixes         TEXT[] DEFAULT '{}',
  desensitization_rules TEXT[] DEFAULT '{}',
  request_count         INT DEFAULT 0,
  size_bytes            BIGINT DEFAULT 0,
  storage_path          VARCHAR(500),
  started_by            UUID REFERENCES users(id),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_traffic_recordings_tenant ON traffic_recordings(tenant_id);
CREATE INDEX idx_traffic_recordings_status ON traffic_recordings(status);
```

### 4.3 新增表：traffic_replays

```sql
CREATE TABLE IF NOT EXISTS traffic_replays (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recording_id        UUID NOT NULL REFERENCES traffic_recordings(id) ON DELETE CASCADE,
  target_env          VARCHAR(50) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  speed_multiplier    DECIMAL(3,1) DEFAULT 1.0,
  parallelism         INT DEFAULT 1,
  progress            INT DEFAULT 0,
  matched_count       INT DEFAULT 0,
  mismatched_count    INT DEFAULT 0,
  skipped_count       INT DEFAULT 0,
  report              JSONB DEFAULT '{}',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE INDEX idx_traffic_replays_recording ON traffic_replays(recording_id);
CREATE INDEX idx_traffic_replays_status ON traffic_replays(status);
```

## 五、前端设计

### 5.1 生产快照页面

**路由**: `/digital-twin/snapshots`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  数字孪生 - 生产快照              [创建快照] │
├─────────────────────────────────────────────┤
│  环境: [Production ▼]  状态: [全部 ▼]       │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 快照ID       │ 环境      │ 状态  │ 大小 │  │
│  │ snap-abc123  │ prod      │ Ready │ 2.3G │  │
│  │   2026-05-05  │ 15 comps │       │      │  │
│  │              [详情] [导出] [恢复] [删除] │  │
│  ├────────────────────────────────────────┤  │
│  │ snap-def456  │ prod      │ 创建中│ --   │  │
│  │   2026-05-04  │ 12 comps │  █████ │      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [上一页]  1/5  [下一页]                     │
└─────────────────────────────────────────────┘
```

### 5.2 流量回放页面

**路由**: `/digital-twin/traffic-replay`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  数字孪生 - 流量回放                         │
├─────────────────────────────────────────────┤
│                                              │
│  创建回放                                    │
│  录制: [snap-abc123 - 1.2K 请求____▼]       │
│  目标: [Staging_______________▼]            │
│  倍速: [1.0___]x  并发: [4___]               │
│  [开始回放]                                  │
│                                              │
│  回放历史                                    │
│  ┌────────────────────────────────────────┐  │
│  │ replay-001 │ staging  │ 完成  98.2%匹配 │  │
│  │ 2026-05-05 │ 1200 req │ 18 mismatch     │  │
│  │              [查看详情] [下载报告]       │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DigitalTwin/SnapshotList.tsx` | 新建 | 快照列表页面 |
| `src/pages/DigitalTwin/SnapshotDetail.tsx` | 新建 | 快照详情页面 |
| `src/pages/DigitalTwin/TrafficReplay.tsx` | 新建 | 流量回放页面 |
| `src/pages/DigitalTwin/ReplayReport.tsx` | 新建 | 回放对比报告 |
| `src/api/digitalTwin.ts` | 新建 | API 客户端 |
| `src/components/TopologyViewer/index.tsx` | 新建 | 拓扑图可视化 |
| `src/components/ReplayProgress/index.tsx` | 新建 | 回放进度组件 |

## 六、测试策略

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | SnapshotService（快照创建/导出/删除） | 10 |
| 单元测试 | TrafficRecorder（录制规则/脱敏） | 12 |
| 单元测试 | TrafficReplayer（回放调度/对比） | 10 |
| 集成测试 | 快照完整生命周期 | 3 |
| 集成测试 | 录制 → 回放 → 报告完整流程 | 3 |
| E2E 测试 | 前端操作快照创建与查看 | 2 |
| E2E 测试 | 前端操作流量回放 | 2 |

## 七、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 快照创建 < 5min（100 组件环境） |
| 性能 | 流量回放延迟 < 50ms/请求 |
| 安全 | 录制流量必须脱敏，PII/Token/密码字段自动过滤 |
| 安全 | 沙箱环境网络与生产完全隔离（NetworkPolicy） |
| 存储 | 快照存储配额限制（每租户默认 50GB） |
| 可维护性 | 代码覆盖率 > 75% |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 生产镜像 | 5 | 3 | 2 |
| 流量回放 | 6 | 3 | 2.5 |
| 变更沙箱 | 4 | 1.5 | 1.5 |
| **合计** | **15** | **7.5** | **6** |

> 注：此为概念性规格，实际工作量取决于 K8s 集群环境和 Istio 集成深度。

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 实施中_
