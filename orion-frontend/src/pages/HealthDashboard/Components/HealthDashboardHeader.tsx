/**
 * HealthDashboardHeader - 页面标题
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Button, Tag, Typography } from 'antd';
import { HeartOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { HealthDashboardState } from '../useHealthDashboardState';

const { Title, Text } = Typography;

interface HealthDashboardHeaderProps {
  state: HealthDashboardState;
}

export const HealthDashboardHeader: React.FC<HealthDashboardHeaderProps> = ({ state }) => {
  const { error, loadData } = state;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
        flexWrap: 'wrap',
        gap: spacing.md,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <HeartOutlined style={{ marginRight: 12, color: colors.error[500] }} />
          健康仪表盘
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          全系统健康状态总览与趋势分析
        </Text>
        {error && (
          <Tag color={colors.error[500]} style={{ marginLeft: 8 }}>
            加载失败
          </Tag>
        )}
      </div>
      <Button icon={<ReloadOutlined />} onClick={loadData}>
        刷新
      </Button>
    </div>
  );
};
