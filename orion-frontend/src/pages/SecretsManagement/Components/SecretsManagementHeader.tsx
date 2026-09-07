/**
 * SecretsManagementHeader - 页面标题 + 刷新 + 创建 Secret 按钮
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { KeyOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { SecretsManagementState } from '../useSecretsManagementState';

const { Title, Text } = Typography;

interface SecretsManagementHeaderProps {
  state: SecretsManagementState;
}

export const SecretsManagementHeader: React.FC<SecretsManagementHeaderProps> = ({ state }) => {
  const { loading, loadSecrets, openCreate } = state;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <KeyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          Secrets 管理
        </Title>
        <Text type="secondary">
          管理 Pipeline 密钥，所有 Secret 值使用 AES-256-GCM 加密存储，不会在任何界面显示
        </Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={loadSecrets} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          创建 Secret
        </Button>
      </Space>
    </div>
  );
};
