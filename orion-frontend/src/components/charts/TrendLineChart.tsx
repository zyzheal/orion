import React, { useMemo, useRef } from 'react';
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
  const formatterRef = useRef(tooltipFormatter);
  formatterRef.current = tooltipFormatter;

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
        formatter: formatterRef.current
          ? (params: unknown[]) => {
              if (!params || params.length === 0) return '';
              const first = params[0] as { name: string; data: number };
              return formatterRef.current!({ period: first.name, value: first.data });
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
  }, [data, title, showArea, smooth, theme]);

  if (error) {
    return <Empty description={error.message} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

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
      data-testid="trend-line-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
