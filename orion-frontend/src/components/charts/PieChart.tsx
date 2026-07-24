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
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
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
