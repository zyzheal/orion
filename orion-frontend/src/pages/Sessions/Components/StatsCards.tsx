/**
 * Sessions Stats Cards
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { CheckCircleOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { SessionStats } from '../types';
import { formatDuration } from '../helpers';

interface StatsCardsProps {
  stats: SessionStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
      <MetricCard
        title="活跃会话"
        value={stats.activeSessions}
        icon={<CheckCircleOutlined />}
        color={colors.success[500]}
        size="medium"
      />
      <MetricCard
        title="总用户数"
        value={stats.totalUsers}
        icon={<UserOutlined />}
        color={colors.primary[500]}
        size="medium"
      />
      <MetricCard
        title="已过期会话"
        value={stats.expiredSessions}
        icon={<ClockCircleOutlined />}
        color={colors.neutral[400]}
        size="medium"
      />
      <MetricCard
        title="平均时长"
        value={formatDuration(stats.avgDuration)}
        icon={<ClockCircleOutlined />}
        color={colors.purple[500]}
        size="medium"
      />
    </div>
  );
};
