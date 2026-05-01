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
        <Spin />
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
