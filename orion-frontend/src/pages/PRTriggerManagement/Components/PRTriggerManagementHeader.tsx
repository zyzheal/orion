/**
 * PR Trigger Management page header
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PRTriggerManagementHeaderProps {
  onRefresh: () => void;
  onCreate: () => void;
  loading: boolean;
}

export const PRTriggerManagementHeader: React.FC<PRTriggerManagementHeaderProps> = ({
  onRefresh,
  onCreate,
  loading,
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
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        PR/MR 触发管理
      </Title>
      <Text type="secondary">配置 Pull Request / Merge Request 触发规则和状态回写</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        添加规则
      </Button>
    </Space>
  </div>
);
