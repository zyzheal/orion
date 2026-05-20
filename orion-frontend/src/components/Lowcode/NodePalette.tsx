/**
 * NodePalette - 节点面板
 * 工作流设计器的节点库，支持拖拽添加节点到画布
 */
import React, { useState } from 'react';
import { Card, Typography, Space } from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  BellOutlined,
  ApiOutlined,
  StopOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens/spacing';
import { animation } from '@/tokens/animation';
import type { WorkflowNodeType } from './types';
import { nodeTypeConfig } from './types';

const { Text, Title } = Typography;

/**
 * 节点类型到 Ant Design 图标的映射
 */
const nodeIcons: Record<WorkflowNodeType, React.ReactNode> = {
  start: <PlayCircleOutlined />,
  approval: <CheckCircleOutlined />,
  condition: <QuestionCircleOutlined />,
  notification: <BellOutlined />,
  webhook: <ApiOutlined />,
  end: <StopOutlined />,
};

export interface NodePaletteProps {
  onAddNode?: (type: WorkflowNodeType) => void;
  onDragStart?: (event: React.DragEvent, type: WorkflowNodeType) => void;
}

/**
 * 单个节点类型卡片
 */
const NodeCard: React.FC<{
  type: WorkflowNodeType;
  onAddNode?: (type: WorkflowNodeType) => void;
  onDragStart?: (event: React.DragEvent, type: WorkflowNodeType) => void;
}> = ({ type, onAddNode, onDragStart }) => {
  const [isDragging, setIsDragging] = useState(false);
  const config = nodeTypeConfig[type];

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/node-type', type);
    onDragStart?.(e, type);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onAddNode?.(type)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: componentRadius.button.md,
        border: `1px solid ${colors.light.border.heavy}`,
        background: isDragging
          ? `${config.color}15`
          : colors.light.bg.primary,
        cursor: 'grab',
        transition: `all ${animation.duration.fast}ms ${animation.easing.easeOut}`,
        boxShadow: isDragging ? shadows.sm : shadows.none,
        transform: isDragging ? 'scale(0.98)' : 'scale(1)',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = config.color;
          e.currentTarget.style.background = `${config.color}08`;
          e.currentTarget.style.transform = 'translateX(4px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = colors.light.border.heavy;
          e.currentTarget.style.background = colors.light.bg.primary;
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      {/* 节点图标 */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: componentRadius.button.sm,
          background: `${config.color}15`,
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {nodeIcons[type]}
      </div>

      {/* 节点信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ fontSize: 13, color: colors.light.text.primary }}>
          {config.label}
        </Text>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {config.description}
          </Text>
        </div>
      </div>

      {/* 拖拽指示器 */}
      <CopyOutlined
        style={{
          fontSize: 12,
          color: colors.neutral[400],
          transition: `color ${animation.duration.fast}ms ease`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = config.color;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.neutral[400];
        }}
      />
    </div>
  );
};

/**
 * NodePalette 组件
 * 按类型分组展示可用节点，支持点击添加和拖拽
 */
const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode, onDragStart }) => {
  const nodeTypes: WorkflowNodeType[] = [
    'start',
    'approval',
    'condition',
    'notification',
    'webhook',
    'end',
  ];

  return (
    <Card
      size="small"
      title={
        <Space size={4}>
          <Text strong style={{ fontSize: 13 }}>
            节点库
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            点击或拖拽添加
          </Text>
        </Space>
      }
      style={{
        borderRadius: componentRadius.card,
        boxShadow: shadows.card,
        border: 'none',
      }}
      styles={{
        body: { padding: `${spacing.sm}px` },
      }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {nodeTypes.map((type) => (
          <NodeCard
            key={type}
            type={type}
            onAddNode={onAddNode}
            onDragStart={onDragStart}
          />
        ))}
      </Space>
    </Card>
  );
};

export default NodePalette;
