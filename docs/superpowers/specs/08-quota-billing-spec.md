# 配额与计费（Quota & Billing）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P0
> **基于模块**: 租户管理（`services/tenant/`）
> **目标成熟度**: 7/10 → 9/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion 租户系统功能完整，已有 `TenantQuotaService` 管理配额（Pipeline、Runner、CPU、内存、存储等），
`tenant.ts` 前端 484 行实现租户管理页面。
但缺少**计费账单、用量计量、配额告警闭环**等 SaaS 化运营能力。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| 租户配额 | ✅ 完整 | `TenantQuotaService.ts` |
| 命名空间池 | ✅ 完整 | `NamespacePoolService.ts` |
| 配额仓库 | ✅ 完整 | `TenantQuotaRepository.ts` |
| 租户管理页面 | ✅ 完整 | `orion-frontend/src/pages/TenantManagement/` |
| 计费账单 | ❌ 缺失 | 无账单生成/查询 |
| 用量计量 | ⚠️ 部分 | 有 usage map，无持久化/报表 |
| 配额告警 | ⚠️ 部分 | 有 alertThreshold，无闭环 |
| 套餐管理 | ❌ 缺失 | 无套餐定义/升级 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 配额管理 | 配额配置/调整/监控/告警闭环 | 9 |
| 用量计量 | 资源使用量持久化/报表/趋势 | 9 |
| 账单列表 | 账单生成/查询/导出 | 9 |
| 费用分析 | 费用构成/趋势/对比/预测 | 9 |

---

## 二、功能设计（后端）

### 2.1 套餐管理

```typescript
interface QuotaPlan {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'basic' | 'professional' | 'enterprise';
  monthlyPrice: number;
  quotas: {
    maxPipelines: number;
    maxPipelineRunsPerDay: number;
    maxConcurrentRuns: number;
    maxRunners: number;
    maxCpuCores: number;
    maxMemoryGb: number;
    maxStorageGb: number;
    maxTeamMembers: number;
    apiRateLimit: number;
  };
  features: string[];
  isActive: boolean;
  createdAt: Date;
}
```

### 2.2 用量计量

```typescript
interface UsageRecord {
  id: string;
  tenantId: string;
  resourceType: string;       // pipeline_run/compute/storage/api_call
  resourceKey: string;
  quantity: number;
  unit: string;               // minutes/GB/requests
  period: string;             // 2026-05
  measuredAt: Date;
  metadata: Record<string, any>;
}

interface UsageReport {
  tenantId: string;
  period: string;
  totalCost: number;
  byResource: {
    resourceType: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  quotaUtilization: {
    resourceType: string;
    used: number;
    limit: number;
    percent: number;
  }[];
}
```

### 2.3 计费账单

```typescript
interface BillingRecord {
  id: string;
  tenantId: string;
  billingNumber: string;          // BILL-00001
  period: string;                 // 2026-05
  planId: string;
  planCost: number;               // 套餐费用
  overageCost: number;            // 超量费用
  discount: number;
  totalCost: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
  items: BillingItem[];
  createdAt: Date;
}

interface BillingItem {
  description: string;
  resourceType: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
```

### 2.4 配额告警闭环

```
Usage > Threshold → Alert → Notify → Action → Resolve
```

```typescript
interface QuotaAlert {
  id: string;
  tenantId: string;
  resourceType: string;
  currentUsage: number;
  quotaLimit: number;
  thresholdPercent: number;
  status: 'triggered' | 'acknowledged' | 'resolved' | 'escalated';
  notifiedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  actionTaken?: string;
}
```

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 套餐表
CREATE TABLE quota_plans (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  tier            VARCHAR(20) NOT NULL,
  monthly_price   DECIMAL(10,2) NOT NULL,
  quotas          JSONB NOT NULL,
  features        JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 租户套餐关联
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id VARCHAR(36);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;

-- 用量计量记录表
CREATE TABLE usage_metering (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  resource_key    VARCHAR(200),
  quantity        DECIMAL(10,2) NOT NULL,
  unit            VARCHAR(20) NOT NULL,
  period          VARCHAR(20) NOT NULL,
  measured_at     TIMESTAMP DEFAULT NOW(),
  metadata        JSONB DEFAULT '{}'
);

-- 计费账单表
CREATE TABLE billing_records (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  billing_number  VARCHAR(20) NOT NULL,
  period          VARCHAR(20) NOT NULL,
  plan_id         VARCHAR(36),
  plan_cost       DECIMAL(10,2) DEFAULT 0,
  overage_cost     DECIMAL(10,2) DEFAULT 0,
  discount        DECIMAL(10,2) DEFAULT 0,
  total_cost      DECIMAL(10,2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  items           JSONB NOT NULL,
  issued_at       TIMESTAMP,
  due_date        TIMESTAMP,
  paid_at         TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, billing_number)
);

-- 配额告警表
CREATE TABLE quota_alerts (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  resource_type   VARCHAR(50) NOT NULL,
  current_usage   DECIMAL(10,2) NOT NULL,
  quota_limit     DECIMAL(10,2) NOT NULL,
  threshold_percent INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'triggered',
  notified_at     TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at     TIMESTAMP,
  action_taken    TEXT
);

-- 定价配置表
CREATE TABLE pricing_config (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type   VARCHAR(50) NOT NULL UNIQUE,
  unit            VARCHAR(20) NOT NULL,
  unit_price      DECIMAL(10,4) NOT NULL,
  free_quota      DECIMAL(10,2) DEFAULT 0,
  overage_price   DECIMAL(10,4),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metering_tenant_period ON usage_metering(tenant_id, period);
CREATE INDEX idx_billing_tenant ON billing_records(tenant_id);
CREATE INDEX idx_billing_status ON billing_records(status);
CREATE INDEX idx_alerts_tenant ON quota_alerts(tenant_id);
CREATE INDEX idx_alerts_status ON quota_alerts(status);
```

### 3.2 TypeScript 接口

```typescript
interface TenantBilling {
  tenantId: string;
  currentPlan?: QuotaPlan;
  currentUsage: UsageReport;
  recentBills: BillingRecord[];
  activeAlerts: QuotaAlert[];
  nextBillingDate?: Date;
}

interface BillingSummary {
  totalBilled: number;
  paidAmount: number;
  overdueAmount: number;
  pendingAmount: number;
  billsByStatus: Record<string, number>;
  trend: { period: string; amount: number }[];
}

interface QuotaUtilizationReport {
  tenantId: string;
  period: string;
  resources: {
    resourceType: string;
    used: number;
    limit: number;
    percent: number;
    unit: string;
    status: 'normal' | 'warning' | 'critical' | 'exceeded';
  }[];
  overallHealth: 'healthy' | 'warning' | 'critical';
}
```

---

## 四、API 路由设计

### 4.1 端点清单（基于已有 tenant-routes 增强）

| 方法 | 路径 | 描述 | 权限 | 响应 |
|------|------|------|------|------|
| **配额管理** |
| GET | `/tenants/:id/quota` | 获取配额配置 | `tenant:read` | `{ data: TenantQuota }` |
| PUT | `/tenants/:id/quota` | 更新配额 | `tenant:admin` | `TenantQuotaUpdate` | `{ data: TenantQuota }` |
| GET | `/tenants/:id/quota/utilization` | 配额使用率 | `tenant:read` | `{ data: QuotaUtilizationReport }` |
| GET | `/tenants/:id/quota/alerts` | 配额告警列表 | `tenant:read` | `{ data: QuotaAlert[] }` |
| POST | `/tenants/:id/quota/alerts/:alertId/acknowledge` | 确认告警 | `tenant:write` | `{ data: { status } }` |
| POST | `/tenants/:id/quota/alerts/:alertId/resolve` | 解决告警 | `tenant:write` | `{ data: { status } }` |
| **套餐管理** |
| GET | `/quota-plans` | 套餐列表 | `tenant:read` | `{ data: QuotaPlan[] }` |
| POST | `/quota-plans` | 创建套餐 | `tenant:admin` | `QuotaPlanCreate` | `{ data: QuotaPlan }` |
| PUT | `/quota-plans/:id` | 更新套餐 | `tenant:admin` | `QuotaPlanUpdate` | `{ data: QuotaPlan }` |
| POST | `/tenants/:id/plan` | 切换套餐 | `tenant:admin` | `{ planId, effectiveDate }` | `{ data: { success } }` |
| **用量计量** |
| GET | `/tenants/:id/usage` | 用量查询 | `tenant:read` | query | `{ data: UsageRecord[], total }` |
| GET | `/tenants/:id/usage/report` | 用量报表 | `tenant:read` | query | `{ data: UsageReport }` |
| GET | `/tenants/:id/usage/trend` | 用量趋势 | `tenant:read` | query | `{ data: { period, quantity }[] }` |
| **计费账单** |
| GET | `/tenants/:id/billing` | 账单列表 | `tenant:read` | query | `{ data: BillingRecord[], total }` |
| GET | `/tenants/:id/billing/:billId` | 账单详情 | `tenant:read` | - | `{ data: BillingRecord }` |
| POST | `/tenants/:id/billing/generate` | 生成账单 | `billing:write` | query | `{ data: BillingRecord }` |
| POST | `/tenants/:id/billing/:billId/pay` | 标记支付 | `billing:write` | - | `{ data: { status } }` |
| GET | `/tenants/:id/billing/summary` | 账单摘要 | `tenant:read` | query | `{ data: BillingSummary }` |
| GET | `/tenants/:id/billing/export` | 导出账单 | `tenant:read` | query | CSV/PDF |
| **定价管理** |
| GET | `/pricing` | 定价列表 | `tenant:read` | `{ data: PricingConfig[] }` |
| PUT | `/pricing/:resourceType` | 更新定价 | `billing:admin` | `{ unitPrice, overagePrice }` | `{ data: PricingConfig }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 配额管理 | `/governance/tenant-management` → 租户详情 → 配额 Tab | 治理 | 配额查看/调整/使用率/告警 |
| 用量计量 | `/governance/usage-metering` | 治理 | 用量查询/报表/趋势 |
| 账单列表 | `/governance/billing` | 治理 | 账单列表/详情/支付/导出 |
| 费用分析 | `/governance/billing/analysis` | 治理 | 费用构成/趋势/对比 |

### 5.2 配额管理页（租户详情页内 Tab）

**文件**: `orion-frontend/src/pages/TenantManagement/TenantDetail.tsx` → QuotaTab 组件

```tsx
// 配额使用率仪表盘
<Row gutter={spacing.md}>
  {utilization.resources.map(r => (
    <Col span={8} key={r.resourceType}>
      <Card title={r.resourceType} size="small" style={{ borderRadius: componentRadius.card }}>
        <Progress
          percent={r.percent}
          strokeColor={
            r.status === 'exceeded' ? colors.error[500] :
            r.status === 'critical' ? colors.error[500] :
            r.status === 'warning' ? colors.warning[500] :
            colors.success[500]
          }
          format={() => `${r.used.toFixed(1)} / ${r.limit} ${r.unit}`}
        />
        <Tag color={utilizationStatusColor[r.status]}>{r.status}</Tag>
      </Card>
    </Col>
  ))}
</Row>

// 配额告警列表
<Table dataSource={alerts} rowKey="id">
  <Column title="资源类型" dataIndex="resourceType" />
  <Column title="当前用量" dataIndex="currentUsage" />
  <Column title="配额上限" dataIndex="quotaLimit" />
  <Column title="触发阈值" dataIndex="thresholdPercent" render={(v: number) => `${v}%`} />
  <Column title="状态" dataIndex="status"
    render={(v: string) => <Tag color={alertStatusColor[v]}>{v}</Tag>} />
  <Column title="触发时间" dataIndex="notifiedAt" render={(v: Date) => new Date(v).toLocaleString()} />
  <Column title="操作" render={(_: any, r: QuotaAlert) => (
    <Space>
      {r.status === 'triggered' && (
        <Button type="link" size="small" onClick={() => handleAcknowledge(r.id)}>确认</Button>
      )}
      {(r.status === 'triggered' || r.status === 'acknowledged') && (
        <Button type="link" size="small" onClick={() => handleResolve(r.id)}>解决</Button>
      )}
    </Space>
  )} />
</Table>
```

### 5.3 账单列表页

**文件**: `orion-frontend/src/pages/Billing/index.tsx`

```tsx
// 账单摘要卡片
<Row gutter={spacing.md}>
  <Col span={6}>
    <Statistic title="已支付" value={summary.paidAmount} prefix="$" precision={2}
      valueStyle={{ color: colors.success[500] }} />
  </Col>
  <Col span={6}>
    <Statistic title="待支付" value={summary.pendingAmount} prefix="$" precision={2}
      valueStyle={{ color: colors.warning[500] }} />
  </Col>
  <Col span={6}>
    <Statistic title="已逾期" value={summary.overdueAmount} prefix="$" precision={2}
      valueStyle={{ color: colors.error[500] }} />
  </Col>
  <Col span={6}>
    <Statistic title="总账单数" value={summary.totalBilled} />
  </Col>
</Row>

// 账单列表
<Table dataSource={bills} rowKey="id" loading={loading}>
  <Column title="账单号" dataIndex="billingNumber"
    render={(v: string, r: BillingRecord) => (
      <a onClick={() => navigate(`/governance/billing/${r.id}`)}>{v}</a>
    )} />
  <Column title="账期" dataIndex="period" />
  <Column title="套餐费用" dataIndex="planCost" render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="超量费用" dataIndex="overageCost" render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="总金额" dataIndex="totalCost" render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="状态" dataIndex="status"
    render={(v: string) => <Tag color={billingStatusColor[v]}>{v}</Tag>} />
  <Column title="到期日" dataIndex="dueDate" render={(v: Date) => new Date(v).toLocaleDateString()} />
  <Column title="操作" render={(_: any, r: BillingRecord) => (
    <Space>
      <Button type="link" size="small" onClick={() => navigate(`/governance/billing/${r.id}`)}>详情</Button>
      {r.status === 'issued' && (
        <Button type="link" size="small" onClick={() => handlePay(r.id)}>标记支付</Button>
      )}
      <Button type="link" size="small" onClick={() => handleExport(r.id)}>导出</Button>
    </Space>
  )} />
</Table>
```

### 5.4 费用分析页

**文件**: `orion-frontend/src/pages/Billing/Analysis.tsx`

```tsx
// 费用构成饼图 + 趋势折线图
// 套餐费用 vs 超量费用 占比
// 各资源类型的用量费用分布

// 费用对比：本月 vs 上月
<Descriptions title="费用对比" bordered>
  <Descriptions.Item label="本月费用">${currentMonth}</Descriptions.Item>
  <Descriptions.Item label="上月费用">${lastMonth}</Descriptions.Item>
  <Descriptions.Item label="环比变化">
    <span style={{ color: changePercent > 0 ? colors.error[500] : colors.success[500] }}>
      {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
    </span>
  </Descriptions.Item>
</Descriptions>

// 用量趋势
// 横轴: 月份，纵轴: 用量，多线: 不同资源类型
```

---

## 六、权限模型

| 角色 | 查看配额 | 调整配额 | 查看账单 | 管理定价 | 管理套餐 |
|------|:--------:|:--------:|:--------:|:--------:|:--------:|
| Viewer | ✅ | - | - | - | - |
| Member | ✅ | - | ✅ (本租户) | - | - |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'quota' | 'billing', action: 'read' | 'write' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| TenantQuotaService | 配额检查/告警 | ✅ 已有 |
| 通知系统 | 配额告警通知 | ✅ 已有 |
| FinOps CostService | 成本数据参考 | ✅ 已有 |
| 审批流 | 套餐升级审批 | ✅ 已有 |
| 邮件服务 | 账单通知 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 配额正常 | `colors.success[500]` |
| 配额警告 | `colors.warning[500]` |
| 配额超限 | `colors.error[500]` |
| 账单已支付 | `colors.success[500]` |
| 账单待支付 | `colors.warning[500]` |
| 账单已逾期 | `colors.error[500]` |
| 费用上涨 | `colors.error[500]` |
| 费用下降 | `colors.success[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 查看租户配额使用率 | 显示各资源类型用量和百分比，颜色区分状态 |
| E2 | 调整租户配额 | 配额更新成功，使用率重新计算 |
| E3 | 配额超限告警 | 触发告警，显示在告警列表中 |
| E4 | 确认/解决告警 | 告警状态正确更新 |
| E5 | 切换租户套餐 | 套餐变更成功，新配额生效 |
| E6 | 查看用量报表 | 显示各资源类型的用量和费用 |
| E7 | 查看账单列表并支付 | 账单状态从 issued 变为 paid |
| E8 | 导出账单 | 下载 CSV/PDF 格式的账单文件 |
| E9 | 费用分析对比 | 显示本月/上月费用对比和趋势 |
| E10 | 生成月度账单 | 基于用量和定价自动生成账单 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 配额使用率加载时间 | < 1s (p95) |
| 账单生成时间 | < 3s |
| 用量报表加载时间 | < 2s |
| 账单导出时间 | < 5s |
| 前端单元测试覆盖率 | > 80% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
