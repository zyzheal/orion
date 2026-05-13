/**
 * Dependency Edge Component - 依赖连线组件
 *
 * 用于 PipelineCanvas 中显示阶段之间的依赖关系
 * 支持：普通连线、高亮连线、错误状态连线
 */
import React, { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow';
import { colors } from '@/tokens';

interface DependencyEdgeData {
  dependency?: string;
  status?: 'success' | 'failed' | 'running' | 'pending';
  isParallel?: boolean;
}

// 状态对应的颜色
const STATUS_COLORS: Record<string, string> = {
  pending: colors.neutral[300],
  running: colors.primary[500],
  success: colors.success[500],
  failed: colors.error[500],
  skipped: colors.neutral[400],
};

const DependencyEdge: React.FC<EdgeProps<DependencyEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}) => {
  // 计算贝塞尔曲线路径
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  // 确定边的颜色
  const edgeColor = data?.status
    ? STATUS_COLORS[data.status]
    : colors.neutral[400];

  // 是否动画显示（running 状态）
  const isAnimated = data?.status === 'running';

  // 是否并行边（虚线）
  const isDashed = data?.isParallel;

  // 合并样式
  const mergedStyle: React.CSSProperties = {
    ...style,
    stroke: edgeColor,
    strokeWidth: 2,
    strokeDasharray: isDashed ? '5,5' : undefined,
    transition: 'stroke 0.3s ease',
    ...(isAnimated ? { strokeDasharray: '5,5', animation: 'dash 1s linear infinite' } : {}),
  };

  return (
    <>
      {/* 主边 */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={mergedStyle}
      />

      {/* 并行标记 (如果有) */}
      {data?.isParallel && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <circle
            r={10}
            fill={colors.neutral[0]}
            stroke={colors.neutral[300]}
            strokeWidth={1}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={10}
            fill={colors.neutral[600]}
          >
            ∥
          </text>
        </g>
      )}

      {/* 运行中动画效果 */}
      {isAnimated && (
        <circle r={4} fill={colors.primary[500]}>
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}
    </>
  );
};

export default memo(DependencyEdge);

// 辅助函数：创建边的数据对象
export function createEdgeData(options?: {
  status?: 'success' | 'failed' | 'running' | 'pending';
  isParallel?: boolean;
  dependency?: string;
}): DependencyEdgeData | undefined {
  if (!options) return undefined;
  return {
    status: options.status,
    isParallel: options.isParallel,
    dependency: options.dependency,
  };
}

// 辅助函数：获取边颜色
export function getEdgeColor(status?: string): string {
  return STATUS_COLORS[status || 'pending'] || colors.neutral[400];
}