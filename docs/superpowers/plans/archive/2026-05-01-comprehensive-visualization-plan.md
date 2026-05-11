# Comprehensive Visualization Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展图表组件库至 11 个类型，完成所有 Dashboard 页面 ECharts 可视化覆盖，为 12 个非 Dashboard 页面添加专业图表

**Architecture:** 分 4 个 Phase：Phase 1 新增 5 个 ECharts 图表组件 → Phase 2 替换 7 个 Dashboard 手写图表 → Phase 3 为 5 个核心非 Dashboard 页面添加可视化 → Phase 4 为 7 个其余页面添加可视化。每个 Phase 可独立提交和测试。

**Tech Stack:** echarts v6.0.0, echarts-for-react, React 18, TypeScript, Ant Design 5, Vitest, Design Tokens

---

## Pre-requisites

- Working directory: `/Users/heal/orion-design/orion-frontend`
- Branch: `feat/frontend-gap-implementation`
- 已有 6 个图表组件：BarChart, TrendLineChart, PieChart, GaugeChart, HeatmapChart, StatCard
- 已有 echarts-init.ts 注册了 LineChart, BarChart, PieChart, GaugeChart, HeatmapChart
- 全量测试 498 passed | 6 skipped (504 total)

---

## Phase 1: 图表组件库扩展

### Task 1: ScatterChart 组件

**Files:**
- Create: `src/components/charts/ScatterChart.tsx`
- Modify: `src/components/charts/echarts-init.ts`
- Modify: `src/components/charts/index.ts`
- Create: `src/components/charts/__tests__/ScatterChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/charts/__tests__/ScatterChart.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScatterChart } from '../ScatterChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="scatter-chart" data-option={JSON.stringify(props.option)} />
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('ScatterChart', () => {
  const sampleData = [
    { x: 10, y: 20, label: 'A' },
    { x: 30, y: 40, label: 'B' },
    { x: 50, y: 60, label: 'C' },
  ];

  it('renders with title', () => {
    render(wrap(<ScatterChart title="Test Scatter" data={sampleData} />));
    expect(screen.getByText('Test Scatter')).toBeTruthy();
  });

  it('renders scatter chart', () => {
    render(wrap(<ScatterChart data={sampleData} />));
    const chart = screen.getByTestId('scatter-chart');
    expect(chart).toBeTruthy();
  });

  it('renders bubble mode with value', () => {
    const bubbleData = [
      { x: 10, y: 20, value: 5, label: 'A' },
      { x: 30, y: 40, value: 15, label: 'B' },
    ];
    render(wrap(<ScatterChart data={bubbleData} showBubble={true} />));
    const chart = screen.getByTestId('scatter-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<ScatterChart data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/ScatterChart.test.tsx`
Expected: FAIL with "ScatterChart is not exported"

- [ ] **Step 3: Register ScatterChart in echarts-init.ts**

```typescript
// src/components/charts/echarts-init.ts — modify imports
import {
  LineChart, BarChart, PieChart, GaugeChart, HeatmapChart,
  ScatterChart, RadarChart, SankeyChart, TreemapChart,
} from 'echarts/charts';

import {
  GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, DatasetComponent, TransformComponent,
  AriaComponent, RadarComponent,
} from 'echarts/components';

echarts.use([
  LineChart, BarChart, PieChart, GaugeChart, HeatmapChart,
  ScatterChart, RadarChart, SankeyChart, TreemapChart,
  GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, DatasetComponent, TransformComponent,
  AriaComponent, RadarComponent,
  CanvasRenderer,
]);
```

- [ ] **Step 4: Write ScatterChart component**

```typescript
// src/components/charts/ScatterChart.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface ScatterDataPoint {
  x: number;
  y: number;
  value?: number;
  label?: string;
  series?: string;
}

export interface ScatterChartProps {
  title?: string;
  data: ScatterDataPoint[];
  height?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showBubble?: boolean;
  colorBy?: 'series' | 'item';
  loading?: boolean;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({
  title,
  data,
  height = 240,
  xAxisLabel,
  yAxisLabel,
  showBubble = false,
  colorBy = 'item',
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const hasSeries = data.some((d) => d.series);
    const seriesNames = hasSeries
      ? [...new Set(data.map((d) => d.series).filter(Boolean))]
      : [''];

    const seriesList = seriesNames.map((name, idx) => {
      const seriesData = data
        .filter((d) => !d.series || d.series === name)
        .map((d) => ({
          value: showBubble && d.value ? [d.x, d.y, d.value] : [d.x, d.y],
          name: d.label,
        }));

      return {
        name: name || 'Default',
        type: 'scatter' as const,
        data: seriesData,
        symbolSize: showBubble
          ? (val: number[]) => Math.max(val[2] ?? 5, 5)
          : 8,
        color: theme.palette[idx % theme.palette.length],
      };
    });

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: { data: { value: number[]; name?: string } }) => {
          const v = p.data.value;
          return `${p.data.name || ''}<br/>X: ${v[0]}, Y: ${v[1]}${v[2] ? `, Size: ${v[2]}` : ''}`;
        },
      },
      legend: hasSeries
        ? { data: seriesNames, bottom: 0, textStyle: { color: theme.textColor, fontSize: 11 } }
        : undefined,
      grid: { top: title ? 40 : 10, right: 20, bottom: hasSeries ? 40 : 20, left: 50 },
      xAxis: {
        type: 'value' as const,
        name: xAxisLabel,
        nameTextStyle: { color: theme.textColor, fontSize: 10 },
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
        splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'value' as const,
        name: yAxisLabel,
        nameTextStyle: { color: theme.textColor, fontSize: 10 },
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
        splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
      },
      series: seriesList,
    };
  }, [data, title, xAxisLabel, yAxisLabel, showBubble, colorBy, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="scatter-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 5: Export from index.ts**

```typescript
// src/components/charts/index.ts — add these lines:
export { ScatterChart } from './ScatterChart';
export type { ScatterChartProps, ScatterDataPoint } from './ScatterChart';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/charts/__tests__/ScatterChart.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/components/charts/ScatterChart.tsx src/components/charts/__tests__/ScatterChart.test.tsx src/components/charts/echarts-init.ts src/components/charts/index.ts
git commit -m "feat(charts): add ScatterChart component with bubble support"
```

---

### Task 2: RadarChart 组件

**Files:**
- Create: `src/components/charts/RadarChart.tsx`
- Create: `src/components/charts/__tests__/RadarChart.test.tsx`
- Modify: `src/components/charts/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/charts/__tests__/RadarChart.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RadarChart } from '../RadarChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="radar-chart" data-option={JSON.stringify(props.option)} />
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('RadarChart', () => {
  const indicators = [
    { name: '速度', max: 100 },
    { name: '质量', max: 100 },
    { name: '效率', max: 100 },
    { name: '协作', max: 100 },
    { name: '创新', max: 100 },
  ];
  const series = [
    { name: '张伟', values: [85, 90, 78, 88, 72] },
  ];

  it('renders with title', () => {
    render(wrap(<RadarChart title="能力画像" indicators={indicators} series={series} />));
    expect(screen.getByText('能力画像')).toBeTruthy();
  });

  it('renders radar chart', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders multiple series', () => {
    const multiSeries = [
      { name: '张伟', values: [85, 90, 78, 88, 72] },
      { name: '李娜', values: [75, 85, 92, 70, 80] },
    ];
    render(wrap(<RadarChart indicators={indicators} series={multiSeries} />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders circle shape', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} shape="circle" />));
    const chart = screen.getByTestId('radar-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<RadarChart indicators={indicators} series={series} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/RadarChart.test.tsx`
Expected: FAIL with "RadarChart is not exported"

- [ ] **Step 3: Write RadarChart component**

```typescript
// src/components/charts/RadarChart.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface RadarIndicator {
  name: string;
  max: number;
  min?: number;
}

export interface RadarSeries {
  name: string;
  values: number[];
  color?: string;
}

export interface RadarChartProps {
  title?: string;
  indicators: RadarIndicator[];
  series: RadarSeries[];
  height?: number;
  shape?: 'polygon' | 'circle';
  loading?: boolean;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  title,
  indicators,
  series,
  height = 240,
  shape = 'polygon',
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const maxVal = Math.max(...indicators.map((i) => i.max), 100);

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: { trigger: 'item' as const },
      legend: {
        data: series.map((s) => s.name),
        bottom: 0,
        textStyle: { color: theme.textColor, fontSize: 11 },
      },
      radar: {
        indicator: indicators.map((i) => ({
          name: i.name,
          max: i.max ?? maxVal,
          min: i.min ?? 0,
        })),
        shape,
        radius: '65%',
        axisName: { color: theme.textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: theme.borderColor } },
        splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
        splitArea: {
          areaStyle: {
            color: [theme.borderColor + '10', theme.borderColor + '20'],
          },
        },
      },
      series: [
        {
          type: 'radar' as const,
          data: series.map((s, idx) => ({
            name: s.name,
            value: s.values,
            itemStyle: { color: s.color ?? theme.palette[idx % theme.palette.length] },
            areaStyle: { opacity: 0.15 },
            lineStyle: { width: 2 },
          })),
        },
      ],
    };
  }, [indicators, series, title, shape, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="radar-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Export from index.ts**

```typescript
// src/components/charts/index.ts — add:
export { RadarChart } from './RadarChart';
export type { RadarChartProps, RadarIndicator, RadarSeries } from './RadarChart';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/charts/__tests__/RadarChart.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/RadarChart.tsx src/components/charts/__tests__/RadarChart.test.tsx src/components/charts/index.ts
git commit -m "feat(charts): add RadarChart for multi-dimensional assessment"
```

---

### Task 3: TimelineChart 组件

**Files:**
- Create: `src/components/charts/TimelineChart.tsx`
- Create: `src/components/charts/__tests__/TimelineChart.test.tsx`
- Modify: `src/components/charts/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/charts/__tests__/TimelineChart.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineChart } from '../TimelineChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="timeline-chart" data-option={JSON.stringify(props.option)} />
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('TimelineChart', () => {
  const sampleEvents = [
    { name: '部署 v1.0', start: '2024-03-20T10:00:00Z', end: '2024-03-20T10:30:00Z', status: 'success' as const },
    { name: '部署 v1.1', start: '2024-03-20T14:00:00Z', end: '2024-03-20T14:45:00Z', status: 'error' as const },
  ];

  it('renders with title', () => {
    render(wrap(<TimelineChart title="部署时间线" events={sampleEvents} />));
    expect(screen.getByText('部署时间线')).toBeTruthy();
  });

  it('renders timeline', () => {
    render(wrap(<TimelineChart events={sampleEvents} />));
    const chart = screen.getByTestId('timeline-chart');
    expect(chart).toBeTruthy();
  });

  it('renders with group lanes', () => {
    const groupedEvents = [
      { name: '部署 A', start: '2024-03-20T10:00:00Z', end: '2024-03-20T10:30:00Z', group: '服务A', status: 'success' as const },
      { name: '部署 B', start: '2024-03-20T11:00:00Z', end: '2024-03-20T11:20:00Z', group: '服务B', status: 'warning' as const },
    ];
    render(wrap(<TimelineChart events={groupedEvents} showGroup={true} />));
    const chart = screen.getByTestId('timeline-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TimelineChart events={sampleEvents} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/TimelineChart.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write TimelineChart component**

```typescript
// src/components/charts/TimelineChart.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface TimelineEvent {
  name: string;
  start: string;
  end: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  group?: string;
}

export interface TimelineChartProps {
  title?: string;
  events: TimelineEvent[];
  height?: number;
  showGroup?: boolean;
  timeFormat?: string;
  loading?: boolean;
}

const statusColor = (status: string | undefined, theme: { success: string; error: string; warning: string; info: string }): string => {
  switch (status) {
    case 'success': return theme.success;
    case 'error': return theme.error;
    case 'warning': return theme.warning;
    case 'info': return theme.info;
    default: return theme.info;
  }
};

export const TimelineChart: React.FC<TimelineChartProps> = ({
  title,
  events,
  height = 300,
  showGroup = false,
  timeFormat,
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    if (events.length === 0) return {};

    const startTime = Math.min(...events.map((e) => new Date(e.start).getTime()));
    const endTime = Math.max(...events.map((e) => new Date(e.end).getTime()));
    const padding = (endTime - startTime) * 0.05;

    const groups = showGroup
      ? [...new Set(events.map((e) => e.group || 'Default'))]
      : ['All'];

    const data = events.map((e, idx) => ({
      name: e.name,
      value: [
        showGroup ? groups.indexOf(e.group || 'Default') : 0,
        new Date(e.start).getTime(),
        new Date(e.end).getTime(),
        idx,
      ],
      status: e.status,
      itemStyle: { color: statusColor(e.status, theme) },
    }));

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: {
        formatter: (p: { data: { name: string; value: [number, number, number] } }) => {
          const startDate = new Date(p.data.value[1]).toLocaleString();
          const endDate = new Date(p.data.value[2]).toLocaleString();
          const duration = Math.round((p.data.value[2] - p.data.value[1]) / 60000);
          return `${p.data.name}<br/>${startDate} → ${endDate}<br/>Duration: ${duration}m`;
        },
      },
      grid: { top: title ? 50 : 20, right: 30, bottom: 30, left: showGroup ? 80 : 40 },
      xAxis: {
        type: 'time' as const,
        min: startTime - padding,
        max: endTime + padding,
        axisLabel: {
          color: theme.textColor,
          fontSize: 10,
          formatter: timeFormat ?? '{MM}-{dd} {HH}:{mm}',
        },
        axisLine: { lineStyle: { color: theme.borderColor } },
        splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category' as const,
        data: groups,
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      series: [
        {
          type: 'custom' as const,
          renderItem: (_params: unknown, api: { value: (i: number, j: number) => number; coord: (i: number, t: number) => number[] }) => {
            const start = api.coord([api.value(0), api.value(1)]);
            const end = api.coord([api.value(0), api.value(2)]);
            const barHeight = 20;
            return {
              type: 'rect' as const,
              shape: {
                x: start[0],
                y: start[1] - barHeight / 2,
                width: end[0] - start[0],
                height: barHeight,
                r: 3,
              },
              style: api.style(),
            };
          },
          data,
          encode: { x: [1, 2], y: 0 },
        },
      ],
    };
  }, [events, title, showGroup, timeFormat, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="timeline-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Export from index.ts**

```typescript
// src/components/charts/index.ts — add:
export { TimelineChart } from './TimelineChart';
export type { TimelineChartProps, TimelineEvent } from './TimelineChart';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/charts/__tests__/TimelineChart.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/TimelineChart.tsx src/components/charts/__tests__/TimelineChart.test.tsx src/components/charts/index.ts
git commit -m "feat(charts): add TimelineChart with swimlane support"
```

---

### Task 4: SankeyChart 组件

**Files:**
- Create: `src/components/charts/SankeyChart.tsx`
- Create: `src/components/charts/__tests__/SankeyChart.test.tsx`
- Modify: `src/components/charts/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/charts/__tests__/SankeyChart.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SankeyChart } from '../SankeyChart';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="sankey-chart" data-option={JSON.stringify(props.option)} />
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('SankeyChart', () => {
  const sampleData = {
    nodes: [
      { name: '来源 A' },
      { name: '来源 B' },
      { name: '中转' },
      { name: '目标' },
    ],
    links: [
      { source: '来源 A', target: '中转', value: 10 },
      { source: '来源 B', target: '中转', value: 20 },
      { source: '中转', target: '目标', value: 30 },
    ],
  };

  it('renders with title', () => {
    render(wrap(<SankeyChart title="流转图" nodes={sampleData.nodes} links={sampleData.links} />));
    expect(screen.getByText('流转图')).toBeTruthy();
  });

  it('renders sankey diagram', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} />));
    const chart = screen.getByTestId('sankey-chart');
    expect(chart).toBeTruthy();
  });

  it('renders vertical orientation', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} orient="vertical" />));
    const chart = screen.getByTestId('sankey-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<SankeyChart nodes={sampleData.nodes} links={sampleData.links} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/SankeyChart.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write SankeyChart component**

```typescript
// src/components/charts/SankeyChart.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface SankeyNode {
  name: string;
  category?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyChartProps {
  title?: string;
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  orient?: 'horizontal' | 'vertical';
  loading?: boolean;
}

export const SankeyChart: React.FC<SankeyChartProps> = ({
  title,
  nodes,
  links,
  height = 300,
  orient = 'horizontal',
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => ({
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: { trigger: 'item' as const, triggerOn: 'mousemove' as const },
    series: [
      {
        type: 'sankey' as const,
        layout: 'none' as const,
        orient,
        data: nodes.map((n) => ({ name: n.name })),
        links: links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
        emphasis: { focus: 'adjacency' as const },
        lineStyle: { color: 'source' as const, curveness: 0.5 },
        label: { color: theme.textColor, fontSize: 11 },
        itemStyle: { borderWidth: 0 },
      },
    ],
  }), [nodes, links, title, orient, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="sankey-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Export from index.ts**

```typescript
// src/components/charts/index.ts — add:
export { SankeyChart } from './SankeyChart';
export type { SankeyChartProps, SankeyNode, SankeyLink } from './SankeyChart';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/charts/__tests__/SankeyChart.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/SankeyChart.tsx src/components/charts/__tests__/SankeyChart.test.tsx src/components/charts/index.ts
git commit -m "feat(charts): add SankeyChart for flow visualization"
```

---

### Task 5: TreeMap 组件

**Files:**
- Create: `src/components/charts/TreeMap.tsx`
- Create: `src/components/charts/__tests__/TreeMap.test.tsx`
- Modify: `src/components/charts/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/charts/__tests__/TreeMap.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreeMap } from '../TreeMap';
import { ChartProvider } from '../ChartProvider';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="treemap-chart" data-option={JSON.stringify(props.option)} />
  ),
}));

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('TreeMap', () => {
  const sampleData = [
    { name: 'A', value: 30 },
    { name: 'B', value: 50 },
    { name: 'C', value: 20 },
  ];

  const nestedData = [
    {
      name: 'Group1',
      value: 80,
      children: [
        { name: 'A', value: 30 },
        { name: 'B', value: 50 },
      ],
    },
    { name: 'C', value: 20 },
  ];

  it('renders with title', () => {
    render(wrap(<TreeMap title="资源分布" data={sampleData} />));
    expect(screen.getByText('资源分布')).toBeTruthy();
  });

  it('renders treemap', () => {
    render(wrap(<TreeMap data={sampleData} />));
    const chart = screen.getByTestId('treemap-chart');
    expect(chart).toBeTruthy();
  });

  it('renders nested data', () => {
    render(wrap(<TreeMap data={nestedData} />));
    const chart = screen.getByTestId('treemap-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TreeMap data={sampleData} loading={true} />));
    const spinner = document.querySelector('[aria-busy="true"]');
    expect(spinner).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts/__tests__/TreeMap.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write TreeMap component**

```typescript
// src/components/charts/TreeMap.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface TreeMapNode {
  name: string;
  value: number;
  children?: TreeMapNode[];
  color?: string;
}

export interface TreeMapChartProps {
  title?: string;
  data: TreeMapNode[];
  height?: number;
  showLabel?: boolean;
  leafDepth?: number;
  loading?: boolean;
}

const convertNode = (node: TreeMapNode, idx: number, palette: string[]) => ({
  name: node.name,
  value: node.value,
  children: node.children?.map((c, i) => convertNode(c, i, palette)),
  itemStyle: node.color
    ? { color: node.color }
    : { color: palette[idx % palette.length] },
});

export const TreeMap: React.FC<TreeMapChartProps> = ({
  title,
  data,
  height = 300,
  showLabel = true,
  leafDepth,
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => ({
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'treemap' as const,
        data: data.map((n, i) => convertNode(n, i, theme.palette)),
        leafDepth: leafDepth ?? 1,
        label: showLabel
          ? { show: true, color: theme.textColor, fontSize: 11 }
          : undefined,
        breadcrumb: { show: false },
        itemStyle: { borderColor: theme.borderColor, borderWidth: 1, gapWidth: 2 },
      },
    ],
  }), [data, title, showLabel, leafDepth, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="treemap-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Export from index.ts**

```typescript
// src/components/charts/index.ts — add:
export { TreeMap } from './TreeMap';
export type { TreeMapChartProps, TreeMapNode } from './TreeMap';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/charts/__tests__/TreeMap.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/TreeMap.tsx src/components/charts/__tests__/TreeMap.test.tsx src/components/charts/index.ts
git commit -m "feat(charts): add TreeMap for hierarchical data visualization"
```

---

## Phase 2: 剩余 Dashboard 收尾

### Task 6: EngineerDashboard 图表重构

**Files:**
- Modify: `src/pages/EngineerDashboard/index.tsx`
- Modify: `src/pages/__tests__/EngineerDashboard.test.tsx`

> **注意：** 此页面有 15 个现有测试。重构后需确保所有测试仍能通过。

- [ ] **Step 1: Write the failing test for new chart rendering**

```typescript
// Add to src/pages/__tests__/EngineerDashboard.test.tsx — add imports at top:
import { ChartProvider } from '@/components/charts';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

// Modify renderWithRouter:
const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ChartProvider>{ui}</ChartProvider>
    </BrowserRouter>
  );
};

// Add new test:
  it('should render personal trend as ECharts', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(screen.getByTestId('echarts-wrapper')).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails (before implementation)**

Run: `npx vitest run src/pages/__tests__/EngineerDashboard.test.tsx -t "should render personal trend as ECharts"`
Expected: FAIL — no echarts-wrapper yet

- [ ] **Step 3: Refactor EngineerDashboard — replace hand-written charts**

In `src/pages/EngineerDashboard/index.tsx`:

1. Add imports at top (after existing imports):
```typescript
import { StatCard, TrendLineChart, GaugeChart, BarChart } from '@/components/charts';
```

2. Remove imports for `Statistic` and `Progress` from antd (keep other antd imports).

3. Replace the 4× Statistic block (lines 305-346):
```typescript
// BEFORE: 4× <Statistic> blocks
// AFTER:
<Col xs={12} sm={6}>
  <StatCard title="当前负载" value={data.personalOverview.currentLoad} suffix="个" icon={<ClockCircleOutlined />} />
</Col>
<Col xs={12} sm={6}>
  <StatCard title="已解决总数" value={data.personalOverview.totalResolved} suffix="个" trend={{ value: 12, direction: 'up', good: 'up' }} sparklineData={recentTrend.map(d => d.resolved)} />
</Col>
<Col xs={12} sm={6}>
  <StatCard title="平均解决时间" value={data.personalOverview.avgResolutionTimeHours} suffix="h" icon={<ThunderboltOutlined />} trend={{ value: 5, direction: 'down', good: 'down' }} />
</Col>
<Col xs={12} sm={6}>
  <StatCard title="SLA合规率" value={data.personalOverview.slaComplianceRate} suffix="%" icon={<FlagOutlined />} />
</Col>
```

4. Replace the hand-written div bar trend chart (lines 356-404) with:
```typescript
<TrendLineChart
  title="个人趋势（近14天）"
  data={[recentTrend.map(d => ({ period: dayjs(d.period).format('MM/DD'), value: d.resolved, label: '解决数' }))]}
  height={200}
  showArea={true}
  smooth={false}
/>
```

5. Replace the 2× Progress bars in strengths/weaknesses (lines 431-436, 478-483) with GaugeChart:
```typescript
// In strengths section (replace <Progress>):
<GaugeChart value={s.proficiencyScore} title={`熟练度 ${s.proficiencyScore}%`} max={100} size={120} unit="%" />

// In weaknesses section (replace <Progress>):
<GaugeChart
  value={Math.round(w.slaComplianceRate * 100)}
  title={`SLA ${Math.round(w.slaComplianceRate * 100)}%`}
  max={100}
  size={120}
  unit="%"
  thresholds={{ warning: 70, danger: 60 }}
/>
```

6. Add a new BarChart for strengths comparison after the strengths/weaknesses Row:
```typescript
<CardPanel title="能力分布">
  <BarChart
    title="各类别熟练度"
    data={[
      ...data.strengths.map(s => ({ label: categoryName(s.category), value: s.proficiencyScore, series: '优势' })),
      ...data.weaknesses.map(w => ({ label: categoryName(w.category), value: Math.round(w.slaComplianceRate * 100), series: '待提升' })),
    ]}
    height={200}
  />
</CardPanel>
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npx vitest run src/pages/__tests__/EngineerDashboard.test.tsx`
Expected: PASS (all 16 tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/pages/EngineerDashboard/index.tsx src/pages/__tests__/EngineerDashboard.test.tsx
git commit -m "refactor(EngineerDashboard): replace hand-written charts with ECharts components"
```

---

### Task 7: ManagerDashboard 图表重构

**Files:**
- Modify: `src/pages/ManagerDashboard/index.tsx`
- Modify: `src/pages/__tests__/ManagerDashboard.test.tsx`

> **注意：** ManagerDashboard 已有 13 个测试通过，且测试文件已包含 ChartProvider wrapper。保持 mock 数据结构兼容。

- [ ] **Step 1: Read current ManagerDashboard to identify hand-written charts**

The page currently has:
- Ant Progress bars for team load
- Ant Table for member metrics (keep as-is)
- Transfer analysis section with plain text/stats

- [ ] **Step 2: Add test for new chart elements**

```typescript
// Add to src/pages/__tests__/ManagerDashboard.test.tsx (ChartProvider already exists):

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

  it('should render team load as gauge chart', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(screen.getByTestId('echarts-wrapper')).toBeTruthy();
  });
```

- [ ] **Step 3: Refactor ManagerDashboard**

```typescript
// Add imports:
import { GaugeChart, PieChart, BarChart, TrendLineChart } from '@/components/charts';
// Remove Progress from antd imports if present.
```

Replace team load Progress with:
```typescript
<GaugeChart
  value={72}
  title="团队负载"
  max={100}
  thresholds={{ warning: 70, danger: 90 }}
  size={160}
  unit="%"
/>
```

Replace transfer analysis plain text with PieChart:
```typescript
<PieChart
  title="转派原因分布"
  data={[
    { name: '专业不匹配', value: 10 },
    { name: '超时自动转派', value: 8 },
    { name: '工程师请假', value: 5 },
  ]}
  variant="donut"
  height={200}
/>
```

Add team performance BarChart:
```typescript
<BarChart
  title="团队效能对比"
  data={memberMetrics.map(m => ({ label: m.name, value: m.comprehensiveScore }))}
  height={240}
/>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/__tests__/ManagerDashboard.test.tsx`
Expected: PASS (14+ tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ManagerDashboard/index.tsx src/pages/__tests__/ManagerDashboard.test.tsx
git commit -m "refactor(ManagerDashboard): replace Progress/Stats with ECharts components"
```

---

### Task 8: FinOpsDashboard 图表补全

**Files:**
- Modify: `src/pages/FinOpsDashboard/index.tsx`
- Create: `src/pages/__tests__/FinOpsDashboard.test.tsx`

> **注意：** FinOpsDashboard 已有 TrendLineChart + PieChart。需新增 GaugeChart（预算利用率）和 BarChart（服务成本排行）。

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/FinOpsDashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import FinOpsDashboard from '@/pages/FinOpsDashboard';
import * as finopsApi from '@/api/finops';

vi.mock('@/api/finops', async () => {
  const actual = await vi.importActual<typeof import('@/api/finops')>('@/api/finops');
  return {
    ...actual,
    getCostSummary: vi.fn().mockResolvedValue({ totalMonthly: 15000, budgetLimit: 20000, previousMonth: 14000, waste: 2000, savings: 3000 }),
    getCostByService: vi.fn().mockResolvedValue([
      { key: '1', service: 'api-gateway', cost: 5000, percent: 33, trend: 'up' as const },
      { key: '2', service: 'platform', cost: 6000, percent: 40, trend: 'stable' as const },
      { key: '3', service: 'ai-service', cost: 4000, percent: 27, trend: 'down' as const },
    ]),
    getCostTrend: vi.fn().mockResolvedValue([
      { month: '2024-01', cost: 12000, budget: 20000 },
      { month: '2024-02', cost: 13500, budget: 20000 },
      { month: '2024-03', cost: 15000, budget: 20000 },
    ]),
    getOptimizations: vi.fn().mockResolvedValue([]),
    getBudgetAlerts: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('FinOpsDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders cost analysis title', async () => {
    renderWithProviders(<FinOpsDashboard />);
    await waitFor(() => expect(screen.getByText('成本分析')).toBeTruthy());
  });

  it('renders trend line chart', async () => {
    renderWithProviders(<FinOpsDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/__tests__/FinOpsDashboard.test.tsx`
Expected: PASS for basic render (charts already exist), but need to add GaugeChart + BarChart

- [ ] **Step 3: Add GaugeChart and BarChart to FinOpsDashboard**

```typescript
// Add imports:
import { GaugeChart, BarChart } from '@/components/charts';

// Add budget utilization gauge after summary cards:
<GaugeChart
  value={budgetUsagePercent}
  title="预算利用率"
  max={100}
  thresholds={{ warning: 70, danger: 90 }}
  size={160}
  unit="%"
/>

// Add service cost bar chart (replace or complement the table's Progress bars):
<BarChart
  title="服务成本排行"
  data={costByService.map(c => ({ label: c.service, value: c.cost }))}
  height={200}
  horizontal={true}
/>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/__tests__/FinOpsDashboard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/FinOpsDashboard/index.tsx src/pages/__tests__/FinOpsDashboard.test.tsx
git commit -m "refactor(FinOpsDashboard): add GaugeChart and BarChart for budget visualization"
```

---

### Task 9: SbomDashboard 图表补全

**Files:**
- Modify: `src/pages/SbomDashboard/index.tsx`
- Create: `src/pages/__tests__/SbomDashboard.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/SbomDashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import SbomDashboard from '@/pages/SbomDashboard';

vi.mock('@/api/sbom', () => ({
  getSbomSummary: vi.fn().mockResolvedValue({ total: 150, compliant: 120, violations: 30 }),
  getSbomLicenses: vi.fn().mockResolvedValue([
    { name: 'MIT', count: 60 },
    { name: 'Apache-2.0', count: 45 },
    { name: 'GPL-3.0', count: 20 },
    { name: 'BSD-3', count: 25 },
  ]),
  getSbomComponents: vi.fn().mockResolvedValue([
    { key: '1', name: 'lodash', version: '4.17.21', license: 'MIT', risk: 'low' },
    { key: '2', name: 'express', version: '4.18.2', license: 'MIT', risk: 'low' },
    { key: '3', name: 'openssl', version: '3.0.0', license: 'Apache-2.0', risk: 'high' },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('SbomDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard title', async () => {
    renderWithProviders(<SbomDashboard />);
    await waitFor(() => expect(screen.getByText(/SBOM|软件物料清单/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<SbomDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/pages/__tests__/SbomDashboard.test.tsx`
Expected: Tests pass after implementation

- [ ] **Step 3: Refactor SbomDashboard**

```typescript
// Add imports:
import { PieChart, BarChart, GaugeChart, TreeMap } from '@/components/charts';

// Add compliance gauge:
<GaugeChart
  value={complianceRate}
  title="合规率"
  max={100}
  thresholds={{ warning: 80, danger: 60 }}
  size={140}
  unit="%"
/>

// Replace license table with PieChart:
<PieChart
  title="许可证分布"
  data={licenses.map(l => ({ name: l.name, value: l.count }))}
  variant="donut"
  height={200}
/>

// Add component dependency tree:
<TreeMap
  title="组件依赖树"
  data={components.map(c => ({ name: c.name, value: c.risk === 'high' ? 10 : c.risk === 'medium' ? 5 : 1 }))}
  height={240}
/>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/__tests__/SbomDashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SbomDashboard/index.tsx src/pages/__tests__/SbomDashboard.test.tsx
git commit -m "refactor(SbomDashboard): add ECharts visualizations for license and compliance"
```

---

### Task 10: RiskDashboard 图表补全

**Files:**
- Modify: `src/pages/RiskDashboard/index.tsx`
- Create: `src/pages/__tests__/RiskDashboard.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/RiskDashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import RiskDashboard from '@/pages/RiskDashboard';

vi.mock('@/api/risk', () => ({
  getRiskSummary: vi.fn().mockResolvedValue({ total: 45, critical: 3, high: 8, medium: 15, low: 19 }),
  getRiskTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', critical: 2, high: 5, medium: 10, low: 15 },
    { date: '2024-03-19', critical: 3, high: 6, medium: 12, low: 18 },
    { date: '2024-03-20', critical: 3, high: 8, medium: 15, low: 19 },
  ]),
  getRiskDistribution: vi.fn().mockResolvedValue([
    { x: 'Mon', y: 'Critical', value: 2 },
    { x: 'Mon', y: 'High', value: 5 },
    { x: 'Tue', y: 'Critical', value: 3 },
    { x: 'Tue', y: 'High', value: 8 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('RiskDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard title', async () => {
    renderWithProviders(<RiskDashboard />);
    await waitFor(() => expect(screen.getByText(/风险/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<RiskDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/pages/__tests__/RiskDashboard.test.tsx`

- [ ] **Step 3: Refactor RiskDashboard**

```typescript
// Add imports:
import { TrendLineChart, PieChart, BarChart } from '@/components/charts';

// Add risk trend chart:
<TrendLineChart
  title="风险趋势（近7天）"
  data={[
    trendData.map(d => ({ period: d.date, value: d.critical, label: '严重' })),
    trendData.map(d => ({ period: d.date, value: d.high, label: '高' })),
    trendData.map(d => ({ period: d.date, value: d.medium, label: '中' })),
  ]}
  height={240}
  smooth={true}
/>

// Add risk level distribution PieChart:
<PieChart
  title="风险等级分布"
  data={[
    { name: '严重', value: riskSummary.critical },
    { name: '高', value: riskSummary.high },
    { name: '中', value: riskSummary.medium },
    { name: '低', value: riskSummary.low },
  ]}
  variant="donut"
  height={200}
/>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/__tests__/RiskDashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/RiskDashboard/index.tsx src/pages/__tests__/RiskDashboard.test.tsx
git commit -m "refactor(RiskDashboard): add TrendLineChart and PieChart for risk analysis"
```

---

### Task 11: AICostDashboard 图表补全

**Files:**
- Modify: `src/pages/AICostDashboard/index.tsx`
- Create: `src/pages/__tests__/AICostDashboard.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/AICostDashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import AICostDashboard from '@/pages/AICostDashboard';

vi.mock('@/api/ai-cost', () => ({
  getAiCostSummary: vi.fn().mockResolvedValue({ totalTokens: 1500000, totalCost: 45.50, avgCostPerToken: 0.00003 }),
  getCostTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', tokens: 400000, cost: 12.0 },
    { date: '2024-03-19', tokens: 550000, cost: 16.5 },
    { date: '2024-03-20', tokens: 550000, cost: 17.0 },
  ]),
  getModelUsage: vi.fn().mockResolvedValue([
    { name: 'gpt-4', tokens: 800000, cost: 30.0 },
    { name: 'claude-3', tokens: 500000, cost: 12.5 },
    { name: 'gemini', tokens: 200000, cost: 3.0 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('AICostDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard title', async () => {
    renderWithProviders(<AICostDashboard />);
    await waitFor(() => expect(screen.getByText(/AI.*成本|成本.*AI/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<AICostDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Refactor AICostDashboard**

Add TrendLineChart + PieChart if not already present:

```typescript
import { TrendLineChart, PieChart } from '@/components/charts';

// Token consumption trend:
<TrendLineChart
  title="Token 消耗趋势"
  data={[costTrend.map(d => ({ period: d.date, value: d.tokens, label: 'Token数' }))]}
  height={240}
  showArea={true}
/>

// Model usage pie:
<PieChart
  title="模型使用占比"
  data={modelUsage.map(m => ({ name: m.name, value: m.tokens }))}
  variant="donut"
  centerLabel={true}
  height={200}
/>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/AICostDashboard.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/AICostDashboard/index.tsx src/pages/__tests__/AICostDashboard.test.tsx
git commit -m "feat(AICostDashboard): add ECharts visualizations for token and model usage"
```

---

### Task 12: DashboardNew 图表重构

**Files:**
- Modify: `src/pages/DashboardNew/index.tsx`
- Create: `src/pages/__tests__/DashboardNew.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/DashboardNew.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import DashboardNew from '@/pages/DashboardNew';

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('DashboardNew', () => {
  it('renders page title', () => {
    renderWithProviders(<DashboardNew />);
    expect(screen.getByText(/仪表盘|Dashboard/)).toBeTruthy();
  });

  it('renders chart elements', () => {
    renderWithProviders(<DashboardNew />);
    expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Refactor DashboardNew**

```typescript
import { StatCard, TrendLineChart } from '@/components/charts';

// Replace KPI cards with StatCard:
<StatCard title="总工单" value={kpiData.total} trend={{ value: 5, direction: 'up', good: 'up' }} />

// Replace hand-written trend div with:
<TrendLineChart
  title="趋势概览"
  data={trendData.map(d => [{ period: d.date, value: d.count, label: '工单数' }])}
  height={240}
/>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/DashboardNew.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardNew/index.tsx src/pages/__tests__/DashboardNew.test.tsx
git commit -m "refactor(DashboardNew): replace hand-written div charts with ECharts components"
```

---

## Phase 3: 核心非 Dashboard 页面可视化

### Task 13: Monitoring 页面可视化

**Files:**
- Modify: `src/pages/Monitoring/Dashboard.tsx`
- Create: `src/pages/Monitoring/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/Monitoring/__tests__/Dashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import MonitoringDashboard from '../Dashboard';

vi.mock('@/api/monitoring', () => ({
  getMonitoringHealth: vi.fn().mockResolvedValue({ status: 'healthy', uptime: 86400 }),
  getMetrics: vi.fn().mockResolvedValue([
    { name: 'cpu', value: 45.2, timestamp: '2024-03-20T10:00:00Z' },
    { name: 'memory', value: 62.1, timestamp: '2024-03-20T10:00:00Z' },
  ]),
  getAlerts: vi.fn().mockResolvedValue([
    { id: '1', severity: 'critical', message: 'CPU过高', status: 'active' },
    { id: '2', severity: 'warning', message: '内存使用率高', status: 'active' },
  ]),
  getRules: vi.fn().mockResolvedValue([
    { id: '1', name: 'CPU告警', enabled: true },
    { id: '2', name: '内存告警', enabled: true },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('MonitoringDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders monitoring dashboard title', async () => {
    renderWithProviders(<MonitoringDashboard />);
    await waitFor(() => expect(screen.getByText(/监控|Monitoring/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<MonitoringDashboard />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations to Monitoring Dashboard**

```typescript
// src/pages/Monitoring/Dashboard.tsx — add imports:
import { GaugeChart, TrendLineChart, BarChart, PieChart } from '@/components/charts';

// Add service health gauge:
<GaugeChart value={health.uptime > 0 ? 100 : 0} title="服务健康" max={100} size={120} unit="%" />

// Add metrics trend chart:
<TrendLineChart
  title="指标趋势"
  data={[
    metrics.filter(m => m.name === 'cpu').map(m => ({ period: m.timestamp, value: m.value, label: 'CPU' })),
    metrics.filter(m => m.name === 'memory').map(m => ({ period: m.timestamp, value: m.value, label: '内存' })),
  ]}
  height={240}
/>

// Add alert statistics bar chart:
<BarChart
  title="告警统计"
  data={alerts.map(a => ({ label: a.severity, value: 1 }))}
  height={200}
/>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/Monitoring/__tests__/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/Monitoring/Dashboard.tsx src/pages/Monitoring/__tests__/Dashboard.test.tsx
git commit -m "feat(Monitoring): add ECharts visualizations for metrics and alerts"
```

---

### Task 14: AlertList 页面可视化

**Files:**
- Modify: `src/pages/AlertList/index.tsx`
- Create: `src/pages/__tests__/AlertList.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/AlertList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import AlertList from '@/pages/AlertList';

vi.mock('@/api/alert', () => ({
  getAlerts: vi.fn().mockResolvedValue([
    { id: '1', severity: 'critical', source: 'prometheus', title: 'CPU过高', createdAt: '2024-03-20' },
    { id: '2', severity: 'warning', source: 'grafana', title: '内存告警', createdAt: '2024-03-19' },
    { id: '3', severity: 'info', source: 'custom', title: '磁盘使用率', createdAt: '2024-03-18' },
  ]),
  getAlertStats: vi.fn().mockResolvedValue({ total: 50, critical: 5, warning: 15, info: 30, mttr: 4.5 }),
  getAlertTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-14', count: 8 },
    { date: '2024-03-15', count: 6 },
    { date: '2024-03-16', count: 10 },
    { date: '2024-03-17', count: 7 },
    { date: '2024-03-18', count: 9 },
    { date: '2024-03-19', count: 5 },
    { date: '2024-03-20', count: 5 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('AlertList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders alert list title', async () => {
    renderWithProviders(<AlertList />);
    await waitFor(() => expect(screen.getByText(/告警|Alert/)).toBeTruthy());
  });

  it('renders chart elements above table', async () => {
    renderWithProviders(<AlertList />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations to AlertList**

Add a chart section at the top of the AlertList page (before the table):

```typescript
import { TrendLineChart, PieChart, BarChart, StatCard } from '@/components/charts';

// Add chart summary section at top:
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={6}>
    <StatCard title="MTTR" value={stats?.mttr ?? 0} suffix="h" />
  </Col>
  <Col span={18}>
    <TrendLineChart
      title="告警趋势（近7天）"
      data={[alertTrend.map(d => ({ period: d.date, value: d.count, label: '告警数' }))]}
      height={160}
      showArea={true}
    />
  </Col>
</Row>
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={12}>
    <PieChart
      title="严重级别分布"
      data={alerts.reduce((acc, a) => {
        const existing = acc.find(x => x.name === a.severity);
        if (existing) existing.value++;
        else acc.push({ name: a.severity, value: 1 });
        return acc;
      }, [] as { name: string; value: number }[])}
      variant="donut"
      height={200}
    />
  </Col>
  <Col span={12}>
    <BarChart
      title="告警来源 TOP10"
      data={alerts.reduce((acc, a) => {
        const existing = acc.find(x => x.label === a.source);
        if (existing) existing.value++;
        else acc.push({ label: a.source, value: 1 });
        return acc;
      }, [] as { label: string; value: number }[])}
      height={200}
    />
  </Col>
</Row>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/AlertList.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/AlertList/index.tsx src/pages/__tests__/AlertList.test.tsx
git commit -m "feat(AlertList): add ECharts visualizations for alert trends and distribution"
```

---

### Task 15: Queue 页面可视化

**Files:**
- Modify: `src/pages/Queue/index.tsx`
- Create: `src/pages/__tests__/Queue.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/Queue.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import QueueManagement from '@/pages/Queue';

vi.mock('@/api/queue', () => ({
  getQueues: vi.fn().mockResolvedValue([
    { name: 'default', depth: 150, consumers: 3, latency: 45 },
    { name: 'priority', depth: 50, consumers: 2, latency: 20 },
    { name: 'batch', depth: 500, consumers: 5, latency: 120 },
  ]),
  getQueueTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', depth: 200 },
    { date: '2024-03-19', depth: 180 },
    { date: '2024-03-20', depth: 700 },
  ]),
  getQueueStats: vi.fn().mockResolvedValue({ totalProcessed: 50000, avgLatency: 62, consumptionRate: 1250 }),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('QueueManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders queue title', async () => {
    renderWithProviders(<QueueManagement />);
    await waitFor(() => expect(screen.getByText(/队列|Queue/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<QueueManagement />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations**

```typescript
import { TrendLineChart, ScatterChart, HeatmapChart, StatCard } from '@/components/charts';

// Add summary charts at top:
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={6}>
    <StatCard title="消费速率" value={stats?.consumptionRate ?? 0} suffix="/min" />
  </Col>
  <Col span={18}>
    <TrendLineChart
      title="队列深度趋势"
      data={[queueTrend.map(d => ({ period: d.date, value: d.depth, label: '深度' }))]}
      height={200}
      showArea={true}
    />
  </Col>
</Row>
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={12}>
    <ScatterChart
      title="处理延迟分布"
      data={queues.map(q => ({ x: q.consumers, y: q.latency, value: q.depth, label: q.name }))}
      showBubble={true}
      xAxisLabel="消费者数"
      yAxisLabel="延迟(ms)"
      height={240}
    />
  </Col>
  <Col span={12}>
    <HeatmapChart
      title="队列负载热力图"
      data={queues.map(q => ({ x: q.name, y: '深度', value: q.depth }))}
      xAxis={queues.map(q => q.name)}
      yAxis={['深度', '延迟', '消费']}
      height={240}
    />
  </Col>
</Row>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/Queue.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/Queue/index.tsx src/pages/__tests__/Queue.test.tsx
git commit -m "feat(Queue): add ECharts visualizations for queue metrics"
```

---

### Task 16: OnCall 页面可视化

**Files:**
- Modify: `src/pages/OnCall/index.tsx`
- Create: `src/pages/__tests__/OnCall.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/OnCall.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import OnCallManagement from '@/pages/OnCall';

vi.mock('@/api/oncall', () => ({
  getOnCallSchedule: vi.fn().mockResolvedValue([
    { engineer: '张伟', start: '2024-03-20', end: '2024-03-27', status: 'active' },
    { engineer: '李娜', start: '2024-03-27', end: '2024-04-03', status: 'upcoming' },
  ]),
  getOnCallStats: vi.fn().mockResolvedValue({ avgResponseTime: 12.5, slaCompliance: 94, totalIncidents: 23 }),
  getOnCallTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-14', responseTime: 15, incidents: 3 },
    { date: '2024-03-15', responseTime: 10, incidents: 2 },
    { date: '2024-03-16', responseTime: 8, incidents: 1 },
    { date: '2024-03-17', responseTime: 12, incidents: 4 },
    { date: '2024-03-18', responseTime: 14, incidents: 3 },
    { date: '2024-03-19', responseTime: 11, incidents: 2 },
    { date: '2024-03-20', responseTime: 12.5, incidents: 2 },
  ]),
  getEngineerLoad: vi.fn().mockResolvedValue([
    { name: '张伟', incidents: 8, avgTime: 10 },
    { name: '李娜', incidents: 6, avgTime: 15 },
    { name: '王强', incidents: 9, avgTime: 8 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('OnCallManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders oncall title', async () => {
    renderWithProviders(<OnCallManagement />);
    await waitFor(() => expect(screen.getByText(/值班|On.?Call/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<OnCallManagement />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations**

```typescript
import { TrendLineChart, HeatmapChart, BarChart, GaugeChart } from '@/components/charts';

<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={6}>
    <GaugeChart value={stats?.slaCompliance ?? 0} title="SLA合规率" max={100} thresholds={{ warning: 80, danger: 60 }} size={140} unit="%" />
  </Col>
  <Col span={18}>
    <TrendLineChart
      title="响应时间趋势"
      data={[oncallTrend.map(d => ({ period: d.date, value: d.responseTime, label: '响应时间(min)' }))]}
      height={200}
    />
  </Col>
</Row>
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={12}>
    <BarChart title="工程师负载" data={engineerLoad.map(e => ({ label: e.name, value: e.incidents }))} height={240} />
  </Col>
  <Col span={12}>
    <HeatmapChart
      title="值班负载热力图"
      data={engineerLoad.flatMap(e => [{ x: e.name, y: '工单', value: e.incidents }, { x: e.name, y: '平均时间', value: e.avgTime }])}
      xAxis={engineerLoad.map(e => e.name)}
      yAxis={['工单', '平均时间']}
      height={240}
    />
  </Col>
</Row>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/OnCall.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/OnCall/index.tsx src/pages/__tests__/OnCall.test.tsx
git commit -m "feat(OnCall): add ECharts visualizations for oncall metrics"
```

---

### Task 17: ChangeIntelligence 页面可视化

**Files:**
- Modify: `src/pages/ChangeIntelligence/index.tsx`
- Create: `src/pages/__tests__/ChangeIntelligence.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/ChangeIntelligence.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import ChangeIntelligence from '@/pages/ChangeIntelligence';

vi.mock('@/api/change-intelligence', () => ({
  getChangeSummary: vi.fn().mockResolvedValue({ total: 120, success: 95, failed: 15, successRate: 79 }),
  getChangeTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-14', success: 12, failed: 2 },
    { date: '2024-03-15', success: 15, failed: 1 },
    { date: '2024-03-16', success: 10, failed: 3 },
    { date: '2024-03-17', success: 14, failed: 2 },
    { date: '2024-03-18', success: 18, failed: 1 },
    { date: '2024-03-19', success: 13, failed: 3 },
    { date: '2024-03-20', success: 13, failed: 3 },
  ]),
  getChangeTypes: vi.fn().mockResolvedValue([
    { type: 'deployment', count: 50 },
    { type: 'config', count: 35 },
    { type: 'rollback', count: 15 },
    { type: 'hotfix', count: 20 },
  ]),
  getChangeFlow: vi.fn().mockResolvedValue({
    nodes: [{ name: '开发' }, { name: '测试' }, { name: '审批' }, { name: '部署' }, { name: '验证' }],
    links: [
      { source: '开发', target: '测试', value: 100 },
      { source: '测试', target: '审批', value: 85 },
      { source: '审批', target: '部署', value: 80 },
      { source: '部署', target: '验证', value: 75 },
    ],
  }),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('ChangeIntelligence', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders change intelligence title', async () => {
    renderWithProviders(<ChangeIntelligence />);
    await waitFor(() => expect(screen.getByText(/变更|Change/)).toBeTruthy());
  });

  it('renders chart elements', async () => {
    renderWithProviders(<ChangeIntelligence />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations**

```typescript
import { TrendLineChart, ScatterChart, PieChart, SankeyChart } from '@/components/charts';

<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={24}>
    <TrendLineChart
      title="变更成功率趋势"
      data={[
        changeTrend.map(d => ({ period: d.date, value: d.success, label: '成功' })),
        changeTrend.map(d => ({ period: d.date, value: d.failed, label: '失败' })),
      ]}
      height={240}
      smooth={true}
    />
  </Col>
</Row>
<Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
  <Col span={12}>
    <PieChart title="变更类型占比" data={changeTypes.map(t => ({ name: t.type, value: t.count }))} variant="donut" height={240} />
  </Col>
  <Col span={12}>
    <SankeyChart title="变更流转" nodes={changeFlow.nodes} links={changeFlow.links} height={240} />
  </Col>
</Row>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/pages/__tests__/ChangeIntelligence.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChangeIntelligence/index.tsx src/pages/__tests__/ChangeIntelligence.test.tsx
git commit -m "feat(ChangeIntelligence): add ECharts visualizations with SankeyChart for change flow"
```

---

## Phase 4: 其余页面渐进式升级

### Task 18: CMDB + Approvals + NotificationCenter 可视化

**Files:**
- Modify: `src/pages/CMDB/index.tsx`
- Modify: `src/pages/Approvals/index.tsx`
- Modify: `src/pages/NotificationCenter/index.tsx`
- Create: `src/pages/__tests__/CMDB.test.tsx`
- Create: `src/pages/__tests__/Approvals.test.tsx`
- Create: `src/pages/__tests__/NotificationCenter.test.tsx`

- [ ] **Step 1: Write tests for all 3 pages**

```typescript
// src/pages/__tests__/CMDB.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import CMDB from '@/pages/CMDB';

vi.mock('@/api/cmdb', () => ({
  getCmdbResources: vi.fn().mockResolvedValue([
    { id: '1', name: 'api-server', type: 'compute', region: 'us-east', status: 'running' },
    { id: '2', name: 'db-primary', type: 'database', region: 'us-east', status: 'running' },
    { id: '3', name: 'cache-redis', type: 'cache', region: 'us-west', status: 'running' },
  ]),
  getCmdbStats: vi.fn().mockResolvedValue({ total: 156, running: 140, stopped: 16 }),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('CMDB', () => {
  it('renders cmdb title', async () => {
    renderWithProviders(<CMDB />);
    await waitFor(() => expect(screen.getByText(/CMDB|资源/)).toBeTruthy());
  });
  it('renders chart elements', async () => {
    renderWithProviders(<CMDB />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});

// src/pages/__tests__/Approvals.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import Approvals from '@/pages/Approvals';

vi.mock('@/api/approval', () => ({
  getApprovals: vi.fn().mockResolvedValue([
    { id: '1', title: '部署审批', status: 'pending', duration: 2 },
    { id: '2', title: '变更审批', status: 'approved', duration: 5 },
  ]),
  getApprovalStats: vi.fn().mockResolvedValue({ passRate: 85, avgDuration: 3.5 }),
  getApprovalTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-14', approved: 8, rejected: 2 },
    { date: '2024-03-15', approved: 10, rejected: 1 },
    { date: '2024-03-16', approved: 7, rejected: 3 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderApprovals = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('Approvals', () => {
  it('renders approval title', async () => {
    renderApprovals(<Approvals />);
    await waitFor(() => expect(screen.getByText(/审批|Approval/)).toBeTruthy());
  });
  it('renders charts', async () => {
    renderApprovals(<Approvals />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});

// src/pages/__tests__/NotificationCenter.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import NotificationCenter from '@/pages/NotificationCenter';

vi.mock('@/api/notification', () => ({
  getNotifications: vi.fn().mockResolvedValue([
    { id: '1', type: 'alert', title: '告警通知', read: false, createdAt: '2024-03-20' },
    { id: '2', type: 'approval', title: '审批通过', read: true, createdAt: '2024-03-19' },
  ]),
  getNotificationStats: vi.fn().mockResolvedValue({ unread: 15, today: 8 }),
  getNotificationTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-14', count: 12 },
    { date: '2024-03-15', count: 8 },
    { date: '2024-03-16', count: 15 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderNotif = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('NotificationCenter', () => {
  it('renders notification title', async () => {
    renderNotif(<NotificationCenter />);
    await waitFor(() => expect(screen.getByText(/通知|Notification/)).toBeTruthy());
  });
  it('renders charts', async () => {
    renderNotif(<NotificationCenter />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations to each page**

**CMDB:**
```typescript
import { TreeMap, ScatterChart } from '@/components/charts';

<TreeMap title="资源层级" data={resources.map(r => ({ name: r.name, value: r.status === 'running' ? 10 : 1 }))} height={240} />
<ScatterChart title="依赖关系" data={resources.map((r, i) => ({ x: i, y: r.region === 'us-east' ? 1 : 2, label: r.name }))} height={200} />
```

**Approvals:**
```typescript
import { GaugeChart, TrendLineChart } from '@/components/charts';

<GaugeChart value={stats?.passRate ?? 0} title="审批通过率" max={100} thresholds={{ warning: 70, danger: 50 }} size={140} unit="%" />
<TrendLineChart title="处理时长趋势" data={approvalTrend.map(d => ({ period: d.date, value: d.approved, label: '通过' }))} height={200} />
```

**NotificationCenter:**
```typescript
import { TrendLineChart, PieChart } from '@/components/charts';

<TrendLineChart title="通知频率" data={notifTrend.map(d => ({ period: d.date, value: d.count, label: '通知数' }))} height={160} showArea={true} />
<PieChart title="渠道分布" data={[{ name: '告警', value: 45 }, { name: '审批', value: 30 }, { name: '系统', value: 25 }]} variant="donut" height={200} />
```

- [ ] **Step 3: Run all 6 tests**

Run: `npx vitest run src/pages/__tests__/CMDB.test.tsx src/pages/__tests__/Approvals.test.tsx src/pages/__tests__/NotificationCenter.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add src/pages/CMDB/index.tsx src/pages/Approvals/index.tsx src/pages/NotificationCenter/index.tsx src/pages/__tests__/CMDB.test.tsx src/pages/__tests__/Approvals.test.tsx src/pages/__tests__/NotificationCenter.test.tsx
git commit -m "feat(P4): add ECharts visualizations to CMDB, Approvals, NotificationCenter"
```

---

### Task 19: EventBus + AIGateway + Diagnostic + SelfHealing 可视化

**Files:**
- Modify: `src/pages/EventBus/index.tsx`
- Modify: `src/pages/AIGateway/index.tsx`
- Modify: `src/pages/Diagnostic/index.tsx`
- Modify: `src/pages/SelfHealing/index.tsx`
- Create: `src/pages/__tests__/EventBus.test.tsx`
- Create: `src/pages/__tests__/AIGateway.test.tsx`
- Create: `src/pages/__tests__/Diagnostic.test.tsx`
- Create: `src/pages/__tests__/SelfHealing.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// src/pages/__tests__/EventBus.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import EventBus from '@/pages/EventBus';

vi.mock('@/api/eventbus', () => ({
  getEvents: vi.fn().mockResolvedValue([
    { id: '1', type: 'pipeline', source: 'ci', target: 'deploy', timestamp: '2024-03-20' },
    { id: '2', type: 'config', source: 'admin', target: 'service', timestamp: '2024-03-19' },
  ]),
  getEventStats: vi.fn().mockResolvedValue({ total: 5000, today: 120 }),
  getEventTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', count: 100 },
    { date: '2024-03-19', count: 150 },
    { date: '2024-03-20', count: 120 },
  ]),
  getEventFlow: vi.fn().mockResolvedValue({
    nodes: [{ name: 'CI' }, { name: 'Deploy' }, { name: 'Monitor' }, { name: 'Alert' }],
    links: [
      { source: 'CI', target: 'Deploy', value: 50 },
      { source: 'Deploy', target: 'Monitor', value: 45 },
      { source: 'Monitor', target: 'Alert', value: 10 },
    ],
  }),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderWithProviders = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('EventBus', () => {
  it('renders event bus title', async () => {
    renderWithProviders(<EventBus />);
    await waitFor(() => expect(screen.getByText(/事件|Event/)).toBeTruthy());
  });
  it('renders charts', async () => {
    renderWithProviders(<EventBus />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});

// src/pages/__tests__/AIGateway.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import AIGateway from '@/pages/AIGateway';

vi.mock('@/api/ai-gateway', () => ({
  getAiGatewayStats: vi.fn().mockResolvedValue({ totalRequests: 10000, totalTokens: 5000000, avgLatency: 250 }),
  getTokenTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', tokens: 1500000 },
    { date: '2024-03-19', tokens: 1800000 },
    { date: '2024-03-20', tokens: 1700000 },
  ]),
  getModelUsage: vi.fn().mockResolvedValue([
    { name: 'gpt-4', tokens: 3000000, cost: 30 },
    { name: 'claude', tokens: 1500000, cost: 12 },
    { name: 'gemini', tokens: 500000, cost: 3 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderAI = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('AIGateway', () => {
  it('renders AI gateway title', async () => {
    renderAI(<AIGateway />);
    await waitFor(() => expect(screen.getByText(/AI.*网关|Gateway/)).toBeTruthy());
  });
  it('renders charts', async () => {
    renderAI(<AIGateway />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});

// src/pages/__tests__/Diagnostic.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import Diagnostic from '@/pages/Diagnostic';

vi.mock('@/api/diagnostic', () => ({
  getDiagnosticResult: vi.fn().mockResolvedValue({
    score: 78,
    dimensions: { performance: 85, security: 65, reliability: 80, maintainability: 75, scalability: 70 },
  }),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderDiag = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('Diagnostic', () => {
  it('renders diagnostic title', async () => {
    renderDiag(<Diagnostic />);
    await waitFor(() => expect(screen.getByText(/诊断|Diagnostic/)).toBeTruthy());
  });
  it('renders radar chart', async () => {
    renderDiag(<Diagnostic />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});

// src/pages/__tests__/SelfHealing.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import SelfHealing from '@/pages/SelfHealing';

vi.mock('@/api/self-healing', () => ({
  getSelfHealingStats: vi.fn().mockResolvedValue({ successRate: 88, totalActions: 156, avgTime: 45 }),
  getHealingTrend: vi.fn().mockResolvedValue([
    { date: '2024-03-18', actions: 20, success: 18 },
    { date: '2024-03-19', actions: 25, success: 23 },
    { date: '2024-03-20', actions: 22, success: 19 },
  ]),
}));

vi.mock('echarts-for-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="echarts-wrapper" data-option={JSON.stringify(props.option)} />
  ),
}));

const renderSH = (ui: React.ReactElement) =>
  render(<BrowserRouter><ChartProvider>{ui}</ChartProvider></BrowserRouter>);

describe('SelfHealing', () => {
  it('renders self healing title', async () => {
    renderSH(<SelfHealing />);
    await waitFor(() => expect(screen.getByText(/自愈|Self.?Healing/)).toBeTruthy());
  });
  it('renders charts', async () => {
    renderSH(<SelfHealing />);
    await waitFor(() => expect(screen.getAllByTestId('echarts-wrapper').length).toBeGreaterThan(0));
  });
});
```

- [ ] **Step 2: Add visualizations**

**EventBus:**
```typescript
import { TrendLineChart, SankeyChart } from '@/components/charts';
<TrendLineChart title="事件流量" data={eventTrend.map(d => ({ period: d.date, value: d.count, label: '事件数' }))} height={200} />
<SankeyChart title="事件类型流转" nodes={eventFlow.nodes} links={eventFlow.links} height={240} />
```

**AIGateway:**
```typescript
import { TrendLineChart, PieChart } from '@/components/charts';
<TrendLineChart title="Token消耗趋势" data={tokenTrend.map(d => ({ period: d.date, value: d.tokens, label: 'Token' }))} height={240} />
<PieChart title="模型调用占比]" data={modelUsage.map(m => ({ name: m.name, value: m.tokens }))} variant="donut" height={200} />
```

**Diagnostic:**
```typescript
import { RadarChart } from '@/components/charts';
<RadarChart
  title="诊断结果"
  indicators={Object.entries(result.dimensions).map(([k, v]) => ({ name: k, max: 100 }))}
  series={[{ name: '当前评分', values: Object.values(result.dimensions) }]}
  height={300}
/>
```

**SelfHealing:**
```typescript
import { TrendLineChart, GaugeChart } from '@/components/charts';
<GaugeChart value={stats?.successRate ?? 0} title="自愈成功率" max={100} thresholds={{ warning: 70, danger: 50 }} size={140} unit="%" />
<TrendLineChart title="自愈事件趋势" data={[healingTrend.map(d => ({ period: d.date, value: d.actions, label: '总动作' })), healingTrend.map(d => ({ period: d.date, value: d.success, label: '成功' }))]} height={200} />
```

- [ ] **Step 3: Run all 8 tests**

Run: `npx vitest run src/pages/__tests__/EventBus.test.tsx src/pages/__tests__/AIGateway.test.tsx src/pages/__tests__/Diagnostic.test.tsx src/pages/__tests__/SelfHealing.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add src/pages/EventBus/index.tsx src/pages/AIGateway/index.tsx src/pages/Diagnostic/index.tsx src/pages/SelfHealing/index.tsx src/pages/__tests__/EventBus.test.tsx src/pages/__tests__/AIGateway.test.tsx src/pages/__tests__/Diagnostic.test.tsx src/pages/__tests__/SelfHealing.test.tsx
git commit -m "feat(P4): add ECharts visualizations to EventBus, AIGateway, Diagnostic, SelfHealing"
```

---

## Phase 5: 全量验证

### Task 20: 全量测试 + 类型检查

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests pass (500+ tests)

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new type errors (only pre-existing ones in CronManagement/WebhookManagement)

- [ ] **Step 3: Build check**

Run: `npx vite build 2>&1 | grep -E "echarts|gzip" | head -20`
Expected: ECharts chunks present, verify bundle size

- [ ] **Step 4: Verify zero hand-written charts in Dashboard pages**

Run: `grep -r "Statistic\|Progress" src/pages/*Dashboard*/index.tsx | grep -v "import" | wc -l`
Expected: 0 (all replaced with ECharts components)
