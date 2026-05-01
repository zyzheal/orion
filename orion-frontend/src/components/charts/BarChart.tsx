import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
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
