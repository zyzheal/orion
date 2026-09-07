/**
 * TrendChart - SVG 趋势图
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Empty } from 'antd';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type { TrendPoint } from '@/api/health';

interface TrendChartProps {
  data: TrendPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  if (!data.length) return <Empty description="暂无趋势数据" />;

  const maxScore = 100;
  const chartWidth = 800;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

  const scorePoints = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - (d.healthScore / maxScore) * innerH,
  }));

  const linePath = scorePoints
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ');
  const areaPath =
    linePath +
    ` L${scorePoints[scorePoints.length - 1].x},${padding.top + innerH}` +
    ` L${scorePoints[0].x},${padding.top + innerH} Z`;

  const gridLines = [0, 25, 50, 75, 100].map((v) => ({
    y: padding.top + innerH - (v / maxScore) * innerH,
    label: `${v}`,
  }));

  const xLabels = data.filter((_, i) => i % 4 === 0 || i === data.length - 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ width: '100%', maxWidth: chartWidth, height: 'auto' }}
      >
        {gridLines.map((g) => (
          <g key={g.y}>
            <line
              x1={padding.left}
              y1={g.y}
              x2={padding.left + innerW}
              y2={g.y}
              stroke={colors.neutral[200]}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 6}
              y={g.y + 4}
              textAnchor="end"
              fontSize="10"
              fill={colors.neutral[500]}
            >
              {g.label}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`${colors.primary[500]}18`} />

        <path d={linePath} fill="none" stroke={colors.primary[500]} strokeWidth={2} />

        {scorePoints.map((p, i) => (
          <circle
            key={String(i)}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={colors.primary[500]}
            stroke={colors.neutral[0]}
            strokeWidth={1.5}
          />
        ))}

        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          return (
            <text
              key={String(i)}
              x={padding.left + idx * xStep}
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize="10"
              fill={colors.neutral[500]}
            >
              {dayjs(d.timestamp).format('HH:mm')}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
