/**
 * StageItem - 可拖拽的 Stage 组件
 */
import React from 'react';
import { Card, Tag, Space, Typography, Button, Tooltip, Badge } from 'antd';
import { colors, spacing } from '@/tokens';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DragOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { StageConfig } from './types';

const { Text } = Typography;

const STAGE_TYPE_ICONS: Record<string, string> = {
  build: '🔨',
  test: '🧪',
  scan: '🔍',
  deploy: '🚀',
  notify: '📢',
  custom: '⚙️',
};

interface StageItemProps {
  id: string;
  stage: StageConfig;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  availableDependencies: { label: string; value: string }[];
}

const StageItem: React.FC<StageItemProps> = ({
  id,
  stage,
  index,
  onEdit,
  onDelete,
  // availableDependencies 保留用于未来扩展
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const stageTypeIcon = STAGE_TYPE_ICONS[stage.type] || '⚙️';

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        hoverable
        styles={{
          body: { padding: '12px 16px' },
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.neutral[400],
            }}
          >
            <DragOutlined />
          </div>

          {/* 阶段序号 */}
          <Badge
            count={index + 1}
            style={{
              backgroundColor: colors.primary[500],
              minWidth: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />

          {/* 阶段信息 */}
          <div style={{ flex: 1 }}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: spacing[4] }}>
                  {stageTypeIcon} {stage.name}
                </Text>
                <Tag color="blue">{stage.type}</Tag>
              </div>
              <Space size={12} wrap>
                {stage.timeout && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <ClockCircleOutlined /> 超时：{stage.timeout}s
                  </Text>
                )}
                {stage.retryCount && stage.retryCount > 0 && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <ReloadOutlined /> 重试：{stage.retryCount}次
                  </Text>
                )}
                {stage.dependsOn && stage.dependsOn.length > 0 && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <LinkOutlined /> 依赖：{stage.dependsOn.join(', ')}
                  </Text>
                )}
                {stage.cache?.enabled && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <SaveOutlined /> 缓存：{stage.cache.key}
                  </Text>
                )}
                {stage.artifacts?.upload && stage.artifacts.upload.length > 0 && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <FileTextOutlined /> 产物：{stage.artifacts.upload.length} 个路径
                  </Text>
                )}
              </Space>
            </Space>
          </div>

          {/* 操作按钮 */}
          <Space>
            <Tooltip title="编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={onEdit}
                aria-label="编辑"
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={onDelete}
                aria-label="删除"
              />
            </Tooltip>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default StageItem;
