# Comprehensive Visualization Upgrade Design

**Goal:** 完成所有 Dashboard 页面的 ECharts 可视化覆盖，并为高价值非 Dashboard 页面添加专业图表

**Architecture:** 扩展现有 `src/components/charts/` 组件库 → 补全 5 个新图表类型 → 逐页面替换手写图表 → 为 5 个核心非 Dashboard 页面添加可视化

**Tech Stack:** echarts v6.0.0, echarts-for-react, React 18, TypeScript, Ant Design 5, Design Tokens

---

## Part 1: 图表组件库扩

### 1.1 新增 5 个 ECharts 组件

| 组件 | ECharts 类型 | 用途 | 使用场景 |
|------|-------------|------|----------|
| **ScatterChart** | scatter | 散点图、气泡图 | CMDB 依赖关系、变更影响分析、性能分布 |
| **RadarChart** | radar | 雷达图 | 工程师能力画像、SLA 多维评估、安全评分 |
| **TimelineChart** | line + custom | 时间线/甘特图 | 事件流、审批时间线、部署时间轴 |
| **SankeyChart** | sankey | 桑基图 | 事件流转、审批流转、成本流向 |
| **TreeMap** | treemap | 树图 | CMDB 层级、成本分解、资源分布 |

### 1.2 组件规范

#### ScatterChart

```typescript
interface ScatterDataPoint {
  x: number;
  y: number;
  value?: number;        // 气泡大小（可选）
  label?: string;        // tooltip 标签
  series?: string;       // 分组
}

interface ScatterChartProps {
  title?: string;
  data: ScatterDataPoint[];
  height?: number;       // 默认 240
  xAxisLabel?: string;   // X 轴标签
  yAxisLabel?: string;   // Y 轴标签
  showBubble?: boolean;  // 是否用气泡大小映射 value
  colorBy?: 'series' | 'item';
  loading?: boolean;
}
```

#### RadarChart

```typescript
interface RadarIndicator {
  name: string;
  max: number;
  min?: number;          // 默认 0
}

interface RadarSeries {
  name: string;
  values: number[];      // 对应 indicator 顺序
  color?: string;
}

interface RadarChartProps {
  title?: string;
  indicators: RadarIndicator[];
  series: RadarSeries[];
  height?: number;       // 默认 240
  shape?: 'polygon' | 'circle';
  loading?: boolean;
}
```

#### TimelineChart

```typescript
interface TimelineEvent {
  name: string;
  start: string;         // ISO 时间或时间戳
  end: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  group?: string;        // 分组（泳道）
}

interface TimelineChartProps {
  title?: string;
  events: TimelineEvent[];
  height?: number;       // 默认 300
  showGroup?: boolean;   // 显示分组泳道
  timeFormat?: string;   // tooltip 时间格式
  loading?: boolean;
}
```

#### SankeyChart

```typescript
interface SankeyNode {
  name: string;
  category?: string;
}

interface SankeyLink {
  source: string;        // 节点 name
  target: string;
  value: number;
}

interface SankeyChartProps {
  title?: string;
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;       // 默认 300
  orient?: 'horizontal' | 'vertical';
  loading?: boolean;
}
```

#### TreeMap

```typescript
interface TreeMapNode {
  name: string;
  value: number;
  children?: TreeMapNode[];
  color?: string;
}

interface TreeMapChartProps {
  title?: string;
  data: TreeMapNode[];
  height?: number;       // 默认 300
  showLabel?: boolean;
  leafDepth?: number;    // 展开深度
  loading?: boolean;
}
```

---

## Part 2: 剩余 Dashboard 收尾

### 2.1 需要替换的 Dashboard 页面

| 页面 | 手写图表数 | 需要替换为 | 涉及行数 |
|------|-----------|-----------|---------|
| **EngineerDashboard** | 8 | StatCard + BarChart + TrendLineChart | ~500 |
| **ManagerDashboard** | 12 | BarChart + PieChart + TrendLineChart | ~600 |
| **FinOpsDashboard** | 9 | TrendLineChart + PieChart + StatCard | ~400 |
| **SbomDashboard** | 9 | PieChart + BarChart + StatCard | ~350 |
| **RiskDashboard** | 7 | HeatmapChart + BarChart + StatCard | ~400 |
| **AICostDashboard** | 部分 | TrendLineChart + PieChart | ~300 |
| **DashboardNew** | 9 | StatCard + TrendLineChart | ~400 |

### 2.2 各页面图表映射

#### EngineerDashboard（个人效能看板）
- 当前：4× Statistic（工单/代码/部署/缺陷） → StatCard
- 当前：2× Progress（代码覆盖率/测试通过率） → GaugeChart
- 新增：个人效能趋势 → TrendLineChart
- 新增：代码贡献分布 → BarChart

#### ManagerDashboard（团队负载）
- 当前：团队负载进度条 → GaugeChart
- 当前：转派分析 → PieChart
- 新增：团队效能对比 → BarChart
- 新增：周环比趋势 → TrendLineChart

#### FinOpsDashboard（成本分析）
- 当前：成本趋势 → TrendLineChart
- 当前：预算占比 → PieChart
- 新增：服务成本排行 → BarChart
- 新增：预算利用率 → GaugeChart

#### SbomDashboard（软件物料清单）
- 当前：许可证分布 → PieChart
- 当前：组件风险等级 → BarChart
- 新增：合规率 → GaugeChart
- 新增：组件依赖树 → TreeMap

#### RiskDashboard（风险分析）
- 当前：风险等级分布 → BarChart
- 当前：时间×严重级别 → HeatmapChart（已有）
- 新增：风险趋势 → TrendLineChart
- 新增：风险等级占比 → PieChart

#### AICostDashboard（AI 成本）
- 当前：Token 消耗趋势 → TrendLineChart
- 当前：模型使用占比 → PieChart

#### DashboardNew（通用仪表盘）
- 当前：KPI 卡片 → StatCard
- 当前：趋势图 → TrendLineChart

---

## Part 3: 核心非 Dashboard 页面可视化

选取 5 个高价值页面做完整可视化升级：

### 3.1 Monitoring（监控仪表盘）

**当前状态：** 纯表格，80 行
**设计文档：** `docs/frontend/monitoring-frontend-design.md`

| 视觉元素 | 图表类型 | 数据来源 |
|----------|---------|---------|
| 服务健康状态 | GaugeChart | `/api/v1/monitoring/health` |
| 指标趋势（CPU/Mem/Request） | TrendLineChart | `/api/v1/monitoring/metrics` |
| 告警统计（按严重级别） | BarChart | `/api/v1/monitoring/alerts` |
| 告警规则分布 | PieChart | `/api/v1/monitoring/rules` |
| 活跃告警列表 | Table | `/api/v1/monitoring/alerts` |

### 3.2 AlertList（告警管理）

**当前状态：** 562 行，纯表格 + 筛选
**需新增：**

| 视觉元素 | 图表类型 |
|----------|---------|
| 告警趋势（近 7 天） | TrendLineChart |
| 严重级别分布 | PieChart |
| 告警来源 TOP10 | BarChart |
| MTTR（平均解决时间） | StatCard |

### 3.3 Queue（队列管理）

**当前状态：** 653 行，纯表格

| 视觉元素 | 图表类型 |
|----------|---------|
| 队列深度趋势 | TrendLineChart |
| 处理延迟分布 | ScatterChart |
| 队列负载热力图 | HeatmapChart |
| 消费速率 | StatCard |

### 3.4 OnCall（值班管理）

**当前状态：** 795 行，纯表格

| 视觉元素 | 图表类型 |
|----------|---------|
| 值班响应时间趋势 | TrendLineChart |
| 值班负载热力图 | HeatmapChart |
| 工程师负载对比 | BarChart |
| 响应 SLA 合规率 | GaugeChart |

### 3.5 ChangeIntelligence（变更智能）

**当前状态：** 551 行，纯表格

| 视觉元素 | 图表类型 |
|----------|---------|
| 变更成功率趋势 | TrendLineChart |
| 变更影响分布 | ScatterChart |
| 变更类型占比 | PieChart |
| 变更流转桑基图 | SankeyChart |

---

## Part 4: 其余页面渐进式升级

### 4.1 页面清单

| 页面 | 行数 | 建议图表 |
|------|------|---------|
| **CMDB** | 1063 | 资源层级 TreeMap、依赖关系 ScatterChart |
| **Approvals** | 778 | 审批通过率 GaugeChart、处理时长 TrendLineChart |
| **NotificationCenter** | 970 | 通知频率 TrendLineChart、渠道分布 PieChart |
| **EventBus** | 437 | 事件流量 TrendLineChart、事件类型 SankeyChart |
| **AIGateway** | 294 | Token 消耗 TrendLineChart、模型调用 PieChart |
| **Diagnostic** | 78 | 诊断结果 RadarChart（多维评分） |
| **SelfHealing** | 67 | 自愈事件 TrendLineChart、成功率 GaugeChart |

### 4.2 优先级

P0: CMDB, Approvals — 资源管理和审批是核心运维流程
P1: NotificationCenter, EventBus — 可观测性重要组成
P2: AIGateway, Diagnostic, SelfHealing — 辅助功能，页面较小

---

## 实施顺序

```
Phase 1: 图表组件库扩展（5 个新组件 + 测试）
    ↓
Phase 2: 剩余 Dashboard 收尾（7 个页面）
    ↓
Phase 3: 核心非 Dashboard 页面（5 个页面）
    ↓
Phase 4: 其余页面渐进式（7 个页面）
```

---

## 测试策略

1. **新增图表组件：** 每个组件至少 3 个测试
   - 基础渲染测试
   - 数据传递测试
   - Loading/Error 状态测试

2. **页面重构：** 每个页面至少 2 个测试
   - 图表组件渲染验证
   - API 数据对接验证

3. **新增页面可视化：** 每个页面至少 2 个测试
   - 图表渲染验证
   - 数据加载验证

---

## 验收标准

1. 所有 Dashboard 页面无手写 div/Statistic/Progress 图表
2. 新增 5 个图表组件均有测试通过
3. 5 个核心非 Dashboard 页面有可视化元素
4. `npx vitest run` 全部通过
5. `npx tsc --noEmit` 无新增类型错误
