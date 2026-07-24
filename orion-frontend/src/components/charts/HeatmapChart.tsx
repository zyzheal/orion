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
          `${xAxis[p.data[0]]} x ${yAxis[p.data[1]]}: ${p.data[2]}`,
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
