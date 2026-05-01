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
          return `${p.data.name}<br/>${startDate} \u2192 ${endDate}<br/>Duration: ${duration}m`;
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
          renderItem: (params: Record<string, unknown>, api: Record<string, unknown>) => {
            const apiValue = api.value as (p: number, d?: number) => number;
            const apiCoord = api.coord as (v: [number, number]) => [number, number];
            const dataIndex = params.dataIndex as number;
            const start = apiCoord([apiValue(0, dataIndex), apiValue(1, dataIndex)]);
            const end = apiCoord([apiValue(0, dataIndex), apiValue(2, dataIndex)]);
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
              style: {
                fill: (params as { itemStyle?: { color?: string } }).itemStyle?.color ?? theme.info,
              },
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
        <Spin />
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
