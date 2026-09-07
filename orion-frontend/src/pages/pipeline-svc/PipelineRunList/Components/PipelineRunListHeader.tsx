/**
 * PipelineRunList Header
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { RocketOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PipelineRunListHeaderProps {
  total: number;
  loading: boolean;
  onRefresh: () => void;
}

export const PipelineRunListHeader: React.FC<PipelineRunListHeaderProps> = ({
  total,
  loading,
  onRefresh,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <RocketOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Pipeline 运行历史
      </Title>
      <Text type="secondary">共 {total} 条运行记录</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
