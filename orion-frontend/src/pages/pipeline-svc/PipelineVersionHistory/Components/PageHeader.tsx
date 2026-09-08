/**
 * PageHeader.tsx - PipelineVersionHistory 页面头部
 * 抽取自 index.tsx (P2-9 Phase 228)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { HistoryOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  versionCount: number;
  selectedCount: number;
  loading: boolean;
  diffLoading: boolean;
  onDiff: () => void;
  onRefresh: () => void;
}

export const PageHeader: React.FC<Props> = ({
  versionCount,
  selectedCount,
  loading,
  diffLoading,
  onDiff,
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
        <HistoryOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        版本历史
      </Title>
      <Text type="secondary">
        共 {versionCount} 个版本
        {selectedCount === 2 && ' (已选 2 个版本)'}
      </Text>
    </div>
    <Space>
      <Button
        icon={<SwapOutlined />}
        onClick={onDiff}
        disabled={selectedCount !== 2}
        loading={diffLoading}
      >
        版本对比
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
