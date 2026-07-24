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
        colorBy,
        itemStyle: {
          color: theme.palette[idx % theme.palette.length],
        },
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
        <Spin />
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
