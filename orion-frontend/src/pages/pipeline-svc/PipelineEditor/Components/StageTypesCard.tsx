/**
 * StageTypesCard.tsx - 阶段类型说明卡片
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 */
import React from 'react';
import { Card, Space, Tag, Divider, Typography } from 'antd';
import { spacing } from '@/tokens';
import { STAGE_TYPES } from '../constants';

const { Text } = Typography;

export const StageTypesCard: React.FC = () => (
  <Card style={{ marginTop: spacing.lg }} title="阶段类型说明">
    <Space wrap>
      {STAGE_TYPES.map((type) => (
        <Tag
          key={type.value}
          color="default"
          style={{ fontSize: spacing[3], padding: '4px 12px' }}
        >
          {type.icon} {type.label}
        </Tag>
      ))}
    </Space>
    <Divider />
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text type="secondary">
        💡 提示：拖拽阶段卡片右侧的拖拽图标可调整顺序；依赖关系只能选择当前阶段之前的阶段
      </Text>
    </Space>
  </Card>
);
