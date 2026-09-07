/**
 * PipelineBudget header
 */
import React from 'react';
import { Button, Typography } from 'antd';
import { DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PipelineBudgetHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const PipelineBudgetHeader: React.FC<PipelineBudgetHeaderProps> = ({
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
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        流水线预算
      </Title>
      <Text type="secondary">配置和管理流水线的资源预算限制</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
