# 多云混合云详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 4. 多云混合云
> **目标成熟度**: L0 → L0.5
> **关键交付**: 多云配置适配层

## 一、功能描述

### 1.1 现状评估 (L0)

Orion 当前部署目标：
- 单 K8s 集群部署
- 无云厂商适配层

**不足**：
- 无法管理多云环境（AWS EKS、GCP GKE、Azure AKS）
- 无云资源统一抽象
- 无法跨云部署同一应用

### 1.2 Phase 3 目标 (L0.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 多云配置适配层 | 统一抽象云厂商差异（网络、存储、身份） | L0.5 |
| 云账户管理 | 多云账户注册/凭证管理/配额查看 | L0.5 |
| 云资源发现 | 自动发现各云上的 K8s 集群/负载均衡器 | L0.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持 3 大云厂商：AWS、GCP、Azure 的凭证管理 | API 测试 |
| M2 | 云厂商抽象层覆盖：计算、网络、存储 3 类资源 | 代码审查 |
| M3 | 自动发现已注册的 K8s 集群并同步状态 | 集成测试 |
| M4 | 多云配置模板（Deployment/Service/Ingress 适配不同云） | API 测试 |
| M5 | 凭证加密存储（KMS 集成），支持轮换 | 安全审查 |
| M6 | 云成本概览（按云厂商/环境/服务维度） | 前端验证 |

## 三、API 设计

```
Base: /api/v1/multi-cloud
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/providers` | 获取云厂商列表 | - | `{ data: CloudProvider[] }` |
| POST | `/accounts` | 注册云账户 | `CloudAccountRequest` | `{ id, provider, status }` |
| GET | `/accounts` | 获取云账户列表 | query: provider | `{ data: CloudAccount[] }` |
| PUT | `/accounts/:id` | 更新云账户 | `{ credentials?, config? }` | `{ ... }` |
| DELETE | `/accounts/:id` | 删除云账户 | - | `{ success }` |
| POST | `/accounts/:id/discover` | 触发资源发现 | - | `{ clusters, loadBalancers, storage }` |
| GET | `/clusters` | 获取所有 K8s 集群 | query: provider | `{ data: K8sCluster[] }` |
| GET | `/cost-overview` | 获取云成本概览 | query: period | `{ byProvider, byService, total }` |

```typescript
interface CloudProvider {
  id: string;
  name: 'aws' | 'gcp' | 'azure' | 'alicloud';
  displayName: string;
  capabilities: string[]; // ['eks', 's3', 'rds', 'elb', ...]
}

interface CloudAccount {
  id: string;
  tenantId: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, unknown>;
  credentialRef: string;    // KMS reference
  lastDiscoveryAt?: Date;
  createdAt: Date;
}

interface CloudAccountRequest {
  provider: string;
  name: string;
  credentials: {
    type: 'access_key' | 'service_account' | 'managed_identity';
    data: Record<string, string>;
  };
  config?: Record<string, unknown>;
}

interface K8sCluster {
  id: string;
  accountId: string;
  provider: string;
  name: string;
  region: string;
  version: string;
  nodeCount: number;
  status: 'running' | 'stopped' | 'error';
  discoveredAt: Date;
}

interface CloudCostOverview {
  byProvider: { provider: string; costCents: number; percent: number }[];
  byService: { service: string; costCents: number }[];
  total: number;
  period: string;
}
```

## 四、数据库变更

```sql
-- Migration 104: Multi-Cloud
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  provider              VARCHAR(50) NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  status                VARCHAR(20) DEFAULT 'active',
  config                JSONB DEFAULT '{}',
  credential_ref        VARCHAR(200),
  last_discovery_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, provider, name)
);
CREATE INDEX idx_cloud_accounts_tenant ON cloud_accounts(tenant_id);

CREATE TABLE IF NOT EXISTS cloud_clusters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  region                VARCHAR(50),
  version               VARCHAR(20),
  node_count            INT,
  status                VARCHAR(20),
  kubeconfig_ref        VARCHAR(200),
  discovered_at         TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cloud_clusters_account ON cloud_clusters(account_id);

CREATE TABLE IF NOT EXISTS cloud_resources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES cloud_accounts(id),
  resource_type         VARCHAR(50),   -- 'loadbalancer', 'storage', 'database'
  resource_id           VARCHAR(200),
  name                  VARCHAR(200),
  region                VARCHAR(50),
  config                JSONB,
  cost_cents            BIGINT,
  discovered_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cloud_resources_account ON cloud_resources(account_id, resource_type);
```

## 五、前端设计

**路由**: `/multi-cloud`

```
┌─────────────────────────────────────────────┐
│  多云管理                          [添加账户] │
├─────────────────────────────────────────────┤
│  云账户                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ AWS      │ │ GCP      │ │ Azure    │     │
│  │ ✅ 2集群 │ │ ✅ 1集群 │ │ ⚠️ 0集群 │     │
│  │ $4,520/m │ │ $2,100/m │ │ -        │     │
│  │ [管理]   │ │ [管理]   │ │ [添加]   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  集群总览                                    │
│  ┌────────────────────────────────────────┐  │
│  │ production-us-east (EKS)  3 nodes ✅  │  │
│  │ staging-eu-west (GKE)   2 nodes ✅    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/MultiCloud/index.tsx` | 新建 | 多云管理主页面 |
| `src/api/multi-cloud.ts` | 新建 | 多云 API 调用 |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 12 | CloudAdapter、CredentialManager、ResourceDiscovery |
| 集成测试 | 4 | 账户注册→资源发现→状态同步 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 凭证加密 | AES-256 + KMS |
| 资源发现频率 | 每 5 分钟 |
| API 响应延迟 | < 500ms |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 云适配层 | 4 | - | 1 |
| 账户管理 | 2 | 2 | 1 |
| 资源发现 | 2 | 1 | 1 |
| **合计** | **8** | **3** | **3** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
