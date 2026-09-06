/**
 * SummaryCards.tsx - 环境汇总卡片
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import React from 'react';
import MetricCard from '@/components/MetricCard';
import { spacing } from '@/tokens';
import {
  AppstoreOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { EnvSummary } from './types';

interface SummaryCardsProps {
  summary: EnvSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
      data-testid="env-summary-cards"
    >
      <MetricCard
        title="环境总数"
        value={summary.totalCount}
        icon={<AppstoreOutlined />}
        color="colors.primary[500]"
        footer="所有环境 (含已销毁)"
      />
      <MetricCard
        title="活跃环境"
        value={summary.activeCount}
        icon={<ThunderboltOutlined />}
        color="colors.success[500]"
        footer="创建中 + 运行中"
      />
      <MetricCard
        title="运行中"
        value={summary.runningCount}
        icon={<CloudServerOutlined />}
        color="colors.purple[500]"
        footer="正在运行的环境"
      />
      <MetricCard
        title="空闲"
        value={summary.idleCount}
        icon={<ClockCircleOutlined />}
        color="colors.warning[500]"
        footer="空闲等待回收"
      />
    </div>
  );
};
