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
