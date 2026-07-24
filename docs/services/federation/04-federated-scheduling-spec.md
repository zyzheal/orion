# 联邦调度详细规格 (Phase 4)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 4. 联邦调度 (Federated Scheduling)
> **目标成熟度**: L1 → L2
> **关键交付**: 跨集群调度、跨组织联邦、资源聚合视图

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Tekton Pipeline 执行引擎（单集群）
- Pipeline 节点调度（Stage/Task 到 K8s Pod）
- 基础资源监控（Prometheus 集成）
- 多环境配置（通过 environment 参数）

**不足**：
- 仅支持单 K8s 集群调度
- 无跨集群工作负载分发
- 无集群间资源聚合视图
- 无跨组织协作（多租户隔离但无法跨租户共享资源）

### 1.2 Phase 4 目标 (L2) — 长期愿景

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 跨集群调度 | Pipeline Run 可调度到多个 K8s 集群的节点 | L2 |
| 集群联邦 | 多个 Orion 实例组成联邦，共享元数据和任务分发 | L2 |
| 资源聚合 | 跨集群资源使用统一视图监控和管理 | L1.5 |
| 调度策略 | 基于成本/延迟/区域/合规的调度策略 | L1.5 |

## 二、验收标准

### 2.1 跨集群调度

| # | 标准 | 验证方式 |
|---|------|----------|
| F1 | 支持注册多个 K8s 集群，维护连接信息 | API 测试 |
| F2 | Pipeline Run 可指定目标集群（默认最优调度） | API 测试 |
| F3 | 集群不可用时自动故障转移到其他集群 | 集成测试 |
| F4 | 各集群执行状态聚合显示 | 前端验证 |

### 2.2 跨组织联邦

| # | 标准 | 验证方式 |
|---|------|----------|
| O1 | 两个 Orion 实例可建立联邦关系（双向/单向） | API 测试 |
| O2 | 联邦成员可共享 Pipeline 模板和制品 | 集成测试 |
| O3 | 联邦任务分发（上游下发任务到下游执行） | 集成测试 |
| O4 | 联邦通信加密（mTLS） | 安全审查 |

### 2.3 调度策略

| # | 标准 | 验证方式 |
|---|------|----------|
| S1 | 支持配置调度策略：cost、latency、region、compliance | API 测试 |
| S2 | 调度器根据策略自动选择最优集群 | 单元测试 |
| S3 | 支持调度策略优先级排序 | 单元测试 |

## 三、API 设计

```
Base: /api/v1/federation-admin
```

### 3.1 集群管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/clusters` | 注册 K8s 集群 | `ClusterRegisterInput` | `{ id, name, status }` |
| GET | `/clusters` | 集群列表 | query: status, region | `{ data: FederatedCluster[], total }` |
| GET | `/clusters/:id` | 集群详情 | - | `{ id, name, region, resources, health, status }` |
| PUT | `/clusters/:id` | 更新集群配置 | `ClusterUpdateInput` | `{ ... }` |
| DELETE | `/clusters/:id` | 移除集群 | - | `{ success }` |
| GET | `/clusters/:id/health` | 集群健康检查 | - | `{ status, latency, k8sVersion, nodeCount, resourceUsage }` |

### 3.2 联邦关系 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/peers` | 建立联邦关系 | `{ peerUrl, sharedSecret, mode: 'bidirectional' | 'unidirectional' }` | `{ peerId, status }` |
| GET | `/peers` | 联邦成员列表 | - | `{ data: FederatedPeer[] }` |
| DELETE | `/peers/:id` | 解除联邦关系 | - | `{ success }` |
| POST | `/peers/:id/heartbeat` | 心跳检测 | - | `{ status, latency }` |

### 3.3 跨集群调度 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/dispatch` | 分发任务到联邦 | `{ pipelineId, runParams, targetClusters, schedulingPolicy }` | `{ dispatchId, targets: [] }` |
| GET | `/dispatch/:id` | 分发状态 | - | `{ id, status, targets: DispatchTarget[] }` |

### 3.4 TypeScript 接口

```typescript
interface FederatedCluster {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  zone: string;
  kubeConfigSecret: string;       // K8s Secret 存储路径
  status: 'active' | 'degraded' | 'offline' | 'maintenance';
  resources: ClusterResources;
  labels: Record<string, string>;
  registeredAt: Date;
  lastHeartbeat: Date;
}

interface ClusterResources {
  nodeCount: number;
  cpuTotal: number;
  cpuUsed: number;
  memoryTotalGB: number;
  memoryUsedGB: number;
  podCapacity: number;
  podRunning: number;
}

interface FederatedPeer {
  id: string;
  name: string;
  url: string;
  mode: 'bidirectional' | 'unidirectional';
  status: 'connected' | 'disconnected' | 'error';
  capabilities: string[];         // 对端支持的功能
  lastHeartbeat: Date;
  connectedAt: Date;
}

interface SchedulingPolicy {
  strategy: 'cost' | 'latency' | 'region' | 'compliance' | 'round-robin';
  preferences: {
    preferredRegions?: string[];
    maxCostPerRun?: number;
    complianceRequirements?: string[];  // 'data-sovereignty', 'pci-dss'
    avoidClusters?: string[];
  };
  fallback: 'retry' | 'queue' | 'fail-fast';
}

interface DispatchTarget {
  clusterId: string;
  clusterName: string;
  runId: string;
  status: 'dispatched' | 'running' | 'completed' | 'failed' | 'cancelled';
  dispatchedAt: Date;
  completedAt?: Date;
  error?: string;
}
```

## 四、数据库变更

### 4.1 新增表：federated_clusters

```sql
-- Migration 119: Federated scheduling - clusters & dispatch
CREATE TABLE IF NOT EXISTS federated_clusters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  region          VARCHAR(100),
  zone            VARCHAR(100),
  kube_config_ref VARCHAR(200) NOT NULL,  -- K8s Secret 路径
  status          VARCHAR(20) NOT NULL DEFAULT 'offline',
  resources       JSONB NOT NULL DEFAULT '{}',
  labels          JSONB NOT NULL DEFAULT '{}',
  last_heartbeat  TIMESTAMPTZ,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_federated_clusters_tenant ON federated_clusters(tenant_id);
CREATE INDEX idx_federated_clusters_status ON federated_clusters(status);
CREATE INDEX idx_federated_clusters_region ON federated_clusters(region);
```

### 4.2 新增表：federated_peers

```sql
CREATE TABLE IF NOT EXISTS federated_peers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  url             VARCHAR(500) NOT NULL,
  mode            VARCHAR(20) NOT NULL DEFAULT 'unidirectional',
  status          VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  capabilities    TEXT[] DEFAULT '{}',
  shared_secret_ref VARCHAR(200) NOT NULL,
  last_heartbeat  TIMESTAMPTZ,
  connected_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_federated_peers_tenant ON federated_peers(tenant_id);
CREATE INDEX idx_federated_peers_status ON federated_peers(status);
```

### 4.3 新增表：federated_dispatches

```sql
CREATE TABLE IF NOT EXISTS federated_dispatches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  dispatch_id     VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  targets         JSONB NOT NULL DEFAULT '[]',
  scheduling_policy JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_federated_dispatches_tenant ON federated_dispatches(tenant_id);
CREATE INDEX idx_federated_dispatches_status ON federated_dispatches(status);
```

### 4.4 新增表：scheduling_policies

```sql
CREATE TABLE IF NOT EXISTS scheduling_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  strategy        VARCHAR(50) NOT NULL DEFAULT 'cost',
  preferences     JSONB NOT NULL DEFAULT '{}',
  fallback        VARCHAR(20) DEFAULT 'retry',
  is_default      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduling_policies_tenant ON scheduling_policies(tenant_id);
```

## 五、前端设计

### 5.1 联邦集群管理页面

**路由**: `/federation/clusters`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  联邦调度 - 集群管理              [注册集群] │
├─────────────────────────────────────────────┤
│                                              │
│  概览                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 集群数  │ │ 在线率  │ │ 总 CPU  │        │
│  │    8    │ │  87.5%  │ │ 128 核  │        │
│  │ 6/8 在线│ │ ↑ 2.1%  │ │ 使用 65%│        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 集群名称   │ 区域    │ 状态   │ 负载   │  │
│  │ prod-cn-bj │ 北京    │ 在线   │ ████░  │  │
│  │ prod-cn-sh │ 上海    │ 在线   │ ██░░░  │  │
│  │ prod-us-w  │ 美西    │ 在线   │ █████  │  │
│  │ prod-eu-de │ 法兰克福│ 降级   │ ███░░  │  │
│  │ dev-cn-bj  │ 北京    │ 在线   │ ██░░░  │  │
│  │ test-cn-bj │ 北京    │ 离线   │ --     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [筛选: 全部 ▼]  [刷新]                      │
└─────────────────────────────────────────────┘
```

### 5.2 联邦调度策略页面

**路由**: `/federation/scheduling-policies`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  联邦调度 - 调度策略              [新建策略] │
├─────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ● 默认策略 (cost)                      │  │
│  │   策略: 成本最优                        │  │
│  │   偏好: 最大单次费用 $10               │  │
│  │   回退: 自动重试                        │  │
│  │   [编辑] [删除]                        │  │
│  ├────────────────────────────────────────┤  │
│  │ ○ 低延迟策略 (latency)                 │  │
│  │   策略: 延迟优先                        │  │
│  │   偏好区域: 北京、上海                   │  │
│  │   回退: 队列等待                        │  │
│  │   [编辑] [删除]                        │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Federation/ClusterList.tsx` | 新建 | 集群列表页面 |
| `src/pages/Federation/ClusterDetail.tsx` | 新建 | 集群详情页面 |
| `src/pages/Federation/PeerList.tsx` | 新建 | 联邦成员列表 |
| `src/pages/Federation/SchedulingPolicy.tsx` | 新建 | 调度策略配置 |
| `src/pages/Federation/DispatchMonitor.tsx` | 新建 | 分发任务监控 |
| `src/api/federation.ts` | 新建 | API 客户端 |
| `src/components/ClusterHealth/index.tsx` | 新建 | 集群健康状态组件 |
| `src/components/ResourceGauge/index.tsx` | 新建 | 资源仪表盘组件 |
| `src/components/DispatchStatus/index.tsx` | 新建 | 分发状态组件 |

## 六、测试策略

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | ClusterManager（CRUD/健康检查） | 10 |
| 单元测试 | SchedulingEngine（策略评估/集群选择） | 12 |
| 单元测试 | DispatchOrchestrator（分发/故障转移） | 8 |
| 单元测试 | PeerConnector（联邦通信/mTLS） | 6 |
| 集成测试 | 跨集群 Pipeline Run 完整流程 | 3 |
| 集成测试 | 集群故障转移 | 2 |
| E2E 测试 | 前端注册集群 → 配置策略 → 分发任务 | 2 |

## 七、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 集群选择决策 < 100ms |
| 性能 | 跨集群任务分发延迟 < 2s |
| 安全 | 联邦通信强制 mTLS |
| 安全 | KubeConfig 存储在 K8s Secret，不落地 |
| 安全 | 联邦成员间数据最小化共享（仅元数据） |
| 可靠性 | 集群心跳超时 30s 自动标记降级 |
| 可维护性 | 代码覆盖率 > 75% |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 跨集群调度 | 6 | 3 | 2 |
| 集群联邦 | 5 | 2 | 2 |
| 调度策略 | 3 | 2 | 1 |
| **合计** | **14** | **7** | **5** |

> 注：需要多 K8s 集群测试环境。建议先在测试集群验证，再逐步推广。

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 实施中_
