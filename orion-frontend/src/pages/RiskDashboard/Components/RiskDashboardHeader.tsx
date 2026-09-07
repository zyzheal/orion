/**
 * RiskDashboardHeader - 页面标题与副标题
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const RiskDashboardHeader: React.FC = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <WarningOutlined style={{ marginRight: spacing.sm, color: colors.warning[500] }} />
      风险管理
    </Title>
    <Text type="secondary">风险评估、健康检查、风险事件监控</Text>
  </div>
);
