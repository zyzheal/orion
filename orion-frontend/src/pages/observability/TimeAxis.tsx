/**
 * TimeAxis.tsx - 时间轴刻度 SVG 组件
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React, { useMemo } from 'react';
import { colors, themeVars } from '@/tokens';
import { AXIS_HEIGHT } from './TraceDetailConfig';

export const TimeAxis: React.FC<{
  chartWidth: number;
  totalDurationMs: number;
  zoom: number;
}> = ({ chartWidth, totalDurationMs, zoom }) => {
  const effectiveDurationMs = totalDurationMs * zoom;
  const pxPerMs = chartWidth / Math.max(1, effectiveDurationMs);

  const ticks = useMemo(() => {
    const fullMsPerPixel = 1 / pxPerMs;
    let intervalMs: number;
    if (fullMsPerPixel < 50) intervalMs = 50;
    else if (fullMsPerPixel < 100) intervalMs = 100;
    else if (fullMsPerPixel < 200) intervalMs = 200;
    else if (fullMsPerPixel < 500) intervalMs = 500;
    else if (fullMsPerPixel < 1000) intervalMs = 1000;
    else if (fullMsPerPixel < 2000) intervalMs = 2000;
    else if (fullMsPerPixel < 5000) intervalMs = 5000;
    else if (fullMsPerPixel < 10000) intervalMs = 10000;
    else if (fullMsPerPixel < 30000) intervalMs = 30000;
    else if (fullMsPerPixel < 60000) intervalMs = 60000;
    else if (fullMsPerPixel < 120000) intervalMs = 120000;
    else intervalMs = 300000;

    const ticks: { x: number; label: string }[] = [];
    for (let t = 0; t <= effectiveDurationMs; t += intervalMs) {
      const x = t * pxPerMs;
      const elapsedMs = t;
      let label: string;
      if (elapsedMs < 1000) label = `${elapsedMs}ms`;
      else if (elapsedMs < 60000) label = `${(elapsedMs / 1000).toFixed(1)}s`;
      else label = `${(elapsedMs / 60000).toFixed(1)}min`;
      ticks.push({ x, label });
    }
    return ticks;
  }, [chartWidth, effectiveDurationMs, pxPerMs]);

  const y = AXIS_HEIGHT - 4;

  return (
    <g>
      <line
        x1="0"
        y1={y}
        x2={chartWidth}
        y2={y}
        stroke={themeVars.borderDefault}
        strokeWidth={1}
      />
      {ticks.map((tick, i) => (
        <g key={String(i)}>
          <line
            x1={tick.x}
            y1={y}
            x2={tick.x}
            y2={y + 4}
            stroke={colors.neutral[400]}
            strokeWidth={1}
          />
          <text
            x={tick.x}
            y={y + 16}
            fontSize={10}
            fill={colors.neutral[500]}
            textAnchor="start"
            style={{ userSelect: 'none' }}
          >
            +{tick.label}
          </text>
        </g>
      ))}
    </g>
  );
};
