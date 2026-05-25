# 变更影响分析（Change Impact Analysis）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P2
> **基于模块**: AI Review + 数据血缘
> **目标成熟度**: 7/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion 已有 AI Review（代码评审）和 DataLineageService（数据血缘），
但变更影响分析停留在"代码变更 → 受影响服务"的简单映射，
**缺少代码变更 → 运行态影响的深度关联**：变更对 SLO 的影响、对运行时指标的预测、变更后的实时监控联动。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| AI Review | ✅ 完整 | `AIReviewService.ts` |
| 变更智能 | ✅ 完整 | `ChangeIntelligenceService.ts` |
| 数据血缘 | ✅ 完整 | `DataLineageService.ts` |
| 风险评估 | ✅ 完整 | `RiskAssessmentService.ts` |
| 运行态关联 | ❌ 缺失 | 无变更 → 运行时指标映射 |
| SLO 影响 | ❌ 缺失 | 无变更对 SLO 的量化影响 |
| 变更趋势 | ❌ 缺失 | 无变更频率/风险趋势 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 变更列表 | 变更聚合、风险等级、影响范围过滤 | 8.5 |
| 影响分析 | 代码变更 → 运行态 → SLO 的完整影响链 | 8.5 |
| SLO 面板 | 变更对 SLO 的量化影响，阈值告警 | 8.5 |
| 风险评估 | 变更前后风险对比，趋势分析 | 8.5 |

---

## 二、功能设计（后端）

### 2.1 运行态影响关联

将代码变更与运行时指标关联：
- 变更文件 → 受影响服务 → 服务 SLO
- 变更类型（API/DB/Config） → 风险分类
- 变更时间 → 运行时指标变化（变更前后对比）

```typescript
interface RuntimeImpact {
  changeId: string;
  affectedServices: {
    serviceName: string;
    tier: ServiceTier;
    impactedSLOs: {
      sloName: string;
      currentValue: number;
      predictedValue: number;
      threshold: number;
      riskLevel: 'low' | 'medium' | 'high';
    }[];
    metricChanges: {
      metric: string;
      beforeValue: number;
      afterValue: number;
      changePercent: number;
    }[];
  }[];
}
```

### 2.2 SLO 影响量化

```typescript
interface SLOImpact {
  sloId: string;
  sloName: string;
  currentCompliance: number;       // 当前合规率
  predictedCompliance: number;     // 变更后预测合规率
  riskThreshold: number;           // 风险阈值
  wouldBreached: boolean;          // 是否会违反 SLO
  contributingChanges: string[];   // 贡献此影响的变更 ID
  recommendation: string;
}
```

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 变更影响分析增强表
ALTER TABLE change_intelligence_reports ADD COLUMN IF NOT EXISTS runtime_impact JSONB DEFAULT '[]';
ALTER TABLE change_intelligence_reports ADD COLUMN IF NOT EXISTS slo_impact JSONB DEFAULT '[]';
ALTER TABLE change_intelligence_reports ADD COLUMN IF NOT EXISTS pre_change_risk DECIMAL(5,2);
ALTER TABLE change_intelligence_reports ADD COLUMN IF NOT EXISTS post_change_risk DECIMAL(5,2);

-- 变更运行时指标快照
CREATE TABLE change_runtime_snapshots (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id       VARCHAR(36) NOT NULL,
  service_name    VARCHAR(100) NOT NULL,
  snapshot_type   VARCHAR(10) NOT NULL,         -- before/after
  metrics         JSONB NOT NULL,               -- { latency, error_rate, throughput, ... }
  captured_at     TIMESTAMP DEFAULT NOW()
);

-- SLO 影响记录
CREATE TABLE change_slo_impacts (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id       VARCHAR(36) NOT NULL,
  slo_id          VARCHAR(36) NOT NULL,
  slo_name        VARCHAR(100) NOT NULL,
  current_compliance DECIMAL(5,2),
  predicted_compliance DECIMAL(5,2),
  risk_threshold  DECIMAL(5,2),
  would_breached  BOOLEAN DEFAULT false,
  recommendation  TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshots_change ON change_runtime_snapshots(change_id);
CREATE INDEX idx_slo_impacts_change ON change_slo_impacts(change_id);
```

### 3.2 TypeScript 接口

```typescript
interface ChangeImpactAnalysis {
  changeId: string;
  prId: string;
  repoId: string;
  title: string;
  author: string;
  createdAt: Date;
  riskLevel: RiskLevel;
  riskScore: number;
  affectedServices: AffectedService[];
  runtimeImpact: RuntimeImpact;
  sloImpacts: SLOImpact[];
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  historicalMatches: HistoricalMatch[];
}

interface ChangeListFilters {
  repoId?: string;
  riskLevel?: RiskLevel;
  dateFrom?: Date;
  dateTo?: Date;
  affectedService?: string;
  sloBreach?: boolean;
}
```

---

## 四、API 路由设计

### 4.1 端点清单（基于已有 change-intelligence-routes 增强）

| 方法 | 路径 | 描述 | 权限 | 响应 |
|------|------|------|------|------|
| **变更列表** |
| GET | `/change-intelligence` | 变更列表（已有，增强） | `change:read` | `{ data: [], total }` |
| GET | `/change-intelligence/:id` | 变更详情（已有，增强） | `change:read` | `{ data: ChangeImpactAnalysis }` |
| **影响分析增强** |
| GET | `/change-intelligence/:id/runtime-impact` | 运行态影响 | `change:read` | `{ data: RuntimeImpact }` |
| GET | `/change-intelligence/:id/slo-impact` | SLO 影响 | `change:read` | `{ data: SLOImpact[] }` |
| GET | `/change-intelligence/:id/blast-radius` | 爆炸半径（已有，增强） | `change:read` | `{ data: BlastRadiusResult }` |
| **风险评估** |
| POST | `/change-intelligence/:id/reassess` | 重新评估风险 | `change:write` | `{ data: ChangeImpactAnalysis }` |
| GET | `/change-intelligence/:id/risk-trend` | 风险趋势 | `change:read` | `{ data: { trend, history } }` |
| GET | `/change-intelligence/summary` | 变更统计摘要 | `change:read` | query | `{ data: ChangeSummary }` |
| **SLO 面板** |
| GET | `/change-intelligence/slo-dashboard` | SLO 影响面板 | `change:read` | query | `{ data: { sloList, breachCount, atRiskCount } }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 变更列表 | `/ops/change-intelligence` | 可观测性 | 列表/过滤/风险等级排序 |
| 影响分析 | `/ops/change-intelligence/:id` | 可观测性 | 完整影响链展示 |
| SLO 面板 | `/ops/change-intelligence/slo-dashboard` | 可观测性 | SLO 合规/预测/告警 |
| 风险评估 | `/ops/change-intelligence/:id/risk` | 可观测性 | 风险对比/趋势 |

### 5.2 变更列表页

**文件**: `orion-frontend/src/pages/ChangeIntelligence/index.tsx`

```tsx
// 变更列表增强版
const riskLevelColor: Record<string, string> = {
  low: colors.success[500],
  medium: colors.warning[500],
  high: colors.error[500],
  critical: '#8B0000',
};

// 过滤条件增强
<Select value={sloFilter} onChange={setSloFilter} style={{ width: 160 }}>
  <Option value="all">全部变更</Option>
  <Option value="breach">SLO 风险</Option>
  <Option value="at-risk">接近阈值</Option>
</Select>
```

### 5.3 影响分析页

**文件**: `orion-frontend/src/pages/ChangeIntelligence/Detail.tsx`

```tsx
// Tab 结构: 基本信息 | 影响分析 | 运行态影响 | SLO 面板 | 历史对比

// 运行态影响展示
<Descriptions title="运行态影响" bordered>
  <Descriptions.Item label="影响服务数">{runtimeImpact.affectedServices.length}</Descriptions.Item>
  <Descriptions.Item label="SLO 风险数">
    {runtimeImpact.affectedServices.reduce((sum, s) => sum + s.impactedSLOs.length, 0)}
  </Descriptions.Item>
</Descriptions>

// 指标变化对比
<Table dataSource={metricChanges} rowKey="metric">
  <Column title="指标" dataIndex="metric" />
  <Column title="变更前" dataIndex="beforeValue" />
  <Column title="变更后" dataIndex="afterValue"
    render={(v: number, r: any) => (
      <span style={{ color: r.changePercent > 10 ? colors.error[500] : colors.success[500] }}>
        {v} ({r.changePercent > 0 ? '+' : ''}{r.changePercent.toFixed(1)}%)
      </span>
    )} />
</Table>
```

### 5.4 SLO 面板

**文件**: `orion-frontend/src/pages/ChangeIntelligence/SLODashboard.tsx`

```tsx
// SLO 合规看板
<Row gutter={spacing.md}>
  <Col span={6}>
    <Card title="SLO 合规数" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={sloStats.compliantCount} suffix="/ 总 SLO 数"
        valueStyle={{ color: colors.success[500] }} />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="SLO 违反数" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={sloStats.breachCount}
        valueStyle={{ color: colors.error[500] }} />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="接近阈值" style={{ borderRadius: componentRadius.card }}>
      <Statistic value={sloStats.atRiskCount}
        valueStyle={{ color: colors.warning[500] }} />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="当前最高风险变更" style={{ borderRadius: componentRadius.card }}>
      <Text strong style={{ color: colors.error[500] }}>{highestRiskChange?.title}</Text>
    </Card>
  </Col>
</Row>

// SLO 详情表格
<Table dataSource={sloList} rowKey="id">
  <Column title="SLO 名称" dataIndex="sloName" />
  <Column title="当前合规率" dataIndex="currentCompliance"
    render={(v: number) => `${v}%`} />
  <Column title="预测合规率" dataIndex="predictedCompliance"
    render={(v: number, r: SLOImpact) => (
      <span style={{ color: v < r.riskThreshold ? colors.error[500] : colors.success[500] }}>
        {v}% {v < r.riskThreshold && <WarningOutlined />}
      </span>
    )} />
  <Column title="风险阈值" dataIndex="riskThreshold" render={(v: number) => `${v}%`} />
  <Column title="是否违反" dataIndex="wouldBreached"
    render={(v: boolean) => v ? <Tag color={colors.error[500]}>违反</Tag> : <Tag color={colors.success[500]}>合规</Tag>} />
  <Column title="关联变更数" dataIndex="contributingChanges" render={(v: string[]) => v.length} />
</Table>
```

---

## 六、权限模型

| 角色 | 查看变更 | 查看运行态 | 重新评估 | 查看 SLO |
|------|:--------:|:----------:|:--------:|:--------:|
| Viewer | ✅ | ✅ | - | ✅ |
| Member | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'change', action: 'read' | 'write' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| Prometheus/Grafana | 运行时指标采集 | ✅ 已有 |
| AI Review | 代码变更分析 | ✅ 已有 |
| 数据血缘 | 服务间依赖分析 | ✅ 已有 |
| SLO 定义系统 | SLO 阈值/合规率 | ⚠️ 需确认 |
| 告警系统 | SLO 违反告警 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 低风险 | `colors.success[500]` |
| 中风险 | `colors.warning[500]` |
| 高风险 | `colors.error[500]` |
| 关键风险 | `#8B0000`（深红） |
| 指标恶化 | `colors.error[500]` |
| 指标改善 | `colors.success[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 查看变更列表并按风险等级过滤 | 列表正确过滤，风险等级颜色正确 |
| E2 | 查看变更的完整影响链 | 代码变更 → 受影响服务 → SLO 影响完整展示 |
| E3 | 变更前后指标对比 | 显示变更前后关键指标差异，变化百分比标红 |
| E4 | SLO 面板查看 | 显示合规/违反/接近阈值的 SLO 数量 |
| E5 | 预测 SLO 违反 | 会违反的 SLO 标红，显示关联变更 |
| E6 | 风险趋势分析 | 显示近 30 天风险等级变化趋势 |
| E7 | 重新评估风险 | 触发 AI 重新评估，风险等级可能变化 |
| E8 | 变更统计摘要 | 显示总变更数、高风险占比、平均风险分 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 变更列表加载时间 | < 1s (p95) |
| 影响分析计算时间 | < 3s |
| SLO 面板加载时间 | < 2s |
| 风险评估时间 | < 5s |
| 前端单元测试覆盖率 | > 75% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
