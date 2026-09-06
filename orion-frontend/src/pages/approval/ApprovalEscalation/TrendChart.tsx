/**
 * TrendChart - SVG 趋势图
 * 平均审批时长 + SLA 达标率双线
 */
import React from 'react';
import { colors } from '@/tokens/colors';
import type { TrendDay } from './types';

export const TrendChart: React.FC<{ data: TrendDay[] }> = ({ data }) => {
  if (data.length === 0) return null;
  const width = 700;
  const height = 200;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.avgDuration)) * 1.2;
  const minVal = 0;

  const avgPoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.avgDuration - minVal) / (maxVal - minVal)) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const slaPoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - (d.slaRate / 100) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${padding.left},${padding.top + chartH} ${avgPoints} ${padding.left + chartW},${padding.top + chartH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartH * (1 - ratio);
        const val = Math.round(minVal + (maxVal - minVal) * ratio);
        return (
          <g key={ratio}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke={colors.neutral[200]}
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill={colors.neutral[500]}
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#avgGradient)" />

      {/* Avg duration line */}
      <polyline
        points={avgPoints}
        fill="none"
        stroke={colors.primary[500]}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* SLA rate line (dashed) */}
      <polyline
        points={slaPoints}
        fill="none"
        stroke={colors.success[500]}
        strokeWidth={2}
        strokeDasharray="6,4"
        strokeLinecap="round"
      />

      {/* Data points */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartW;
        const yAvg = padding.top + chartH - ((d.avgDuration - minVal) / (maxVal - minVal)) * chartH;
        const ySla = padding.top + chartH - (d.slaRate / 100) * chartH;
        return (
          <g key={String(i)} aria-hidden>
            <circle cx={x} cy={yAvg} r={4} fill={colors.primary[500]} />
            <circle cx={x} cy={ySla} r={3.5} fill={colors.success[500]} />
            <text
              x={x}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              fontSize={11}
              fill={colors.neutral[500]}
            >
              {d.date}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g aria-hidden>
        <rect x={padding.left} y={4} width={12} height={3} fill={colors.primary[500]} />
        <text x={padding.left + 18} y={9} fontSize={11} fill={colors.neutral[600]}>
          平均审批时长
        </text>
        <line
          x1={padding.left + 140}
          y1={6}
          x2={padding.left + 152}
          y2={6}
          stroke={colors.success[500]}
          strokeDasharray="4,2"
          strokeWidth={2}
        />
        <text x={padding.left + 158} y={9} fontSize={11} fill={colors.neutral[600]}>
          SLA 达标率
        </text>
      </g>
    </svg>
  );
};
