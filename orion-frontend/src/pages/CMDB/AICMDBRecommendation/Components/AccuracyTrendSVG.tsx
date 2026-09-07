/**
 * AccuracyTrendSVG mini chart
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { colors } from '@/tokens';

interface AccuracyTrendSVGProps {
  data: number[];
}

export const AccuracyTrendSVG: React.FC<AccuracyTrendSVGProps> = ({ data }) => {
  if (data.length === 0) return null;
  const width = 280;
  const height = 80;
  const padding = { top: 12, right: 12, bottom: 18, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const minVal = Math.min(...data) - 1;
  const maxVal = Math.max(...data) + 1;
  const range = maxVal - minVal || 1;

  const points = data.map((val, idx) => {
    const x = padding.left + (idx / (data.length - 1)) * innerW;
    const y = padding.top + innerH - ((val - minVal) / range) * innerH;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding.left},${padding.top + innerH}`,
    ...points,
    `${padding.left + innerW},${padding.top + innerH}`,
  ];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.purple[500]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colors.purple[500]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints.join(' ')} fill="url(#accuracyGradient)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={colors.purple[500]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((val, idx) => {
        const x = padding.left + (idx / (data.length - 1)) * innerW;
        const y = padding.top + innerH - ((val - minVal) / range) * innerH;
        return <circle key={String(idx)} cx={x} cy={y} r="3" fill={colors.purple[500]} />;
      })}
      <text x={padding.left} y={height - 2} fontSize="9" fill={colors.neutral[500]}>
        7天前
      </text>
      <text x={width - padding.right - 24} y={height - 2} fontSize="9" fill={colors.neutral[500]}>
        今天
      </text>
    </svg>
  );
};
