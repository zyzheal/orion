# Dashboard Visual Enhancement Design (ECharts Integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-written div charts with professional ECharts visualizations across all Dashboard pages

**Architecture:** Install echarts + echarts-for-react → create unified chart component library → progressively refactor 7 Dashboard pages to use professional charts (line, bar, pie, gauge, heatmap)

**Tech Stack:** echarts v5.x, echarts-for-react, React, TypeScript, Ant Design, Design Tokens

---

## Architecture

### Component Library

```
orion-frontend/src/components/charts/
├── ChartProvider.tsx       # ECharts theme config, auto-extracts from Design Tokens
├── TrendLineChart.tsx      # Line/area charts for trends, time series
├── BarChart.tsx            # Bar/stacked bar for comparisons, distributions
├── PieChart.tsx            # Pie/donut for proportions, categories
├── GaugeChart.tsx          # Gauge for SLA, budget utilization
├── HeatmapChart.tsx        # Heatmap for time×severity density
├── StatCard.tsx            # KPI card with sparkline trend
└── index.ts               # Unified exports
```

### Design Principles
1. **Unified theme** — colors auto-extracted from `colors.ts` Design Tokens, consistent with platform
2. **Responsive** — all charts auto-resize, mobile degrades to tables
3. **Loading/Error states** — built-in loading overlay and error fallback
4. **Data-driven** — pass structured data, charts render automatically, source-agnostic (API/mock)

---

## Component Specifications

### ChartProvider — Theme Configuration

```typescript
interface ChartTheme {
  colors: {
    palette: string[];       // 10-color plate from Design Tokens
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  dark: boolean;
  fontSize: number;
  fontFamily: string;
}
```

Auto-maps from `colors.ts`. Supports light/dark mode switching with automatic redraw.

---

### TrendLineChart — Line/Area Chart

```typescript
interface TrendDataPoint {
  period: string;            // Timestamp or formatted date
  value: number;
  label?: string;            // Legend label
}

interface TrendLineChartProps {
  title?: string;
  data: TrendDataPoint[][];  // Multi-series: [[series1], [series2]]
  height?: number;           // Default 240
  showArea?: boolean;        // Show area fill
  smooth?: boolean;          // Smooth curve
  tooltipFormatter?: (point: TrendDataPoint) => string;
  loading?: boolean;
  error?: Error | null;
}
```

Replaces ExecutiveDashboard lines 391-445 (hand-written div bars) → 3 lines of component call.

---

### BarChart — Bar Chart

```typescript
interface BarDataItem {
  label: string;
  value: number;
  series?: string;           // Group label
}

interface BarChartProps {
  title?: string;
  data: BarDataItem[];
  height?: number;           // Default 240
  stacked?: boolean;         // Stacked mode
  horizontal?: boolean;      // Horizontal bars
  colorBy?: 'series' | 'item';
  loading?: boolean;
}
```

Used in: FinOps cost comparison, Risk distribution, Efficiency deployment frequency.

---

### PieChart — Pie/Donut Chart

```typescript
interface PieDataItem {
  name: string;
  value: number;
  color?: string;            // Optional custom color
}

interface PieChartProps {
  title?: string;
  data: PieDataItem[];
  variant?: 'pie' | 'donut'; // Pie or donut
  showLabel?: boolean;       // Percentage labels
  centerLabel?: boolean;     // Show total in donut center
  height?: number;           // Default 200
  loading?: boolean;
}
```

Used in: Executive category distribution (replaces lines 653-690), FinOps budget ratio, Sbom license distribution.

---

### GaugeChart — Gauge

```typescript
interface GaugeChartProps {
  value: number;             // 0-100
  title: string;
  max?: number;              // Custom max value
  thresholds?: {
    warning: number;         // Warning threshold
    danger: number;          // Danger threshold
  };
  size?: number;             // Default 160
  unit?: string;             // '%' | 'h' | '个'
}
```

Used in: SLA compliance rate, budget utilization, system health.

---

### HeatmapChart — Heatmap

```typescript
interface HeatmapCell {
  x: string;                 // X-axis label (Mon/Tue/Wed)
  y: string;                 // Y-axis label (0-4h/4-8h)
  value: number;
}

interface HeatmapChartProps {
  title?: string;
  data: HeatmapCell[];
  xAxis: string[];
  yAxis: string[];
  colorScale?: 'green-red' | 'blue-red' | 'custom';
  height?: number;
  loading?: boolean;
}
```

Used in: Risk time×severity distribution, Efficiency deployment period heatmap.

---

### StatCard — KPI Card with Trend

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    good: 'up' | 'down';     // Which direction is positive
  };
  sparklineData?: number[];  // Mini sparkline data
  color?: string;            // Theme color
}
```

Replaces ExecutiveDashboard lines 330-388 (hand-written KPI cards).

---

## Refactoring Scope by Dashboard

| Dashboard | Current | After | New Charts |
|-----------|---------|-------|------------|
| **ExecutiveDashboard** | Hand-written div bars | TrendLine + Pie + Gauge | Ticket trend line, category donut, SLA gauge |
| **ManagerDashboard** | Table + Progress | BarChart + TrendLine | Team performance bars, trend comparison |
| **FinOpsDashboard** | Table | BarChart + TrendLine + Pie | Cost trends, budget pie |
| **RiskDashboard** | Table + Tag | Heatmap + BarChart | Risk heatmap (time×severity) |
| **MetricsDashboard** | MetricCard | TrendLine + Gauge | Metric trends, health gauge |
| **EfficiencyDashboard** | Table | TrendLine + BarChart | DORA trends, deployment frequency |
| **SbomDashboard** | Table | PieChart + BarChart | Compliance pie, component bars |

---

## Implementation Phases

### Phase 1: Infrastructure
- Install `echarts` + `echarts-for-react`
- Create `ChartProvider.tsx` (theme config)
- Create base components: `BarChart`, `TrendLineChart`, `PieChart`
- Each component with tests

### Phase 2: Executive Dashboard
- Highest visual priority, most complete dashboard
- Replace all hand-written div charts → professional charts
- Serves as reference template for other dashboards

### Phase 3: Manager + Engineer Dashboards
- Reuse Phase 2 pattern
- Add team performance bar charts

### Phase 4: FinOps + Efficiency Dashboards
- Cost trend charts, DORA metrics
- Add GaugeChart component

### Phase 5: Risk + Metrics + Sbom Dashboards
- Add HeatmapChart component
- Risk heatmap, compliance pie charts

---

## Bundle Size Control

Use on-demand imports to keep bundle size manageable:

```typescript
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, GaugeChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, GaugeChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
```

Estimated bundle: ~150KB gzip (vs current 0KB for charts).

---

## Acceptance Criteria

1. Executive Dashboard has zero hand-written div charts remaining
2. All new chart components have tests (at least render + data tests)
3. `npx vitest run` all passing
4. `npx tsc --noEmit` no new errors
5. New bundle size increase < 200KB gzip
