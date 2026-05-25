# FinOps 成本优化能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P0
> **基于模块**: FinOps（`services/finops/`）
> **目标成熟度**: 7.5/10 → 9/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion FinOps 已有完整的成本管理、预算告警、ROI 分析、成本优化建议功能。
`FinOpsService.ts` 包含成本追踪、预算计算、ROI 分析，`CloudCostCollector.ts` 支持多云成本采集。
但缺少**成本归因分析增强、ROI 分析增强、优化建议闭环**等能力。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| 成本追踪 | ✅ 完整 | `FinOpsService.ts` |
| 预算管理 | ✅ 完整 | `FinOpsService.ts` + `CostBudgetGuardService.ts` |
| ROI 分析 | ✅ 已有 | `FinOpsService.ts` |
| 成本优化建议 | ✅ 已有 | `CostOptimizationService.ts` |
| 云成本采集 | ✅ 已有 | `CloudCostCollector.ts` |
| SaaS 成本追踪 | ✅ 已有 | `SaaSCostTracker.ts` |
| 成本归因分析 | ⚠️ 部分 | 有 CostService，归因深度不足 |
| 优化闭环 | ❌ 缺失 | 建议无执行/验证/反馈 |
| 团队分摊 | ⚠️ 部分 | 有 ChargebackReport，缺少细粒度 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 成本概览 | 多维度成本聚合、趋势、对比 | 9 |
| 归因分析 | 成本根因分析、异常检测 | 9 |
| 优化建议 | 优化建议执行闭环、效果验证 | 9 |
| 预算规划 | 预算预测、情景模拟 | 9 |

---

## 二、功能设计（后端）

### 2.1 成本归因分析增强

从"花了多少钱" → "为什么花这么多钱"：

```typescript
interface CostAttribution {
  period: string;
  totalCost: number;
  attributions: {
    dimension: 'service' | 'team' | 'environment' | 'project' | 'tag';
    breakdown: {
      name: string;
      cost: number;
      percent: number;
      trend: number;             // 环比变化
      drivers: {                 // 费用驱动因素
        factor: string;          // 如：流量增长、实例升级
        impact: number;          // 影响金额
      }[];
    }[];
  }[];
}
```

### 2.2 优化建议闭环

```
OptimizationRecommendation → Execute → Verify → Measure → Report
```

```typescript
interface OptimizationRecommendation {
  id: string;
  category: 'rightsizing' | 'reserved' | 'spot' | 'idle' | 'architecture';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentCost: number;
  estimatedSavings: number;
  savingsPercent: number;
  effortLevel: 'low' | 'medium' | 'high';
  status: 'open' | 'accepted' | 'executing' | 'completed' | 'rejected';
  executedAt?: Date;
  actualSavings?: number;
  verifiedAt?: Date;
  tags: string[];
}
```

### 2.3 预算规划与情景模拟

```typescript
interface BudgetPlan {
  period: string;
  baseBudget: number;
  growthRate: number;
  scenarios: {
    name: string;
    description: string;
    projectedCost: number;
    assumptions: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }[];
}
```

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 优化建议执行记录
ALTER TABLE cost_optimizations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
ALTER TABLE cost_optimizations ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;
ALTER TABLE cost_optimizations ADD COLUMN IF NOT EXISTS actual_savings DECIMAL(10,2);
ALTER TABLE cost_optimizations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE cost_optimizations ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);

-- 成本归因分析缓存
CREATE TABLE cost_attributions (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  period          VARCHAR(20) NOT NULL,
  dimension       VARCHAR(30) NOT NULL,
  breakdown       JSONB NOT NULL,
  generated_at    TIMESTAMP DEFAULT NOW()
);

-- 预算情景模拟
CREATE TABLE budget_scenarios (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  period          VARCHAR(20) NOT NULL,
  base_budget     DECIMAL(10,2) NOT NULL,
  growth_rate     DECIMAL(5,2),
  projected_cost  DECIMAL(10,2),
  assumptions     JSONB DEFAULT '[]',
  risk_level      VARCHAR(10),
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 优化效果追踪
CREATE TABLE optimization_tracking (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  optimization_id VARCHAR(36) NOT NULL,
  metric_name     VARCHAR(100) NOT NULL,
  before_value    DECIMAL(10,2),
  after_value     DECIMAL(10,2),
  improvement     DECIMAL(10,2),
  measured_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attributions_tenant_period ON cost_attributions(tenant_id, period);
CREATE INDEX idx_scenarios_tenant ON budget_scenarios(tenant_id);
CREATE INDEX idx_tracking_tenant ON optimization_tracking(tenant_id);
```

### 3.2 TypeScript 接口

```typescript
interface CostOverview {
  totalCost: number;
  period: string;
  previousPeriodCost: number;
  changePercent: number;
  byProvider: { provider: string; cost: number; percent: number }[];
  byService: { service: string; cost: number; percent: number }[];
  byEnvironment: { env: string; cost: number; percent: number }[];
  budgetUtilization: { budget: number; spent: number; percent: number }[];
  topSpenders: { entity: string; cost: number; trend: number }[];
}

interface CostAnomaly {
  id: string;
  type: 'spike' | 'drop' | 'pattern_change' | 'new_service';
  entity: string;
  entityType: string;
  expectedValue: number;
  actualValue: number;
  deviationPercent: number;
  detectedAt: Date;
  description: string;
}

interface BudgetForecast {
  period: string;
  actualCost: number;
  forecastedCost: number;
  confidence: number;
  drivers: { factor: string; impact: number }[];
}
```

---

## 四、API 路由设计

### 4.1 端点清单

| 方法 | 路径 | 描述 | 权限 | 响应 |
|------|------|------|------|------|
| **成本概览** |
| GET | `/finops/overview` | 成本概览（已有，增强） | `finops:read` | `{ data: CostOverview }` |
| GET | `/finops/cost/trend` | 成本趋势 | `finops:read` | query | `{ data: { period, cost, forecast }[] }` |
| GET | `/finops/cost/forecast` | 成本预测 | `finops:read` | query | `{ data: BudgetForecast }` |
| GET | `/finops/cost/chargeback` | 团队分摊报告 | `finops:read` | query | `{ data: ChargebackReport }` |
| **归因分析** |
| GET | `/finops/attribution` | 成本归因分析 | `finops:read` | query | `{ data: CostAttribution }` |
| GET | `/finops/anomalies` | 费用异常检测 | `finops:read` | query | `{ data: CostAnomaly[], total }` |
| POST | `/finops/anomalies/analyze` | 触发异常检测 | `finops:write` | - | `{ data: CostAnomaly[] }` |
| **优化建议** |
| GET | `/finops/optimizations` | 优化建议列表 | `finops:read` | query | `{ data: OptimizationRecommendation[], total }` |
| POST | `/finops/optimizations` | 创建优化建议 | `finops:write` | `OptimizationCreate` | `{ data: OptimizationRecommendation }` |
| POST | `/finops/optimizations/:id/execute` | 执行优化 | `finops:execute` | - | `{ data: { status } }` |
| POST | `/finops/optimizations/:id/verify` | 验证效果 | `finops:write` | `{ actualSavings }` | `{ data: { verified: true } }` |
| POST | `/finops/optimizations/:id/reject` | 拒绝建议 | `finops:write` | `{ reason }` | `{ data: { status } }` |
| GET | `/finops/optimizations/stats` | 优化统计 | `finops:read` | - | `{ data: { total, open, executed, totalSavings, actualSavings } }` |
| **预算规划** |
| GET | `/finops/budgets` | 预算列表（已有） | `finops:read` | query | `{ data: BudgetRecord[], total }` |
| POST | `/finops/budgets/scenarios` | 创建情景模拟 | `finops:write` | `BudgetScenarioCreate` | `{ data: BudgetScenario }` |
| GET | `/finops/budgets/scenarios` | 情景列表 | `finops:read` | query | `{ data: BudgetScenario[] }` |
| DELETE | `/finops/budgets/scenarios/:id` | 删除情景 | `finops:admin` | - | `{ success: true }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 成本概览 | `/governance/finops` | 治理 | 成本聚合/趋势/对比/分摊 |
| 归因分析 | `/governance/finops/attribution` | 治理 | 成本驱动因素/异常检测 |
| 优化建议 | `/governance/finops/optimizations` | 治理 | 优化列表/执行/验证 |
| 预算规划 | `/governance/finops/budget-planning` | 治理 | 预算/预测/情景模拟 |

### 5.2 成本概览页

**文件**: `orion-frontend/src/pages/FinOps/Overview.tsx`

```tsx
// 第一行: 总成本 | 环比变化 | 预算使用率 | 预测费用
<Row gutter={spacing.md}>
  <Col span={6}>
    <Card title="本月成本" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={overview.totalCost} prefix="$" precision={2}
        valueStyle={{ color: overview.changePercent > 10 ? colors.error[500] : colors.neutral[900] }} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        环比 {overview.changePercent > 0 ? '+' : ''}{overview.changePercent.toFixed(1)}%
      </Text>
    </Card>
  </Col>
  <Col span={6}>
    <Card title="预算使用率" style={{ borderRadius: componentRadius.card }}>
      {overview.budgetUtilization.map(b => (
        <Progress percent={b.percent}
          strokeColor={b.percent > 90 ? colors.error[500] : b.percent > 75 ? colors.warning[500] : colors.success[500]}
          size="small" />
      ))}
    </Card>
  </Col>
  <Col span={6}>
    <Card title="预测费用" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={forecast.forecastedCost} prefix="$" precision={2} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        置信度 {(forecast.confidence * 100).toFixed(0)}%
      </Text>
    </Card>
  </Col>
  <Col span={6}>
    <Card title="Top 花费实体" style={{ borderRadius: componentRadius.card }}>
      {overview.topSpenders.slice(0, 5).map(s => (
        <div key={s.entity} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text ellipsis style={{ maxWidth: 120 }}>{s.entity}</Text>
          <Text>${s.cost.toFixed(2)}</Text>
        </div>
      ))}
    </Card>
  </Col>
</Row>

// 第二行: 成本趋势折线图 + 按服务分布饼图
```

### 5.3 优化建议页

**文件**: `orion-frontend/src/pages/FinOps/Optimizations.tsx`

```tsx
// 优化建议状态流转
const handleExecute = async (id: string) => {
  setExecuting(id);
  try {
    await executeOptimization(id);
    message.success('优化已开始执行');
    loadOptimizations();
  } catch {
    message.error('执行失败');
  } finally {
    setExecuting(null);
  }
};

const handleVerify = async (id: string) => {
  Modal.confirm({
    title: '验证优化效果',
    content: (
      <Form form={verifyForm}>
        <Form.Item name="actualSavings" label="实际节省金额">
          <InputNumber prefix="$" style={{ width: 200 }} />
        </Form.Item>
      </Form>
    ),
    onOk: async () => {
      const values = await verifyForm.validateFields();
      try {
        await verifyOptimization(id, values);
        message.success('效果已验证');
        loadOptimizations();
      } catch {
        message.error('验证失败');
      }
    },
  });
};

// 优化建议统计卡片
<Row gutter={spacing.md}>
  <Col span={4}><Statistic title="总建议数" value={stats.total} /></Col>
  <Col span={4}><Statistic title="待执行" value={stats.open} valueStyle={{ color: colors.primary[500] }} /></Col>
  <Col span={4}><Statistic title="已执行" value={stats.executed} valueStyle={{ color: colors.success[500] }} /></Col>
  <Col span={4}><Statistic title="预估节省" value={stats.totalSavings} prefix="$" /></Col>
  <Col span={4}><Statistic title="实际节省" value={stats.actualSavings} prefix="$" valueStyle={{ color: colors.success[500] }} /></Col>
</Row>
```

### 5.4 归因分析页

**文件**: `orion-frontend/src/pages/FinOps/Attribution.tsx`

```tsx
// 归因分析：按维度分组展示
<Select value={attributionDimension} onChange={setAttributionDimension} style={{ width: 140 }}>
  <Option value="service">按服务</Option>
  <Option value="team">按团队</Option>
  <Option value="environment">按环境</Option>
  <Option value="project">按项目</Option>
</Select>

// 费用驱动因素表格
<Table dataSource={attribution.breakdown} rowKey="name">
  <Column title="名称" dataIndex="name" />
  <Column title="费用" dataIndex="cost" render={(v: number) => `$${v.toFixed(2)}`} />
  <Column title="占比" dataIndex="percent" render={(v: number) => `${v.toFixed(1)}%`} />
  <Column title="环比" dataIndex="trend" render={(v: number) => (
    <span style={{ color: v > 0 ? colors.error[500] : colors.success[500] }}>
      {v > 0 ? '+' : ''}{v.toFixed(1)}%
    </span>
  )} />
  <Column title="驱动因素" dataIndex="drivers" render={(v: any[]) =>
    v?.map(d => <Tag key={d.factor}>{d.factor}: +${d.impact.toFixed(2)}</Tag>)
  } />
</Table>
```

---

## 六、权限模型

| 角色 | 查看成本 | 查看归因 | 执行优化 | 管理预算 |
|------|:--------:|:--------:|:--------:|:--------:|
| Viewer | ✅ | - | - | - |
| Member | ✅ | ✅ | - | - |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'finops', action: 'read' | 'write' | 'execute' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| CloudCostCollector | 多云成本采集 | ✅ 已有 |
| Prometheus | 运行时指标采集 | ✅ 已有 |
| AI Review | 成本异常 AI 分析 | ⚠️ 可选增强 |
| 告警系统 | 预算超支告警 | ✅ 已有 |
| 租户系统 | 成本按租户分摊 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 成本上涨 | `colors.error[500]` |
| 成本下降 | `colors.success[500]` |
| 预算正常 | `colors.success[500]` |
| 预算接近 | `colors.warning[500]` |
| 预算超支 | `colors.error[500]` |
| 优化优先级高 | `colors.error[500]` |
| 优化优先级中 | `colors.warning[500]` |
| 优化优先级低 | `colors.neutral[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 查看成本概览 | 显示总成本、环比、预算使用率、预测费用 |
| E2 | 按维度查看成本归因 | 正确展示各维度费用分布和驱动因素 |
| E3 | 费用异常检测 | 检测到异常费用波动并展示 |
| E4 | 查看优化建议并执行 | 执行后状态变为 executing |
| E5 | 验证优化效果 | 填写实际节省金额，标记为已完成 |
| E6 | 创建预算情景模拟 | 保存情景，展示不同情景下的预测费用 |
| E7 | 团队分摊报告 | 显示各团队/项目的成本分摊 |
| E8 | 成本趋势预测 | 显示历史趋势和预测值，含置信度 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 成本概览加载时间 | < 1.5s (p95) |
| 归因分析生成时间 | < 3s |
| 异常检测时间 | < 5s |
| 成本预测时间 | < 3s |
| 前端单元测试覆盖率 | > 80% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
