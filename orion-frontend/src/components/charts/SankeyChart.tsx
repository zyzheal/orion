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
        layout: 'force' as const,
        layoutIterations: 30,
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
        <Spin />
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
