/**
 * WaterfallChart.tsx - SVG Waterfall 图表（列头 + Tree 列 + SVG 网格 + Span 条 + 时间轴）
 * 抽取自 TraceDetailPage.tsx (P2-9 Phase 43)
 */
import React from 'react';
import { Popover } from 'antd';
import { spacing, radius, themeVars } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  HEADER_HEIGHT,
  AXIS_HEIGHT,
  ROW_HEIGHT,
  ROW_GAP,
  TREE_COL_WIDTH,
  BAR_MIN_HEIGHT,
  BAR_MIN_WIDTH,
  spanDurationMs,
  spanStartMs,
  formatDuration,
  isSpanError,
  getBarColor,
  getBarHoverColor,
} from './TraceDetailConfig';
import type { SpanNode } from './TraceDetailConfig';
import { SpanDetailPopover, TreeNodeRow } from './TraceDetailColumns';
import { TimeAxis } from './TimeAxis';

export interface WaterfallChartProps {
  chartRef: React.RefObject<HTMLDivElement>;
  visibleSpans: SpanNode[];
  flatSpans: SpanNode[];
  chartWidth: number;
  totalDurationMs: number;
  traceStartMs: number;
  serviceColorMap: Map<string, string>;
  zoom: number;
  effectiveDurationMs: number;
  pxPerMs: number;
  svgHeight: number;
  collapsed: Set<string>;
  hoveredSpanId: string | null;
  selectedSpanId: string | null;
  hoverY: number | null;
  searchTerm: string;
  matchingSpanIds: Set<string>;
  onSpanEnter: (spanId: string, rowIdx: number) => void;
  onSpanLeave: () => void;
  onSelect: (spanId: string) => void;
  onToggle: (spanId: string) => void;
  onWheelZoom: (e: React.WheelEvent) => void;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  chartRef,
  visibleSpans,
  flatSpans,
  chartWidth,
  totalDurationMs,
  traceStartMs,
  serviceColorMap,
  zoom,
  effectiveDurationMs,
  pxPerMs,
  svgHeight,
  collapsed,
  hoveredSpanId,
  selectedSpanId,
  hoverY,
  searchTerm,
  matchingSpanIds,
  onSpanEnter,
  onSpanLeave,
  onSelect,
  onToggle,
  onWheelZoom,
}) => {
  const totalRows = visibleSpans.length;

  return (
    <div
      ref={chartRef}
      style={{
        position: 'relative',
        height: svgHeight,
        overflow: 'hidden',
      }}
      onWheel={onWheelZoom}
    >
      {/* Column headers */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: TREE_COL_WIDTH,
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${spacing.md}`,
          borderBottom: `1px solid ${themeVars.borderDefault}`,
          borderRight: `1px solid ${themeVars.borderDefault}`,
          backgroundColor: themeVars.bgTertiary,
          fontSize: 12,
          fontWeight: 500,
          zIndex: 2,
        }}
      >
        <span style={{ width: 16, marginRight: 4, textAlign: 'center' }}>
          {String.fromCharCode(160)}
        </span>
        <span>Span</span>
        <span style={{ marginLeft: 'auto' }}>Duration</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: TREE_COL_WIDTH,
          top: 0,
          width: chartWidth,
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: colors.neutral[500],
          zIndex: 2,
        }}
      >
        Time elapsed (scale: {zoom.toFixed(2)}x, {formatDuration(totalDurationMs * 1_000_000)}
        total)
      </div>

      {/* Time axis header line */}
      <div
        style={{
          position: 'absolute',
          left: TREE_COL_WIDTH,
          top: HEADER_HEIGHT,
          width: chartWidth,
          height: 1,
          backgroundColor: themeVars.borderDefault,
          zIndex: 1,
        }}
      />

      {/* Tree column */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: HEADER_HEIGHT,
          width: TREE_COL_WIDTH,
          height: Math.max(400, totalRows * (ROW_HEIGHT + ROW_GAP)),
          borderRight: `1px solid ${themeVars.borderDefault}`,
          backgroundColor: themeVars.bgPrimary,
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        {visibleSpans.map((node, rowIdx) => (
          <TreeNodeRow
            key={node.span.spanId}
            node={node}
            rowIdx={rowIdx}
            treeColWidth={TREE_COL_WIDTH}
            rowHeight={ROW_HEIGHT}
            collapsed={collapsed}
            onToggle={onToggle}
            hoveredSpanId={hoveredSpanId}
            onMouseEnter={onSpanEnter}
            onMouseLeave={onSpanLeave}
            selectedSpanId={selectedSpanId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* SVG Waterfall */}
      <div
        style={{
          position: 'absolute',
          left: TREE_COL_WIDTH,
          top: HEADER_HEIGHT,
          width: chartWidth,
          height: svgHeight - HEADER_HEIGHT,
          backgroundColor: themeVars.bgPrimary,
          cursor: 'col-resize',
          overflow: 'hidden',
        }}
      >
        <svg
          width={chartWidth}
          height={svgHeight - HEADER_HEIGHT}
          style={{ display: 'block' }}
          onWheel={onWheelZoom}
        >
          {/* Grid lines (vertical) */}
          {(() => {
            const gridLines: React.ReactNode[] = [];
            const fullMsPerPixel = 1 / pxPerMs;
            let intervalMs: number;
            if (fullMsPerPixel < 50) intervalMs = 50;
            else if (fullMsPerPixel < 100) intervalMs = 100;
            else if (fullMsPerPixel < 500) intervalMs = 500;
            else if (fullMsPerPixel < 1000) intervalMs = 1000;
            else intervalMs = 2000;

            for (let t = 0; t <= effectiveDurationMs; t += intervalMs) {
              const x = t * pxPerMs;
              gridLines.push(
                <line
                  key={`grid-${t}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={svgHeight - HEADER_HEIGHT - AXIS_HEIGHT}
                  stroke={themeVars.borderLight}
                  strokeWidth={1}
                  strokeDasharray="2,4"
                />
              );
            }
            return gridLines;
          })()}

          {visibleSpans.map((node, rowIdx) => {
            const s = node.span;
            const startOffset = spanStartMs(s) - traceStartMs;
            const dur = spanDurationMs(s);
            const x = Math.max(0, startOffset * pxPerMs);
            const w = Math.max(BAR_MIN_WIDTH, dur * pxPerMs);
            const y = rowIdx * (ROW_HEIGHT + ROW_GAP);
            const barH = Math.min(ROW_HEIGHT - ROW_GAP - 4, BAR_MIN_HEIGHT);
            const barY = y + 2;
            const barColor = getBarColor(s, serviceColorMap);
            const isHovered = hoveredSpanId === s.spanId;
            const isSelected = selectedSpanId === s.spanId;
            const isMatch = searchTerm.trim() && matchingSpanIds.has(s.spanId);

            return (
              <g key={`span-${s.spanId}`}>
                {isMatch && (
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={ROW_HEIGHT + ROW_GAP}
                    fill={colors.warning[50]}
                    opacity={0.7}
                  />
                )}
                <rect
                  x={x + 1}
                  y={barY + 2}
                  width={w}
                  height={barH}
                  fill="rgba(0,0,0,0.08)"
                  rx={radius.xs}
                />
                <Popover
                  content={<SpanDetailPopover span={s} />}
                  trigger="hover"
                  placement="bottomLeft"
                >
                  <rect
                    x={x}
                    y={barY}
                    width={w}
                    height={barH}
                    fill={isHovered ? getBarHoverColor(barColor) : barColor}
                    rx={radius.xs}
                    style={{
                      cursor: 'pointer',
                      filter: isHovered ? 'brightness(1.1)' : 'none',
                      stroke: isSelected ? colors.neutral[900] : 'none',
                      strokeWidth: isSelected ? 2 : 0,
                      transition: 'fill 150ms ease',
                    }}
                    onMouseEnter={() => onSpanEnter(s.spanId, rowIdx)}
                    onMouseLeave={onSpanLeave}
                  />
                </Popover>
                {w > 60 && (
                  <text
                    x={x + 4}
                    y={barY + barH / 2 + 3}
                    fontSize={10}
                    fill="var(--text-primary)"
                    style={{ userSelect: 'none', fontWeight: 500 }}
                  >
                    {formatDuration(s.durationNs)}
                  </text>
                )}
                {isSpanError(s) && (
                  <circle cx={x + w - 4} cy={barY + barH / 2} r={3} fill={colors.error[700]} />
                )}
              </g>
            );
          })}

          {hoveredSpanId &&
            hoverY !== null &&
            (() => {
              const y = hoverY * (ROW_HEIGHT + ROW_GAP);
              return (
                <rect
                  x={0}
                  y={y}
                  width={chartWidth}
                  height={ROW_HEIGHT + ROW_GAP}
                  fill={colors.primary[50]}
                  opacity={0.5}
                  pointerEvents="none"
                />
              );
            })()}

          <g transform={`translate(0, ${svgHeight - HEADER_HEIGHT - AXIS_HEIGHT})`}>
            <TimeAxis chartWidth={chartWidth} totalDurationMs={totalDurationMs} zoom={zoom} />
          </g>
        </svg>
      </div>

      {/* Axis label column (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: svgHeight - AXIS_HEIGHT,
          width: TREE_COL_WIDTH,
          height: AXIS_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${spacing.md}`,
          borderRight: `1px solid ${themeVars.borderDefault}`,
          backgroundColor: themeVars.bgTertiary,
          fontSize: 11,
          color: colors.neutral[500],
          zIndex: 2,
        }}
      >
        {totalRows} spans &middot; {flatSpans.length} total
      </div>

      {/* X-axis line under tree column */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: svgHeight - AXIS_HEIGHT,
          width: TREE_COL_WIDTH,
          height: 1,
          backgroundColor: themeVars.borderDefault,
          zIndex: 1,
        }}
      />
    </div>
  );
};
