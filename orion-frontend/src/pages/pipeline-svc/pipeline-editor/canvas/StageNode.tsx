/**
 * Stage Node Component - 流水线阶段节点
 *
 * 用于 PipelineCanvas 中的可视化阶段节点
 * 显示阶段名称、类型图标、状态、配置信息
 */
import React, { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Typography, Space, Tag, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

// Stage 类型配置
const STAGE_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  build: { icon: '🔨', color: colors.primary[500], label: '构建' },
  test: { icon: '🧪', color: colors.success[500], label: '测试' },
  scan: { icon: '🔍', color: colors.warning[500], label: '扫描' },
  deploy: { icon: '🚀', color: colors.error[500], label: '部署' },
  notify: { icon: '📢', color: colors.info[500], label: '通知' },
  custom: { icon: '⚙️', color: colors.neutral[500], label: '自定义' },
  buildx: { icon: '🏷️', color: colors.primary[600], label: '多架构构建' },
  container: { icon: '📦', color: colors.primary[400], label: '容器运行' },
};

// 状态配置
const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <ClockCircleOutlined />, color: colors.neutral[400] },
  running: { icon: <SyncOutlined spin />, color: colors.primary[500] },
  success: { icon: <CheckCircleOutlined />, color: colors.success[500] },
  failed: { icon: <CloseCircleOutlined />, color: colors.error[500] },
  skipped: { icon: <PlayCircleOutlined style={{ transform: 'rotate(180deg)' }} />, color: colors.neutral[400] },
};

// Stage Node Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StageNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const label = data?.label || '';
  const stageType = data?.stageType || 'custom';
  const status = data?.status || 'pending';
  const config = data?.config;
  const index = data?.index;

  const typeConfig = useMemo(
    () => STAGE_TYPE_CONFIG[stageType] || STAGE_TYPE_CONFIG.custom,
    [stageType]
  );

  const statusConfig = useMemo(
    () => STATUS_CONFIG[status] || STATUS_CONFIG.pending,
    [status]
  );

  // 构建工具提示内容
  const tooltipContent = useMemo(() => {
    const lines = [
      `阶段: ${label}`,
      `类型: ${typeConfig.label}`,
      `状态: ${status}`,
    ];

    if (config) {
      if ((config as Record<string, unknown>).imageName) lines.push(`镜像: ${String((config as Record<string, unknown>).imageName)}`);
      if ((config as Record<string, unknown>).containerImage) lines.push(`容器: ${String((config as Record<string, unknown>).containerImage)}`);
      if ((config as Record<string, unknown>).uses) lines.push(`使用: ${String((config as Record<string, unknown>).uses)}`);
    }

    return (
      <Space direction="vertical" size={4}>
        {lines.map((line, i) => (
          <Text key={i} style={{ color: '#fff' }}>
            {line}
          </Text>
        ))}
      </Space>
    );
  }, [label, typeConfig, status, config]);

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div
        style={{
          padding: `${spacing[3]} ${spacing[4]}`,
          borderRadius: 8,
          border: `2px solid ${selected ? colors.primary[500] : typeConfig.color}`,
          background: selected ? colors.primary[50] : colors.neutral[0],
          minWidth: 150,
          maxWidth: 200,
          boxShadow: selected
            ? `0 0 12px ${colors.primary[300]}`
            : '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
      >
        {/* Input Handle (Top) */}
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: typeConfig.color,
            width: 10,
            height: 10,
            top: -5,
            border: `2px solid ${colors.neutral[0]}`,
          }}
        />

        {/* Node Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[1],
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: typeConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}
          >
            {index + 1}
          </div>
          <span style={{ fontSize: 12, color: statusConfig.color }}>{statusConfig.icon}</span>
        </div>

        {/* Node Label */}
        <div style={{
          display: 'block',
          fontSize: 13,
          marginBottom: spacing[1],
          fontWeight: 'bold',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span>{typeConfig.icon}</span> {String(label)}
        </div>

        {/* Type Tag */}
        <div style={{ marginTop: spacing[1] }}>
          <Tag
            color={typeConfig.color}
            style={{
              fontSize: 10,
              padding: '0 4px',
              margin: 0,
              borderRadius: 4,
            }}
          >
            {typeConfig.label}
          </Tag>
        </div>

        {/* Config Info (if available) */}
        {config && (config.imageName || config.containerImage) && (
          <div
            style={{
              marginTop: spacing[1],
              paddingTop: spacing[1],
              borderTop: `1px solid ${colors.neutral[200]}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 10 }}>
              {String(config.imageName || config.containerImage || '')}
            </Text>
          </div>
        )}

        {/* Output Handle (Bottom) */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: typeConfig.color,
            width: 10,
            height: 10,
            bottom: -5,
            border: `2px solid ${colors.neutral[0]}`,
          }}
        />
      </div>
    </Tooltip>
  );
};

export default memo(StageNode);