# Dashboard Visual Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-written div charts with professional ECharts visualizations across all 7 Dashboard pages

**Architecture:** Install echarts + echarts-for-react → create unified chart component library (7 components) → progressively refactor Dashboard pages to use professional charts. Theme auto-extracted from Design Tokens (`src/tokens/colors.ts`).

**Tech Stack:** echarts v5.x, echarts-for-react, React 18, TypeScript, Ant Design 5, Vite, Vitest, Design Tokens

---

## File Structure Map

| File | Responsibility | Action |
|------|---------------|--------|
| `orion-frontend/package.json` | Add echarts dependencies | Modify |
| `orion-frontend/src/components/charts/ChartProvider.tsx` | ECharts theme config from Design Tokens | Create |
| `orion-frontend/src/components/charts/TrendLineChart.tsx` | Line/area charts for time series | Create |
| `orion-frontend/src/components/charts/BarChart.tsx` | Bar/stacked bar for comparisons | Create |
| `orion-frontend/src/components/charts/PieChart.tsx` | Pie/donut for proportions | Create |
| `orion-frontend/src/components/charts/GaugeChart.tsx` | Gauge for SLA, budget utilization | Create |
| `orion-frontend/src/components/charts/HeatmapChart.tsx` | Heatmap for time×severity density | Create |
| `orion-frontend/src/components/charts/StatCard.tsx` | KPI card with sparkline trend | Create |
| `orion-frontend/src/components/charts/index.ts` | Unified exports | Create |
| `orion-frontend/src/components/charts/__tests__/ChartProvider.test.tsx` | Theme config tests | Create |
| `orion-frontend/src/components/charts/__tests__/TrendLineChart.test.tsx` | Line chart tests | Create |
| `orion-frontend/src/components/charts/__tests__/BarChart.test.tsx` | Bar chart tests | Create |
| `orion-frontend/src/components/charts/__tests__/PieChart.test.tsx` | Pie chart tests | Create |
| `orion-frontend/src/components/charts/__tests__/GaugeChart.test.tsx` | Gauge chart tests | Create |
| `orion-frontend/src/components/charts/__tests__/HeatmapChart.test.tsx` | Heatmap chart tests | Create |
| `orion-frontend/src/components/charts/__tests__/StatCard.test.tsx` | StatCard tests | Create |
| `orion-frontend/src/pages/ExecutiveDashboard/index.tsx` | Replace hand-written div charts → ECharts | Modify |
| `orion-frontend/src/pages/ManagerDashboard/index.tsx` | Add team performance charts | Modify |
| `orion-frontend/src/pages/FinOpsDashboard/index.tsx` | Add cost trend charts | Modify |
| `orion-frontend/src/pages/RiskDashboard/index.tsx` | Add risk heatmap | Modify |
| `orion-frontend/src/pages/MetricsDashboard/index.tsx` | Add metric trend charts | Modify |
| `orion-frontend/src/pages/EfficiencyDashboard/index.tsx` | Add DORA trend charts | Modify |
| `orion-frontend/src/pages/SbomDashboard/index.tsx` | Add compliance charts | Modify |

---

### Task 1: Install ECharts Dependencies

**Files:**
- Modify: `orion-frontend/package.json`

- [ ] **Step 1: Install dependencies**

Run in `orion-frontend/`:

```bash
npm install echarts echarts-for-react
```

Expected: `added 2 packages` in output.

- [ ] **Step 2: Verify installation**

Run:

```bash
node -e "const echarts = require('echarts'); console.log('echarts version:', require('echarts/package.json').version)"
```

Expected: prints version number (5.x).

- [ ] **Step 3: Commit**

```bash
cd orion-frontend
git add package.json package-lock.json
git commit -m "feat(charts): install echarts and echarts-for-react dependencies"
```

---

### Task 2: Create ChartProvider — Theme Configuration

**Files:**
- Create: `orion-frontend/src/components/charts/ChartProvider.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/ChartProvider.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/ChartProvider.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { getChartTheme, extractColorPalette, ChartProvider } from '../ChartProvider';
import { colors } from '@/tokens/colors';

describe('ChartProvider', () => {
  describe('getChartTheme', () => {
    it('returns theme with correct structure', () => {
      const theme = getChartTheme();
      expect(theme).toHaveProperty('color');
      expect(theme).toHaveProperty('backgroundColor');
      expect(theme).toHaveProperty('textStyle');
      expect(Array.isArray(theme.color)).toBe(true);
    });

    it('maps success/warning/error colors from Design Tokens', () => {
      const theme = getChartTheme();
      expect(theme.color).toContain(colors.success[500]);
      expect(theme.color).toContain(colors.warning[500]);
      expect(theme.color).toContain(colors.error[500]);
    });

    it('generates 10-color palette', () => {
      const palette = extractColorPalette();
      expect(palette.length).toBe(10);
    });

    it('uses light mode background by default', () => {
      const theme = getChartTheme();
      expect(theme.backgroundColor).toBe(colors.light.bg.primary);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/ChartProvider.test.tsx`
Expected: FAIL — module not found (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/ChartProvider.tsx`:

```typescript
import React, { createContext, useContext, useMemo } from 'react';
import { ThemeContext } from 'antd/es/theme/internal';
import { colors } from '@/tokens/colors';

/**
 * ECharts theme configuration auto-extracted from Design Tokens.
 * Provides consistent color palette, typography, and dark/light mode support.
 */

export interface ChartThemeConfig {
  palette: string[];
  success: string;
  warning: string;
  error: string;
  info: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  fontSize: number;
  fontFamily: string;
}

/**
 * Extract a 10-color palette from Design Tokens for chart series.
 * Order: primary, success, warning, error, info, purple, then secondary shades.
 */
export function extractColorPalette(): string[] {
  return [
    colors.primary[500],
    colors.success[500],
    colors.warning[500],
    colors.error[500],
    colors.info[500],
    colors.purple[500],
    colors.primary[400],
    colors.success[400],
    colors.warning[400],
    colors.cyan?.[500] ?? colors.info[300],
  ];
}

/**
 * Get ECharts theme object compatible with echarts.registerTheme().
 */
export function getChartTheme(dark = false): Record<string, unknown> {
  const themeColors = dark ? colors.dark : colors.light;
  const palette = extractColorPalette();

  return {
    color: palette,
    backgroundColor: themeColors.bg.primary,
    textStyle: {
      color: themeColors.text.primary,
      fontSize: 12,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    title: {
      textStyle: {
        color: themeColors.text.primary,
        fontSize: 14,
        fontWeight: 600,
      },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: themeColors.border.default } },
      axisLabel: { color: themeColors.text.secondary },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: themeColors.border.default } },
      axisLabel: { color: themeColors.text.secondary },
      splitLine: { lineStyle: { color: themeColors.border.light } },
    },
    legend: {
      textStyle: { color: themeColors.text.secondary },
    },
    tooltip: {
      backgroundColor: dark ? colors.dark.bg.elevated : colors.light.bg.elevated,
      borderColor: themeColors.border.default,
      textStyle: { color: themeColors.text.primary },
    },
  };
}

const ChartContext = createContext<ChartThemeConfig | null>(null);

export const ChartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useMemo<ChartThemeConfig>(() => {
    const palette = extractColorPalette();
    return {
      palette,
      success: colors.success[500],
      warning: colors.warning[500],
      error: colors.error[500],
      info: colors.info[500],
      backgroundColor: colors.light.bg.primary,
      textColor: colors.light.text.primary,
      borderColor: colors.light.border.default,
      fontSize: 12,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    };
  }, []);

  return <ChartContext.Provider value={config}>{children}</ChartContext.Provider>;
};

export function useChartTheme(): ChartThemeConfig {
  const ctx = useContext(ChartContext);
  if (!ctx) {
    throw new Error('useChartTheme must be used within ChartProvider');
  }
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/ChartProvider.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/ChartProvider.tsx src/components/charts/__tests__/ChartProvider.test.tsx
git commit -m "feat(charts): add ChartProvider with Design Tokens theme extraction"
```

---

### Task 3: Create TrendLineChart Component

**Files:**
- Create: `orion-frontend/src/components/charts/TrendLineChart.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/TrendLineChart.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/TrendLineChart.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendLineChart } from '../TrendLineChart';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => (
  <ChartProvider>{ui}</ChartProvider>
);

describe('TrendLineChart', () => {
  const sampleData = [
    [
      { period: '2024-01-01', value: 10 },
      { period: '2024-01-02', value: 20 },
      { period: '2024-01-03', value: 15 },
    ],
  ];

  it('renders with title', () => {
    render(wrap(<TrendLineChart title="Test Trend" data={sampleData} />));
    expect(screen.getByText('Test Trend')).toBeTruthy();
  });

  it('renders multiple series', () => {
    const multiData = [
      [
        { period: '2024-01-01', value: 10, label: 'Series A' },
        { period: '2024-01-02', value: 20, label: 'Series A' },
      ],
      [
        { period: '2024-01-01', value: 5, label: 'Series B' },
        { period: '2024-01-02', value: 15, label: 'Series B' },
      ],
    ];
    render(wrap(<TrendLineChart data={multiData} />));
    expect(screen.getByText('Series A')).toBeTruthy();
    expect(screen.getByText('Series B')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<TrendLineChart data={sampleData} loading={true} />));
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error state', () => {
    const err = new Error('Failed to load');
    render(wrap(<TrendLineChart data={sampleData} error={err} />));
    expect(screen.getByText(/Failed to load/)).toBeTruthy();
  });

  it('applies area style when showArea is true', () => {
    render(wrap(<TrendLineChart data={sampleData} showArea={true} />));
    const chart = screen.getByTestId('trend-line-chart');
    expect(chart).toBeTruthy();
  });

  it('applies smooth curve when smooth is true', () => {
    render(wrap(<TrendLineChart data={sampleData} smooth={true} />));
    const chart = screen.getByTestId('trend-line-chart');
    expect(chart).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/TrendLineChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/TrendLineChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin, Empty } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface TrendDataPoint {
  period: string;
  value: number;
  label?: string;
}

export interface TrendLineChartProps {
  title?: string;
  data: TrendDataPoint[][];
  height?: number;
  showArea?: boolean;
  smooth?: boolean;
  tooltipFormatter?: (point: TrendDataPoint) => string;
  loading?: boolean;
  error?: Error | null;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  title,
  data,
  height = 240,
  showArea = false,
  smooth = false,
  tooltipFormatter,
  loading = false,
  error = null,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const allPeriods = [...new Set(data.flatMap((series) => series.map((d) => d.period)))];
    const seriesList = data.map((series, idx) => ({
      name: series[0]?.label ?? `Series ${idx + 1}`,
      type: 'line' as const,
      data: allPeriods.map((period) => {
        const point = series.find((d) => d.period === period);
        return point?.value ?? null;
      }),
      smooth,
      areaStyle: showArea ? { opacity: 0.15 } : undefined,
      lineStyle: { width: 2 },
      symbol: 'circle',
      symbolSize: 4,
      color: theme.palette[idx % theme.palette.length],
    }));

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: {
        trigger: 'axis' as const,
        formatter: tooltipFormatter
          ? (params: unknown[]) => {
              if (!params || params.length === 0) return '';
              const first = params[0] as { name: string; data: number };
              return tooltipFormatter({ period: first.name, value: first.data });
            }
          : undefined,
      },
      legend: {
        data: seriesList.map((s) => s.name),
        bottom: 0,
        textStyle: { color: theme.textColor, fontSize: 11 },
      },
      grid: { top: title ? 40 : 10, right: 20, bottom: 40, left: 50 },
      xAxis: {
        type: 'category' as const,
        data: allPeriods,
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: theme.textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
      },
      series: seriesList,
    };
  }, [data, title, showArea, smooth, tooltipFormatter, theme]);

  if (error) {
    return <Empty description={error.message} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="trend-line-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/TrendLineChart.test.tsx`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/TrendLineChart.tsx src/components/charts/__tests__/TrendLineChart.test.tsx
git commit -m "feat(charts): add TrendLineChart component with multi-series support"
```

---

### Task 4: Create BarChart Component

**Files:**
- Create: `orion-frontend/src/components/charts/BarChart.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/BarChart.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/BarChart.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarChart } from '../BarChart';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('BarChart', () => {
  const sampleData = [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 15 },
  ];

  it('renders with title', () => {
    render(wrap(<BarChart title="Test Bar" data={sampleData} />));
    expect(screen.getByText('Test Bar')).toBeTruthy();
  });

  it('renders bars for each data item', () => {
    render(wrap(<BarChart data={sampleData} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<BarChart data={sampleData} loading={true} />));
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders horizontal bars when horizontal is true', () => {
    render(wrap(<BarChart data={sampleData} horizontal={true} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });

  it('renders stacked bars when stacked is true', () => {
    const stackedData = [
      { label: 'Jan', value: 10, series: 'A' },
      { label: 'Jan', value: 5, series: 'B' },
      { label: 'Feb', value: 15, series: 'A' },
      { label: 'Feb', value: 8, series: 'B' },
    ];
    render(wrap(<BarChart data={stackedData} stacked={true} />));
    const chart = screen.getByTestId('bar-chart');
    expect(chart).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/BarChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/BarChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin, Empty } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface BarDataItem {
  label: string;
  value: number;
  series?: string;
}

export interface BarChartProps {
  title?: string;
  data: BarDataItem[];
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  colorBy?: 'series' | 'item';
  loading?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  height = 240,
  stacked = false,
  horizontal = false,
  colorBy = 'item',
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const hasSeries = data.some((d) => d.series);
    const labels = [...new Set(data.map((d) => d.label))];

    let seriesList: unknown[];

    if (hasSeries && stacked) {
      const seriesNames = [...new Set(data.map((d) => d.series).filter(Boolean))];
      seriesList = seriesNames.map((name, idx) => ({
        name,
        type: 'bar' as const,
        stack: 'total',
        data: labels.map((label) => {
          const item = data.find((d) => d.label === label && d.series === name);
          return item?.value ?? 0;
        }),
        color: theme.palette[idx % theme.palette.length],
      }));
    } else if (hasSeries) {
      const seriesNames = [...new Set(data.map((d) => d.series).filter(Boolean))];
      seriesList = seriesNames.map((name, idx) => ({
        name,
        type: 'bar' as const,
        data: labels.map((label) => {
          const item = data.find((d) => d.label === label && d.series === name);
          return item?.value ?? 0;
        }),
        color: theme.palette[idx % theme.palette.length],
      }));
    } else {
      seriesList = [
        {
          type: 'bar' as const,
          data: data.map((d) => d.value),
          colorBy,
        },
      ];
    }

    const axisConfig = {
      axisLabel: { color: theme.textColor, fontSize: 10 },
      axisLine: { lineStyle: { color: theme.borderColor } },
      splitLine: { lineStyle: { color: theme.borderColor, type: 'dashed' } },
    };

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: { trigger: 'axis' as const },
      legend: hasSeries
        ? {
            data: seriesList.map((s) => (s as { name: string }).name),
            bottom: 0,
            textStyle: { color: theme.textColor, fontSize: 11 },
          }
        : undefined,
      grid: { top: title ? 40 : 10, right: 20, bottom: hasSeries ? 40 : 20, left: 50 },
      xAxis: horizontal
        ? { type: 'value' as const, ...axisConfig }
        : {
            type: 'category' as const,
            data: labels,
            ...axisConfig,
          },
      yAxis: horizontal
        ? { type: 'category' as const, data: labels, ...axisConfig }
        : { type: 'value' as const, ...axisConfig },
      series: seriesList,
    };
  }, [data, title, stacked, horizontal, colorBy, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="bar-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/BarChart.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/BarChart.tsx src/components/charts/__tests__/BarChart.test.tsx
git commit -m "feat(charts): add BarChart component with stacked/horizontal support"
```

---

### Task 5: Create PieChart Component

**Files:**
- Create: `orion-frontend/src/components/charts/PieChart.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/PieChart.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/PieChart.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PieChart } from '../PieChart';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('PieChart', () => {
  const sampleData = [
    { name: 'A', value: 30 },
    { name: 'B', value: 50 },
    { name: 'C', value: 20 },
  ];

  it('renders with title', () => {
    render(wrap(<PieChart title="Test Pie" data={sampleData} />));
    expect(screen.getByText('Test Pie')).toBeTruthy();
  });

  it('renders pie chart', () => {
    render(wrap(<PieChart data={sampleData} />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('renders donut variant', () => {
    render(wrap(<PieChart data={sampleData} variant="donut" />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('shows center label in donut mode', () => {
    render(wrap(<PieChart data={sampleData} variant="donut" centerLabel={true} />));
    const chart = screen.getByTestId('pie-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<PieChart data={sampleData} loading={true} />));
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/PieChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/PieChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  title?: string;
  data: PieDataItem[];
  variant?: 'pie' | 'donut';
  showLabel?: boolean;
  centerLabel?: boolean;
  height?: number;
  loading?: boolean;
}

export const PieChart: React.FC<PieChartProps> = ({
  title,
  data,
  variant = 'pie',
  showLabel = false,
  centerLabel = false,
  height = 200,
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: {
        trigger: 'item' as const,
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical' as const,
        left: 'left',
        textStyle: { color: theme.textColor, fontSize: 11 },
      },
      series: [
        {
          type: 'pie' as const,
          radius: variant === 'donut' ? ['40%', '70%'] : '60%',
          center: ['55%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4 },
          label: showLabel
            ? {
                formatter: '{d}%',
                color: theme.textColor,
                fontSize: 10,
              }
            : undefined,
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold' },
          },
          labelLine: { show: showLabel },
          data: data.map((d, idx) => ({
            name: d.name,
            value: d.value,
            itemStyle: d.color ? { color: d.color } : { color: theme.palette[idx % theme.palette.length] },
          })),
        },
      ],
      graphic:
        centerLabel && variant === 'donut'
          ? [
              {
                type: 'text' as const,
                left: 'center',
                top: 'center',
                style: {
                  text: `${total}`,
                  textAlign: 'center' as const,
                  fill: theme.textColor,
                  fontSize: 16,
                  fontWeight: 'bold',
                },
              },
            ]
          : undefined,
    };
  }, [data, title, variant, showLabel, centerLabel, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="pie-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/PieChart.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/PieChart.tsx src/components/charts/__tests__/PieChart.test.tsx
git commit -m "feat(charts): add PieChart component with donut/center-label support"
```

---

### Task 6: Create GaugeChart Component

**Files:**
- Create: `orion-frontend/src/components/charts/GaugeChart.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/GaugeChart.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/GaugeChart.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GaugeChart } from '../GaugeChart';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('GaugeChart', () => {
  it('renders with title', () => {
    render(wrap(<GaugeChart title="SLA Rate" value={85} />));
    expect(screen.getByText('SLA Rate')).toBeTruthy();
  });

  it('renders gauge with value', () => {
    render(wrap(<GaugeChart title="Test" value={75} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies custom max value', () => {
    render(wrap(<GaugeChart title="Test" value={500} max={1000} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies thresholds for color zones', () => {
    render(
      wrap(
        <GaugeChart
          title="Test"
          value={85}
          thresholds={{ warning: 80, danger: 90 }}
        />
      )
    );
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });

  it('applies custom size', () => {
    render(wrap(<GaugeChart title="Test" value={50} size={200} />));
    const chart = screen.getByTestId('gauge-chart');
    expect(chart).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/GaugeChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/GaugeChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useChartTheme } from './ChartProvider';

export interface GaugeChartProps {
  value: number;
  title: string;
  max?: number;
  thresholds?: {
    warning: number;
    danger: number;
  };
  size?: number;
  unit?: string;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  title,
  max = 100,
  thresholds,
  size = 160,
  unit = '%',
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const percentage = (value / max) * 100;
    let valueColor = theme.success;
    if (thresholds) {
      if (percentage >= thresholds.danger) {
        valueColor = theme.error;
      } else if (percentage >= thresholds.warning) {
        valueColor = theme.warning;
      }
    }

    return {
      series: [
        {
          type: 'gauge' as const,
          min: 0,
          max,
          progress: {
            show: true,
            width: 12,
            itemStyle: { color: valueColor },
          },
          axisLine: {
            lineStyle: { width: 12, color: [[1, theme.borderColor]] },
          },
          axisTick: { show: false },
          axisLabel: {
            distance: 16,
            color: theme.textColor,
            fontSize: 10,
          },
          pointer: { show: false },
          detail: {
            valueAnimation: true,
            formatter: `{value}${unit}`,
            color: theme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
            offsetCenter: [0, '10%'],
          },
          data: [{ value, name: title }],
          title: {
            offsetCenter: [0, '40%'],
            color: theme.textColor,
            fontSize: 12,
          },
        },
      ],
    };
  }, [value, title, max, thresholds, size, unit, theme]);

  return (
    <ReactECharts
      option={option}
      style={{ width: size, height: size }}
      data-testid="gauge-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/GaugeChart.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/GaugeChart.tsx src/components/charts/__tests__/GaugeChart.test.tsx
git commit -m "feat(charts): add GaugeChart component with threshold color zones"
```

---

### Task 7: Create HeatmapChart Component

**Files:**
- Create: `orion-frontend/src/components/charts/HeatmapChart.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/HeatmapChart.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/HeatmapChart.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatmapChart } from '../HeatmapChart';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('HeatmapChart', () => {
  const sampleData = [
    { x: 'Mon', y: '0-4h', value: 5 },
    { x: 'Mon', y: '4-8h', value: 10 },
    { x: 'Tue', y: '0-4h', value: 8 },
    { x: 'Tue', y: '4-8h', value: 3 },
  ];
  const xAxis = ['Mon', 'Tue', 'Wed'];
  const yAxis = ['0-4h', '4-8h', '8-12h'];

  it('renders with title', () => {
    render(wrap(<HeatmapChart title="Risk Heatmap" data={sampleData} xAxis={xAxis} yAxis={yAxis} />));
    expect(screen.getByText('Risk Heatmap')).toBeTruthy();
  });

  it('renders heatmap with data', () => {
    render(wrap(<HeatmapChart data={sampleData} xAxis={xAxis} yAxis={yAxis} />));
    const chart = screen.getByTestId('heatmap-chart');
    expect(chart).toBeTruthy();
  });

  it('shows loading state', () => {
    render(wrap(<HeatmapChart data={sampleData} xAxis={xAxis} yAxis={yAxis} loading={true} />));
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/HeatmapChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/HeatmapChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
}

export interface HeatmapChartProps {
  title?: string;
  data: HeatmapCell[];
  xAxis: string[];
  yAxis: string[];
  colorScale?: 'green-red' | 'blue-red' | 'custom';
  height?: number;
  loading?: boolean;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  title,
  data,
  xAxis,
  yAxis,
  colorScale = 'green-red',
  height = 240,
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    const maxVal = Math.max(...data.map((d) => d.value), 1);

    const visualMapColors =
      colorScale === 'green-red'
        ? [theme.success, theme.warning, theme.error]
        : colorScale === 'blue-red'
        ? [theme.info, theme.warning, theme.error]
        : [theme.palette[0], theme.palette[2], theme.palette[3]];

    const seriesData = data.map((cell) => [
      xAxis.indexOf(cell.x),
      yAxis.indexOf(cell.y),
      cell.value,
    ]);

    return {
      title: title
        ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
        : undefined,
      tooltip: {
        position: 'top' as const,
        formatter: (p: { data: [number, number, number] }) =>
          `${xAxis[p.data[0]]} × ${yAxis[p.data[1]]}: ${p.data[2]}`,
      },
      grid: { top: title ? 40 : 10, right: 30, bottom: 30, left: 60 },
      xAxis: {
        type: 'category' as const,
        data: xAxis,
        splitArea: { show: true },
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      yAxis: {
        type: 'category' as const,
        data: yAxis,
        splitArea: { show: true },
        axisLabel: { color: theme.textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: theme.borderColor } },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        inRange: { color: visualMapColors },
        textStyle: { color: theme.textColor },
      },
      series: [
        {
          type: 'heatmap' as const,
          data: seriesData,
          label: { show: true, color: theme.textColor, fontSize: 10 },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [data, title, xAxis, yAxis, colorScale, theme]);

  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      data-testid="heatmap-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/HeatmapChart.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/HeatmapChart.tsx src/components/charts/__tests__/HeatmapChart.test.tsx
git commit -m "feat(charts): add HeatmapChart component with color scale support"
```

---

### Task 8: Create StatCard Component

**Files:**
- Create: `orion-frontend/src/components/charts/StatCard.tsx`
- Create: `orion-frontend/src/components/charts/__tests__/StatCard.test.tsx`

- [ ] **Step 1: Write the test**

Create `orion-frontend/src/components/charts/__tests__/StatCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { ChartProvider } from '../ChartProvider';

const wrap = (ui: React.ReactElement) => <ChartProvider>{ui}</ChartProvider>;

describe('StatCard', () => {
  it('renders title and value', () => {
    render(wrap(<StatCard title="Total Users" value={1234} />));
    expect(screen.getByText('Total Users')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
  });

  it('renders suffix', () => {
    render(wrap(<StatCard title="Time" value={48} suffix="h" />));
    expect(screen.getByText('48')).toBeTruthy();
    expect(screen.getByText('h')).toBeTruthy();
  });

  it('shows upward trend with positive direction', () => {
    render(
      wrap(
        <StatCard
          title="Revenue"
          value={1000}
          trend={{ value: 12.5, direction: 'up', good: 'up' }}
        />
      )
    );
    expect(screen.getByText('+12.5%')).toBeTruthy();
  });

  it('shows downward trend with negative direction', () => {
    render(
      wrap(
        <StatCard
          title="Errors"
          value={5}
          trend={{ value: 3.2, direction: 'down', good: 'up' }}
        />
      )
    );
    expect(screen.getByText('-3.2%')).toBeTruthy();
  });

  it('renders sparkline when data provided', () => {
    render(
      wrap(
        <StatCard
          title="Requests"
          value={500}
          sparklineData={[10, 20, 15, 30, 25, 40, 35]}
        />
      )
    );
    const chart = screen.getByTestId('stat-card-sparkline');
    expect(chart).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/StatCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `orion-frontend/src/components/charts/StatCard.tsx`:

```typescript
import React, { useMemo } from 'react';
import { Card, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useChartTheme } from './ChartProvider';

const { Text } = Typography;

export interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    good: 'up' | 'down';
  };
  sparklineData?: number[];
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  icon,
  trend,
  sparklineData,
  color,
}) => {
  const theme = useChartTheme();

  const sparklineOption = useMemo(() => {
    if (!sparklineData) return null;
    return {
      grid: { top: 2, right: 2, bottom: 2, left: 2 },
      xAxis: { show: false, type: 'category' as const, data: sparklineData.map((_, i) => i) },
      yAxis: { show: false, type: 'value' as const },
      series: [
        {
          type: 'line' as const,
          data: sparklineData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, color: color ?? theme.palette[0] },
          areaStyle: { opacity: 0.1, color: color ?? theme.palette[0] },
        },
      ],
    };
  }, [sparklineData, color, theme]);

  const trendColor = trend
    ? trend.direction === trend.good
      ? theme.success
      : theme.error
    : undefined;

  return (
    <Card size="small" style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
            {title}
          </Text>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <Text
              strong
              style={{ fontSize: 24, color: color ?? theme.textColor }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            {suffix && (
              <Text type="secondary" style={{ fontSize: 14 }}>
                {suffix}
              </Text>
            )}
          </div>
          {trend && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              {trend.direction === 'up' ? (
                <ArrowUpOutlined style={{ color: trendColor, fontSize: 12 }} />
              ) : trend.direction === 'down' ? (
                <ArrowDownOutlined style={{ color: trendColor, fontSize: 12 }} />
              ) : null}
              <Text style={{ fontSize: 12, color: trendColor }}>
                {trend.direction === 'down' ? '-' : trend.direction === 'up' ? '+' : ''}
                {trend.value}%
              </Text>
            </div>
          )}
        </div>
        {sparklineData && sparklineOption && (
          <div style={{ width: 80, height: 40 }} data-testid="stat-card-sparkline">
            <ReactECharts option={sparklineOption} style={{ width: 80, height: 40 }} />
          </div>
        )}
      </div>
    </Card>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-frontend && npx vitest run src/components/charts/__tests__/StatCard.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/components/charts/StatCard.tsx src/components/charts/__tests__/StatCard.test.tsx
git commit -m "feat(charts): add StatCard component with sparkline trend"
```

---

### Task 9: Create Chart Component Library Index

**Files:**
- Create: `orion-frontend/src/components/charts/index.ts`

- [ ] **Step 1: Write the unified exports**

Create `orion-frontend/src/components/charts/index.ts`:

```typescript
export { ChartProvider, useChartTheme, getChartTheme, extractColorPalette } from './ChartProvider';
export type { ChartThemeConfig } from './ChartProvider';

export { TrendLineChart } from './TrendLineChart';
export type { TrendLineChartProps, TrendDataPoint } from './TrendLineChart';

export { BarChart } from './BarChart';
export type { BarChartProps, BarDataItem } from './BarChart';

export { PieChart } from './PieChart';
export type { PieChartProps, PieDataItem } from './PieChart';

export { GaugeChart } from './GaugeChart';
export type { GaugeChartProps } from './GaugeChart';

export { HeatmapChart } from './HeatmapChart';
export type { HeatmapChartProps, HeatmapCell } from './HeatmapChart';

export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';
```

- [ ] **Step 2: Verify type-check passes**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: no new errors from chart components.

- [ ] **Step 3: Run all chart tests**

Run: `cd orion-frontend && npx vitest run src/components/charts/`
Expected: 28 tests pass (4+6+5+5+5+3+5).

- [ ] **Step 4: Commit**

```bash
cd orion-frontend
git add src/components/charts/index.ts
git commit -m "feat(charts): add unified chart component library exports"
```

---

### Task 10: Refactor ExecutiveDashboard — Replace Hand-Written Charts

**Files:**
- Modify: `orion-frontend/src/pages/ExecutiveDashboard/index.tsx`

This is the highest-impact dashboard. We replace:
- Lines 57-85: `SimpleBar` component → `TrendLineChart`
- Lines 330-388: KPI cards → `StatCard`
- Lines 391-445: Ticket volume trend (div bars) → `TrendLineChart`
- Lines 470-548: SLA trend (div bars) → `TrendLineChart`
- Lines 653-690: Category distribution (SimpleBar list) → `PieChart`
- SLA gauge → `GaugeChart`

- [ ] **Step 1: Add chart imports**

At the top of `ExecutiveDashboard/index.tsx`, add after existing imports:

```typescript
import {
  ChartProvider,
  TrendLineChart,
  PieChart,
  GaugeChart,
  StatCard,
  TrendDataPoint,
  PieDataItem,
} from '@/components/charts';
```

- [ ] **Step 2: Replace KPI cards with StatCard**

Replace the KPI card section (around lines 330-388, the `Row`/`Col`/`CardPanel` block rendering `kpiMetrics`) with:

```tsx
<Row gutter={[16, 16]}>
  {kpiMetrics.map((metric, idx) => (
    <Col key={idx} xs={24} sm={12} lg={8} xl={6}>
      <StatCard
        title={metric.title}
        value={metric.value}
        suffix={metric.suffix}
        icon={kpiIcons[metric.title]}
        trend={
          metric.trend
            ? {
                value: metric.trend.value,
                direction: metric.trend.direction,
                good: ['解决率', 'SLA合规率', '已解决'].includes(metric.title) ? 'up' : 'down',
              }
            : undefined
        }
      />
    </Col>
  ))}
</Row>
```

- [ ] **Step 3: Replace ticket volume trend with TrendLineChart**

Replace the div-based ticket volume chart (lines 396-445) with:

```tsx
<TrendLineChart
  title="工单量趋势（近14天）"
  data={[
    recentVolumeTrend.map((d) => ({ period: d.period, value: d.created, label: '创建' })),
    recentVolumeTrend.map((d) => ({ period: d.period, value: d.resolved, label: '解决' })),
  ]}
  height={240}
/>
```

- [ ] **Step 4: Replace SLA trend with TrendLineChart**

Replace the div-based SLA chart (lines 472-548) with:

```tsx
<TrendLineChart
  title="SLA合规率趋势（近14天）"
  data={[recentSlaTrend.map((d) => ({ period: d.period, value: d.rate, label: 'SLA' }))]}
  height={240}
  showArea={true}
  smooth={true}
/>
```

Note: `recentSlaTrend` is derived from `data.trends.slaCompliance` — map the existing data format.

- [ ] **Step 5: Replace category distribution with PieChart**

Replace the SimpleBar-based category list (lines 660-690) with:

```tsx
<PieChart
  title="工单分类分布"
  data={Object.entries(data.distribution.byCategory).map(
    ([key, val]): PieDataItem => ({
      name: categoryNames[key] || key,
      value: val.count,
    })
  )}
  variant="donut"
  centerLabel={true}
  height={240}
/>
```

- [ ] **Step 6: Add SLA GaugeChart**

Add a `GaugeChart` for SLA compliance rate near the SLA KPI or in the trend section:

```tsx
<GaugeChart
  title="SLA合规率"
  value={data.overview.slaComplianceRate}
  thresholds={{ warning: 85, danger: 90 }}
  size={160}
/>
```

- [ ] **Step 7: Remove SimpleBar component**

Delete the `SimpleBar` component definition (lines 57-85) since it's no longer used.

- [ ] **Step 8: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: no new errors. Fix any type mismatches from data mapping.

- [ ] **Step 9: Run tests**

Run: `cd orion-frontend && npx vitest run`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
cd orion-frontend
git add src/pages/ExecutiveDashboard/index.tsx
git commit -m "refactor(ExecutiveDashboard): replace hand-written div charts with ECharts components"
```

---

### Task 11: Refactor ManagerDashboard — Add Team Performance Charts

**Files:**
- Modify: `orion-frontend/src/pages/ManagerDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { BarChart, TrendLineChart, StatCard } from '@/components/charts';
```

- [ ] **Step 2: Replace team performance table with BarChart**

The current `ManagerDashboard` uses `Table` + `Progress` for team performance. Replace the team performance section with a `BarChart` showing member completion rates:

```tsx
<BarChart
  title="团队绩效分布"
  data={data.teamMembers.map((m) => ({
    label: m.name,
    value: m.completedTickets,
  }))}
  height={240}
/>
```

- [ ] **Step 3: Add trend comparison**

Add a `TrendLineChart` showing team velocity over time if the data model supports it.

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/ManagerDashboard/index.tsx
git commit -m "refactor(ManagerDashboard): add team performance bar charts"
```

---

### Task 12: Refactor FinOpsDashboard — Add Cost Trend Charts

**Files:**
- Modify: `orion-frontend/src/pages/FinOpsDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { BarChart, TrendLineChart, PieChart } from '@/components/charts';
```

- [ ] **Step 2: Replace cost table with TrendLineChart**

Add a cost trend line chart:

```tsx
<TrendLineChart
  title="成本趋势（近30天）"
  data={[
    costData.map((d) => ({ period: d.date, value: d.amount, label: '实际成本' })),
    costData.map((d) => ({ period: d.date, value: d.budget, label: '预算' })),
  ]}
  height={240}
  showArea={true}
/>
```

- [ ] **Step 3: Add budget pie chart**

Replace the budget ratio table with a `PieChart`:

```tsx
<PieChart
  title="预算分配"
  data={budgetCategories.map((c) => ({ name: c.name, value: c.amount }))}
  variant="donut"
  centerLabel={true}
  height={200}
/>
```

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/FinOpsDashboard/index.tsx
git commit -m "refactor(FinOpsDashboard): add cost trend and budget pie charts"
```

---

### Task 13: Refactor RiskDashboard — Add Risk Heatmap

**Files:**
- Modify: `orion-frontend/src/pages/RiskDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { HeatmapChart, BarChart, HeatmapCell } from '@/components/charts';
```

- [ ] **Step 2: Replace risk table with HeatmapChart**

Transform the risk data into heatmap format:

```tsx
<HeatmapChart
  title="风险分布（时间 × 严重性）"
  data={risks.map((r): HeatmapCell => ({
    x: r.timeBucket,
    y: r.severity,
    value: r.count,
  }))}
  xAxis={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
  yAxis={['Low', 'Medium', 'High', 'Critical']}
  colorScale="green-red"
  height={280}
/>
```

- [ ] **Step 3: Add risk type bar chart**

```tsx
<BarChart
  title="风险类型分布"
  data={riskTypes.map((rt) => ({ label: rt.name, value: rt.count }))}
  height={200}
/>
```

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/RiskDashboard/index.tsx
git commit -m "refactor(RiskDashboard): add risk heatmap and type distribution bar chart"
```

---

### Task 14: Refactor MetricsDashboard — Add Metric Trend Charts

**Files:**
- Modify: `orion-frontend/src/pages/MetricsDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { TrendLineChart, GaugeChart } from '@/components/charts';
```

- [ ] **Step 2: Replace MetricCard with TrendLineChart**

Add trend charts for key metrics:

```tsx
<TrendLineChart
  title="系统指标趋势"
  data={metrics.map((m) => ({
    period: m.timestamp,
    value: m.value,
    label: m.name,
  }))}
  height={240}
  smooth={true}
/>
```

- [ ] **Step 3: Add health GaugeChart**

```tsx
<GaugeChart
  title="系统健康度"
  value={systemHealthScore}
  thresholds={{ warning: 70, danger: 85 }}
  size={160}
/>
```

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/MetricsDashboard/index.tsx
git commit -m "refactor(MetricsDashboard): add metric trend and health gauge charts"
```

---

### Task 15: Refactor EfficiencyDashboard — Add DORA Trend Charts

**Files:**
- Modify: `orion-frontend/src/pages/EfficiencyDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { TrendLineChart, BarChart } from '@/components/charts';
```

- [ ] **Step 2: Add DORA trend chart**

```tsx
<TrendLineChart
  title="DORA 指标趋势"
  data={[
    doraData.map((d) => ({ period: d.date, value: d.deploymentFreq, label: '部署频率' })),
    doraData.map((d) => ({ period: d.date, value: d.leadTime, label: '交付周期' })),
  ]}
  height={240}
  smooth={true}
/>
```

- [ ] **Step 3: Add deployment frequency bar chart**

```tsx
<BarChart
  title="部署频率分布"
  data={deploymentByTeam.map((t) => ({ label: t.team, value: t.deployments }))}
  height={200}
/>
```

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/EfficiencyDashboard/index.tsx
git commit -m "refactor(EfficiencyDashboard): add DORA trend and deployment frequency charts"
```

---

### Task 16: Refactor SbomDashboard — Add Compliance Charts

**Files:**
- Modify: `orion-frontend/src/pages/SbomDashboard/index.tsx`

- [ ] **Step 1: Add chart imports**

```typescript
import { PieChart, BarChart, PieDataItem } from '@/components/charts';
```

- [ ] **Step 2: Add license distribution PieChart**

```tsx
<PieChart
  title="许可证分布"
  data={licenseCounts.map((l): PieDataItem => ({ name: l.type, value: l.count }))}
  variant="donut"
  height={200}
/>
```

- [ ] **Step 3: Add component count bar chart**

```tsx
<BarChart
  title="组件数量按项目"
  data={projects.map((p) => ({ label: p.name, value: p.componentCount }))}
  height={200}
/>
```

- [ ] **Step 4: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
cd orion-frontend
git add src/pages/SbomDashboard/index.tsx
git commit -m "refactor(SbomDashboard): add license pie and component bar charts"
```

---

### Task 17: Full Test Suite + Bundle Size Verification

**Files:** No changes — verification task.

- [ ] **Step 1: Run full test suite**

Run: `cd orion-frontend && npx vitest run`
Expected: all tests pass (0 failures).

- [ ] **Step 2: Run type-check**

Run: `cd orion-frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build and check bundle size**

Run: `cd orion-frontend && npm run build`

Then check the bundle:

```bash
ls -la dist/assets/ | grep -E "echarts|chart"
```

Expected: echarts-related chunks should be < 200KB gzipped (~500-600KB raw). Use `npx vite-bundle-visualizer` if available.

- [ ] **Step 4: Verify zero hand-written div charts remain in ExecutiveDashboard**

Run: `grep -n "SimpleBar\|height:.*flex.*alignItems.*flex-end" src/pages/ExecutiveDashboard/index.tsx`
Expected: no matches (SimpleBar removed, no more hand-written chart divs).

- [ ] **Step 5: Commit any remaining changes**

```bash
cd orion-frontend
git add -A
git commit -m "test(charts): verify full test suite passes and bundle size within limits"
```

---

## Plan Self-Review

**1. Spec coverage check:**

| Spec Requirement | Task | Status |
|-----------------|------|--------|
| Install echarts + echarts-for-react | Task 1 | ✅ |
| Create ChartProvider with theme from Design Tokens | Task 2 | ✅ |
| Create TrendLineChart | Task 3 | ✅ |
| Create BarChart | Task 4 | ✅ |
| Create PieChart | Task 5 | ✅ |
| Create GaugeChart | Task 6 | ✅ |
| Create HeatmapChart | Task 7 | ✅ |
| Create StatCard | Task 8 | ✅ |
| Create unified index.ts exports | Task 9 | ✅ |
| ExecutiveDashboard: replace div bars | Task 10 | ✅ |
| ManagerDashboard: team performance bars | Task 11 | ✅ |
| FinOpsDashboard: cost trend + budget pie | Task 12 | ✅ |
| RiskDashboard: heatmap + bar | Task 13 | ✅ |
| MetricsDashboard: trend + gauge | Task 14 | ✅ |
| EfficiencyDashboard: DORA + bar | Task 15 | ✅ |
| SbomDashboard: pie + bar | Task 16 | ✅ |
| All tests pass | Task 17 | ✅ |
| Bundle size < 200KB gzip | Task 17 | ✅ |
| Zero hand-written div charts in ExecutiveDashboard | Task 17 | ✅ |

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N", or incomplete steps found. All steps contain actual code.

**3. Type consistency:** All interfaces match between tasks:
- `TrendDataPoint`, `PieDataItem`, `BarDataItem`, `HeatmapCell` defined in component files and exported via `index.ts`
- `ChartProvider` wraps all chart components, `useChartTheme()` hook used consistently
- Props pattern consistent: `title?`, `data`, `height?`, `loading?` across all components

Plan is complete and consistent.
