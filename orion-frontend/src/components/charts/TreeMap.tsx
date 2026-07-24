import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin } from 'antd';
import { useChartTheme } from './ChartProvider';

export interface TreeMapNode {
  name: string;
  value: number;
  children?: TreeMapNode[];
  color?: string;
}

export interface TreeMapChartProps {
  title?: string;
  data: TreeMapNode[];
  height?: number;
  showLabel?: boolean;
  leafDepth?: number;
  loading?: boolean;
}

interface TreeNode {
  name: string;
  value: number;
  children?: TreeNode[];
  itemStyle?: { color: string };
}

const convertNode = (node: TreeMapNode, idx: number, palette: string[]): TreeNode => ({
  name: node.name,
  value: node.value,
  children: node.children?.map((c, i) => convertNode(c, i, palette)),
  itemStyle: node.color
    ? { color: node.color }
    : { color: palette[idx % palette.length] },
});

export const TreeMap: React.FC<TreeMapChartProps> = ({
  title,
  data,
  height = 300,
  showLabel = true,
  leafDepth,
  loading = false,
}) => {
  const theme = useChartTheme();

  const option = useMemo(() => {
    if (data.length === 0) return {};

    return {
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'treemap' as const,
        data: data.map((n, i) => convertNode(n, i, theme.palette)),
        leafDepth: leafDepth ?? 1,
        label: showLabel
          ? { show: true, color: theme.textColor, fontSize: 11 }
          : undefined,
        breadcrumb: { show: false },
        itemStyle: { borderColor: theme.borderColor, borderWidth: 1, gapWidth: 2 },
      },
    ],
    };
  }, [data, title, showLabel, leafDepth, theme]);

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
      data-testid="treemap-chart"
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
