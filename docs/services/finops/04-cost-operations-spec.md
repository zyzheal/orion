# 成本运营详细规格 (Phase 2)

> **日期**: 2026-05-05
> **状态**: 已验证
> **能力域**: 成本运营
> **目标成熟度**: L2 → L2.3
> **关键交付**: 预算门禁

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现：
- **FinOpsService** (`services/finops/FinOpsService.ts`)：成本报告、成本追踪、预算管理（Budget CRUD）、ROI 分析、成本优化建议、云成本收集、K8s 成本分摊、SaaS 成本追踪、成本汇总与趋势分析，全部基于 PostgreSQL Repository
- **Budget 管理**：预算创建、阈值告警（50%/75%/90%/100%）、预算预测（线性外推）、预算状态查询
- **成本优化**：资源利用率分析、闲置资源检测、right-sizing 建议、调度优化建议
- **成本分摊**：按 Entity 类型（tenant/project/service）追踪成本，支持 Chargeback 报告

**不足**：
- 预算门禁（Budget Gate）缺失：Pipeline 部署前无成本门禁检查（高成本变更无法被自动阻断）
- 成本异常检测：仅线性预测，无异常检测（突增/异常模式无法自动识别）
- 成本门禁策略：无基于成本的门禁策略（warn/block/degrade）
- 成本与部署关联：部署事件与成本变化无关联分析（无法回答"这次部署增加了多少成本"）
- 多云成本：虽有 CloudCostRecord 表，但仅支持手动录入，无 AWS/GCP/Azure API 自动同步
- 预算预测过于简单（仅线性外推），无季节性/趋势性预测

### 1.2 Phase 2 目标 (L2.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 预算门禁 | 部署前成本门禁检查，支持 warn/block/degrade 策略 | L2.3 |
| 成本异常检测 | 自动识别成本突增/异常模式 | L2.3 |
| 部署成本关联 | 部署事件与成本变化的关联分析 | L2.3 |
| 成本优化闭环 | 优化建议 → 执行 → 验证节省效果 | L2.3 |
| 预算预测增强 | 基于历史数据的趋势预测（含季节性） | L2.3 |

## 二、验收标准

### 2.1 预算门禁

| # | 标准 | 验证方式 |
|---|------|----------|
| G1 | 部署前自动检查目标环境预算使用情况 | 集成测试 |
| G2 | 门禁策略：warn（告警不阻断）、block（阻断部署）、degrade（降级部署） | API 测试 |
| G3 | 门禁通过时生成成本预估报告 | API 测试 |
| G4 | 门禁阻断时可申请豁免（含审批流程） | API 测试 |
| G5 | 门禁策略按环境/服务可配置 | API 测试 |

### 2.2 成本异常检测

| # | 标准 | 验证方式 |
|---|------|----------|
| A1 | 自动检测成本突增（> 2σ 偏离基线） | 单元测试 |
| A2 | 自动检测成本异常模式（阶梯上升、尖峰） | 单元测试 |
| A3 | 异常告警含异常时间、异常幅度、可能原因 | API 测试 |
| A4 | 支持配置检测灵敏度 | API 测试 |

### 2.3 部署成本关联

| # | 标准 | 验证方式 |
|---|------|----------|
| D1 | 部署后自动计算成本变化（部署前 vs 部署后 24h） | 集成测试 |
| D2 | 支持按部署标签/版本追踪成本变化 | API 测试 |
| D3 | 生成部署成本报告（资源变化、成本差异） | API 测试 |

### 2.4 成本优化闭环

| # | 标准 | 验证方式 |
|---|------|----------|
| O1 | 优化建议可一键执行（如 right-sizing、终止闲置资源） | API 测试 |
| O2 | 优化执行后自动追踪节省效果（实际 vs 预估） | 集成测试 |
| O3 | 优化效果报告（月度节省汇总、ROI） | API 测试 |

### 2.5 预算预测增强

| # | 标准 | 验证方式 |
|---|------|----------|
| P1 | 支持线性回归预测（含 R² 置信度） | 单元测试 |
| P2 | 支持季节性预测（识别周/月周期模式） | 单元测试 |
| P3 | 预测包含上下置信区间 | API 测试 |

## 三、API 设计

### 3.1 预算门禁 API

```
Base: /api/v1/finops/gates
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/check` | 执行预算门禁检查 | `GateCheckInput` | `GateCheckResult` |
| GET | `/policies` | 获取门禁策略配置 | query: environment, service | `{ data: GatePolicy[] }` |
| PUT | `/policies/:id` | 更新门禁策略 | `GatePolicyInput` | `{ id, updated }` |
| POST | `/exemptions` | 申请门禁豁免 | `GateExemptionInput` | `{ id, status }` |
| POST | `/exemptions/:id/review` | 审批门禁豁免 | `{ action, comment }` | `{ id, status }` |

**GateCheckInput 结构**:

```typescript
interface GateCheckInput {
  deploymentId: string;
  environment: string;               // production/staging/development
  service: string;
  tenantId: string;
  estimatedCostChange?: number;       // 预估成本变化（美分）
  resourceChanges?: {
    type: 'add' | 'remove' | 'resize';
    resourceType: string;
    currentSpec?: Record<string, unknown>;
    targetSpec: Record<string, unknown>;
  }[];
}

interface GateCheckResult {
  passed: boolean;
  action: 'pass' | 'warn' | 'block' | 'degrade';
  currentBudget: {
    budgetAmount: number;
    currentSpend: number;
    usagePercent: number;
    forecastedSpend: number;
  };
  estimatedImpact: {
    estimatedCostChange: number;
    newUsagePercent: number;
    wouldExceedBudget: boolean;
  };
  warnings: string[];
  recommendations: string[];
}

interface GatePolicyInput {
  environment: string;
  service?: string;                   // 不指定则应用于所有服务
  action: 'warn' | 'block' | 'degrade';
  thresholdPercent: number;           // 预算使用率超过此值时触发
  exemptionRequired: boolean;         // 阻断时是否需要审批豁免
}
```

### 3.2 成本异常检测 API

```
Base: /api/v1/finops/anomalies
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 获取成本异常列表 | query: entity, period, severity | `{ data: CostAnomaly[], total }` |
| GET | `/detect` | 触发成本异常检测 | query: entityType, entityId, period | `{ anomalies: CostAnomaly[] }` |
| GET | `/config` | 获取异常检测配置 | - | `AnomalyDetectionConfig` |
| PUT | `/config` | 更新异常检测配置 | `AnomalyDetectionConfig` | `{ updated }` |

**CostAnomaly 结构**:

```typescript
interface CostAnomaly {
  id: string;
  entityType: string;
  entityId: string;
  detectedAt: Date;
  type: 'spike' | 'step-change' | 'pattern-break';
  severity: 'critical' | 'warning' | 'info';
  anomalyScore: number;               // 0-1, 越高越异常
  details: {
    expectedCost: number;
    actualCost: number;
    deviationPercent: number;
    deviationSigma: number;
    startTime: Date;
    endTime?: Date;
  };
  possibleCause?: string;
}

interface AnomalyDetectionConfig {
  sensitivity: 'low' | 'medium' | 'high';
  sigmaThreshold: number;             // 标准差阈值，默认 2.0
  minimumDataPoints: number;          // 最小数据点数，默认 14
  excludeWeekends: boolean;
}
```

### 3.3 部署成本关联 API

```
Base: /api/v1/finops/deployments/:deploymentId/cost
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/impact` | 获取部署成本影响 | query: hoursBefore, hoursAfter | `DeploymentCostImpact` |
| GET | `/report` | 获取部署成本报告 | - | `DeploymentCostReport` |

**DeploymentCostImpact 结构**:

```typescript
interface DeploymentCostImpact {
  deploymentId: string;
  beforeWindow: {
    startTime: Date;
    endTime: Date;
    avgHourlyCost: number;
  };
  afterWindow: {
    startTime: Date;
    endTime: Date;
    avgHourlyCost: number;
  };
  costChange: {
    absoluteChange: number;
    percentChange: number;
    isSignificant: boolean;             // 是否超过异常阈值
  };
  resourceChanges: {
    resourceType: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    costDelta: number;
  }[];
}

interface DeploymentCostReport {
  deploymentId: string;
  service: string;
  environment: string;
  deployedAt: Date;
  version: string;
  costImpact: DeploymentCostImpact;
  gateCheckResult?: GateCheckResult;
  optimizationSuggestions: string[];
}
```

### 3.4 成本优化闭环 API

```
Base: /api/v1/finops/optimizations
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/:id/execution` | 获取优化执行状态 | - | `OptimizationExecution` |
| POST | `/:id/execute` | 执行优化建议 | `{ dryRun?: boolean }` | `{ executionId, status }` |
| GET | `/savings` | 获取节省效果汇总 | query: period | `{ totalSavings, byCategory, byMonth }` |

## 四、数据库变更

### 4.1 新增表：finops_gate_policies

```sql
CREATE TABLE IF NOT EXISTS finops_gate_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  environment     VARCHAR(50) NOT NULL,
  service         VARCHAR(200),                    -- NULL = 所有服务
  action          VARCHAR(20) NOT NULL DEFAULT 'warn',
  threshold_percent INT NOT NULL DEFAULT 80,
  exemption_required BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, environment, service)
);
CREATE INDEX idx_gate_policies_env ON finops_gate_policies(tenant_id, environment);
```

### 4.2 新增表：finops_gate_checks

```sql
CREATE TABLE IF NOT EXISTS finops_gate_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   VARCHAR(100) NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  service         VARCHAR(200) NOT NULL,
  passed          BOOLEAN NOT NULL,
  action          VARCHAR(20) NOT NULL,
  current_spend   DECIMAL(12,2) NOT NULL,
  budget_amount   DECIMAL(12,2),
  usage_percent   DECIMAL(5,2) NOT NULL,
  estimated_impact DECIMAL(12,2),
  new_usage_percent DECIMAL(5,2),
  warnings        TEXT[],
  recommendations TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gate_checks_deployment ON finops_gate_checks(deployment_id);
CREATE INDEX idx_gate_checks_tenant ON finops_gate_checks(tenant_id, created_at DESC);
```

### 4.3 新增表：finops_gate_exemptions

```sql
CREATE TABLE IF NOT EXISTS finops_gate_exemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gate_check_id   UUID REFERENCES finops_gate_checks(id),
  reason          TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,            -- business-urgency/temporary/one-time
  requested_by    UUID REFERENCES users(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  approval_chain  JSONB DEFAULT '[]',
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gate_exemptions_tenant ON finops_gate_exemptions(tenant_id, status);
```

### 4.4 新增表：finops_cost_anomalies

```sql
CREATE TABLE IF NOT EXISTS finops_cost_anomalies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(200) NOT NULL,
  anomaly_type    VARCHAR(30) NOT NULL,            -- spike/step-change/pattern-break
  severity        VARCHAR(20) NOT NULL,
  anomaly_score   DECIMAL(3,2) NOT NULL,
  expected_cost   DECIMAL(12,2),
  actual_cost     DECIMAL(12,2),
  deviation_percent DECIMAL(5,2),
  deviation_sigma DECIMAL(3,1),
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  possible_cause  TEXT,
  acknowledged    BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_anomalies_tenant ON finops_cost_anomalies(tenant_id, created_at DESC);
CREATE INDEX idx_cost_anomalies_entity ON finops_cost_anomalies(entity_type, entity_id);
CREATE INDEX idx_cost_anomalies_severity ON finops_cost_anomalies(severity, acknowledged);
```

### 4.5 新增表：finops_deployment_costs

```sql
CREATE TABLE IF NOT EXISTS finops_deployment_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deployment_id   VARCHAR(100) NOT NULL,
  service         VARCHAR(200) NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  version         VARCHAR(50),
  deployed_at     TIMESTAMPTZ NOT NULL,
  before_avg_cost DECIMAL(12,2),
  after_avg_cost  DECIMAL(12,2),
  cost_change     DECIMAL(12,2),
  percent_change  DECIMAL(5,2),
  is_significant  BOOLEAN DEFAULT false,
  resource_changes JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deploy_costs_deployment ON finops_deployment_costs(deployment_id);
CREATE INDEX idx_deploy_costs_tenant ON finops_deployment_costs(tenant_id, deployed_at DESC);
```

### 4.6 新增表：finops_optimization_executions

```sql
CREATE TABLE IF NOT EXISTS finops_optimization_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  optimization_id VARCHAR(100) NOT NULL,
  execution_type  VARCHAR(20) NOT NULL,             -- right-sizing/termination/scheduling
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  estimated_savings DECIMAL(12,2),
  actual_savings  DECIMAL(12,2),
  savings_verified_at TIMESTAMPTZ,
  executed_by     UUID REFERENCES users(id),
  execution_details JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_opt_executions_tenant ON finops_optimization_executions(tenant_id, status);
CREATE INDEX idx_opt_executions_optimization ON finops_optimization_executions(optimization_id);
```

### 4.7 迁移脚本

```sql
-- Migration 089: 成本运营增强
-- 预算门禁、成本异常检测、部署成本关联、优化闭环
```

## 五、前端设计

### 5.1 预算门禁配置页面

**路由**: `/finops/gate-policies`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  预算门禁策略                    [添加策略]  │
├─────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 环境: Production                        │  │
│  │ 服务: 全部                              │  │
│  │ 动作: [● 阻断] ○ 告警  ○ 降级          │  │
│  │ 阈值: 预算使用 > [80]%                  │  │
│  │ 豁免审批: [✓] 需要                      │  │
│  │ [保存] [删除]                          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 环境: Staging                           │  │
│  │ 服务: user-service                      │  │
│  │ 动作: [● 告警] ○ 阻断  ○ 降级          │  │
│  │ 阈值: 预算使用 > [90]%                  │  │
│  │ 豁免审批: [ ] 不需要                    │  │
│  │ [保存] [删除]                          │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 5.2 成本异常检测页面

**路由**: `/finops/anomalies`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  成本异常检测                                │
├─────────────────────────────────────────────┤
│  筛选: [全部▼] [Critical▼] [最近 7 天▼]       │
│  灵敏度: [● 中] ○ 高  ○ 低    [检测]        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🔴 Cost Spike - api-gateway            │  │
│  │ 期望: $45/h  实际: $120/h (+167%)      │  │
│  │ 检测到: 10:30  持续: 2h                │  │
│  │ 可能原因: 新部署增加了实例数            │  │
│  │ [确认] [忽略] [详情]                   │  │
│  ├────────────────────────────────────────┤  │
│  │ 🟡 Step Change - database              │  │
│  │ 期望: $200/d  实际: $280/d (+40%)      │  │
│  │ 检测到: 05-03  持续: 2d                │  │
│  │ 可能原因: 存储扩容                      │  │
│  │ [确认] [忽略] [详情]                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  检测设置                                    │
│  σ 阈值: [2.0]   最小数据点: [14]            │
│  排除周末: [✓]                               │
└─────────────────────────────────────────────┘
```

### 5.3 部署成本报告页面

**路由**: `/finops/deployments/:id/cost-report`

**页面结构**:
```
┌─────────────────────────────────────────────┐
│  部署成本报告  deploy-abc123                 │
├─────────────────────────────────────────────┤
│                                              │
│  部署信息                                     │
│  服务: user-service  环境: production        │
│  版本: v2.3.0  时间: 2026-05-05 10:00        │
│                                              │
│  成本影响                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 部署前   │ │ 部署后   │ │ 变化     │     │
│  │ $45.2/h  │ │ $48.7/h  │ │ +$3.5/h │     │
│  │          │ │          │ │  +7.7%  │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  资源变化                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 资源       │ 部署前  │ 部署后  │ 成本差 │  │
│  │ Replicas   │    3    │    3    │    $0 │  │
│  │ CPU/Replica│  2 core │  2 core │    $0 │  │
│  │ Memory/Rep │  4 GB   │  8 GB   │ +$3.5 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  门禁检查结果: ✅ 通过                        │
│  优化建议: 考虑在低峰期缩减到 2 副本          │
└─────────────────────────────────────────────┘
```

### 5.4 前端文件变更

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/GatePolicies/index.tsx` | 新建 | 预算门禁策略配置 |
| `src/pages/CostAnomalies/index.tsx` | 新建 | 成本异常检测页面 |
| `src/pages/DeploymentCostReport/index.tsx` | 新建 | 部署成本报告 |
| `src/pages/OptimizationExecution/index.tsx` | 新建 | 优化执行与效果追踪 |
| `src/api/finops.ts` | 修改 | 新增门禁/异常/部署成本 API |
| `src/components/CostChart/index.tsx` | 新建 | 成本趋势图组件 |
| `src/components/AnomalyBadge/index.tsx` | 新建 | 成本异常标签组件 |

## 六、测试策略

### 6.1 单元测试

| 模块 | 文件 | 测试用例 |
|------|------|----------|
| BudgetGateService | `services/finops/BudgetGateService.ts` | 门禁检查/策略评估/豁免处理（12 cases） |
| CostAnomalyDetector | `services/finops/CostAnomalyDetector.ts` | 突增检测/阶梯变化/模式断裂（10 cases） |
| DeploymentCostAnalyzer | `services/finops/DeploymentCostAnalyzer.ts` | 前后对比/显著性判定（8 cases） |
| BudgetForecaster | `services/finops/BudgetForecaster.ts` | 线性回归/季节性预测/置信区间（8 cases） |

### 6.2 集成测试

| 场景 | 描述 |
|------|------|
| 预算门禁完整流程 | 创建门禁策略 → 触发部署 → 门禁检查 → 阻断/通过 |
| 成本异常检测 | 注入突增数据 → 检测异常 → 验证异常评分和原因 |
| 优化闭环 | 创建优化建议 → 执行 → 验证节省效果追踪 |

### 6.3 E2E 测试

| 场景 | 描述 |
|------|------|
| 预算门禁 E2E | 配置门禁 → 触发部署 → 查看门禁结果 → 申请豁免 → 审批 |
| 成本异常 E2E | 查看异常列表 → 筛选 → 确认异常 → 验证状态更新 |

## 七、非功能性要求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 门禁检查响应 | < 200ms |
| 异常检测计算 | < 2s（30 天数据） |
| 部署成本报告 | < 1s |
| 预算预测计算 | < 500ms |

### 7.2 安全性

| 要求 | 实现 |
|------|------|
| 门禁策略修改权限 | 需 admin 权限 |
| 成本数据隔离 | 所有查询按 tenant_id 过滤 |
| 豁免审批权限 | 豁免审批需 admin 或特定角色 |

### 7.3 可维护性

| 要求 | 实现 |
|------|------|
| 代码覆盖率 | > 80% |
| 异常检测算法 | 可替换/可插拔（支持自定义检测器） |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 预算门禁 | 2 | 2 | 1 |
| 成本异常检测 | 2 | 1.5 | 1 |
| 部署成本关联 | 1.5 | 1.5 | 1 |
| 成本优化闭环 | 1 | 1 | 0.5 |
| 预算预测增强 | 1 | 0.5 | 0.5 |
| **合计** | **7.5** | **6.5** | **4** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05 | 状态: 已验证_
