# 配额与计费模块 — 完整功能设计 + 页面交互设计

> **文档编号**: `specs/2026-05-22-billing-quota-complete-design`
> **创建日期**: 2026-05-22
> **状态**: 待评审
> **涉及模块**: 配额管理(P0) + 计费账单(P0) + 用量计量(P0)
> **关联文档**:
> - `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.6
> - 现有迁移: `020_create_tenant_quotas.sql`, `031_create_cost_tables.sql`
> - `CLAUDE.md` 前端交互审查规则

---

## 目录

1. [功能设计概述](#1-功能设计概述)
2. [数据库设计](#2-数据库设计)
3. [用量计量引擎](#3-用量计量引擎)
4. [计费引擎](#4-计费引擎)
5. [配额管理增强](#5-配额管理增强)
6. [外部依赖](#6-外部依赖)
7. [权限模型](#7-权限模型)
8. [后端 API 设计](#8-后端-api-设计)
9. [前端页面交互设计](#9-前端页面交互设计)
10. [Event 事件体系](#10-event-事件体系)
11. [验收标准](#11-验收标准)
12. [实施工作量估算](#12-实施工作量估算)

---

## 1. 功能设计概述

### 1.1 业务闭环

```
资源计量 → 计费计算 → 账单生成 → 费用通知 → 用量分析
    ↑                                          │
    └──────────── 配额预警 / 自动限流 ←─────────┘
```

| 阶段 | 触发条件 | 核心动作 | 产出物 |
|------|---------|---------|--------|
| 资源计量 | PipelineRun 结束 / 定时采集(5min) | 采集 CPU/内存/存储/AI Token 用量 | `usage_metering` 记录 |
| 计费计算 | 账单周期到达(日/月) 或 实时按需计费 | 按定价模型计算费用、应用折扣 | `billing_records` 记录 |
| 账单生成 | 账单周期结束 | 汇总计费记录生成账单、更新 `budgets.spent` | 账单记录 + 通知事件 |
| 费用通知 | 预算阈值触发 / 账单生成 | 发送站内通知 + Webhook | `quota_alerts` / `budget_alerts` |
| 用量分析 | 用户查询 / Dashboard 渲染 | 聚合 `usage_metering` 和 `billing_records` | 可视化图表数据 |

### 1.2 现有能力盘点

| 组件 | 状态 | 位置 | 可复用 |
|------|------|------|--------|
| `tenant_quotas` 表 | 已有(迁移 020) | `020_create_tenant_quotas.sql` | 是 — 配额定义 |
| `tenant_quota_alerts` 表 | 已有(迁移 182) | `182_create_tenant_quota_alerts.sql` | 是 — 预警记录 |
| `budgets` 表 | 已有(迁移 031) | `031_create_cost_tables.sql` | 是 — 预算定义 |
| `cost_records` 表 | 已有(迁移 031) | `031_create_cost_tables.sql` | 是 — AI 成本记录 |
| `model_pricing` 表 | 已有(迁移 031) | `031_create_cost_tables.sql` | 是 — 定价模型 |
| `TenantQuotaService` | 已有(484 行) | `src/services/tenant/TenantQuotaService.ts` | 是 — 配额检查 |
| `BudgetService` (FinOps) | 已有(Map 实现) | `src/services/finops/BudgetService.ts` | 部分 — 需改 PostgreSQL |
| `CostService` | 已有(基础 CRUD) | `src/services/cost/CostService.ts` | 部分 — 需增强 |
| `tenant-routes.ts` | 已有 | `src/api/tenant-routes.ts` | 是 — 路由注册 |
| FinOps 前端页面 | 已有 | `orion-frontend/src/pages/FinOpsDashboard/` | 是 — 可复用组件 |
| 配额管理前端页面 | 已有(部分) | `orion-frontend/src/pages/TenantManagement/` | 是 — 可复用组件 |

### 1.3 新建能力清单

| 能力 | 优先级 | 说明 |
|------|--------|------|
| `usage_metering` 表 | P0 | 统一用量计量表，覆盖计算/存储/网络/AI 四类资源 |
| `billing_records` 表 | P0 | 计费记录表，关联用量与定价模型 |
| `BillingEngine` 服务 | P0 | 计费引擎：按需/包年包月/阶梯定价 |
| `UsageMeteringService` 服务 | P0 | 用量计量服务：采集、聚合、上报 |
| `BillingService` 服务 | P0 | 账单服务：生成、查询、导出 |
| `QuotaRequestService` 服务 | P1 | 配额申请审批流程 |
| `billing-routes.ts` 路由 | P0 | 计费相关 API 路由 |
| `UsageMeteringRepository` | P0 | 用量计量数据访问层 |
| `BillingRepository` | P0 | 计费数据访问层 |
| 6 个前端页面 | P0 | 配额/计量/账单/分析/申请/设置 |

---

## 2. 数据库设计

### 2.1 新建表: `usage_metering` (迁移 187)

**设计目标**: 统一计量所有资源类型的用量，支持按租户/项目/资源多维度查询。

```sql
-- Migration 187 Part 1: Usage Metering
-- Unified resource usage metering per tenant

CREATE TABLE IF NOT EXISTS usage_metering (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type       VARCHAR(30) NOT NULL,    -- compute | storage | network | ai
  resource_subtype    VARCHAR(50),             -- cpu | memory | disk | bandwidth | gpu | llm_token | embedding_token
  resource_id         VARCHAR(255),            -- 关联资源标识 (pipeline_id, namespace, model_name 等)
  project_id          UUID,                    -- 可选：关联项目

  -- 计量值（通用设计，支持不同单位）
  quantity            DECIMAL(18, 4) NOT NULL, -- 用量数值
  unit                VARCHAR(20) NOT NULL,    -- core_hour | gb_hour | gb | request | token | gpu_hour | mbps_hour

  -- 时间维度
  metering_start      TIMESTAMPTZ NOT NULL,    -- 计量周期开始
  metering_end        TIMESTAMPTZ NOT NULL,    -- 计量周期结束

  -- 标签与元数据
  tags                JSONB NOT NULL DEFAULT '{}', -- 附加维度: {environment: "prod", region: "cn-beijing"}
  metadata            JSONB NOT NULL DEFAULT '{}', -- 扩展元数据

  -- 计费关联
  is_billable         BOOLEAN NOT NULL DEFAULT true,
  billing_status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | billed | waived | disputed
  billing_record_id   UUID,                    -- 关联已生成的计费记录

  -- 审计
  created_by          VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_usage_metering_tenant ON usage_metering(tenant_id);
CREATE INDEX idx_usage_metering_resource ON usage_metering(resource_type, resource_subtype);
CREATE INDEX idx_usage_metering_time ON usage_metering(metering_start, metering_end);
CREATE INDEX idx_usage_metering_billing ON usage_metering(billing_status, is_billable);
CREATE INDEX idx_usage_metering_project ON usage_metering(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_usage_metering_tenant_time ON usage_metering(tenant_id, metering_start);

-- CHECK 约束
ALTER TABLE usage_metering ADD CONSTRAINT chk_usage_resource_type
  CHECK (resource_type IN ('compute', 'storage', 'network', 'ai'));

ALTER TABLE usage_metering ADD CONSTRAINT chk_usage_billing_status
  CHECK (billing_status IN ('pending', 'billed', 'waived', 'disputed'));

ALTER TABLE usage_metering ADD CONSTRAINT chk_usage_unit
  CHECK (unit IN ('core_hour', 'gb_hour', 'gb', 'request', 'token', 'gpu_hour', 'mbps_hour', 'count'));

ALTER TABLE usage_metering ADD CONSTRAINT chk_usage_metering_time_order
  CHECK (metering_end > metering_start);

-- RLS
ALTER TABLE usage_metering ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_metering_tenant_isolation ON usage_metering
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY usage_metering_tenant_insert ON usage_metering
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 触发器
CREATE TRIGGER trg_usage_metering_updated_at
  BEFORE UPDATE ON usage_metering
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rollback:
-- DROP TABLE IF EXISTS usage_metering;
```

### 2.2 新建表: `billing_records` (迁移 187)

**设计目标**: 存储计费记录，关联用量计量与定价模型，支持账单周期汇总。

```sql
-- Migration 187 Part 2: Billing Records
-- Billing records per tenant per billing cycle

CREATE TABLE IF NOT EXISTS billing_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          UUID,

  -- 账单周期
  billing_cycle       VARCHAR(20) NOT NULL,    -- daily | weekly | monthly | yearly
  cycle_start         TIMESTAMPTZ NOT NULL,
  cycle_end           TIMESTAMPTZ NOT NULL,

  -- 计费明细
  resource_type       VARCHAR(30) NOT NULL,    -- compute | storage | network | ai | platform
  pricing_model       VARCHAR(30) NOT NULL,    -- pay_as_you_go | subscription | tiered
  quantity            DECIMAL(18, 4) NOT NULL,
  unit_price          DECIMAL(12, 6) NOT NULL, -- 单价（含税前）
  discount_percent    DECIMAL(5, 2) NOT NULL DEFAULT 0, -- 折扣百分比 0-100
  subtotal            DECIMAL(16, 4) NOT NULL, -- quantity * unit_price
  discount_amount     DECIMAL(16, 4) NOT NULL DEFAULT 0, -- subtotal * discount_percent / 100
  tax_amount          DECIMAL(16, 4) NOT NULL DEFAULT 0, -- 税费
  total_amount        DECIMAL(16, 4) NOT NULL, -- subtotal - discount_amount + tax_amount

  -- 币种与汇率
  currency            VARCHAR(10) NOT NULL DEFAULT 'CNY',
  exchange_rate       DECIMAL(10, 6) DEFAULT 1.000000,

  -- 状态与支付
  status              VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | issued | paid | overdue | refunded | voided
  payment_method      VARCHAR(30),             -- credit_card | bank_transfer | internal_balance | none
  payment_date        TIMESTAMPTZ,
  due_date            TIMESTAMPTZ,

  -- 关联引用
  budget_id           UUID REFERENCES budgets(id) ON DELETE SET NULL,
  usage_metering_ids  UUID[] DEFAULT '{}',     -- 关联的用量计量 ID 列表（汇总来源）

  -- 说明
  description         TEXT,
  tags                JSONB NOT NULL DEFAULT '{}',

  -- 审计
  created_by          VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          VARCHAR(100),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_billing_records_tenant ON billing_records(tenant_id);
CREATE INDEX idx_billing_records_cycle ON billing_records(billing_cycle, cycle_start);
CREATE INDEX idx_billing_records_status ON billing_records(status);
CREATE INDEX idx_billing_records_project ON billing_records(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_billing_records_resource ON billing_records(resource_type, pricing_model);
CREATE INDEX idx_billing_records_tenant_cycle ON billing_records(tenant_id, billing_cycle, cycle_start);
CREATE INDEX idx_billing_records_due ON billing_records(due_date, status) WHERE status IN ('issued', 'overdue');

-- CHECK 约束
ALTER TABLE billing_records ADD CONSTRAINT chk_billing_resource_type
  CHECK (resource_type IN ('compute', 'storage', 'network', 'ai', 'platform'));

ALTER TABLE billing_records ADD CONSTRAINT chk_billing_pricing_model
  CHECK (pricing_model IN ('pay_as_you_go', 'subscription', 'tiered'));

ALTER TABLE billing_records ADD CONSTRAINT chk_billing_cycle
  CHECK (billing_cycle IN ('daily', 'weekly', 'monthly', 'yearly'));

ALTER TABLE billing_records ADD CONSTRAINT chk_billing_status
  CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'refunded', 'voided'));

ALTER TABLE billing_records ADD CONSTRAINT chk_billing_discount_range
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

ALTER TABLE billing_records ADD CONSTRAINT chk_billing_cycle_time_order
  CHECK (cycle_end > cycle_start);

-- RLS
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_records_tenant_isolation ON billing_records
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY billing_records_tenant_insert ON billing_records
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 触发器
CREATE TRIGGER trg_billing_records_updated_at
  BEFORE UPDATE ON billing_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rollback:
-- DROP TABLE IF EXISTS billing_records;
```

### 2.3 扩展现有表: `tenant_quotas` (迁移 187 Part 3)

```sql
-- Migration 187 Part 3: Extend tenant_quotas for billing-aware quotas

-- 新增 AI 资源配额列
ALTER TABLE tenant_quotas
  ADD COLUMN IF NOT EXISTS max_ai_tokens_per_month BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_gpu_hours_per_month DECIMAL(10, 2) DEFAULT 0;

-- 新增预算关联
ALTER TABLE tenant_quotas
  ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(12, 2) DEFAULT 0;

-- 新增预警阈值配置
ALTER TABLE tenant_quotas
  ADD COLUMN IF NOT EXISTS alert_thresholds JSONB NOT NULL DEFAULT '{"warning": 80, "critical": 90, "hard_limit": 100}';

-- CHECK 约束
ALTER TABLE tenant_quotas ADD CONSTRAINT chk_tenant_quotas_alert_thresholds
  CHECK (
    (alert_thresholds->>'warning')::int <= (alert_thresholds->>'critical')::int AND
    (alert_thresholds->>'critical')::int <= (alert_thresholds->>'hard_limit')::int AND
    (alert_thresholds->>'warning')::int >= 0 AND
    (alert_thresholds->>'hard_limit')::int <= 100
  );

-- Rollback:
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_ai_tokens_per_month;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS max_gpu_hours_per_month;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS monthly_budget;
-- ALTER TABLE tenant_quotas DROP COLUMN IF EXISTS alert_thresholds;
```

---

## 3. 用量计量引擎

### 3.1 计量资源分类与单位

| 资源大类 | 子类 | 计量单位 | 采集方式 | 采集频率 |
|---------|------|---------|---------|---------|
| **计算资源** | `cpu` | `core_hour` (CPU核时) | K8s Metrics API / PipelineRun 记录 | 5min 聚合 |
| | `memory` | `gb_hour` (内存GB时) | K8s Metrics API | 5min 聚合 |
| | `gpu` | `gpu_hour` (GPU小时) | GPU Node Labels + PipelineRun | 实时 |
| **存储资源** | `disk` | `gb` (存储GB) | K8s PVC / Artifact 大小 | 1h 采集 |
| **网络资源** | `bandwidth` | `mbps_hour` (Mbps小时) | K8s NetworkPolicy + Ingress | 5min 聚合 |
| **AI 资源** | `llm_token` | `token` (Token数) | AI Service 调用日志 | 实时 |
| | `embedding_token` | `token` (Embedding Token) | AI Service 调用日志 | 实时 |
| **平台资源** | `pipeline_run` | `count` (Pipeline执行次数) | PipelineEngine 事件 | 实时 |

### 3.2 UsageMeteringService 接口设计

```typescript
// orion-platform-service/src/services/billing/types.ts

/** 资源类型 */
export type ResourceType = 'compute' | 'storage' | 'network' | 'ai' | 'platform';

/** 计量单位 */
export type MeteringUnit =
  | 'core_hour' | 'gb_hour' | 'gb' | 'request'
  | 'token' | 'gpu_hour' | 'mbps_hour' | 'count';

/** 用量计量记录 */
export interface UsageMeteringRecord {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  resourceSubtype: string;
  resourceId: string;
  projectId?: string;
  quantity: number;
  unit: MeteringUnit;
  meteringStart: Date;
  meteringEnd: Date;
  tags: Record<string, string>;
  metadata: Record<string, any>;
  isBillable: boolean;
  billingStatus: 'pending' | 'billed' | 'waived' | 'disputed';
  billingRecordId?: string;
}

/** 用量采集参数 */
export interface MeteringCollectParams {
  tenantId: string;
  resourceType: ResourceType;
  resourceSubtype: string;
  resourceId: string;
  projectId?: string;
  quantity: number;
  unit: MeteringUnit;
  meteringStart: Date;
  meteringEnd: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
  isBillable?: boolean;
}

/** 用量聚合维度 */
export interface MeteringAggregation {
  resourceType: ResourceType;
  resourceSubtype: string;
  totalQuantity: number;
  unit: MeteringUnit;
  periodStart: Date;
  periodEnd: Date;
  recordCount: number;
}

/** 用量查询过滤器 */
export interface MeteringQuery {
  tenantId: string;
  projectId?: string;
  resourceType?: ResourceType;
  resourceSubtype?: string;
  startDate: Date;
  endDate: Date;
  billingStatus?: string;
  page?: number;
  limit?: number;
}
```

### 3.3 UsageMeteringService 实现骨架

```typescript
// orion-platform-service/src/services/billing/UsageMeteringService.ts

import { EventEmitter } from 'events';
import { UsageMeteringRepository } from '../../repositories/UsageMeteringRepository';
import {
  UsageMeteringRecord,
  MeteringCollectParams,
  MeteringAggregation,
  MeteringQuery,
} from './types';

export class UsageMeteringService extends EventEmitter {
  private repository: UsageMeteringRepository;

  constructor(repository: UsageMeteringRepository) {
    super();
    this.repository = repository;
  }

  /** 记录用量（实时采集） */
  async recordUsage(params: MeteringCollectParams): Promise<UsageMeteringRecord> {
    if (params.quantity < 0) {
      throw new Error('Usage quantity must be non-negative');
    }
    if (params.meteringEnd <= params.meteringStart) {
      throw new Error('meteringEnd must be after meteringStart');
    }
    const record = await this.repository.create(params);
    this.emit('usage:recorded', record);
    return record;
  }

  /** 批量记录用量（用于周期聚合） */
  async batchRecordUsage(params: MeteringCollectParams[]): Promise<UsageMeteringRecord[]> {
    const records = await this.repository.createBatch(params);
    records.forEach((r) => this.emit('usage:recorded', r));
    return records;
  }

  /** 查询用量记录（分页） */
  async queryUsage(query: MeteringQuery): Promise<{
    data: UsageMeteringRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.repository.query(query);
  }

  /** 按维度聚合用量 */
  async aggregateUsage(
    query: MeteringQuery,
    groupBy: ('resourceType' | 'resourceSubtype' | 'unit')[]
  ): Promise<MeteringAggregation[]> {
    return this.repository.aggregate(query, groupBy);
  }

  /** 获取租户用量概览 */
  async getTenantUsageSummary(tenantId: string, period: { start: Date; end: Date }): Promise<{
    compute: { cpuCoreHours: number; memoryGbHours: number; gpuHours: number };
    storage: { totalGb: number };
    network: { bandwidthMbHours: number };
    ai: { totalTokens: number };
    platform: { pipelineRuns: number };
  }> {
    const aggregations = await this.aggregateUsage(
      { tenantId, startDate: period.start, endDate: period.end },
      ['resourceType']
    );

    const summary = {
      compute: { cpuCoreHours: 0, memoryGbHours: 0, gpuHours: 0 },
      storage: { totalGb: 0 },
      network: { bandwidthMbHours: 0 },
      ai: { totalTokens: 0 },
      platform: { pipelineRuns: 0 },
    };

    for (const agg of aggregations) {
      switch (agg.resourceType) {
        case 'compute':
          if (agg.resourceSubtype === 'cpu') summary.compute.cpuCoreHours = agg.totalQuantity;
          if (agg.resourceSubtype === 'memory') summary.compute.memoryGbHours = agg.totalQuantity;
          if (agg.resourceSubtype === 'gpu') summary.compute.gpuHours = agg.totalQuantity;
          break;
        case 'storage':
          summary.storage.totalGb = agg.totalQuantity;
          break;
        case 'network':
          summary.network.bandwidthMbHours = agg.totalQuantity;
          break;
        case 'ai':
          summary.ai.totalTokens = agg.totalQuantity;
          break;
        case 'platform':
          summary.platform.pipelineRuns = agg.totalQuantity;
          break;
      }
    }

    return summary;
  }

  /** 标记用量为已计费 */
  async markAsBilled(usageIds: string[], billingRecordId: string): Promise<number> {
    return this.repository.updateBillingStatus(usageIds, 'billed', billingRecordId);
  }
}
```

---

## 4. 计费引擎

### 4.1 定价模型

| 定价模型 | 适用场景 | 计算逻辑 | 示例 |
|---------|---------|---------|------|
| **pay_as_you_go** (按需) | 计算/存储/网络/AI 资源 | `quantity * unit_price` | CPU: ¥0.5/core_hour |
| **subscription** (包年包月) | 平台基础费、固定配额 | 固定月费 / 年费 | 企业版: ¥999/月 |
| **tiered** (阶梯定价) | AI Token、大用量场景 | 不同区间不同单价 | 0-1M token: ¥0.01/千, 1M-10M: ¥0.008/千 |

### 4.2 定价配置（复用 model_pricing + 扩展）

```sql
-- 复用已有的 model_pricing 表存储 AI 定价
-- 新建 billing_price_catalog 表存储通用定价

CREATE TABLE IF NOT EXISTS billing_price_catalog (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type       VARCHAR(30) NOT NULL,
  resource_subtype    VARCHAR(50) NOT NULL,
  pricing_model       VARCHAR(30) NOT NULL DEFAULT 'pay_as_you_go',
  unit                VARCHAR(20) NOT NULL,
  unit_price          DECIMAL(12, 6) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'CNY',
  tier_config         JSONB,       -- 阶梯定价配置: [{"min": 0, "max": 1000000, "price": 0.01}, ...]
  effective_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to        TIMESTAMPTZ,
  created_by          VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_subtype, pricing_model, effective_from)
);

ALTER TABLE billing_price_catalog ADD CONSTRAINT chk_price_catalog_resource_type
  CHECK (resource_type IN ('compute', 'storage', 'network', 'ai', 'platform'));

ALTER TABLE billing_price_catalog ADD CONSTRAINT chk_price_catalog_pricing_model
  CHECK (pricing_model IN ('pay_as_you_go', 'subscription', 'tiered'));

CREATE INDEX idx_price_catalog_active ON billing_price_catalog(resource_type, resource_subtype)
  WHERE effective_to IS NULL;

-- Rollback:
-- DROP TABLE IF EXISTS billing_price_catalog;
```

### 4.3 BillingEngine 核心接口

```typescript
// orion-platform-service/src/services/billing/types.ts

/** 计费结果 */
export interface BillingCalculationResult {
  resourceType: ResourceType;
  pricingModel: 'pay_as_you_go' | 'subscription' | 'tiered';
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  breakdown?: { tier: string; quantity: number; price: number; amount: number }[];
}

/** 账单生成参数 */
export interface GenerateBillParams {
  tenantId: string;
  projectId?: string;
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'yearly';
  cycleStart: Date;
  cycleEnd: Date;
  discountPercent?: number;
  taxRate?: number; // 税率，默认 0.06 (6%)
}

/** 账单汇总结果 */
export interface BillSummary {
  billingRecordId: string;
  tenantId: string;
  cycleStart: Date;
  cycleEnd: Date;
  items: BillingCalculationResult[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
}
```

### 4.4 BillingEngine 实现骨架

```typescript
// orion-platform-service/src/services/billing/BillingEngine.ts

import { BillingRepository } from '../../repositories/BillingRepository';
import { UsageMeteringService } from './UsageMeteringService';
import {
  BillingCalculationResult,
  GenerateBillParams,
  BillSummary,
} from './types';

export class BillingEngine {
  private billingRepo: BillingRepository;
  private meteringService: UsageMeteringService;

  constructor(
    billingRepo: BillingRepository,
    meteringService: UsageMeteringService
  ) {
    this.billingRepo = billingRepo;
    this.meteringService = meteringService;
  }

  /**
   * 按需计费计算
   * formula: quantity * unit_price * (1 - discount/100) * (1 + tax_rate)
   */
  calculatePayAsYouGo(
    quantity: number,
    unitPrice: number,
    discountPercent: number = 0,
    taxRate: number = 0.06
  ): BillingCalculationResult {
    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * taxRate;
    const totalAmount = afterDiscount + taxAmount;

    return {
      resourceType: 'compute',
      pricingModel: 'pay_as_you_go',
      quantity,
      unitPrice,
      discountPercent,
      subtotal: Math.round(subtotal * 10000) / 10000,
      discountAmount: Math.round(discountAmount * 10000) / 10000,
      taxAmount: Math.round(taxAmount * 10000) / 10000,
      totalAmount: Math.round(totalAmount * 10000) / 10000,
      currency: 'CNY',
    };
  }

  /**
   * 阶梯计费计算
   * 根据 tier_config 中定义的区间分段计费
   */
  calculateTiered(
    quantity: number,
    tiers: Array<{ min: number; max: number; price: number }>
  ): BillingCalculationResult {
    let total = 0;
    const breakdown: { tier: string; quantity: number; price: number; amount: number }[] = [];
    let remaining = quantity;

    for (const tier of tiers) {
      if (remaining <= 0) break;
      const tierCapacity = tier.max === Infinity ? remaining : tier.max - tier.min;
      const tierQuantity = Math.min(remaining, tierCapacity);
      const tierAmount = tierQuantity * tier.price;
      total += tierAmount;
      breakdown.push({
        tier: `${tier.min}-${tier.max === Infinity ? '∞' : tier.max}`,
        quantity: tierQuantity,
        price: tier.price,
        amount: Math.round(tierAmount * 10000) / 10000,
      });
      remaining -= tierQuantity;
    }

    return {
      resourceType: 'ai',
      pricingModel: 'tiered',
      quantity,
      unitPrice: 0,
      discountPercent: 0,
      subtotal: Math.round(total * 10000) / 10000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: Math.round(total * 10000) / 10000,
      currency: 'CNY',
      breakdown,
    };
  }

  /**
   * 生成账单
   * 1. 查询周期内所有未计费用量
   * 2. 按资源类型+定价模型分组计算
   * 3. 创建 billing_records
   * 4. 标记用量为已计费
   */
  async generateBill(params: GenerateBillParams): Promise<BillSummary> {
    const taxRate = params.taxRate ?? 0.06;
    const discountPercent = params.discountPercent ?? 0;

    // 1. 查询未计费用量
    const pendingUsage = await this.meteringService.queryUsage({
      tenantId: params.tenantId,
      projectId: params.projectId,
      startDate: params.cycleStart,
      endDate: params.cycleEnd,
      billingStatus: 'pending',
      limit: 10000,
    });

    if (pendingUsage.data.length === 0) {
      // 无用量时生成 ¥0 账单
      return this.createZeroBill(params);
    }

    // 2. 按资源类型聚合
    const aggregated = await this.meteringService.aggregateUsage(
      {
        tenantId: params.tenantId,
        projectId: params.projectId,
        startDate: params.cycleStart,
        endDate: params.cycleEnd,
        billingStatus: 'pending',
      },
      ['resourceType', 'resourceSubtype']
    );

    // 3. 计算费用
    const items: BillingCalculationResult[] = [];
    for (const agg of aggregated) {
      const priceEntry = await this.billingRepo.getCurrentPrice(
        agg.resourceType,
        agg.resourceSubtype
      );

      if (!priceEntry) {
        console.warn(`[BillingEngine] No price found for ${agg.resourceType}/${agg.resourceSubtype}, skipping`);
        continue;
      }

      let result: BillingCalculationResult;

      if (priceEntry.pricingModel === 'tiered' && priceEntry.tierConfig) {
        result = this.calculateTiered(agg.totalQuantity, priceEntry.tierConfig);
      } else {
        result = this.calculatePayAsYouGo(
          agg.totalQuantity,
          priceEntry.unitPrice,
          discountPercent,
          taxRate
        );
      }

      result.resourceType = agg.resourceType;
      result.pricingModel = priceEntry.pricingModel;
      result.unitPrice = priceEntry.unitPrice;
      items.push(result);
    }

    // 4. 汇总
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const totalDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
    const totalTax = items.reduce((s, i) => s + i.taxAmount, 0);
    const grandTotal = items.reduce((s, i) => s + i.totalAmount, 0);

    // 5. 创建账单记录（按资源类型拆分为多条）
    const usageIds = pendingUsage.data.map((r) => r.id);
    const records: string[] = [];

    for (const item of items) {
      const record = await this.billingRepo.createBillingRecord({
        tenantId: params.tenantId,
        projectId: params.projectId,
        billingCycle: params.billingCycle,
        cycleStart: params.cycleStart,
        cycleEnd: params.cycleEnd,
        resourceType: item.resourceType,
        pricingModel: item.pricingModel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        subtotal: item.subtotal,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
        currency: item.currency,
        usageMeteringIds: usageIds,
        status: 'draft',
      });
      records.push(record.id);
    }

    // 6. 标记用量为已计费
    await this.meteringService.markAsBilled(usageIds, records[0]);

    return {
      billingRecordId: records[0],
      tenantId: params.tenantId,
      cycleStart: params.cycleStart,
      cycleEnd: params.cycleEnd,
      items,
      subtotal: Math.round(subtotal * 10000) / 10000,
      totalDiscount: Math.round(totalDiscount * 10000) / 10000,
      totalTax: Math.round(totalTax * 10000) / 10000,
      grandTotal: Math.round(grandTotal * 10000) / 10000,
      currency: 'CNY',
    };
  }

  /**
   * 创建 ¥0 账单（无用量时）
   */
  private async createZeroBill(params: GenerateBillParams): Promise<BillSummary> {
    const record = await this.billingRepo.createBillingRecord({
      tenantId: params.tenantId,
      projectId: params.projectId,
      billingCycle: params.billingCycle,
      cycleStart: params.cycleStart,
      cycleEnd: params.cycleEnd,
      resourceType: 'platform',
      pricingModel: 'pay_as_you_go',
      quantity: 0,
      unitPrice: 0,
      discountPercent: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      currency: 'CNY',
      status: 'issued',
    });

    return {
      billingRecordId: record.id,
      tenantId: params.tenantId,
      cycleStart: params.cycleStart,
      cycleEnd: params.cycleEnd,
      items: [],
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
      currency: 'CNY',
    };
  }
}
```

### 4.5 BillingService 业务层

```typescript
// orion-platform-service/src/services/billing/BillingService.ts

import { BillingRepository } from '../../repositories/BillingRepository';
import { BillingEngine } from './BillingEngine';
import { UsageMeteringService } from './UsageMeteringService';

export interface BillingQuery {
  tenantId: string;
  projectId?: string;
  status?: string;
  resourceType?: string;
  cycleStart?: Date;
  cycleEnd?: Date;
  page?: number;
  limit?: number;
}

export interface BillingRecordDetail {
  id: string;
  tenantId: string;
  projectId?: string;
  billingCycle: string;
  cycleStart: Date;
  cycleEnd: Date;
  resourceType: string;
  pricingModel: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  paymentDate?: Date;
  dueDate?: Date;
  description?: string;
  tags: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export class BillingService {
  private repo: BillingRepository;
  private engine: BillingEngine;
  private meteringService: UsageMeteringService;

  constructor(
    repo: BillingRepository,
    engine: BillingEngine,
    meteringService: UsageMeteringService
  ) {
    this.repo = repo;
    this.engine = engine;
    this.meteringService = meteringService;
  }

  /** 查询账单列表（分页） */
  async listBills(query: BillingQuery): Promise<{
    data: BillingRecordDetail[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.repo.listBills(query);
  }

  /** 查询账单详情 */
  async getBill(id: string, tenantId: string): Promise<BillingRecordDetail> {
    const bill = await this.repo.findById(id);
    if (!bill || bill.tenantId !== tenantId) {
      throw new Error('Billing record not found');
    }
    return bill;
  }

  /** 生成账单（触发计费引擎） */
  async generateBill(params: {
    tenantId: string;
    projectId?: string;
    billingCycle: 'daily' | 'weekly' | 'monthly' | 'yearly';
    cycleStart: Date;
    cycleEnd: Date;
  }): Promise<any> {
    return this.engine.generateBill(params);
  }

  /** 支付账单 */
  async payBill(id: string, paymentMethod: string): Promise<BillingRecordDetail> {
    return this.repo.updateBillStatus(id, 'paid', {
      paymentMethod,
      paymentDate: new Date(),
    });
  }

  /** 作废账单 */
  async voidBill(id: string, reason: string): Promise<BillingRecordDetail> {
    return this.repo.updateBillStatus(id, 'voided', { description: reason });
  }

  /** 获取账单周期内的用量明细 */
  async getBillUsageDetail(billId: string): Promise<any[]> {
    return this.repo.getBillUsageDetail(billId);
  }

  /** 获取费用趋势 */
  async getCostTrend(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly',
    range: number
  ): Promise<{ date: string; amount: number }[]> {
    return this.repo.getCostTrend(tenantId, period, range);
  }

  /** 获取费用构成（按资源类型占比） */
  async getCostBreakdown(tenantId: string, cycleStart: Date, cycleEnd: Date): Promise<
    { resourceType: string; amount: number; percent: number }[]
  > {
    return this.repo.getCostBreakdown(tenantId, cycleStart, cycleEnd);
  }

  /** 获取当前计费周期已过账单 */
  async getCurrentCycleBills(tenantId: string): Promise<BillingRecordDetail[]> {
    return this.repo.getCurrentCycleBills(tenantId);
  }
}
```

---

## 5. 配额管理增强

### 5.1 配额预警系统

在已有 `tenant_quota_alerts` 表基础上，增强预警能力：

| 预警级别 | 阈值 | 动作 | 通知方式 |
|---------|------|------|---------|
| `warning` | 80% | 记录预警 + 站内通知 | 站内消息 |
| `critical` | 90% | 记录告警 + 站内通知 + Webhook | 站内消息 + Webhook |
| `hard_limit` | 100% | 拒绝新资源请求 + 通知 | 站内消息 + Webhook + Email |

### 5.2 配额申请审批流程

```
用户申请 → 审批人审核 → 自动更新配额 → 通知申请人
     │          │                         │
     │          └─ 拒绝 → 通知原因 ←──────┘
     └─ 自动审批（申请量 < 阈值）→ 直接更新
```

```typescript
// orion-platform-service/src/services/billing/QuotaRequestService.ts

export interface QuotaRequest {
  id: string;
  tenantId: string;
  applicantId: string;
  resourceType: string;       // max_pipelines, max_cpu_cores, max_ai_tokens_per_month 等
  currentValue: number;       // 当前配额值
  requestedValue: number;     // 申请值
  reason: string;             // 申请理由
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approverId?: string;
  approvalComment?: string;
  autoApprovalThreshold?: number; // 自动审批阈值
  createdAt: Date;
  updatedAt: Date;
}

export class QuotaRequestService {
  /** 提交配额申请 */
  async submitRequest(params: {
    tenantId: string;
    applicantId: string;
    resourceType: string;
    requestedValue: number;
    reason: string;
  }): Promise<QuotaRequest> {
    // 实现：检查是否可自动审批（申请量 <= 阈值）
    // 如可自动审批：直接更新配额，状态为 auto_approved
    // 否则：创建待审批记录，通知审批人
  }

  /** 审批配额申请 */
  async approveRequest(requestId: string, approverId: string, comment?: string): Promise<QuotaRequest> {
    // 实现：更新配额 + 更新申请状态 + 通知申请人
  }

  /** 拒绝配额申请 */
  async rejectRequest(requestId: string, approverId: string, comment: string): Promise<QuotaRequest> {
    // 实现：更新申请状态 + 通知申请人
  }
}
```

### 5.3 自动扩容与限流

| 条件 | 动作 | 限制 |
|------|------|------|
| 配额使用率 >= 80% | 触发预警通知 | 不限速 |
| 配额使用率 >= 90% | 触发告警 + 建议扩容 | 不限速 |
| 配额使用率 >= 100% | 拒绝新请求 | API 429 + Pipeline 排队 |
| 紧急临时扩容 | 24h 内生效，最多 1.5x 当前配额 | 需管理员审批 |

---

## 6. 外部依赖

| 依赖 | 用途 | 当前状态 | 集成方式 |
|------|------|---------|---------|
| **K8s Metrics API** | 采集 CPU/内存/存储/GPU 用量 | 已有 Pipeline Runner 集成 | `@kubernetes/client-node` 定时采集 |
| **Prometheus** | 网络带宽 + 历史趋势 | 已有 PrometheusService | PromQL 查询聚合 |
| **AI Service** (orion-ai-service) | 采集 AI Token/GPU 用量 | 已有 cost_records 记录 | Event 事件 / 直接调用 |
| **Notification Service** | 账单/配额通知 | 已有 notification-svc | Event 发布 + 订阅 |
| **Tenant Service** | 租户上下文 + 配额 | 已有 | 直接 import |
| **Budget Service** (FinOps) | 预算校验 + 更新 spent | 已有（需改 PostgreSQL） | 直接 import |

**集成架构图**:

```
K8s Metrics API ──┐
Prometheus ───────┤                    ┌──────────────┐
AI Service ───────┤──→ UsageMetering   │ BillingEngine │──→ billing_records
Pipeline Engine ──┘    Service          └──────┬───────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ BudgetService   │──→ budgets.spent 更新
                                      └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │ Notification     │──→ 站内/Webhook/Email
                                      │ Service          │
                                      └─────────────────┘
```

---

## 7. 权限模型

### 7.1 资源-权限矩阵

| 资源 | 权限 | 角色 | 说明 |
|------|------|------|------|
| `quota` | `read` | tenant_admin, member | 查看配额状态 |
| `quota` | `manage` | tenant_admin | 修改配额配置 |
| `quota` | `request` | member | 申请配额扩容 |
| `metering` | `read` | tenant_admin, member | 查看用量数据 |
| `metering` | `manage` | tenant_admin | 标记用量豁免/争议 |
| `billing` | `read` | tenant_admin, member | 查看账单 |
| `billing` | `manage` | tenant_admin | 支付/作废账单 |
| `billing` | `export` | tenant_admin | 导出账单报表 |
| `pricing` | `read` | tenant_admin, member | 查看定价 |
| `pricing` | `manage` | platform_admin | 修改定价目录 |
| `budget` | `read` | tenant_admin, member | 查看预算 |
| `budget` | `manage` | tenant_admin | 创建/修改预算 |
| `cost_analysis` | `read` | tenant_admin, member | 查看费用分析 |

### 7.2 RBAC 集成

所有 billing 相关 API 路由通过 `requirePermission` 中间件鉴权：

```typescript
// 示例：计费路由鉴权
app.get('/billing/bills', {
  onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'read' })],
}, handler);

app.post('/billing/bills/:id/pay', {
  onRequest: [authenticateUser, requirePermission({ resource: 'billing', action: 'manage' })],
}, handler);
```

---

## 8. 后端 API 设计

### 8.1 路由注册

新建文件: `orion-platform-service/src/api/billing-routes.ts`

注册到 `routes.ts`:

```typescript
// orion-platform-service/src/api/routes.ts 新增:
import billingRoutes from './billing-routes';
app.register(billingRoutes, { prefix: '/api/v1/billing', database: dbPool });
```

### 8.2 API 端点清单

#### 配额管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/quotas` | `quota:read` | 获取租户配额状态 |
| `PUT` | `/api/v1/billing/quotas` | `quota:manage` | 更新租户配额 |
| `GET` | `/api/v1/billing/quotas/alerts` | `quota:read` | 配额预警历史（分页） |
| `GET` | `/api/v1/billing/quotas/alerts/stats` | `quota:read` | 配额预警统计 |

#### 配额申请

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/quota-requests` | `quota:read` | 配额申请列表（分页） |
| `POST` | `/api/v1/billing/quota-requests` | `quota:request` | 提交配额申请 |
| `GET` | `/api/v1/billing/quota-requests/:id` | `quota:read` | 配额申请详情 |
| `POST` | `/api/v1/billing/quota-requests/:id/approve` | `quota:manage` | 审批通过 |
| `POST` | `/api/v1/billing/quota-requests/:id/reject` | `quota:manage` | 审批拒绝 |

#### 用量计量

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/metering` | `metering:read` | 用量计量列表（分页） |
| `GET` | `/api/v1/billing/metering/summary` | `metering:read` | 用量概览（按资源类型汇总） |
| `GET` | `/api/v1/billing/metering/trend` | `metering:read` | 用量趋势 |
| `POST` | `/api/v1/billing/metering/aggregate` | `metering:read` | 按维度聚合用量 |
| `PUT` | `/api/v1/billing/metering/:id/waive` | `metering:manage` | 标记用量豁免 |
| `PUT` | `/api/v1/billing/metering/:id/dispute` | `metering:manage` | 标记用量争议 |

#### 账单管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/bills` | `billing:read` | 账单列表（分页） |
| `GET` | `/api/v1/billing/bills/:id` | `billing:read` | 账单详情 |
| `GET` | `/api/v1/billing/bills/:id/usage-detail` | `billing:read` | 账单用量明细 |
| `POST` | `/api/v1/billing/bills/generate` | `billing:manage` | 手动触发账单生成 |
| `POST` | `/api/v1/billing/bills/:id/pay` | `billing:manage` | 支付账单 |
| `POST` | `/api/v1/billing/bills/:id/void` | `billing:manage` | 作废账单 |
| `GET` | `/api/v1/billing/bills/export` | `billing:export` | 导出账单报表（CSV） |

#### 定价管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/pricing` | `pricing:read` | 定价目录列表 |
| `GET` | `/api/v1/billing/pricing/:id` | `pricing:read` | 定价详情 |
| `POST` | `/api/v1/billing/pricing` | `pricing:manage` | 新增定价条目 |
| `PUT` | `/api/v1/billing/pricing/:id` | `pricing:manage` | 更新定价条目 |
| `DELETE` | `/api/v1/billing/pricing/:id` | `pricing:manage` | 停用定价条目 |

#### 费用分析

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/v1/billing/cost-analysis/overview` | `cost_analysis:read` | 费用概览 |
| `GET` | `/api/v1/billing/cost-analysis/breakdown` | `cost_analysis:read` | 费用构成（按资源类型） |
| `GET` | `/api/v1/billing/cost-analysis/trend` | `cost_analysis:read` | 费用趋势 |
| `GET` | `/api/v1/billing/cost-analysis/comparison` | `cost_analysis:read` | 周期对比（环比/同比） |
| `GET` | `/api/v1/billing/cost-analysis/forecast` | `cost_analysis:read` | 费用预测（基于历史数据） |
| `GET` | `/api/v1/billing/cost-analysis/budget-status` | `cost_analysis:read` | 预算执行状态 |

### 8.3 请求/响应示例

**GET /api/v1/billing/quotas**

```json
// Response 200
{
  "code": "SUCCESS",
  "data": {
    "quotas": {
      "maxPipelines": 100,
      "maxCpuCores": 16,
      "maxMemoryGb": 32,
      "maxStorageGb": 100,
      "maxAiTokensPerMonth": 1000000,
      "maxGpuHoursPerMonth": 50,
      "monthlyBudget": 5000
    },
    "usage": {
      "pipelines": { "used": 45, "limit": 100, "percent": 45 },
      "cpuCores": { "used": 12.5, "limit": 16, "percent": 78.1 },
      "memoryGb": { "used": 24, "limit": 32, "percent": 75 },
      "storageGb": { "used": 85, "limit": 100, "percent": 85 },
      "aiTokens": { "used": 750000, "limit": 1000000, "percent": 75 },
      "gpuHours": { "used": 30, "limit": 50, "percent": 60 },
      "monthlyBudget": { "used": 3200, "limit": 5000, "percent": 64 }
    },
    "alerts": [
      {
        "resourceType": "storage",
        "threshold": 80,
        "currentPercent": 85,
        "level": "warning",
        "triggeredAt": "2026-05-22T10:30:00Z"
      }
    ],
    "alertThresholds": { "warning": 80, "critical": 90, "hard_limit": 100 }
  }
}
```

**GET /api/v1/billing/bills**

```json
// Query: ?page=1&limit=20&status=issued&cycle=monthly&month=2026-05
// Response 200
{
  "code": "SUCCESS",
  "data": [
    {
      "id": "bill-uuid-1",
      "billingCycle": "monthly",
      "cycleStart": "2026-05-01T00:00:00Z",
      "cycleEnd": "2026-05-31T23:59:59Z",
      "resourceType": "compute",
      "pricingModel": "pay_as_you_go",
      "quantity": 125.5,
      "unitPrice": 0.5,
      "subtotal": 62.75,
      "discountPercent": 0,
      "totalAmount": 66.52,
      "currency": "CNY",
      "status": "issued",
      "dueDate": "2026-06-05T00:00:00Z",
      "createdAt": "2026-06-01T00:00:00Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**GET /api/v1/billing/metering/summary**

```json
// Query: ?period=current_month
// Response 200
{
  "code": "SUCCESS",
  "data": {
    "period": { "start": "2026-05-01T00:00:00Z", "end": "2026-05-22T00:00:00Z" },
    "compute": { "cpuCoreHours": 385.2, "memoryGbHours": 1200.5, "gpuHours": 30.0 },
    "storage": { "totalGb": 85.0 },
    "network": { "bandwidthMbHours": 5000.0 },
    "ai": { "totalTokens": 750000 },
    "platform": { "pipelineRuns": 1250 }
  }
}
```

---

## 9. 前端页面交互设计

### 9.1 路由与页面清单

| 路由路径 | 页面组件 | 菜单归属 | 权限 |
|---------|---------|---------|------|
| `/billing/quotas` | `BillingQuotaPage` | 治理 > 配额管理 | `quota:read` |
| `/billing/metering` | `BillingMeteringPage` | 治理 > 用量计量 | `metering:read` |
| `/billing/bills` | `BillingListPage` | 治理 > 账单管理 | `billing:read` |
| `/billing/bills/:id` | `BillingDetailPage` | 隐藏（从列表进入） | `billing:read` |
| `/billing/cost-analysis` | `CostAnalysisPage` | 治理 > 费用分析 | `cost_analysis:read` |
| `/billing/quota-request` | `QuotaRequestPage` | 治理 > 配额申请 | `quota:request` |
| `/billing/pricing` | `PricingCatalogPage` | 控制台 > 定价管理 | `pricing:manage` |

**路由注册**（`orion-frontend/src/router/routes.tsx` 新增）:

```tsx
// Billing & Quota
{
  path: '/billing/quotas',
  element: React.lazy(() => import('@/pages/billing-svc/BillingQuotaPage')),
  protected: true,
  requiredPermission: { resource: 'quota', action: 'read' },
},
{
  path: '/billing/metering',
  element: React.lazy(() => import('@/pages/billing-svc/BillingMeteringPage')),
  protected: true,
  requiredPermission: { resource: 'metering', action: 'read' },
},
{
  path: '/billing/bills',
  element: React.lazy(() => import('@/pages/billing-svc/BillingListPage')),
  protected: true,
  requiredPermission: { resource: 'billing', action: 'read' },
},
{
  path: '/billing/bills/:id',
  element: React.lazy(() => import('@/pages/billing-svc/BillingDetailPage')),
  protected: true,
  requiredPermission: { resource: 'billing', action: 'read' },
},
{
  path: '/billing/cost-analysis',
  element: React.lazy(() => import('@/pages/billing-svc/CostAnalysisPage')),
  protected: true,
  requiredPermission: { resource: 'cost_analysis', action: 'read' },
},
{
  path: '/billing/quota-request',
  element: React.lazy(() => import('@/pages/billing-svc/QuotaRequestPage')),
  protected: true,
  requiredPermission: { resource: 'quota', action: 'request' },
},
{
  path: '/billing/pricing',
  element: React.lazy(() => import('@/pages/billing-svc/PricingCatalogPage')),
  protected: true,
  requiredPermission: { resource: 'pricing', action: 'manage' },
},
```

### 9.2 前端 API Client

新建文件: `orion-frontend/src/api/billing.ts`

```typescript
// orion-frontend/src/api/billing.ts
import { api } from './client';

// ==================== Types ====================

export interface QuotaStatus {
  quotas: Record<string, number>;
  usage: Record<string, { used: number; limit: number; percent: number }>;
  alerts: QuotaAlert[];
  alertThresholds: { warning: number; critical: number; hard_limit: number };
}

export interface QuotaAlert {
  resourceType: string;
  threshold: number;
  currentPercent: number;
  level: 'warning' | 'critical' | 'hard_limit';
  triggeredAt: string;
}

export interface MeteringSummary {
  period: { start: string; end: string };
  compute: { cpuCoreHours: number; memoryGbHours: number; gpuHours: number };
  storage: { totalGb: number };
  network: { bandwidthMbHours: number };
  ai: { totalTokens: number };
  platform: { pipelineRuns: number };
}

export interface BillingRecord {
  id: string;
  billingCycle: string;
  cycleStart: string;
  cycleEnd: string;
  resourceType: string;
  pricingModel: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export interface BillingDetail extends BillingRecord {
  usageDetails: any[];
  description?: string;
}

export interface CostBreakdownItem {
  resourceType: string;
  amount: number;
  percent: number;
}

export interface CostTrendPoint {
  date: string;
  amount: number;
}

export interface QuotaRequestItem {
  id: string;
  resourceType: string;
  currentValue: number;
  requestedValue: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  applicantName: string;
  createdAt: string;
}

// ==================== Quota API ====================

export const getQuotaStatus = async (): Promise<QuotaStatus> => {
  const response = await api.get('/v1/billing/quotas');
  return response.data.data;
};

export const updateQuota = async (payload: Record<string, number>): Promise<any> => {
  const response = await api.put('/v1/billing/quotas', payload);
  return response.data.data;
};

export const getQuotaAlerts = async (
  params?: { page?: number; limit?: number }
): Promise<{ data: QuotaAlert[]; total: number }> => {
  const response = await api.get('/v1/billing/quotas/alerts', { params });
  return response.data.data;
};

// ==================== Quota Request API ====================

export const getQuotaRequests = async (
  params?: { page?: number; limit?: number; status?: string }
): Promise<{ data: QuotaRequestItem[]; total: number }> => {
  const response = await api.get('/v1/billing/quota-requests', { params });
  return response.data.data;
};

export const submitQuotaRequest = async (payload: {
  resourceType: string;
  requestedValue: number;
  reason: string;
}): Promise<QuotaRequestItem> => {
  const response = await api.post('/v1/billing/quota-requests', payload);
  return response.data.data;
};

export const approveQuotaRequest = async (id: string, comment?: string): Promise<QuotaRequestItem> => {
  const response = await api.post(`/v1/billing/quota-requests/${id}/approve`, { comment });
  return response.data.data;
};

export const rejectQuotaRequest = async (id: string, comment: string): Promise<QuotaRequestItem> => {
  const response = await api.post(`/v1/billing/quota-requests/${id}/reject`, { comment });
  return response.data.data;
};

// ==================== Metering API ====================

export const getMeteringSummary = async (
  params?: { period?: string }
): Promise<MeteringSummary> => {
  const response = await api.get('/v1/billing/metering/summary', { params });
  return response.data.data;
};

export const getMeteringList = async (params?: {
  page?: number;
  limit?: number;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: any[]; total: number }> => {
  const response = await api.get('/v1/billing/metering', { params });
  return response.data.data;
};

export const getMeteringTrend = async (params?: {
  period?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}): Promise<{ date: string; quantity: number; unit: string }[]> => {
  const response = await api.get('/v1/billing/metering/trend', { params });
  return response.data.data;
};

// ==================== Billing API ====================

export const getBills = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  cycle?: string;
  month?: string;
}): Promise<{ data: BillingRecord[]; total: number }> => {
  const response = await api.get('/v1/billing/bills', { params });
  return response.data.data;
};

export const getBillDetail = async (id: string): Promise<BillingDetail> => {
  const response = await api.get(`/v1/billing/bills/${id}`);
  return response.data.data;
};

export const getBillUsageDetail = async (id: string): Promise<any[]> => {
  const response = await api.get(`/v1/billing/bills/${id}/usage-detail`);
  return response.data.data;
};

export const payBill = async (id: string, paymentMethod: string): Promise<BillingDetail> => {
  const response = await api.post(`/v1/billing/bills/${id}/pay`, { paymentMethod });
  return response.data.data;
};

export const voidBill = async (id: string, reason: string): Promise<BillingDetail> => {
  const response = await api.post(`/v1/billing/bills/${id}/void`, { reason });
  return response.data.data;
};

export const generateBill = async (params: {
  billingCycle: string;
  cycleStart: string;
  cycleEnd: string;
}): Promise<any> => {
  const response = await api.post('/v1/billing/bills/generate', params);
  return response.data.data;
};

export const exportBills = async (params: {
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx';
}): Promise<Blob> => {
  const response = await api.get('/v1/billing/bills/export', {
    params,
    responseType: 'blob',
  });
  return response.data as unknown as Blob;
};

// ==================== Cost Analysis API ====================

export const getCostOverview = async (): Promise<{
  currentMonth: number;
  previousMonth: number;
  changePercent: number;
  projectedMonthly: number;
  budgetLimit: number;
  budgetPercent: number;
}> => {
  const response = await api.get('/v1/billing/cost-analysis/overview');
  return response.data.data;
};

export const getCostBreakdown = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<CostBreakdownItem[]> => {
  const response = await api.get('/v1/billing/cost-analysis/breakdown', { params });
  return response.data.data;
};

export const getCostTrend = async (params?: {
  period?: string;
  granularity?: string;
}): Promise<CostTrendPoint[]> => {
  const response = await api.get('/v1/billing/cost-analysis/trend', { params });
  return response.data.data;
};

export const getCostComparison = async (params?: {
  currentPeriod: string;
  previousPeriod: string;
}): Promise<{
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  byResource: { resourceType: string; current: number; previous: number; change: number }[];
}> => {
  const response = await api.get('/v1/billing/cost-analysis/comparison', { params });
  return response.data.data;
};

export const getCostForecast = async (): Promise<{
  forecasted: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown: { resourceType: string; amount: number }[];
}> => {
  const response = await api.get('/v1/billing/cost-analysis/forecast');
  return response.data.data;
};

export const getBudgetStatus = async (): Promise<{
  budgetLimit: number;
  currentSpend: number;
  percent: number;
  remaining: number;
  projectedOverage: number;
  daysUntilExhausted: number;
}> => {
  const response = await api.get('/v1/billing/cost-analysis/budget-status');
  return response.data.data;
};

// ==================== Pricing API ====================

export const getPricingCatalog = async (): Promise<any[]> => {
  const response = await api.get('/v1/billing/pricing');
  return response.data.data;
};

export const createPricingEntry = async (payload: any): Promise<any> => {
  const response = await api.post('/v1/billing/pricing', payload);
  return response.data.data;
};

export const updatePricingEntry = async (id: string, payload: any): Promise<any> => {
  const response = await api.put(`/v1/billing/pricing/${id}`, payload);
  return response.data.data;
};

export const deletePricingEntry = async (id: string): Promise<void> => {
  await api.delete(`/v1/billing/pricing/${id}`);
};
```

### 9.3 各页面详细交互设计

#### 9.3.1 配额管理页 (`/billing/quotas`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  📊 配额管理                                                  │
│  管理租户资源配额与预算限制                                      │
├─────────────────────────────────────────────────────────────┤
│  [本月预算 ¥5,000 | 已用 ¥3,200 | 64%  ●●●●●●○○○○ 剩余 ¥1,800] │
├────────────┬────────────┬────────────┬────────────┬──────────┤
│ CPU 核心    │ 内存 GB     │ 存储 GB     │ AI Token    │ GPU 时   │
│ 12.5/16    │ 24/32      │ 85/100 ⚠️  │ 750K/1M    │ 30/50    │
│ 78.1%      │ 75%        │ 85% ⚠️    │ 75%        │ 60%      │
│ ●●●●●●●●○○  │ ●●●●●●●○○○  │ ●●●●●●●●●○  │ ●●●●●●●○○○  │ ●●●●●●○○○○│
├────────────┴────────────┴────────────┴────────────┴──────────┤
│  ⚙️ 操作: [编辑配额] [申请扩容] [查看预警历史]                    │
├─────────────────────────────────────────────────────────────┤
│  预警历史                                        [🔍 筛选] [↻ 刷新] │
│  ┌─────┬──────────┬────────┬────────┬──────────┬──────────┐  │
│  │时间  │资源类型   │阈值     │当前%    │级别       │状态       │  │
│  ├─────┼──────────┼────────┼────────┼──────────┼──────────┤  │
│  │5-22  │存储 GB    │80%     │85%     │⚠️ warning│已通知     │  │
│  │5-20  │CPU 核心   │80%     │82%     │⚠️ warning│已通知     │  │
│  └─────┴──────────┴────────┴────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 配额卡片(6 张) | 点击展开详情 Modal，显示历史趋势折线图 | 无加载态，数据已预加载 |
| 编辑配额按钮 | 打开 Drawer (width=600)，表单含所有配额字段，字段有 number 校验 | 保存: `message.success('配额已更新')`；失败: `message.error(...)` |
| 申请扩容按钮 | 跳转到 `/billing/quota-request`，自动携带当前资源类型 | - |
| 预警表格行 | 点击展开详情: 触发时间、资源快照、通知记录 | - |
| 预警筛选 | 下拉: 全部/warning/critical/hard_limit | 实时更新表格 |
| 预警级别列 | warning=黄色 Tag, critical=橙色 Tag, hard_limit=红色 Tag | - |
| 页面加载 | 显示 Spin 占位 | loading 时不可操作 |
| 空状态 | 无预警: Empty + "当前无配额预警" | - |

**Design Token 使用**:

- 卡片圆角: `componentRadius.card` (12px)
- 卡片阴影: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- 进度条颜色: < 80% = `colors.success[500]`, 80-90% = `colors.warning[500]`, > 90% = `colors.error[500]`
- 按钮间距: `spacing.sm` (8px)
- 预警表格行高: `48px`

---

#### 9.3.2 用量计量页 (`/billing/metering`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  📈 用量计量                                                  │
│  实时查看各类型资源使用量                                       │
├─────────────────────────────────────────────────────────────┤
│  周期: [本月 ▼] | 资源类型: [全部 ▼] | [🔍 搜索资源ID] [↻ 刷新]  │
├────────────┬────────────┬────────────┬────────────┬──────────┤
│ 计算资源    │ 存储资源    │ 网络资源    │ AI 资源     │ 平台资源  │
│ 385 核时    │ 85 GB      │ 5,000 Mh   │ 750K Token │ 1,250 次 │
│ +12% 较上月 │ +5% 较上月  │ -3% 较上月 │ +25% 较上月 │ +8% 较上月│
├─────────────────────────────────────────────────────────────┤
│  用量趋势图 (折线图: 近30天, 按资源类型分色线)                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ╱╲    ╱╲   ╱ 计算资源                                    │ │
│  │ ╱  ╲  ╱  ╲ ╱   存储资源                                   │ │
│  │╱    ╲╱    ╲    AI 资源                                    │ │
│  │───────────────── 日期轴                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  明细记录                                           [📥 导出]    │
│  ┌─────┬────────┬──────────┬────────┬──────┬────────┬──────┐  │
│  │时间  │资源类型 │子类型     │用量     │单位    │计费状态 │操作   │  │
│  ├─────┼────────┼──────────┼────────┼──────┼────────┼──────┤  │
│  │5-22 │计算    │CPU        │2.5     │核时    │已计费   │[豁免]  │  │
│  │5-22 │AI      │LLM Token │50,000  │Token   │待计费   │[豁免]  │  │
│  └─────┴────────┴──────────┴────────┴──────┴────────┴──────┘  │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 周期选择器 | 下拉: 今天/本周/本月/自定义范围 | 切换后重新加载所有数据 |
| 资源类型筛选 | 下拉: 全部/计算/存储/网络/AI/平台 | 实时更新统计卡片和趋势图 |
| 搜索资源ID | Input 输入后 300ms debounce 搜索 | 过滤明细表格 |
| 趋势图 | ECharts/Recharts 折线图, 悬浮显示精确值 | loading 时显示骨架图 |
| 明细表格 | 分页(默认20条), 列可排序 | loading 时行骨架 |
| 豁免按钮 | 点击打开 Modal 确认: "确认豁免此条用量（不计费）？" | 成功: `message.success('已豁免')`；表格行状态更新 |
| 导出按钮 | 导出 CSV 文件下载 | 成功: `message.success('导出完成')`；loading 时按钮 disabled |
| 计费状态列 | pending=灰色 Tag, billed=绿色 Tag, waived=蓝色 Tag, disputed=橙色 Tag | - |
| 空状态 | 无记录: Empty + "选择其他周期查看" | - |

---

#### 9.3.3 账单列表页 (`/billing/bills`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  📄 账单管理                                                  │
│  查看和管理账单记录                                            │
├─────────────────────────────────────────────────────────────┤
│  本月累计: ¥66.52  |  待支付: ¥20.00  |  已支付: ¥46.52        │
│  [周期: 月度 ▼] [状态: 全部 ▼] [月份: 2026-05 ▼] [🔍 搜索] [📥 导出]│
├─────────────────────────────────────────────────────────────┤
│  ┌────┬────────┬────────┬────────┬────────┬────────┬──────┐  │
│  │☐  │账单周期 │资源类型 │用量     │金额     │状态     │操作   │  │
│  ├────┼────────┼────────┼────────┼────────┼────────┼──────┤  │
│  │☐  │2026-05 │计算     │125.5核时│ ¥66.52 │已出账   │[详情] │  │
│  │    │        │         │        │        │        │[支付] │  │
│  ├────┼────────┼────────┼────────┼────────┼────────┼──────┤  │
│  │☐  │2026-05 │AI       │750K    │ ¥30.00 │已支付   │[详情] │  │
│  │    │        │         │Token   │        │        │      │  │
│  ├────┼────────┼────────┼────────┼────────┼────────┼──────┤  │
│  │☐  │2026-05 │存储     │85GB    │ ¥17.00 │已支付   │[详情] │  │
│  └────┴────────┴────────┴────────┴────────┴────────┴──────┘  │
│  批量操作: [批量支付]                                         │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 统计摘要栏 | 只读展示, 数据随筛选条件刷新 | - |
| 筛选器 | 周期/状态/月份组合筛选, 点击即刷新 | - |
| 搜索 | 按账单 ID 或描述搜索, 300ms debounce | - |
| 表格行 | 点击行进入详情页 `/billing/bills/:id` | - |
| 支付按钮 | 点击打开 Modal 选择支付方式(余额/银行卡/内部转账) | 成功: `message.success('账单已支付')`；状态更新为 paid |
| 状态 Tag | draft=灰色, issued=蓝色, paid=绿色, overdue=红色, refunded=橙色, voided=灰色删除线 | - |
| 批量支付 | 勾选多条 issued 账单后出现批量支付按钮 | 二次确认: "确认支付 X 条账单, 合计 ¥Y？" |
| 导出 | 选择日期范围 + 格式(CSV/XLSX), 下载文件 | loading 时按钮 disabled + loading 文字 |
| 到期日 | 超过 due_date 且状态为 issued 的行背景色 `#FFF2F0` | - |
| 分页 | 默认 20 条/页 | - |
| 空状态 | Empty + "当前周期无账单" | - |

---

#### 9.3.4 账单详情页 (`/billing/bills/:id`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回列表           📄 账单详情                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─ 基本信息 ─────────────────────────────────────────────┐  │
│  │ 账单ID: bill-uuid-1    │ 周期: 2026-05 月度              │  │
│  │ 状态: [已出账 ●]        │ 创建时间: 2026-06-01 00:00     │  │
│  │ 到期日: 2026-06-05      │ 币种: CNY                     │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ 费用明细 ─────────────────────────────────────────────┐  │
│  │ 资源类型 │ 计费模型    │ 用量    │ 单价    │ 小计     │    │
│  │ 计算     │ 按需计费    │ 125.5核时│ ¥0.5   │ ¥62.75  │    │
│  │ AI       │ 阶梯计费    │ 750K    │ -      │ ¥30.00  │    │
│  │          │            │         │         │ 折扣: -¥3.00│    │
│  │          │            │         │         │ 税费(6%): ¥5.39│ │
│  │ 合计: ¥66.52                                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ 用量明细 ─────────────────────────────────────────────┐  │
│  │ [展开] 计算资源用量明细 (125.5 核时, 45 条记录)            │  │
│  │ [展开] AI 资源用量明细 (750K Token, 12 条记录)             │  │
│  └────────────────────────────────────────────────────────┘  │
│  [💳 支付账单]  [🚫 作废]                                     │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 返回列表 | 点击跳转到 `/billing/bills` | - |
| 状态 Tag | 根据 `status` 字段渲染, 同列表页 | - |
| 费用明细表格 | 只读 Descriptions, 每行右对齐数字列 | - |
| 用量明细 Collapse | 可展开/折叠, 展开后显示关联 `usage_metering` 明细表 | 展开时加载数据 |
| 支付按钮 | 仅 `issued` 状态可见, Modal 选择支付方式 | 成功: `message.success('支付成功')` → 跳转列表页 |
| 作废按钮 | 仅 `draft`/`issued` 状态可见, Modal 输入作废原因 | 成功: `message.success('账单已作废')` |
| 页面加载 | 并行请求 `getBillDetail(id)` + `getBillUsageDetail(id)` | 显示 Spin |
| 权限控制 | 无 `billing:manage` 权限时隐藏支付/作废按钮 | - |

---

#### 9.3.5 费用分析页 (`/billing/cost-analysis`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  📊 费用分析                                                  │
│  多维度分析费用趋势与构成                                       │
├─────────────────────────────────────────────────────────────┤
│  周期: [2026-05 ▼]  对比: [上月 ▼]                            │
├────────────┬────────────┬────────────┬──────────────────────┤
│ 本月费用    │ 较上月      │ 预算使用率  │ 预测月末              │
│ ¥96.52     │ ↑ 12.3%    │ 64%       │ ¥145.00              │
│            │            │ ●●●●●●○○○○  │ 超预算: ¥-              │
├────────────┴────────────┴────────────┴──────────────────────┤
│  费用构成 (饼图)              │  费用趋势 (折线图)               │
│  ┌──────────────────────┐    │  ┌──────────────────────────┐  │
│  │  计算 65%            │    │  │  ╱╲  ╱╲  ╱                │  │
│  │  AI 31%              │    │  │ ╱  ╲╱  ╲╱                 │  │
│  │  存储 4%             │    │  │─────────────────          │  │
│  └──────────────────────┘    │  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  周期对比表                                                  │
│  ┌──────────┬────────┬────────┬────────┬─────────┐           │
│  │资源类型   │本月     │上月     │变化     │变化率    │           │
│  ├──────────┼────────┼────────┼────────┼─────────┤           │
│  │计算       │¥62.75  │¥55.00  │↑ ¥7.75 │+14.1%   │           │
│  │AI         │¥30.00  │¥28.00  │↑ ¥2.00 │+7.1%    │           │
│  │存储       │¥17.00  │¥16.50  │↑ ¥0.50 │+3.0%    │           │
│  │合计       │¥96.52  │¥85.97  │↑ ¥10.55│+12.3%   │           │
│  └──────────┴────────┴────────┴────────┴─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  预算执行状态                                                │
│  预算: ¥5,000 | 已用: ¥3,200 | 剩余: ¥1,800                   │
│  预测超支: 无 | 预算耗尽剩余天数: 18 天                         │
│  [查看预算详情 →] (跳转到 FinOps Dashboard)                    │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 周期选择器 | 下拉: 本月/上月/自定义月份 | 切换后重新加载所有图表 |
| 对比选择器 | 下拉: 上月/去年同期/自定义 | 刷新周期对比表 |
| 饼图 | 悬浮显示资源类型+金额+占比, 点击筛选 | 点击饼图扇区时表格联动过滤 |
| 趋势折线图 | 双线图: 本月 vs 上月对比, 悬浮显示精确值 | loading 时骨架图 |
| 周期对比表 | 上涨=红色文字, 下降=绿色文字 | 列可排序 |
| 预算执行 | 进度条 + 预测信息 | 预测超支时显示红色警告 |
| 预算详情链接 | 跳转到已有 FinOps Dashboard | - |
| 页面加载 | 并行请求所有分析接口 | 各模块独立 loading, 不阻塞整体 |

---

#### 9.3.6 配额申请页 (`/billing/quota-request`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  📝 配额申请                                                  │
│  申请提高资源配额上限                                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─ 新建申请 ─────────────────────────────────────────────┐  │
│  │ 资源类型: [CPU 核心 ▼]                                   │  │
│  │ 当前配额: 16 核                                          │  │
│  │ 申请值:   [___] 核                                      │  │
│  │ 申请理由: [_______________________________________]       │  │
│  │ [提交申请]                                               │  │
│  │ 提示: 申请量 ≤ 自动审批阈值时将自动通过                      │  │
│  └────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  申请记录                                          [🔍 筛选]    │
│  状态: [全部 ▼]                                               │
│  ┌─────┬──────────┬────────┬────────┬────────┬──────┬──────┐  │
│  │提交时间│资源类型   │当前值   │申请值   │理由     │状态   │操作   │  │
│  ├─────┼──────────┼────────┼────────┼────────┼──────┼──────┤  │
│  │5-22 │CPU 核心   │16      │24      │扩容需求  │待审批 │[撤回] │  │
│  │5-20 │AI Token  │1M      │5M      │AI实验   │已通过 │      │  │
│  │5-18 │存储 GB    │100     │200     │数据增长  │已拒绝 │[查看] │  │
│  └─────┴──────────┴────────┴────────┴────────┴──────┴──────┘  │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 资源类型选择 | 下拉选择, 选择后自动显示当前配额值 | - |
| 申请值输入 | Number Input, min=当前值+1, max=当前值*5 | 超出范围时显示校验错误 |
| 申请理由 | TextArea, 必填, max 500 字 | 为空时校验提示 |
| 提交按钮 | 校验通过后提交, 按钮 loading | 成功: `message.success('申请已提交')` + 刷新申请记录表 |
| 撤回按钮 | 仅 pending 状态可见, Modal 确认 | 成功: `message.success('申请已撤回')` |
| 查看拒绝原因 | 点击打开 Modal 显示审批人 + 拒绝原因 | - |
| 状态 Tag | pending=蓝色, approved=绿色, rejected=红色, auto_approved=青色 | - |
| 筛选 | 按状态下拉筛选 | 实时刷新 |
| 空状态 | Empty + "您还没有配额申请记录" + [新建申请] 按钮 | - |

**自动审批规则**:

- 申请值 ≤ 当前值 × 1.5 → 自动审批通过
- 申请值 > 当前值 × 1.5 → 需管理员审批
- 管理员审批后配额立即生效, 更新 `tenant_quotas` 对应字段

---

#### 9.3.7 定价目录页 (`/billing/pricing`)

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ 定价管理                                                  │
│  管理资源定价目录与阶梯策略                                     │
├─────────────────────────────────────────────────────────────┤
│  [+ 新增定价条目]  [资源类型: 全部 ▼]  [状态: 生效中 ▼]           │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┬──────────┬────────┬────────┬────────┬──────┬────┐ │
│  │资源类型 │子类型     │计费模型 │单位     │单价     │状态   │操作 │ │
│  ├────────┼──────────┼────────┼────────┼────────┼──────┼────┤ │
│  │计算     │CPU       │按需    │核时    │¥0.50   │生效中 │[编辑]│ │
│  │计算     │内存      │按需    │GB时    │¥0.10   │生效中 │[编辑]│ │
│  │计算     │GPU       │按需    │GPU时   │¥15.00  │生效中 │[编辑]│ │
│  │AI       │LLM Token │阶梯    │Token   │-       │生效中 │[编辑]│ │
│  │存储     │磁盘      │按需    │GB      │¥0.20/月 │生效中 │[编辑]│ │
│  └────────┴──────────┴────────┴────────┴────────┴──────┴────┘ │
└─────────────────────────────────────────────────────────────┘
```

**交互细节**:

| 元素 | 交互 | 反馈 |
|------|------|------|
| 新增按钮 | 打开 Drawer (width=700), 表单: 资源类型/子类型/计费模型/单价/阶梯配置 | 保存: `message.success('定价条目已创建')` |
| 编辑按钮 | 打开 Drawer 预填数据, 可修改 | 保存: `message.success('定价已更新')` |
| 阶梯配置 | JSON Editor 或可视化表单, 支持添加/删除阶梯区间 | 区间必须连续, 最后区间 max=Infinity |
| 生效时间 | DatePicker 范围, 默认 now ~ ∞ | - |
| 权限控制 | 仅 `platform_admin` 可访问 | 无权限时 403 |

**新增/编辑表单字段**:

| 字段 | 类型 | 校验 |
|------|------|------|
| 资源类型 | Select (compute/storage/network/ai/platform) | 必填 |
| 资源子类型 | Input (cpu/memory/disk/llm_token 等) | 必填 |
| 计费模型 | Select (pay_as_you_go/subscription/tiered) | 必填 |
| 计量单位 | Select (根据资源类型联动) | 必填 |
| 单价 | Number (DECIMAL 6位小数) | > 0 |
| 阶梯配置 | JSON (仅 tiered 模型) | 区间连续, 首区间 min=0 |
| 生效开始时间 | DatePicker | 必填 |
| 生效结束时间 | DatePicker (可选) | ≥ 生效开始时间 |

---

## 10. Event 事件体系

### 10.1 事件定义

```typescript
// 用量记录事件
'usage:recorded'        // { tenantId, resourceType, quantity, unit }
'usage:aggregated'      // { tenantId, period, aggregations: MeteringAggregation[] }

// 计费事件
'billing:calculated'    // { tenantId, billId, totalAmount, items }
'billing:generated'     // { tenantId, billId, cycleStart, cycleEnd }
'billing:paid'          // { tenantId, billId, amount, paymentMethod }
'billing:voided'        // { tenantId, billId, reason }

// 配额事件
'quota:threshold'       // { tenantId, resourceType, percent, level }
'quota:hard_limit'      // { tenantId, resourceType, percent }
'quota:updated'         // { tenantId, oldQuota, newQuota }
'quota:request:submitted'  // { tenantId, requestId, resourceType, requestedValue }
'quota:request:approved'   // { tenantId, requestId, approverId }
'quota:request:rejected'   // { tenantId, requestId, approverId, reason }

// 预算事件
'budget:warning'        // { budgetId, percent, remaining }
'budget:exhausted'      // { budgetId, spent, limit }
'budget:forecast'       // { budgetId, forecastedSpend, projectedOverage }
```

### 10.2 事件处理流程

```
UsageMeteringService.recordUsage()
  → emit 'usage:recorded'
  → QuotaCheckService 检查配额使用率
  → 超过阈值时 emit 'quota:threshold'
  → NotificationService 发送通知

BillingEngine.generateBill()
  → emit 'billing:calculated'
  → BudgetService.updateSpent()
  → 超过预算时 emit 'budget:warning'
  → NotificationService 发送通知
  → emit 'billing:generated'
```

---

## 11. 验收标准

### 11.1 功能验收

| 编号 | 验收项 | 验收标准 | 验证方法 |
|------|--------|---------|---------|
| F01 | 用量计量记录 | PipelineRun 结束后自动记录 CPU/内存用量到 `usage_metering` 表 | 运行 Pipeline → 查询表确认记录 |
| F02 | 多资源类型计量 | 计算/存储/网络/AI 四类资源均可计量 | 分别触发各类资源操作 → 确认记录 |
| F03 | 按需计费 | `quantity * unit_price` 计算正确, 精度到 ¥0.0001 | 单元测试覆盖 |
| F04 | 阶梯计费 | 分段计费计算正确, 阶梯边界无遗漏 | 单元测试: 0-1M/1M-10M/>10M 三段 |
| F05 | 折扣计算 | 折扣百分比正确应用到 subtotal | 单元测试: 10%/20%/50% |
| F06 | 税费计算 | 默认 6% 税率正确应用 | 单元测试 |
| F07 | 账单生成 | 周期结束时汇总用量生成 billing_records | 手动触发 generateBill → 确认记录 |
| F08 | 账单状态流转 | draft → issued → paid/voided, 不可逆向 | API 测试各状态转换 |
| F09 | 配额预警 80% | 使用率达 80% 时创建预警记录 | 模拟用量 → 查询 alerts 表 |
| F10 | 配额预警 90% | 使用率达 90% 时创建告警记录 | 同上 |
| F11 | 硬限制 100% | 使用率达 100% 时拒绝新请求 | API 测试: 创建 Pipeline 应返回 429 |
| F12 | 配额申请 | 提交申请 → 审批 → 配额生效 | 端到端测试完整流程 |
| F13 | 自动审批 | 申请量 ≤ 1.5x 当前配额时自动通过 | 提交小额申请 → 确认状态 auto_approved |
| F14 | 费用趋势 | API 返回的趋势数据可用于折线图渲染 | 前端页面展示验证 |
| F15 | 费用构成 | API 返回各资源类型费用占比 | 前端饼图展示验证 |
| F16 | 预算执行 | `budgets.spent` 随账单支付自动更新 | 支付账单 → 查询 budgets 表 |
| F17 | 账单导出 | 导出 CSV 格式正确, 包含全部字段 | 下载文件用 Excel 打开验证 |

### 11.2 前端交互验收

| 编号 | 验收项 | 验收标准 |
|------|--------|---------|
| UI01 | 所有页面有标题+图标 | 遵循 `level={2}` + `colors.primary[500]` 图标规范 |
| UI02 | 所有页面有副标题 | `Typography.Text` + `colors.neutral[500]` |
| UI03 | 卡片圆角统一 | 使用 `componentRadius.card` (12px) |
| UI04 | 表格行高统一 | `48px`, 悬停背景 `colors.primary[50]` |
| UI05 | 按钮间距统一 | `spacing.sm` (8px) |
| UI06 | 状态 Tag 颜色统一 | 各状态颜色对应 Design Token |
| UI07 | 进度条颜色分级 | < 80% 绿, 80-90% 黄, > 90% 红 |
| UI08 | 所有异步操作有 loading | 按钮 `loading` + `disabled` |
| UI09 | 所有异步操作有成功/失败提示 | `message.success` / `message.error` |
| UI10 | 空状态有引导 | `Empty` 组件 + 引导文字/按钮 |
| UI11 | 表单字段有校验 | 必填项 `rules`, 数值字段 `min`/`max` |
| UI12 | 确认操作有二次确认 | 支付/作废/豁免等危险操作 Modal 确认 |
| UI13 | 列表页支持筛选+分页 | 筛选即时生效, 分页默认 20 条 |
| UI14 | 详情页有返回入口 | "← 返回列表" 按钮 |
| UI15 | 权限控制 | 无权限时隐藏对应按钮, 403 时显示空状态 |

### 11.3 性能验收

| 编号 | 验收项 | 验收标准 |
|------|--------|---------|
| P01 | 账单列表查询 | `GET /billing/bills` 响应时间 < 200ms (100 条以内) |
| P02 | 用量聚合查询 | `POST /metering/aggregate` 响应时间 < 500ms (30 天数据) |
| P03 | 账单生成 | `generateBill` 处理 1000 条用量 < 5s |
| P04 | 前端首屏加载 | 各页面首屏加载 < 1.5s |

### 11.4 测试覆盖验收

| 编号 | 验收项 | 验收标准 |
|------|--------|---------|
| T01 | 后端单元测试 | `BillingEngine` 计算逻辑覆盖率 ≥ 90% |
| T02 | 后端集成测试 | `billing-routes` API 端到端测试覆盖全部端点 |
| T03 | 前端单元测试 | 各页面组件 render 测试, API mock 验证 |
| T04 | 前端交互测试 | 按钮点击、表单提交、Modal 确认等交互测试 |

---

## 12. 实施工作量估算

### 12.1 后端 (orion-platform-service)

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 迁移 187: `usage_metering` 表 DDL + RLS + rollback | 0.5 天 | P0 |
| 迁移 187: `billing_records` 表 DDL + RLS + rollback | 0.5 天 | P0 |
| 迁移 187: `billing_price_catalog` 表 DDL + RLS + rollback | 0.25 天 | P0 |
| 迁移 187: `tenant_quotas` 扩展 (ALTER TABLE) | 0.25 天 | P0 |
| `UsageMeteringRepository` + Entity + 测试 | 1 天 | P0 |
| `BillingRepository` + Entity + 测试 | 1 天 | P0 |
| `UsageMeteringService` + 测试 | 1 天 | P0 |
| `BillingEngine` (计算逻辑) + 测试 | 1.5 天 | P0 |
| `BillingService` + 测试 | 1 天 | P0 |
| `QuotaRequestService` + 测试 | 1 天 | P1 |
| `billing-routes.ts` 路由实现 | 1.5 天 | P0 |
| 注册到 `routes.ts` + 权限中间件集成 | 0.5 天 | P0 |
| 与 PipelineEngine 集成(自动计量) | 1 天 | P0 |
| 与 BudgetService 集成(更新 spent) | 0.5 天 | P0 |
| 与 NotificationService 集成(事件通知) | 0.5 天 | P1 |
| **后端合计** | **~12 天** | |

### 12.2 前端 (orion-frontend)

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| `api/billing.ts` API Client + 类型定义 | 1 天 | P0 |
| `billing-svc/BillingQuotaPage` | 1.5 天 | P0 |
| `billing-svc/BillingMeteringPage` | 1.5 天 | P0 |
| `billing-svc/BillingListPage` | 1.5 天 | P0 |
| `billing-svc/BillingDetailPage` | 1.5 天 | P0 |
| `billing-svc/CostAnalysisPage` | 2 天 | P0 |
| `billing-svc/QuotaRequestPage` | 1.5 天 | P1 |
| `billing-svc/PricingCatalogPage` | 1.5 天 | P1 |
| 路由注册 (`routes.tsx`) + 菜单配置 (`menuConfigStore.ts`) | 0.5 天 | P0 |
| 组件测试 (各页面 render + 交互) | 2 天 | P1 |
| **前端合计** | **~15 天** | |

### 12.3 总工作量

| 模块 | 工作量 | 人月 |
|------|--------|------|
| 后端开发 | 12 天 | ~0.6 |
| 前端开发 | 15 天 | ~0.75 |
| 联调 + 测试 | 5 天 | ~0.25 |
| **合计** | **~32 天** | **~1.6 人月** |

> 与原计划估算 "1 人月(计费增强)" 对齐, 考虑到已有 `tenant_quotas`/`budgets`/`cost_records` 等基础设施, 实际增量工作量为 **~1.6 人月**。

---

## 附录: 文件清单

### 新建文件

```
orion-platform-service/
  src/db/migrations/
    187_create_billing_tables.sql            # usage_metering + billing_records + price_catalog
    187_rollback_create_billing_tables.sql   # Rollback
  src/services/billing/
    types.ts                                  # 类型定义
    UsageMeteringService.ts                   # 用量计量服务
    BillingEngine.ts                          # 计费引擎
    BillingService.ts                         # 账单服务
    QuotaRequestService.ts                    # 配额申请服务
    index.ts                                  # 导出
  src/repositories/
    UsageMeteringRepository.ts               # 用量数据访问
    BillingRepository.ts                      # 计费数据访问
  src/api/
    billing-routes.ts                         # 计费 API 路由
  src/services/billing/__tests__/
    UsageMeteringService.test.ts
    BillingEngine.test.ts
    BillingService.test.ts
    QuotaRequestService.test.ts
  src/repositories/__tests__/
    UsageMeteringRepository.test.ts
    BillingRepository.test.ts
  src/api/__tests__/
    billing-routes.test.ts

orion-frontend/
  src/api/
    billing.ts                                # Billing API Client
  src/pages/billing-svc/
    BillingQuotaPage/
      index.tsx                               # 配额管理页
    BillingMeteringPage/
      index.tsx                               # 用量计量页
    BillingListPage/
      index.tsx                               # 账单列表页
    BillingDetailPage/
      index.tsx                               # 账单详情页
    CostAnalysisPage/
      index.tsx                               # 费用分析页
    QuotaRequestPage/
      index.tsx                               # 配额申请页
    PricingCatalogPage/
      index.tsx                               # 定价目录页
```

### 修改文件

```
orion-platform-service/
  src/api/routes.ts                           # 注册 billing-routes
  src/db/migrations/                          # 扩展 tenant_quotas (ALTER TABLE)
  src/engine/TaskRunner.ts                    # PipelineRun 结束时调用 UsageMeteringService
  src/services/tenant/TenantQuotaService.ts   # 增加预算感知 + 硬限流

orion-frontend/
  src/router/routes.tsx                       # 注册 7 个 billing 路由
  src/stores/menuConfigStore.ts               # 新增 "治理" 菜单下的子项
```
