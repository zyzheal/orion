/**
 * FlameGraphContainer.tsx - 火焰图 SVG 容器 Card
 * 抽取自 PerformanceFlameGraphPage.tsx (P2-9 Phase 44)
 * 包含: 顶部信息栏 (服务/总值/层数/深度) + SVG 火焰图容器 + 底部图例
 * 渲染: clipPath defs + FlameFrame 行 (含 collapse 祖先判断) + Empty 空态
 */
import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { spacing, shadows, radius, themeVars } from '@/tokens';
import { colors } from '@/tokens/colors';
import { FLAME_GRAPH_LABELS, type FlameGraphFrame, type FlameGraphProfile } from '@/api/flamegraph';
import {
  FRAME_HEIGHT,
  FRAME_GAP,
  HEADER_HEIGHT,
  LEGEND_HEIGHT,
  formatValue,
  type RenderRow,
} from './PerformanceFlameGraphConfig';
import { FlameFrame } from './PerformanceFlameGraphColumns';
import { FlameGraphLegend } from './FlameGraphLegend';

const { Text } = Typography;

export interface FlameGraphContainerProps {
  activeType: 'cpu' | 'memory' | 'io';
  unit: string;
  currentProfile: FlameGraphProfile | null;
  flatRows: RenderRow[];
  effectiveMaxDepth: number;
  maxDepth: number;
  zoom: number;
  chartWidth: number;
  collapsed: Set<string>;
  hoveredFrame: FlameGraphFrame | null;
  selectedFrame: FlameGraphFrame | null;
  svgRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  sortedCategories: [string, { value: number; pct: number }][];
  isNodeCollapsed: (frame: FlameGraphFrame) => boolean;
  handleFrameEnter: (frame: FlameGraphFrame) => void;
  handleFrameLeave: () => void;
  handleFrameClick: (frame: FlameGraphFrame) => void;
  handleWheel: (e: React.WheelEvent) => void;
}

export const FlameGraphContainer: React.FC<FlameGraphContainerProps> = ({
  activeType,
  unit,
  currentProfile,
  flatRows,
  effectiveMaxDepth,
  maxDepth,
  zoom,
  chartWidth,
  collapsed,
  hoveredFrame,
  selectedFrame,
  svgRef,
  containerRef,
  sortedCategories,
  isNodeCollapsed,
  handleFrameEnter,
  handleFrameLeave,
  handleFrameClick,
  handleWheel,
}) => {
  const svgWidth = chartWidth * zoom;
  const svgHeight = Math.max(
    400,
    effectiveMaxDepth * (FRAME_HEIGHT + FRAME_GAP) + HEADER_HEIGHT + LEGEND_HEIGHT
  );

  return (
    <Card
      style={{
        flex: 1,
        boxShadow: shadows.sm,
        borderRadius: radius.lg,
        overflow: 'hidden',
        minHeight: 500,
      }}
      bodyStyle={{ padding: 0 }}
    >
      {/* 顶部信息栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${spacing.md}`,
          height: HEADER_HEIGHT,
          borderBottom: `1px solid ${themeVars.borderDefault}`,
          backgroundColor: themeVars.bgSecondary,
          fontSize: 12,
        }}
      >
        <Text strong>{FLAME_GRAPH_LABELS[activeType]} Flame Graph</Text>
        {currentProfile && (
          <>
            <Text type="secondary" style={{ marginLeft: spacing.md }}>
              服务: <Text strong>{currentProfile.serviceName}</Text>
            </Text>
            <Text type="secondary" style={{ marginLeft: spacing.md }}>
              总 {unit}: <Text strong>{formatValue(currentProfile.totalValue)}</Text>
            </Text>
            <Text type="secondary" style={{ marginLeft: spacing.md }}>
              层数: <Text strong>{effectiveMaxDepth}</Text>
            </Text>
            <Text type="secondary" style={{ marginLeft: spacing.md }}>
              深度: <Text strong>{maxDepth}</Text>
            </Text>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.neutral[500] }}>
              滚轮缩放 · 点击展开/收起 · Hover 查看详情
            </span>
          </>
        )}
      </div>

      {/* SVG 火焰图容器 */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          overflow: 'auto',
          height: svgHeight - HEADER_HEIGHT - LEGEND_HEIGHT,
          backgroundColor: themeVars.bgPrimary,
        }}
        onWheel={handleWheel}
      >
        {currentProfile ? (
          <svg
            ref={svgRef}
            width={svgWidth}
            height={effectiveMaxDepth * (FRAME_HEIGHT + FRAME_GAP)}
            style={{ display: 'block', minWidth: chartWidth }}
          >
            <defs>
              {/* 每行一个 clipPath，防止标签溢出 */}
              {flatRows.map((_, i) => (
                <clipPath key={`clip-${i}`}>
                  <rect x={0} y={0} width={svgWidth} height={FRAME_HEIGHT} />
                </clipPath>
              ))}
            </defs>
            {flatRows.map((row, i) => {
              const underCollapsed =
                i > 0
                  ? (() => {
                      // 查找上一个深度更小的行作为父节点
                      for (let j = i - 1; j >= 0; j--) {
                        if (flatRows[j].depth < row.depth) {
                          return isNodeCollapsed(flatRows[j].frame);
                        }
                        if (flatRows[j].depth === row.depth) break;
                      }
                      return false;
                    })()
                  : false;

              return (
                <FlameFrame
                  key={`frame-${i}`}
                  row={row}
                  rowIndex={i}
                  chartWidth={chartWidth}
                  zoom={zoom}
                  hoveredFrame={hoveredFrame}
                  selectedFrame={selectedFrame}
                  collapsed={collapsed}
                  isCollapsedAncestor={underCollapsed}
                  onEnter={handleFrameEnter}
                  onLeave={handleFrameLeave}
                  onClick={handleFrameClick}
                />
              );
            })}
          </svg>
        ) : (
          <div
            style={
              {
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              } as React.CSSProperties
            }
          >
            <Empty description="暂无火焰图数据" />
          </div>
        )}
      </div>

      {/* 底部图例 */}
      {currentProfile && (
        <FlameGraphLegend sortedCategories={sortedCategories} />
      )}
    </Card>
  );
};

export default FlameGraphContainer;
