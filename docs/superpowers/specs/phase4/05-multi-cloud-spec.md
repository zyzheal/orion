# 多云混合云详细规格 (Phase 4)

> **日期**: 2026-05-05
> **状态**: 概念探索
> **能力域**: 5. 多云混合云 (Multi-Cloud & Hybrid Cloud)
> **目标成熟度**: L0.5 → L1.5
> **关键交付**: 多云配置适配层、跨区域容灾、成本优化

## 一、功能描述

### 1.1 现状评估 (L0.5)

Orion 当前已实现：
- 环境配置管理（多环境支持）
- 基础部署能力（DeploymentService）
- Terraform 状态追踪

**不足**：
- 仅支持单一云提供商（阿里云 K8s）
- 无多云配置抽象层
- 无跨区域容灾机制
- 无多云成本对比与优化
- 无云原生资源的统一抽象

### 1.2 Phase 4 目标 (L1.5) — 长期愿景

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 多云配置适配 | 统一抽象层屏蔽 AWS/GCP/阿里云差异 | L1.5 |
| 跨区域容灾 | 主备区域自动切换，RPO < 5min, RTO < 15min | L1.5 |
| 多云成本优化 | 跨云资源成本对比、推荐最优部署方案 | L1 |
| 混合云网络 | VPC 对等连接、专线监控 | L1 |

## 二、验收标准

### 2.1 多云配置适配

| # | 标准 | 验证方式 |
|---|------|----------|
| M1 | 支持注册多云账户（AWS、GCP、阿里云、腾讯云） | API 测试 |
| M2 | 多云资源统一抽象（Compute/Storage/Network） | 单元测试 |
| M3 | 基于 Cloud Provider 自动翻译资源配置到原生 API | 集成测试 |
| M4 | 多云资源统一列表与查询 | API 测试 |

### 2.2 跨区域容灾

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 配置主备区域，数据库跨区同步 | 集成测试 |
| D2 | 手动触发区域切换（Failover） | API 测试 |
| D3 | 自动 Failover（主区不可达时自动切换） | 集成测试 |
| D4 | Failback（故障恢复后切回主区） | API 测试 |
| D5 | RPO（恢复点目标）< 5min，RTO（恢复时间目标）< 15min | 性能测试 |

### 2.3 多云成本优化

| # | 标准 | 验证方式 |
|---|------|----------|
| C1 | 多云账单采集与聚合 | API 测试 |
| C2 | 资源成本对比（同规格在不同云的报价） | API 测试 |
| C3 | 成本优化推荐（闲置资源、预留实例建议） | 前端验证 |
| C4 | 预算预警（多云统一预算） | 集成测试 |

## 三、API 设计

```
Base: /api/v1/cloud-management
```

### 3.1 云账户管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/accounts` | 注册云账户 | `CloudAccountInput` | `{ id, provider, name, status }` |
| GET | `/accounts` | 云账户列表 | query: provider, status | `{ data: CloudAccount[], total }` |
| GET | `/accounts/:id` | 云账户详情 | - | `{ id, provider, name, region, resources, billing }` |
| PUT | `/accounts/:id` | 更新云账户 | `CloudAccountUpdate` | `{ ... }` |
| DELETE | `/accounts/:id` | 删除云账户 | - | `{ success }` |
| POST | `/accounts/:id/verify` | 验证连接 | - | `{ connected, latency, message }` |

### 3.2 多云资源 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/resources` | 多云资源列表 | query: provider, type, region | `{ data: CloudResource[], total }` |
| GET | `/resources/:id` | 资源详情 | - | `{ id, provider, type, spec, cost, region }` |
| POST | `/resources/provision` | 统一资源配置 | `ProvisionRequest` | `{ resourceId, provider, status }` |
| DELETE | `/resources/:id` | 释放资源 | - | `{ success }` |

### 3.3 容灾管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/disaster-recovery` | 容灾配置 | - | `{ primaryRegion, standbyRegion, syncStatus, rpo, rto }` |
| PUT | `/disaster-recovery` | 配置容灾 | `DRConfig` | `{ ...DRConfig }` |
| POST | `/disaster-recovery/failover` | 触发 Failover | `{ targetRegion?, force?: boolean }` | `{ failoverId, status, startedAt }` |
| POST | `/disaster-recovery/failback` | 触发 Failback | - | `{ failbackId, status, startedAt }` |
| GET | `/disaster-recovery/history` | 容灾事件历史 | - | `{ data: DREvent[] }` |
| GET | `/disaster-recovery/drill` | 容灾演练状态 | - | `{ lastDrillAt, result, rpoAchieved, rtoAchieved }` |

### 3.4 多云成本 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/costs/summary` | 成本概览 | query: period, provider | `{ totalCost, byProvider, byResource, trend }` |
| GET | `/costs/comparison` | 成本对比 | query: spec, regions | `{ options: CostOption[] }` |
| GET | `/costs/recommendations` | 成本优化推荐 | - | `{ recommendations: CostRecommendation[] }` |

### 3.5 TypeScript 接口

```typescript
interface CloudAccount {
  id: string;
  tenantId: string;
  provider: 'aws' | 'gcp' | 'aliyun' | 'tencent';
  name: string;
  region: string;
  status: 'active' | 'inactive' | 'error';
  credentialRef: string;
  monthlyCost: number;
  createdAt: Date;
}

interface CloudResource {
  id: string;
  provider: string;
  type: string;  // compute|storage|network|k8s|database|cache
  name: string;
  region: string;
  spec: Record<string, unknown>;
  monthlyCost: number;
  createdAt: Date;
}

interface DRConfig {
  primaryRegion: string;
  standbyRegions: string[];
  dbSyncMode: 'sync' | 'async' | 'semi-sync';
  autoFailover: boolean;
  failoverThresholdMs: number;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
}

interface DREvent {
  id: string;
  type: 'failover' | 'failback' | 'drill';
  fromRegion: string;
  toRegion: string;
  status: string;
  rpoAchieved?: number;
  rtoAchieved?: number;
  startedAt: Date;
}

interface CostRecommendation {
  id: string;
  type: string;  // idle_resource|reserved_instance|right_sizing
  description: string;
  currentCost: number;
  estimatedSaving: number;
  risk: 'low' | 'medium' | 'high';
}
```

## 四、数据库变更

### 4.1 新增表：multi_cloud_accounts

```sql
-- Migration 120: Multi-cloud - accounts, resources, disaster recovery
CREATE TABLE IF NOT EXISTS multi_cloud_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider        VARCHAR(20) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  region          VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive',
  credential_ref  VARCHAR(200) NOT NULL,
  resources       JSONB DEFAULT '{}',
  monthly_cost    DECIMAL(10,2) DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_multi_cloud_accounts_tenant ON multi_cloud_accounts(tenant_id);
CREATE INDEX idx_multi_cloud_accounts_provider ON multi_cloud_accounts(provider);
CREATE INDEX idx_multi_cloud_accounts_status ON multi_cloud_accounts(status);
```

### 4.2 新增表：multi_cloud_resources

```sql
CREATE TABLE IF NOT EXISTS multi_cloud_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES multi_cloud_accounts(id) ON DELETE SET NULL,
  provider        VARCHAR(20) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  provider_id     VARCHAR(200) NOT NULL,  -- 云厂商资源 ID
  name            VARCHAR(200),
  region          VARCHAR(100),
  spec            JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'creating',
  monthly_cost    DECIMAL(10,2) DEFAULT 0,
  tags            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_multi_cloud_resources_tenant ON multi_cloud_resources(tenant_id);
CREATE INDEX idx_multi_cloud_resources_provider ON multi_cloud_resources(provider, resource_type);
CREATE INDEX idx_multi_cloud_resources_region ON multi_cloud_resources(region);
```

### 4.3 新增表：disaster_recovery_config

```sql
CREATE TABLE IF NOT EXISTS disaster_recovery_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  primary_region      VARCHAR(100) NOT NULL,
  standby_regions     TEXT[] NOT NULL DEFAULT '{}',
  db_sync_mode        VARCHAR(20) DEFAULT 'async',
  auto_failover       BOOLEAN DEFAULT false,
  failover_threshold_ms BIGINT DEFAULT 300000,
  rpo_target_minutes  INT DEFAULT 5,
  rto_target_minutes  INT DEFAULT 15,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id)
);
```

### 4.4 新增表：disaster_recovery_events

```sql
CREATE TABLE IF NOT EXISTS disaster_recovery_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      VARCHAR(20) NOT NULL,  -- 'failover' | 'failback' | 'drill'
  from_region     VARCHAR(100) NOT NULL,
  to_region       VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  rpo_achieved    INT,
  rto_achieved    INT,
  notes           TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_dr_events_tenant ON disaster_recovery_events(tenant_id);
CREATE INDEX idx_dr_events_type ON disaster_recovery_events(event_type);
```

## 五、前端设计

### 5.1 多云管理页面

**路由**: `/multi-cloud/accounts`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  多云管理                         [添加账户] │
├─────────────────────────────────────────────┤
│  总览: 账户 4 (3 在线) | 资源 126 | ¥12,800  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 云厂商   │ 区域       │ 资源 │ 月费│状态│  │
│  │ AWS      │ us-east-1  │  45  │$3200│ ✓  │  │
│  │ GCP      │ asia-east  │  32  │$2800│ ✓  │  │
│  │ 阿里云   │ cn-hangzhou│  28  │¥4200│ ✓  │  │
│  │ 腾讯云   │ ap-shanghai│  21  │¥1800│ 错误│  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 容灾管理页面

**路由**: `/multi-cloud/disaster-recovery`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  容灾管理                                    │
├─────────────────────────────────────────────┤
│  当前状态: ● 主区运行 (北京)                 │
│  备区: 上海 (同步延迟: 1.2s)                 │
│                                              │
│  主区域: [北京 ▼]  备区域: [上海 ▼][广州 ▼]  │
│  同步模式: [异步]  自动切换: [开] 超时: 5min  │
│                                              │
│  [保存配置] [容灾演练] [手动切换]            │
│                                              │
│  历史事件                                    │
│  ┌────────────────────────────────────────┐  │
│  │ 2026-04-15  容灾演练  北京→上海  成功  │  │
│  │   RPO: 2min  RTO: 8min                 │  │
│  │ 2026-03-20  Failover  北京→广州  成功  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 成本优化页面

**路由**: `/multi-cloud/cost-optimization`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  多云成本优化                                │
├─────────────────────────────────────────────┤
│  本月总费用: ¥12,800  较上月 ↓ 3.2%          │
│                                              │
│  成本分布                                    │
│  ┌────────────────────────────────────────┐  │
│  │ AWS     ████████████░░░░░░  $3,200     │  │
│  │ GCP     ██████████░░░░░░░░  $2,800     │  │
│  │ 阿里云  ███████████████░░░  ¥4,200     │  │
│  │ 腾讯云  ████████░░░░░░░░░░  ¥1,800     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  优化建议                                    │
│  ┌────────────────────────────────────────┐  │
│  │ [低] 3 台 AWS 实例闲置  节省 $240/月    │  │
│  │ [中] 预留实例建议       节省 ¥800/月    │  │
│  │ [低] 低频存储替代       节省 $120/月    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.4 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/MultiCloud/AccountList.tsx` | 新建 | 云账户管理 |
| `src/pages/MultiCloud/ResourceList.tsx` | 新建 | 多云资源列表 |
| `src/pages/MultiCloud/DisasterRecovery.tsx` | 新建 | 容灾管理 |
| `src/pages/MultiCloud/CostOptimization.tsx` | 新建 | 成本优化 |
| `src/api/multiCloud.ts` | 新建 | API 客户端 |
| `src/components/CloudProviderIcon/index.tsx` | 新建 | 云厂商标识组件 |
| `src/components/DRStatus/index.tsx` | 新建 | 容灾状态组件 |
| `src/components/CostBar/index.tsx` | 新建 | 成本对比条组件 |

## 六、测试策略

| 类型 | 模块 | 用例数 |
|------|------|:------:|
| 单元测试 | CloudAdapter（多云抽象/翻译） | 12 |
| 单元测试 | DREngine（容灾调度/Failover） | 10 |
| 单元测试 | CostAnalyzer（成本聚合/推荐） | 8 |
| 单元测试 | ProvisionTranslator（配置翻译） | 8 |
| 集成测试 | 多云资源创建与查询 | 3 |
| 集成测试 | Failover/Failback 完整流程 | 3 |
| E2E 测试 | 前端容灾配置与演练 | 2 |
| E2E 测试 | 前端成本优化查看 | 2 |

## 七、非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 容灾 Failover 触发 < 1s |
| 性能 | 多云资源列表加载 < 1s（200 资源） |
| 安全 | 云凭据存储在 K8s Secret，API 不返回明文 |
| 安全 | 容灾切换需双人确认（二次审批） |
| 可靠性 | 数据库跨区同步延迟 < 2s |
| 可维护性 | 代码覆盖率 > 75% |
| 可扩展性 | 云 Provider 适配器插件化，易于新增厂商 |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 多云配置适配 | 6 | 3 | 2 |
| 跨区域容灾 | 5 | 2.5 | 2 |
| 成本优化 | 4 | 2 | 1.5 |
| **合计** | **15** | **7.5** | **5.5** |

> 注：此规格需要真实的云环境进行集成测试。建议分阶段实施：先完成阿里云/AWS 适配，再扩展 GCP/腾讯云。

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 概念探索_
