/**
 * ConfigDiffHeader - 页面头部 (标题 + 刷新按钮)
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { DiffOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ConfigDiffState } from '../useConfigDiffState';

const { Title, Text } = Typography;

interface ConfigDiffHeaderProps {
  state: ConfigDiffState;
}

export const ConfigDiffHeader: React.FC<ConfigDiffHeaderProps> = ({ state }) => {
  const { configLoading, loadConfigs } = state;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <DiffOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          Config Version Diff
        </Title>
        <Text type="secondary">
          Compare configuration versions, visualize changes, and rollback
        </Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={configLoading}>
          Refresh
        </Button>
      </Space>
    </div>
  );
};
