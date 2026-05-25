# 容量规划模块完整设计（Capacity Planning Complete Design）

> 文档日期：2026-05-22
> 状态：设计完成，待实现
> 关联 DDL：`orion-upgrade-executable-plan-2026-05-22.md` Section 11.5

---

## 1. 功能设计（后端）

### 1.1 业务闭环

容量规划模块实现完整的"采集→基线→预测→预警→建议"五步闭环：

```
Prometheus/K8s ResourceQuota
        │
        ▼ (5min 原始采集)
  Raw Metrics Collection
        │
        ▼ (小时聚合 → 日基线)
  Baseline Computation ──────► capacity_baselines
        │
        ▼ (线性回归 / 指数平滑)
  Forecast Engine ───────────► capacity_forecasts
        │
        ▼ (阈值 + 预测 + 趋势)
  Alert Evaluator ───────────► capacity_alerts
        │
        ▼ (自动计算 + 成本估算)
  Recommendation Generator ──► JSONB recommendation
```

**闭环触发关系**：
- 基线变更 → 自动触发预测重算
- 预测结果超阈 → 自动生成预警
- 预警状态更新 → 自动附带扩容建议

### 1.2 数据采集

#### 数据源

| 数据源 | 查询接口 | 用途 | 已有集成 |
|--------|----------|------|----------|
| Prometheus | `/api/v1/query_range` | CPU、内存、磁盘、网络用量时序 | `PrometheusClient`（canary-analysis 目录） |
| K8s API | `/api/v1/namespaces/{ns}/resourcequotas` | 资源配额上限 | 无，需新增 |
| K8s API | `/api/v1/namespaces/{ns}/pods` | Pod 资源 requests/limits | 无，需新增 |
| FinOps | `finops_k8s_costs` 表 | 成本分摊 | 已有 `FinOpsRepository` |

#### 采集频率与聚合

| 层级 | 频率 | 数据保留 | 存储位置 |
|------|------|----------|----------|
| 原始指标 | 5min | 30 天 | Prometheus（外部） |
| 小时聚合 | 每小时 1 次 | 90 天 | Prometheus recording rules |
| 日基线 | 每日 02:00 UTC | 永久 | `capacity_baselines` 表 |

#### PromQL 查询模板

```typescript
const CapacityPromQL = {
  // CPU 使用率（namespace 维度）
  cpuUsage: `
    sum(rate(container_cpu_usage_seconds_total{namespace="{{namespace}}"}[5m]))
    /
    sum(kube_pod_container_resource_limits{namespace="{{namespace}}", resource="cpu"})
    * 100
  `,
  // 内存使用率
  memoryUsage: `
    sum(container_memory_working_set_bytes{namespace="{{namespace}}"})
    /
    sum(kube_pod_container_resource_limits{namespace="{{namespace}}", resource="memory"})
    * 100
  `,
  // 磁盘使用率（PV）
  diskUsage: `
    sum(kubelet_volume_stats_used_bytes{namespace="{{namespace}}"})
    /
    sum(kubelet_volume_stats_capacity_bytes{namespace="{{namespace}}"})
    * 100
  `,
  // Pod 数量 vs Limit
  podCount: `
    count(kube_pod_info{namespace="{{namespace}}"})
  `,
};
```

#### K8s ResourceQuota 采集流程

1. 定时任务每 5min 调用 K8s API 获取所有 namespace 的 ResourceQuota
2. 提取 `.status.hard`（上限）与 `.status.used`（当前用量）
3. 与 Prometheus 用量交叉校验，取大值作为实际使用率
4. 写入 `capacity_baselines`

### 1.3 预测算法

#### 算法选型矩阵

| 场景 | 算法 | 适用条件 | 预测窗口 |
|------|------|----------|----------|
| 短期趋势 | 线性回归（OLS） | 近 30 天数据点数 ≥ 15 | 7-30 天 |
| 季节性模式 | Holt-Winters 三次指数平滑 | 近 90 天数据点数 ≥ 30，且存在周/月周期 | 30-90 天 |
| 数据不足 | 移动平均（MA-7） | 数据点数 < 15 | 7 天 |

#### 算法选择策略

```typescript
function selectAlgorithm(dataPoints: number[], daysOfHistory: number): ForecastAlgorithm {
  if (dataPoints.length < 15) return 'moving_average';
  if (daysOfHistory >= 90 && hasSeasonality(dataPoints)) return 'exponential_smoothing';
  return 'linear_regression';
}
```

#### 线性回归实现

```
y = a * x + b
其中：
  x = 时间戳（归一化为第 N 天）
  y = 使用率百分比
  a = 斜率（每日增长率）
  b = 截距

置信区间 95%：
  lower = y - 1.96 * SE
  upper = y + 1.96 * SE
  SE = sqrt(SSE / (n - 2)) * sqrt(1/n + (x0 - x_mean)^2 / Sxx)
```

#### 指数平滑实现（Holt-Winters）

```
Level:    L(t) = alpha * Y(t)/S(t-s) + (1-alpha) * (L(t-1) + T(t-1))
Trend:    T(t) = beta * (L(t) - L(t-1)) + (1-beta) * T(t-1)
Season:   S(t) = gamma * Y(t)/L(t) + (1-gamma) * S(t-s)
Forecast: F(t+h) = (L(t) + h*T(t)) * S(t-s+h)

参数默认值：alpha=0.3, beta=0.1, gamma=0.1, season_length=7
```

#### 准确率评估

每次预测生成后，回溯验证上一周期的预测误差：

```
MAPE = (1/n) * sum(|actual - predicted| / actual) * 100
accuracy_score = max(0, 100 - MAPE)
```

`accuracy_score` 写入 `capacity_forecasts.accuracy_score`，用于算法自动调优。

### 1.4 预警规则

#### 三类预警触发条件

| 预警类型 | alert_type | 触发条件 | 默认严重度 |
|----------|------------|----------|------------|
| 阈值超用 | `threshold_exceeded` | 当前使用率 > 80% | `warning` |
| | | 当前使用率 > 90% | `critical` |
| 预测耗尽 | `forecast_exhaust` | 预测 30 天内使用率达 100% | `warning` |
| | | 预测 7 天内使用率达 100% | `critical` |
| 趋势异常 | `trend_anomaly` | 近 7 天日均增长率 > 上次基线的 2 倍标准差 | `warning` |

#### 预警去重

- 同一 `baseline_id` + `alert_type` 的组合，在 `status` 未变为 `resolved`/`ignored` 前不重复创建
- 每日 02:30 UTC 执行预警评估，覆盖近 7 天未关闭预警

#### 预警生命周期

```
open ──acknowledge──► acknowledged ──resolve──► resolved
  │                        │
  │                        │
  └──ignore──► ignored ────┘ (终态，不可逆转)
```

### 1.5 扩容建议生成

#### 建议计算逻辑

```typescript
interface CapacityRecommendation {
  resourceType: string;     // "cpu" | "memory" | "disk" | "pod_count"
  currentLimit: number;     // 当前上限
  currentUsage: number;     // 当前用量
  suggestedLimit: number;   // 建议上限
  growthRate: number;       // 日均增长率 (%)
  daysToExhaust: number;    // 预计耗尽天数
  estimatedCost: number;    // 月度预估成本增量
  priority: 'P0'|'P1'|'P2'; // 优先级
  action: ScaleAction;      // 具体动作
}

type ScaleAction =
  | { type: 'increase_quota'; namespace: string; resource: string; newValue: number }
  | { type: 'add_node'; cluster: string; nodeCount: number }
  | { type: 'optimize'; description: string; expectedSavings: number };
```

#### 优先级计算

| 条件 | 优先级 |
|------|--------|
| daysToExhaust ≤ 7 | P0（立即处理） |
| 7 < daysToExhaust ≤ 30 | P1（本周内） |
| 30 < daysToExhaust ≤ 90 | P2（本月内） |
| daysToExhaust > 90 | 不生成建议 |

#### 成本估算

- CPU：每核 $0.048/小时（基于 GCP n2-standard 公开定价，可配置）
- 内存：每 GB $0.006/小时
- 存储：每 GB $0.02/月
- 公式：`estimatedCost = (suggestedLimit - currentLimit) * unitPrice * 720`

### 1.6 外部依赖检查

| 依赖 | 状态 | 回退策略 |
|------|------|----------|
| Prometheus | 已有 `PrometheusClient`（canary-analysis 目录），通过 `PROMETHEUS_URL` 环境变量连接 | 返回空数据集，日志 warning |
| K8s API Server | 需新增 `K8sClient`，使用 in-cluster config 或 kubeconfig 文件 | 降级为仅使用 Prometheus 数据 |
| PostgreSQL | 已有连接池 `DatabasePool` | 启动失败 |

**Prometheus 接入验证**：
- `PrometheusClient` 已在 `orion-platform-service/src/services/canary-analysis/PrometheusClient.ts` 实现
- 支持 `query()` 即时查询和 `queryRange()` 范围查询
- 环境变量 `PROMETHEUS_URL` 配置地址
- 容量模块复用同一 client，无需新建

### 1.7 权限模型

基于 RBAC + RLS 双层控制：

#### 角色权限矩阵

| 角色 | 查看基线 | 查看预测 | 查看预警 | 确认/忽略预警 | 配置采集 | 关闭预警 |
|------|----------|----------|----------|---------------|----------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PlatformAdmin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DevOpsEngineer | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Developer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| FinanceViewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### RLS 策略

```sql
-- 已在 DDL 中定义，每个表均有 tenant_isolation 策略
CREATE POLICY tenant_isolation_capacity_baselines ON capacity_baselines
  USING (tenant_id::text = current_setting('app.current_tenant_id'));
```

#### API 权限映射

| 路由 | 权限要求 |
|------|----------|
| GET `/baselines` | `requirePermission({ resource: 'capacity', action: 'read' })` |
| POST `/baselines/refresh` | `requirePermission({ resource: 'capacity', action: 'write' })` |
| GET `/forecasts` | `requirePermission({ resource: 'capacity', action: 'read' })` |
| POST `/forecasts/run` | `requirePermission({ resource: 'capacity', action: 'write' })` |
| GET `/alerts` | `requirePermission({ resource: 'capacity', action: 'read' })` |
| POST `/alerts/:id/acknowledge` | `requirePermission({ resource: 'capacity', action: 'execute' })` |
| POST `/alerts/:id/ignore` | `requirePermission({ resource: 'capacity', action: 'execute' })` |
| GET `/recommendations` | `requirePermission({ resource: 'capacity', action: 'read' })` |
| POST `/recommendations/apply` | `requirePermission({ resource: 'capacity', action: 'write' })` |

### 1.8 定时任务

| 任务 | Cron 表达式 | 功能 | 超时 |
|------|-------------|------|------|
| BaselineCollector | `*/5 * * * *` | 5min 采集 Prometheus + K8s 指标 | 60s |
| BaselineAggregator | `0 * * * *` | 小时聚合，写入日基线候选 | 120s |
| BaselineDaily | `0 2 * * *` | 计算并写入当日基线到 DB | 300s |
| ForecastRunner | `0 3 * * *` | 对所有 active baseline 执行预测 | 600s |
| AlertEvaluator | `0 2:30 * * *` | 评估预警规则，生成/更新预警 | 120s |
| RecommendationGen | `0 4 * * *` | 根据预警生成扩容建议 | 120s |
| AccuracyReporter | `0 5 * * 1` | 每周一回溯上周预测准确率 | 300s |

定时任务通过现有 `CronSchedulerService` 注册，失败时写入日志 + 发送 notification。

---

## 2. 页面交互设计（前端）

### 2.1 页面清单与路由

| 页面 | 路由 | 优先级 | 对应后端 API |
|------|------|--------|-------------|
| 容量概览仪表盘 | `/capacity/overview` | P0 | 聚合接口 |
| 资源基线列表 | `/capacity/baselines` | P0 | GET/POST `/baselines` |
| 容量预测 | `/capacity/forecasts` | P0 | GET `/forecasts` |
| 容量预警列表 | `/capacity/alerts` | P0 | GET `/alerts` |
| 预警详情 | `/capacity/alerts/:id` | P1 | GET `/alerts/:id` |
| 扩容建议 | `/capacity/recommendations` | P1 | GET `/recommendations` |

### 2.2 页面 1：容量概览仪表盘（/capacity/overview）

**页面标题**：

```tsx
import { Title, Typography } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';

<Title level={2} style={{ marginBottom: spacing.sm }}>
  <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  容量规划
</Title>
<Typography.Text style={{ color: colors.neutral[500], fontSize: 14 }}>
  资源使用趋势、预测与扩容建议
</Typography.Text>
```

**布局结构**：4 个统计卡片 + 1 个趋势图 + 1 个预警列表 + 1 个 Top5 资源水位

**统计卡片（4 个）**：

```tsx
import { Row, Col, Card, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WarningOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { shadows } from '@/tokens/shadows';

<Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
  <Col span={6}>
    <Card hoverable style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
      <Statistic
        title="监控资源数"
        value={summary.totalResources}
        suffix="个"
        valueStyle={{ color: colors.neutral[900] }}
      />
    </Card>
  </Col>
  <Col span={6}>
    <Card hoverable style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
      <Statistic
        title="平均使用率"
        value={summary.avgUtilization}
        suffix="%"
        precision={1}
        valueStyle={{
          color: summary.avgUtilization > 80 ? colors.error[500] : colors.success[500],
        }}
      />
    </Card>
  </Col>
  <Col span={6}>
    <Card hoverable style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
      <Statistic
        title="活跃预警"
        value={summary.activeAlerts}
        valueStyle={{ color: colors.warning[500] }}
        prefix={<WarningOutlined />}
      />
    </Card>
  </Col>
  <Col span={6}>
    <Card hoverable style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}>
      <Statistic
        title="待处理建议"
        value={summary.pendingRecommendations}
        valueStyle={{ color: colors.primary[500] }}
      />
      <Typography.Text style={{ color: colors.neutral[500], fontSize: 12 }}>
        预估月度成本 ${summary.estimatedMonthlyCost}
      </Typography.Text>
    </Card>
  </Col>
</Row>
```

**趋势图（近 30 天使用率趋势 + 预测区间）**：

```tsx
import ReactECharts from 'echarts-for-react';

const trendOption = {
  tooltip: { trigger: 'axis' as const },
  grid: { left: 60, right: 30, top: 40, bottom: 40 },
  xAxis: { type: 'category', data: dates },
  yAxis: {
    type: 'value' as const,
    min: 0,
    max: 100,
    axisLabel: { formatter: '{value}%' },
    splitLine: { lineStyle: { type: 'dashed' as const } },
  },
  series: [
    {
      name: '实际使用率',
      type: 'line' as const,
      data: actualUsage,
      smooth: true,
      lineStyle: { width: 3, color: colors.primary[500] },
      itemStyle: { color: colors.primary[500] },
    },
    {
      name: '预测值',
      type: 'line' as const,
      data: forecasted,
      smooth: true,
      lineStyle: { width: 2, type: 'dashed' as const, color: colors.purple[500] },
      itemStyle: { color: colors.purple[500] },
    },
    {
      name: '置信区间',
      type: 'line' as const,
      data: forecastUpper,
      smooth: true,
      lineStyle: { width: 0 },
      areaStyle: {
        color: 'rgba(124, 92, 252, 0.08)',
      },
      stack: 'confidence',
    },
    {
      name: '警戒线 80%',
      type: 'line' as const,
      data: Array(dates.length).fill(80),
      lineStyle: { width: 1, color: colors.warning[500], type: 'dotted' as const },
      symbol: 'none' as const,
    },
  ],
};

<ReactECharts option={trendOption} style={{ height: 360 }} />
```

**Top5 资源水位条**：

```tsx
import { Progress, Typography } from 'antd';
import { colors } from '@/tokens/colors';

// 水位条颜色函数
function getUtilizationColor(pct: number): string {
  if (pct >= 90) return colors.error[500];
  if (pct >= 70) return colors.warning[500];
  return colors.success[500];
}

// 每个资源项
<div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 8 }}>
  <Typography.Text style={{ width: 140, flexShrink: 0 }}>{resource.name}</Typography.Text>
  <Progress
    percent={Math.round(resource.utilization)}
    strokeColor={getUtilizationColor(resource.utilization)}
    trailColor="#f0f0f0"
    strokeWidth={8}
    style={{ flex: 1, margin: 0 }}
    format={(percent) => `${percent}%`}
  />
  <Typography.Text style={{ width: 60, textAlign: 'right', fontSize: 12 }}>
    {resource.daysToExhaust}d
  </Typography.Text>
</div>
```

**空状态**：

```tsx
import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

<Empty
  description="暂无容量数据，请先添加监控资源"
  image={Empty.PRESENTED_IMAGE_SIMPLE}
>
  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddResource}>
    添加监控资源
  </Button>
</Empty>
```

### 2.3 页面 2：资源基线列表（/capacity/baselines）

**搜索/过滤/排序**：

```tsx
import { Table, Input, Select, Space, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

const [filters, setFilters] = useState({
  resourceType: '',
  period: '',
  keyword: '',
  sortField: 'updated_at',
  sortOrder: 'descend' as const,
});

<Space style={{ marginBottom: spacing.md }}>
  <Input
    placeholder="搜索资源 ID"
    prefix={<SearchOutlined />}
    value={filters.keyword}
    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
    style={{ width: 240 }}
    allowClear
  />
  <Select
    placeholder="资源类型"
    value={filters.resourceType}
    onChange={(v) => setFilters({ ...filters, resourceType: v })}
    style={{ width: 160 }}
    allowClear
    options={[
      { label: 'CPU', value: 'cpu' },
      { label: '内存', value: 'memory' },
      { label: '磁盘', value: 'disk' },
      { label: 'Pod 数', value: 'pod_count' },
    ]}
  />
  <Select
    placeholder="统计周期"
    value={filters.period}
    onChange={(v) => setFilters({ ...filters, period: v })}
    style={{ width: 120 }}
    allowClear
    options={[
      { label: '每日', value: 'daily' },
      { label: '每周', value: 'weekly' },
      { label: '每月', value: 'monthly' },
    ]}
  />
  <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing}>
    刷新基线
  </Button>
</Space>
```

**表格列定义**：

```tsx
const columns = [
  {
    title: '资源类型',
    dataIndex: 'resource_type',
    width: 120,
    render: (type: string) => {
      const icons: Record<string, string> = { cpu: 'CPU', memory: '内存', disk: '磁盘', pod_count: 'Pod' };
      return <Tag color={colors.primary[500]}>{icons[type] || type}</Tag>;
    },
  },
  {
    title: '资源 ID',
    dataIndex: 'resource_id',
    ellipsis: true,
  },
  {
    title: '周期',
    dataIndex: 'period',
    width: 80,
    render: (p: string) => <Tag>{p}</Tag>,
  },
  {
    title: '平均使用率',
    dataIndex: 'avg_usage',
    width: 120,
    sorter: true,
    render: (v: number, r: any) => (
      <Progress
        percent={Math.round((v / r.total_capacity) * 100)}
        strokeColor={getUtilizationColor((v / r.total_capacity) * 100)}
        size="small"
      />
    ),
  },
  {
    title: 'P50/P95/P99',
    width: 160,
    render: (_: any, r: any) => (
      <Typography.Text style={{ fontSize: 12 }}>
        {r.p50_usage}/{r.p95_usage}/{r.p99_usage}
      </Typography.Text>
    ),
  },
  {
    title: '总容量',
    dataIndex: 'total_capacity',
    width: 100,
    sorter: true,
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 180,
    sorter: true,
    defaultSortOrder: 'descend' as const,
  },
  {
    title: '操作',
    width: 100,
    render: (_: any, r: any) => (
      <Space>
        <a onClick={() => navigate(`/capacity/forecasts?baseline=${r.id}`)}>预测</a>
        <a onClick={() => navigate(`/capacity/alerts?baseline=${r.id}`)}>预警</a>
      </Space>
    ),
  },
];
```

**Loading/Error 处理**：

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['capacity-baselines', filters],
  queryFn: () => fetchBaselines(filters),
});

if (isLoading) return <Skeleton active />;
if (error) return <Alert type="error" message={`加载失败: ${(error as Error).message}`} />;
```

### 2.4 页面 3：容量预测页（/capacity/forecasts）

**预测可视化**：

```tsx
import { Card, Select, Radio } from 'antd';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';

<Card
  title="容量预测"
  style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
  extra={
    <Space>
      <Select
        value={selectedBaseline}
        onChange={setSelectedBaseline}
        options={baselineOptions}
        style={{ width: 240 }}
      />
      <Radio.Group value={forecastWindow} onChange={(e) => setForecastWindow(e.target.value)}>
        <Radio.Button value={7}>7 天</Radio.Button>
        <Radio.Button value={30}>30 天</Radio.Button>
        <Radio.Button value={90}>90 天</Radio.Button>
      </Radio.Group>
    </Space>
  }
>
  <ReactECharts option={forecastOption} style={{ height: 400 }} />
</Card>
```

**预测信息面板**：

```tsx
<Row gutter={spacing.md} style={{ marginTop: spacing.md }}>
  <Col span={8}>
    <Card size="small" title="算法信息">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="使用算法">{forecast.algorithm}</Descriptions.Item>
        <Descriptions.Item label="准确率">{(forecast.accuracy_score * 100).toFixed(1)}%</Descriptions.Item>
        <Descriptions.Item label="数据点数">{forecast.dataPoints}</Descriptions.Item>
      </Descriptions>
    </Card>
  </Col>
  <Col span={8}>
    <Card size="small" title="耗尽预测">
      <Statistic
        value={forecast.daysToExhaust}
        suffix="天"
        valueStyle={{
          color: forecast.daysToExhaust <= 7
            ? colors.error[500]
            : forecast.daysToExhaust <= 30
              ? colors.warning[500]
              : colors.success[500],
        }}
      />
      <Typography.Text style={{ fontSize: 12, color: colors.neutral[500] }}>
        预计 {forecast.exhaustDate} 耗尽
      </Typography.Text>
    </Card>
  </Col>
  <Col span={8}>
    <Card size="small" title="置信区间">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="下限">{forecast.confidenceLower}%</Descriptions.Item>
        <Descriptions.Item label="预测值">{forecast.predictedUsage}%</Descriptions.Item>
        <Descriptions.Item label="上限">{forecast.confidenceUpper}%</Descriptions.Item>
      </Descriptions>
    </Card>
  </Col>
</Row>
```

**手动触发预测**：

```tsx
<Button
  type="primary"
  onClick={handleRunForecast}
  loading={forecastLoading}
  disabled={!selectedBaseline}
>
  运行预测
</Button>

// handler
const handleRunForecast = async () => {
  setForecastLoading(true);
  try {
    const result = await runForecast({ baseline_id: selectedBaseline });
    message.success('预测任务已启动，预计 2 分钟内完成');
    // 轮询直到完成
    await pollForecastResult(result.task_id);
    refetch();
  } catch (err: any) {
    message.error(`预测失败: ${err.message}`);
  } finally {
    setForecastLoading(false);
  }
};
```

### 2.5 页面 4：容量预警列表页（/capacity/alerts）

**预警表格**：

```tsx
import { Table, Tag, Space, Button, Popconfirm, Badge } from 'antd';
import { CheckOutlined, CloseOutlined, ArrowUpOutlined } from '@ant-design/icons';

// 严重度标签
const severityTag: Record<string, { color: string; label: string }> = {
  info: { color: colors.info[500], label: '信息' },
  warning: { color: colors.warning[500], label: '警告' },
  critical: { color: colors.error[500], label: '严重' },
};

// 状态徽章
const statusBadge: Record<string, { status: string; text: string }> = {
  open: { status: 'error', text: '待处理' },
  acknowledged: { status: 'processing', text: '处理中' },
  resolved: { status: 'success', text: '已解决' },
  ignored: { status: 'default', text: '已忽略' },
};

const columns = [
  {
    title: '预警类型',
    dataIndex: 'alert_type',
    width: 140,
    render: (t: string) => {
      const labels: Record<string, string> = {
        threshold_exceeded: '阈值超用',
        forecast_exhaust: '预测耗尽',
        trend_anomaly: '趋势异常',
      };
      return <Tag color={colors.warning[500]}>{labels[t]}</Tag>;
    },
  },
  {
    title: '严重度',
    dataIndex: 'severity',
    width: 100,
    render: (s: string) => (
      <Tag color={severityTag[s]?.color}>{severityTag[s]?.label}</Tag>
    ),
  },
  {
    title: '当前使用率',
    dataIndex: 'current_usage',
    width: 120,
    render: (v: number) => (
      <Progress percent={Math.round(v)} size="small"
        strokeColor={getUtilizationColor(v)}
      />
    ),
  },
  {
    title: '预计耗尽',
    dataIndex: 'predicted_exhaust_date',
    width: 160,
    render: (d: string, r: any) => d ? (
      <span>{dayjs(d).format('YYYY-MM-DD')}
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          ({dayjs(d).diff(dayjs(), 'day')} 天)
        </Typography.Text>
      </span>
    ) : '-',
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (s: string) => <Badge {...statusBadge[s]} />,
  },
  {
    title: '操作',
    width: 180,
    render: (_: any, r: any) => (
      <Space>
        <a onClick={() => navigate(`/capacity/alerts/${r.id}`)}>详情</a>
        {r.status === 'open' && (
          <>
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleAcknowledge(r.id)}
            >
              确认
            </Button>
            <Popconfirm
              title="确认忽略此预警？"
              description="忽略后将无法恢复，如需重新评估请手动刷新基线。"
              onConfirm={() => handleIgnore(r.id)}
            >
              <Button type="link" size="small" danger icon={<CloseOutlined />}>
                忽略
              </Button>
            </Popconfirm>
          </>
        )}
        {r.status === 'acknowledged' && (
          <Button type="link" size="small" onClick={() => handleResolve(r.id)}>
            解决
          </Button>
        )}
      </Space>
    ),
  },
];
```

**预警操作 handler**：

```tsx
const handleAcknowledge = async (id: string) => {
  try {
    await acknowledgeAlert(id);
    message.success('已确认预警');
    refetch();
  } catch (err: any) {
    message.error(`操作失败: ${err.message}`);
  }
};

const handleIgnore = async (id: string) => {
  try {
    await ignoreAlert(id);
    message.info('预警已忽略');
    refetch();
  } catch (err: any) {
    message.error(`操作失败: ${err.message}`);
  }
};

const handleResolve = async (id: string) => {
  try {
    await resolveAlert(id);
    message.success('预警已解决');
    refetch();
  } catch (err: any) {
    message.error(`操作失败: ${err.message}`);
  }
};
```

### 2.6 页面 5：预警详情页（/capacity/alerts/:id）

**详情面板**：

```tsx
import { Card, Descriptions, Timeline, Button, Space } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';

<Card
  title={
    <Space>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
      <span>预警详情</span>
    </Space>
  }
  style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
  extra={
    alert.status === 'open' && (
      <Space>
        <Button onClick={handleAcknowledge}>确认</Button>
        <Popconfirm title="确认忽略？" onConfirm={handleIgnore}>
          <Button danger>忽略</Button>
        </Popconfirm>
      </Space>
    )
  }
>
  <Descriptions column={2} bordered>
    <Descriptions.Item label="预警类型">{alertTypeLabels[alert.alert_type]}</Descriptions.Item>
    <Descriptions.Item label="严重度">
      <Tag color={severityTag[alert.severity]?.color}>{severityTag[alert.severity]?.label}</Tag>
    </Descriptions.Item>
    <Descriptions.Item label="当前使用率">{alert.current_usage}%</Descriptions.Item>
    <Descriptions.Item label="总容量">{alert.total_capacity}</Descriptions.Item>
    <Descriptions.Item label="预计耗尽时间">
      {alert.predicted_exhaust_date ? dayjs(alert.predicted_exhaust_date).format('YYYY-MM-DD HH:mm') : '-'}
    </Descriptions.Item>
    <Descriptions.Item label="状态">
      <Badge {...statusBadge[alert.status]} />
    </Descriptions.Item>
    <Descriptions.Item label="创建时间">
      {dayjs(alert.created_at).format('YYYY-MM-DD HH:mm')}
    </Descriptions.Item>
    <Descriptions.Item label="更新时间">
      {dayjs(alert.updated_at).format('YYYY-MM-DD HH:mm')}
    </Descriptions.Item>
  </Descriptions>

  {/* 扩容建议内嵌 */}
  {alert.recommendation && Object.keys(alert.recommendation).length > 0 && (
    <Card
      title={<><ThunderboltOutlined /> 扩容建议</>}
      style={{ marginTop: spacing.md }}
      size="small"
    >
      <Descriptions column={1} size="small">
        <Descriptions.Item label="建议操作">{alert.recommendation.action}</Descriptions.Item>
        <Descriptions.Item label="建议容量">{alert.recommendation.suggested_limit}</Descriptions.Item>
        <Descriptions.Item label="预估成本">${alert.recommendation.estimated_cost}/月</Descriptions.Item>
        <Descriptions.Item label="优先级">
          <Tag color={priorityColors[alert.recommendation.priority]}>
            {alert.recommendation.priority}
          </Tag>
        </Descriptions.Item>
      </Descriptions>
      <Button
        type="primary"
        style={{ marginTop: spacing.sm }}
        onClick={handleApplyRecommendation}
      >
        应用建议
      </Button>
    </Card>
  )}

  {/* 状态变更时间线 */}
  <Card title="操作记录" style={{ marginTop: spacing.md }} size="small">
    <Timeline>
      <Timeline.Item color="blue">
        预警创建 {dayjs(alert.created_at).format('YYYY-MM-DD HH:mm')}
      </Timeline.Item>
      {alert.acknowledged_at && (
        <Timeline.Item color="green">
          已确认 {dayjs(alert.acknowledged_at).format('YYYY-MM-DD HH:mm')}
          {alert.updated_by && <span style={{ color: colors.neutral[500] }}> - {alert.updated_by}</span>}
        </Timeline.Item>
      )}
      {alert.resolved_at && (
        <Timeline.Item color="green">
          已解决 {dayjs(alert.resolved_at).format('YYYY-MM-DD HH:mm')}
          {alert.updated_by && <span style={{ color: colors.neutral[500] }}> - {alert.updated_by}</span>}
        </Timeline.Item>
      )}
    </Timeline>
  </Card>
</Card>
```

### 2.7 页面 6：扩容建议页（/capacity/recommendations）

**建议表格 + 批量操作**：

```tsx
import { Table, Tag, Button, Space, Checkbox } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';

const priorityConfig: Record<string, { color: string; label: string; order: number }> = {
  P0: { color: colors.error[500], label: 'P0 立即', order: 0 },
  P1: { color: colors.warning[500], label: 'P1 本周', order: 1 },
  P2: { color: colors.info[500], label: 'P2 本月', order: 2 },
};

const columns = [
  {
    title: '优先级',
    dataIndex: 'priority',
    width: 100,
    sorter: (a: any, b: any) => priorityConfig[a.priority].order - priorityConfig[b.priority].order,
    defaultSortOrder: 'ascend' as const,
    render: (p: string) => <Tag color={priorityConfig[p].color}>{priorityConfig[p].label}</Tag>,
  },
  {
    title: '资源',
    dataIndex: 'resource_name',
    ellipsis: true,
  },
  {
    title: '当前容量',
    dataIndex: 'current_limit',
    width: 120,
  },
  {
    title: '建议容量',
    dataIndex: 'suggested_limit',
    width: 120,
    render: (v: number, r: any) => (
      <span style={{ color: colors.primary[500], fontWeight: 600 }}>
        {v}
        <Typography.Text style={{ fontSize: 11, color: colors.neutral[500], marginLeft: 4 }}>
          (+{((v - r.current_limit) / r.current_limit * 100).toFixed(0)}%)
        </Typography.Text>
      </span>
    ),
  },
  {
    title: '预计耗尽',
    dataIndex: 'days_to_exhaust',
    width: 100,
    render: (d: number) => (
      <Typography.Text style={{ color: d <= 7 ? colors.error[500] : colors.neutral[700] }}>
        {d} 天
      </Typography.Text>
    ),
  },
  {
    title: '预估月成本',
    dataIndex: 'estimated_cost',
    width: 120,
    sorter: true,
    render: (v: number) => `$${v.toFixed(2)}`,
  },
  {
    title: '操作',
    width: 120,
    render: (_: any, r: any) => (
      <Button
        type="link"
        icon={<CheckCircleOutlined />}
        onClick={() => handleApply(r.id)}
        disabled={r.applied}
      >
        {r.applied ? '已应用' : '应用'}
      </Button>
    ),
  },
];

// 批量操作栏
<Space style={{ marginBottom: spacing.md }}>
  <Button
    type="primary"
    icon={<ThunderboltOutlined />}
    onClick={handleBatchApply}
    disabled={selectedIds.length === 0}
  >
    批量应用 ({selectedIds.length})
  </Button>
  <Typography.Text style={{ color: colors.neutral[500] }}>
    预估总成本: ${totalEstimatedCost.toFixed(2)}/月
  </Typography.Text>
</Space>
```

---

## 3. API 设计

### 3.1 后端路由

**路由文件**：`orion-platform-service/src/api/capacity-routes.ts`

**基础路径**：`/api/v1/capacity`

| Method | Path | Handler | 权限 | 描述 |
|--------|------|---------|------|------|
| GET | `/overview` | `getOverview` | read | 仪表盘聚合数据 |
| GET | `/baselines` | `listBaselines` | read | 基线列表（分页+过滤） |
| GET | `/baselines/:id` | `getBaseline` | read | 基线详情 |
| POST | `/baselines/refresh` | `refreshBaselines` | write | 手动触发基线刷新 |
| PUT | `/baselines/:id` | `updateBaseline` | write | 更新基线配置 |
| GET | `/forecasts` | `listForecasts` | read | 预测列表 |
| POST | `/forecasts/run` | `runForecast` | write | 手动运行预测 |
| GET | `/forecasts/:id` | `getForecast` | read | 预测详情 |
| GET | `/alerts` | `listAlerts` | read | 预警列表（分页+状态过滤） |
| GET | `/alerts/:id` | `getAlert` | read | 预警详情 |
| POST | `/alerts/:id/acknowledge` | `acknowledgeAlert` | execute | 确认预警 |
| POST | `/alerts/:id/resolve` | `resolveAlert` | execute | 解决预警 |
| POST | `/alerts/:id/ignore` | `ignoreAlert` | execute | 忽略预警 |
| GET | `/recommendations` | `listRecommendations` | read | 扩容建议列表 |
| POST | `/recommendations/apply` | `applyRecommendation` | write | 应用扩容建议 |

### 3.2 Controller → Service → Repository 分层

```
capacity-routes.ts
    │
    ▼
CapacityController.ts
    │ (HTTP req/res, 参数校验, 响应封装)
    ▼
CapacityPlanningService.ts
    │ (业务逻辑: 聚合、算法选择、预警评估)
    ├───► CapacityRepository.ts (CRUD)
    ├───► PrometheusClient.ts (数据采集)
    └───► K8sClient.ts (ResourceQuota 采集)
```

**Repository 接口设计**：

```typescript
// orion-platform-service/src/repositories/CapacityRepository.ts

export class CapacityRepository {
  constructor(private pool: DatabasePool) {}

  // === Baselines ===
  async listBaselines(params: {
    tenantId: string;
    resourceType?: string;
    period?: string;
    keyword?: string;
    sortField?: string;
    sortOrder?: 'ascend' | 'descend';
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: BaselineRow[]; total: number }> {
    // SELECT * FROM capacity_baselines WHERE tenant_id=$1 AND deleted_at IS NULL
    //   [dynamic filters]
    //   ORDER BY [sortField] [sortOrder]
    //   LIMIT $n OFFSET $m
  }

  async createBaseline(data: CreateBaselineInput): Promise<BaselineRow> {
    // INSERT INTO capacity_baselines ... RETURNING *
  }

  async updateBaseline(id: string, updates: UpdateBaselineInput): Promise<BaselineRow | null> {
    // UPDATE capacity_baselines SET ... WHERE id=$1 RETURNING *
  }

  async getBaselineById(id: string, tenantId: string): Promise<BaselineRow | null> {
    // SELECT * FROM capacity_baselines WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
  }

  // === Forecasts ===
  async listForecasts(params: {
    tenantId: string;
    baselineId?: string;
    days?: number;
  }): Promise<ForecastRow[]> {
    // SELECT * FROM capacity_forecasts WHERE tenant_id=$1 AND deleted_at IS NULL
    //   [AND baseline_id=$2]
    //   ORDER BY forecast_date ASC
  }

  async createForecast(data: CreateForecastInput): Promise<ForecastRow> {
    // INSERT INTO capacity_forecasts ... RETURNING *
  }

  // === Alerts ===
  async listAlerts(params: {
    tenantId: string;
    status?: string;
    severity?: string;
    baselineId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: AlertRow[]; total: number }> {
    // SELECT * FROM capacity_alerts WHERE tenant_id=$1 AND deleted_at IS NULL
    //   [dynamic filters]
    //   ORDER BY created_at DESC
    //   LIMIT $n OFFSET $m
  }

  async getAlertById(id: string, tenantId: string): Promise<AlertRow | null> {
    // SELECT * FROM capacity_alerts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL
  }

  async updateAlertStatus(
    id: string,
    tenantId: string,
    status: 'acknowledged' | 'resolved' | 'ignored',
    updatedBy?: string
  ): Promise<AlertRow | null> {
    // UPDATE capacity_alerts SET status=$3, updated_at=NOW(),
    //   updated_by=$4, resolved_at=NOW() (if resolved)
    //   WHERE id=$1 AND tenant_id=$2 RETURNING *
  }

  async findOpenAlert(tenantId: string, baselineId: string, alertType: string): Promise<AlertRow | null> {
    // 预警去重: SELECT * WHERE status IN ('open','acknowledged')
  }

  async createAlert(data: CreateAlertInput): Promise<AlertRow> {
    // INSERT INTO capacity_alerts ... RETURNING *
  }

  // === Overview aggregation ===
  async getOverviewStats(tenantId: string): Promise<OverviewStats> {
    // 聚合查询: total_resources, avg_utilization, active_alerts, pending_recommendations
  }
}
```

**Service 核心方法设计**：

```typescript
// orion-platform-service/src/services/capacity/CapacityPlanningService.ts

export class CapacityPlanningService {
  constructor(
    private repository: CapacityRepository,
    private prometheusClient: PrometheusClient | null,
  ) {}

  // 获取仪表盘聚合数据
  async getOverview(tenantId: string): Promise<OverviewResponse> {
    const stats = await this.repository.getOverviewStats(tenantId);
    const activeAlerts = await this.repository.listAlerts({
      tenantId,
      status: 'open',
      pageSize: 5,
    });
    return { ...stats, recentAlerts: activeAlerts.rows };
  }

  // 运行预测（线性回归 + 置信区间）
  async runForecast(tenantId: string, baselineId: string, days: number = 30): Promise<ForecastResult> {
    const baseline = await this.repository.getBaselineById(baselineId, tenantId);
    if (!baseline) throw new NotFoundError('Baseline not found');

    // 1. 从 Prometheus 获取历史数据
    const historicalData = await this.fetchHistoricalMetrics(baseline);

    // 2. 选择算法
    const algorithm = selectAlgorithm(historicalData, baseline.period);

    // 3. 执行预测
    const predictions = this.computeForecast(historicalData, days, algorithm);

    // 4. 计算置信区间
    const { lower, upper } = this.computeConfidenceInterval(predictions);

    // 5. 计算耗尽时间
    const daysToExhaust = this.calculateDaysToExhaust(predictions, baseline.total_capacity);

    // 6. 存储结果
    const saved = await this.repository.createForecast({
      tenant_id: tenantId,
      baseline_id: baselineId,
      forecast_date: new Date(),
      predicted_usage: predictions[0].value,
      confidence_lower: lower,
      confidence_upper: upper,
      model_type: algorithm,
      accuracy_score: this.computeAccuracy(predictions, historicalData),
    });

    return { ...saved, daysToExhaust, dataPoints: historicalData.length };
  }

  // 评估预警规则
  async evaluateAlerts(tenantId: string): Promise<AlertEvaluationResult> {
    const baselines = await this.repository.listBaselines({ tenantId });
    const newAlerts: AlertRow[] = [];

    for (const baseline of baselines.rows) {
      // 规则 1: 阈值超用
      const utilization = (baseline.avg_usage / baseline.total_capacity) * 100;
      if (utilization > 80) {
        const existing = await this.repository.findOpenAlert(tenantId, baseline.id, 'threshold_exceeded');
        if (!existing) {
          newAlerts.push(await this.createThresholdAlert(baseline, utilization));
        }
      }

      // 规则 2: 预测耗尽
      const forecast = await this.runForecast(tenantId, baseline.id, 30);
      if (forecast.daysToExhaust <= 30) {
        const existing = await this.repository.findOpenAlert(tenantId, baseline.id, 'forecast_exhaust');
        if (!existing) {
          newAlerts.push(await this.createForecastExhaustAlert(baseline, forecast));
        }
      }
    }

    return { evaluated: baselines.rows.length, newAlerts: newAlerts.length };
  }

  // 生成扩容建议
  async generateRecommendations(tenantId: string): Promise<Recommendation[]> {
    const alerts = await this.repository.listAlerts({ tenantId, status: 'open' });
    const recommendations: Recommendation[] = [];

    for (const alert of alerts.rows) {
      if (!alert.baseline_id || !alert.predicted_exhaust_date) continue;

      const baseline = await this.repository.getBaselineById(alert.baseline_id, tenantId);
      if (!baseline) continue;

      const daysToExhaust = dayjs(alert.predicted_exhaust_date).diff(dayjs(), 'day');
      const suggestedLimit = this.calculateSuggestedLimit(baseline, daysToExhaust);
      const estimatedCost = this.estimateCostIncrease(baseline, suggestedLimit);

      recommendations.push({
        baseline_id: baseline.id,
        resource_type: baseline.resource_type,
        resource_name: baseline.resource_id,
        current_limit: baseline.total_capacity,
        suggested_limit: suggestedLimit,
        growth_rate: this.calculateGrowthRate(baseline),
        days_to_exhaust: daysToExhaust,
        estimated_cost: estimatedCost,
        priority: this.calculatePriority(daysToExhaust),
      });
    }

    return recommendations.sort((a, b) => a.days_to_exhaust - b.days_to_exhaust);
  }

  // 应用扩容建议（写入 K8s ResourceQuota）
  async applyRecommendation(tenantId: string, recommendationId: string): Promise<ApplyResult> {
    // TODO: 实际集成 K8s API 更新 ResourceQuota
    // 当前阶段：记录操作日志 + 发送通知
    return { success: true, message: '扩容建议已记录，等待执行' };
  }
}
```

### 3.3 前端 API 客户端

**文件**：`orion-frontend/src/api/capacity.ts`

```typescript
import { api } from './client';

// === Types ===

export interface CapacityOverview {
  totalResources: number;
  avgUtilization: number;
  activeAlerts: number;
  pendingRecommendations: number;
  estimatedMonthlyCost: number;
  recentAlerts: CapacityAlert[];
  trendData: { date: string; usage: number }[];
  topResources: { name: string; utilization: number; daysToExhaust: number }[];
}

export interface CapacityBaseline {
  id: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string;
  period: 'daily' | 'weekly' | 'monthly';
  avg_usage: number;
  p50_usage: number;
  p95_usage: number;
  p99_usage: number;
  max_usage: number;
  total_capacity: number;
  utilization_pct: number;
  created_at: string;
  updated_at: string;
}

export interface CapacityForecast {
  id: string;
  baseline_id: string;
  forecast_date: string;
  predicted_usage: number;
  confidence_lower: number;
  confidence_upper: number;
  model_type: 'linear' | 'exponential' | 'seasonal';
  accuracy_score: number;
  created_at: string;
}

export interface CapacityAlert {
  id: string;
  baseline_id: string | null;
  alert_type: 'threshold_exceeded' | 'forecast_exhaust' | 'trend_anomaly';
  severity: 'info' | 'warning' | 'critical';
  current_usage: number;
  predicted_exhaust_date: string | null;
  recommendation: Record<string, any>;
  status: 'open' | 'acknowledged' | 'resolved' | 'ignored';
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  resolved_at: string | null;
}

export interface CapacityRecommendation {
  id: string;
  baseline_id: string;
  resource_type: string;
  resource_name: string;
  current_limit: number;
  suggested_limit: number;
  growth_rate: number;
  days_to_exhaust: number;
  estimated_cost: number;
  priority: 'P0' | 'P1' | 'P2';
  applied: boolean;
}

// === API Functions ===

export const getCapacityOverview = async (): Promise<CapacityOverview> => {
  const response = await api.get<CapacityOverview>('/v1/capacity/overview');
  return response.data.data;
};

export const fetchBaselines = async (params?: {
  resourceType?: string;
  period?: string;
  keyword?: string;
  sortField?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CapacityBaseline[]; total: number }> => {
  const response = await api.get('/v1/capacity/baselines', { params });
  return response.data.data;
};

export const refreshBaselines = async (): Promise<{ success: boolean }> => {
  const response = await api.post('/v1/capacity/baselines/refresh');
  return response.data.data;
};

export const updateBaseline = async (
  id: string,
  updates: { total_capacity?: number; period?: string }
): Promise<CapacityBaseline> => {
  const response = await api.put(`/v1/capacity/baselines/${id}`, updates);
  return response.data.data;
};

export const fetchForecasts = async (params?: {
  baselineId?: string;
  days?: number;
}): Promise<CapacityForecast[]> => {
  const response = await api.get('/v1/capacity/forecasts', { params });
  return response.data.data;
};

export const runForecast = async (params: {
  baseline_id: string;
  days?: number;
}): Promise<CapacityForecast> => {
  const response = await api.post('/v1/capacity/forecasts/run', params);
  return response.data.data;
};

export const fetchAlerts = async (params?: {
  status?: string;
  severity?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CapacityAlert[]; total: number }> => {
  const response = await api.get('/v1/capacity/alerts', { params });
  return response.data.data;
};

export const getAlertDetail = async (id: string): Promise<CapacityAlert> => {
  const response = await api.get(`/v1/capacity/alerts/${id}`);
  return response.data.data;
};

export const acknowledgeAlert = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post(`/v1/capacity/alerts/${id}/acknowledge`);
  return response.data.data;
};

export const resolveAlert = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post(`/v1/capacity/alerts/${id}/resolve`);
  return response.data.data;
};

export const ignoreAlert = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post(`/v1/capacity/alerts/${id}/ignore`);
  return response.data.data;
};

export const fetchRecommendations = async (params?: {
  priority?: string;
  applied?: boolean;
}): Promise<CapacityRecommendation[]> => {
  const response = await api.get('/v1/capacity/recommendations', { params });
  return response.data.data;
};

export const applyRecommendation = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post(`/v1/capacity/recommendations/apply`, { id });
  return response.data.data;
};
```

---

## 4. 验收标准

### 4.1 端到端场景

| 场景编号 | 场景描述 | 验收条件 |
|----------|----------|----------|
| E2E-01 | 新 namespace 接入容量监控 | 调用 `/baselines/refresh` 后，`capacity_baselines` 表中新增对应记录，avg_usage 非空 |
| E2E-02 | 日基线自动生成 | 每日 02:00 UTC 后，查询当日基线，P50/P95/P99 值已填充 |
| E2E-03 | 预测结果可查询 | 调用 `/forecasts/run` 后，返回预测数据，包含 confidence_lower/upper 和 accuracy_score |
| E2E-04 | 阈值预警自动触发 | 当某资源使用率 > 80%，`capacity_alerts` 中自动生成 `threshold_exceeded` 类型预警 |
| E2E-05 | 预测耗尽预警 | 预测 30 天内使用率达 100%，自动生成 `forecast_exhaust` 预警 |
| E2E-06 | 预警确认/忽略流程 | 调用 `/alerts/:id/acknowledge` 后 status 变为 `acknowledged`；调用 `/ignore` 后变为 `ignored` |
| E2E-07 | 扩容建议生成 | 调用 `/recommendations` 返回按优先级排序的建议列表，每项包含 estimated_cost |
| E2E-08 | 仪表盘数据加载 | `/capacity/overview` 页面在 2s 内加载完成，4 个统计卡片数据非空 |
| E2E-09 | 预警去重 | 同一 baseline 的同一类型预警，在状态未关闭前不重复创建 |
| E2E-10 | 租户隔离 | 租户 A 的 API 请求无法查询到租户 B 的容量数据（RLS 策略生效） |

### 4.2 量化指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 基线计算延迟 | < 5min（从 Prometheus 采集到基线可查） | 时间戳差 |
| 预测准确率 | MAPE < 15%（30 天预测窗口） | 回溯对比 actual vs predicted |
| 预警延迟 | < 10min（从触发条件到预警可见） | 时间戳差 |
| 仪表盘加载时间 | P95 < 2s | 前端 Performance API |
| 列表页加载时间 | P95 < 1.5s | 前端 Performance API |
| 定时任务成功率 | > 99%（月度） | 定时任务日志统计 |
| 预警误报率 | < 5%（月度） | 被 ignore 的预警数 / 总预警数 |
| 算法自动切换成功率 | > 95% | 根据数据量自动选择正确算法 |

### 4.3 前端交互完整性审查（按 CLAUDE.md 规则）

#### CRUD 完整性

| 实体 | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| Baseline | 自动采集 + 手动 refresh | 列表 + 详情 | 更新 total_capacity | 软删除（deleted_at） |
| Forecast | 自动/手动运行 | 列表 + 详情 | 不支持（只读快照） | 软删除 |
| Alert | 自动生成 | 列表 + 详情 | 状态流转（ack/resolve/ignore） | 软删除 |
| Recommendation | 自动生成 | 列表 + 应用 | 不支持 | 不适用 |

#### 交互链审查

| 检查项 | 容量规划模块覆盖情况 |
|--------|---------------------|
| 每个按钮有 onClick？ | 所有按钮/链接均有 handler |
| 操作后有 feedback？ | `message.success/error` 全覆盖 |
| 有 loading 状态？ | 异步操作均有 `loading/disabled` |
| 空状态有引导？ | 列表为空时 `Empty` + 引导按钮 |
| 表单有校验？ | 基线更新有 `rules` |
| 保存失败有提示？ | 所有 catch 分支有 `message.error` |

---

## 5. 文件变更清单

### 5.1 后端新增/修改文件

| 文件路径 | 操作 | 描述 |
|----------|------|------|
| `orion-platform-service/src/repositories/CapacityRepository.ts` | 新增 | 容量模块数据访问层 |
| `orion-platform-service/src/services/capacity/CapacityPlanningService.ts` | 新增 | 容量规划核心业务逻辑 |
| `orion-platform-service/src/services/capacity/index.ts` | 新增 | 模块入口 |
| `orion-platform-service/src/api/controllers/CapacityController.ts` | 新增 | HTTP 控制器 |
| `orion-platform-service/src/api/capacity-routes.ts` | 新增 | 路由注册 |
| `orion-platform-service/src/api/routes.ts` | 修改 | 注册 capacity 路由 |
| `orion-platform-service/src/services/cron/CapacityCronJobs.ts` | 新增 | 定时任务定义 |
| `orion-platform-service/src/db/migrations/184_create_capacity_tables.sql` | 新增 | DDL（已有） |

### 5.2 前端新增文件

| 文件路径 | 操作 | 描述 |
|----------|------|------|
| `orion-frontend/src/api/capacity.ts` | 新增 | API 客户端 |
| `orion-frontend/src/pages/capacity/Overview/index.tsx` | 新增 | 容量概览仪表盘 |
| `orion-frontend/src/pages/capacity/Baselines/index.tsx` | 新增 | 资源基线列表 |
| `orion-frontend/src/pages/capacity/Forecasts/index.tsx` | 新增 | 容量预测页 |
| `orion-frontend/src/pages/capacity/Alerts/index.tsx` | 新增 | 容量预警列表 |
| `orion-frontend/src/pages/capacity/AlertDetail/index.tsx` | 新增 | 预警详情页 |
| `orion-frontend/src/pages/capacity/Recommendations/index.tsx` | 新增 | 扩容建议页 |
| `orion-frontend/src/router/routes.tsx` | 修改 | 注册容量路由 |

---

## 6. Design Token 使用总结

| Token | 使用场景 | 代码引用 |
|-------|----------|----------|
| `colors.primary[500]` (#3370E6) | 主操作色、趋势线、标题图标 | 全局 |
| `colors.success[500]` (#52c41a) | 低使用率指标、已解决状态 | 水位条、状态标签 |
| `colors.warning[500]` (#faad14) | 中/高使用率、警告标签 | 水位条、预警类型标签 |
| `colors.error[500]` (#f5222d) | 超高使用率 (>90%)、严重标签 | 水位条、P0 优先级 |
| `colors.purple[500]` (#7C5CFC) | 预测线、置信区间 | 趋势图 |
| `colors.neutral[500]` (#8c8c8c) | 副标题、次要文字 | 页面描述 |
| `colors.neutral[900]` (#1f1f1f) | 主标题 | 页面标题 |
| `componentRadius.card` (12px) | 所有卡片圆角 | Card 组件 |
| `componentRadius.button.md` (6px) | 按钮圆角 | Button 组件 |
| `shadows.card` | 卡片阴影 | Card 组件 |
| `spacing.md` (16px) | 卡片间距、Section 间距 | Row gutter, marginBottom |
| `spacing.sm` (8px) | 元素间距 | Space gap |
