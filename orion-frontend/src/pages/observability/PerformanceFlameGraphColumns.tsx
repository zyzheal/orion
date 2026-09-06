/**
 * PerformanceFlameGraphColumns (P2-9)
 * 性能火焰图页面的渲染组件和类别颜色映射。
 *
 * 包含:
 * - FlameFrame: SVG 帧渲染组件（纯展示，无内部状态）
 * - categoryTagColor: 图例 Tag 的颜色映射
 * - categoryCardColor: 统计卡片的颜色映射
 */

import React from 'react';
import {
  colorByDepth,
  textColorByDepth,
  FLAME_COLORS,
  FRAME_HEIGHT,
  FRAME_GAP,
  MIN_FRAME_WIDTH,
  MIN_LABEL_WIDTH,
  truncateLabel,
} from './PerformanceFlameGraphConfig';
import type { RenderRow } from './PerformanceFlameGraphConfig';
import type { FlameGraphFrame } from '@/api/flamegraph';
import { colors } from '@/tokens/colors';
import { radius } from '@/tokens';

// ---- 类别颜色映射 ----

/** 图例 Tag 的颜色（Ant Design Tag color 值） */
export const categoryTagColor = (cat: string): string => {
  if (cat === 'runtime') return 'blue';
  if (cat === 'network') return 'green';
  if (cat === 'database') return 'orange';
  return 'default';
};

/** 统计卡片的边框颜色（具体色值） */
export const categoryCardColor = (cat: string): string => {
  if (cat === 'runtime') return colors.primary[500];
  if (cat === 'network') return colors.info[500];
  if (cat === 'database') return colors.warning[500];
  if (cat === 'security') return colors.error[500];
  if (cat === 'io') return colors.purple[500];
  return colors.neutral[600];
};

// ---- 火焰图帧渲染组件 ----

export interface FlameFrameProps {
  row: RenderRow;
  rowIndex: number;
  chartWidth: number;
  zoom: number;
  hoveredFrame: FlameGraphFrame | null;
  selectedFrame: FlameGraphFrame | null;
  collapsed: Set<string>;
  isCollapsedAncestor: boolean;
  onEnter: (f: FlameGraphFrame) => void;
  onLeave: () => void;
  onClick: (f: FlameGraphFrame) => void;
}

/**
 * 渲染单个火焰图帧（SVG rect + text）。
 * 纯展示组件：所有视觉状态通过 props 传入，无内部 state。
 */
export const FlameFrame: React.FC<FlameFrameProps> = ({
  row,
  rowIndex,
  chartWidth,
  zoom,
  hoveredFrame,
  selectedFrame,
  collapsed,
  isCollapsedAncestor,
  onEnter,
  onLeave,
  onClick,
}) => {
  const { frame, depth, x, w } = row;

  const left = x * chartWidth * zoom;
  const width = Math.max(MIN_FRAME_WIDTH, w * chartWidth * zoom);
  const top = rowIndex * (FRAME_HEIGHT + FRAME_GAP);
  const fill = isCollapsedAncestor ? FLAME_COLORS[0] : colorByDepth(depth);
  const textColor = textColorByDepth(depth);

  const isHovered = hoveredFrame === frame;
  const isSelected = selectedFrame === frame;
  const isCollapsed = collapsed.has(frame.name) && frame.children && frame.children.length > 0;

  // 仅当帧足够宽且未被折叠时显示标签
  const showLabel = width >= MIN_LABEL_WIDTH && !isCollapsedAncestor;

  const label = showLabel ? truncateLabel(frame.name, width) : '';

  return (
    <g
      onMouseEnter={() => onEnter(frame)}
      onMouseLeave={onLeave}
      onClick={() => onClick(frame)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <rect
        x={left}
        y={top}
        width={width}
        height={FRAME_HEIGHT}
        fill={fill}
        rx={radius.xs}
        style={{
          stroke: isHovered || isSelected ? '#ffffff' : 'none',
          strokeWidth: isHovered || isSelected ? 2 : 0,
          filter: isHovered ? 'brightness(1.1)' : 'none',
          opacity: isCollapsedAncestor ? 0.5 : 1,
          transition: 'filter 150ms ease, opacity 150ms ease',
        }}
      />
      {label && (
        <text
          x={left + 4}
          y={top + FRAME_HEIGHT / 2 + 3}
          fontSize={10}
          fill={textColor}
          style={{
            userSelect: 'none',
            fontWeight: isSelected ? 600 : 400,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
          clipPath={`url(#clip-${rowIndex})`}
        >
          {label}
        </text>
      )}
      {/* 折叠指示器 */}
      {isCollapsed && width > 10 && (
        <text
          x={left + width - 10}
          y={top + FRAME_HEIGHT / 2 + 3}
          fontSize={9}
          fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
          textAnchor="end"
        >
          +{frame.children?.length ?? 0}
        </text>
      )}
    </g>
  );
};
