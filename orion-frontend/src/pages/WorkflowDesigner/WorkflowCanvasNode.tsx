/**
 * WorkflowCanvas — 自定义节点渲染（ReactFlow）
 *
 * 将原 WorkflowCanvas.tsx 中的 CustomNode 抽离出来，
 * 使用设计 token（@/tokens）与 WorkflowCanvasConfig 中的类型映射。
 */
import React from 'react';
import type { WorkflowNode } from '@/api/workflow';
import { colors } from '@/tokens';
import { nodeTypeColors, nodeTypeLabels } from './WorkflowCanvasConfig';

export interface CustomNodeData {
  node: WorkflowNode;
  isHovered: boolean;
  isSelected: boolean;
  configured: boolean;
  configPreview: string;
  onNodeClick: () => void;
}

interface CustomNodeProps {
  data: CustomNodeData;
}

export const CustomNode: React.FC<CustomNodeProps> = ({ data }) => {
  const { node, isHovered, isSelected, configured, configPreview, onNodeClick } = data;

  const color = nodeTypeColors[node.type];

  return (
    <div
      onClick={onNodeClick}
      style={{
        minWidth: 200,
        maxWidth: 280,
        background: isSelected
          ? colors.primary[50]
          : isHovered
            ? colors.neutral[50]
            : colors.neutral[0],
        borderRadius: 12,
        padding: '12px 16px',
        border: isSelected
          ? `2px solid ${colors.primary[500]}`
          : `1px solid ${colors.neutral[200]}`,
        boxShadow: isHovered
          ? '0 3px 8px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Type badge */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          left: 16,
          background: color,
          color: colors.neutral[0],
          borderRadius: 12,
          padding: '3px 12px',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {nodeTypeLabels[node.type] || node.type}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.neutral[900],
          marginBottom: 6,
          marginTop: 8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.name}
      </div>

      {/* Config preview */}
      {configured && (
        <div
          style={{
            fontSize: 11,
            color: colors.neutral[600],
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            borderTop: `1px solid ${colors.neutral[200]}`,
            paddingTop: 6,
            marginTop: 2,
          }}
        >
          {configPreview}
        </div>
      )}

      {!configured && (
        <div
          style={{
            fontSize: 11,
            color: colors.neutral[400],
            fontStyle: 'italic',
          }}
        >
          未配置
        </div>
      )}
    </div>
  );
};

export const customNodeTypes = { workflow: CustomNode };
