/**
 * Quality Trend SVG chart
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React from 'react';
import { colors } from '@/tokens/colors';
import { MOCK_TREND, TREND_LABELS } from '../constants';

export const QualityTrendChart: React.FC = () => {
  if (MOCK_TREND.length === 0) return null;
  const width = 300;
  const height = 80;
  const padding = 10;
  const min = Math.min(...MOCK_TREND) - 5;
  const max = Math.max(...MOCK_TREND) + 5;
  const scaleX = (i: number) => padding + (width - 2 * padding) * (i / (MOCK_TREND.length - 1));
  const scaleY = (v: number) =>
    height - padding - (height - 2 * padding) * ((v - min) / (max - min));

  const pathD = MOCK_TREND.map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}`).join(' ');

  const areaD =
    `M ${scaleX(0)} ${scaleY(MOCK_TREND[0])} ` +
    MOCK_TREND.map((v, i) => `L ${scaleX(i)} ${scaleY(v)}`).join(' ') +
    ` L ${scaleX(MOCK_TREND.length - 1)} ${height - padding} L ${scaleX(0)} ${height - padding} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.primary[400]} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colors.primary[400]} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trendGradient)" />
      <path d={pathD} fill="none" stroke={colors.primary[500]} strokeWidth={2} />
      {MOCK_TREND.map((v, i) => (
        <circle key={String(i)} cx={scaleX(i)} cy={scaleY(v)} r={3} fill={colors.primary[500]} />
      ))}
      {TREND_LABELS.map((label, i) => (
        <text
          key={String(i)}
          x={scaleX(i)}
          y={height - 1}
          fontSize={8}
          fill={colors.neutral[500]}
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
    </svg>
  );
};
