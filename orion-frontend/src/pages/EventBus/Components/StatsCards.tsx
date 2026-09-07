/**
 * EventBus Monitoring stats cards
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import {
  ClockCircleOutlined,
  InfoCircleOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { EventBusStats } from '../types';

interface StatsCardsProps {
  stats: EventBusStats | null;
}

export const StatsCards = ({ stats }: StatsCardsProps) => {
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
        title="总事件数"
        value={stats.totalEvents}
        icon={<InfoCircleOutlined />}
        color={colors.primary[500]}
        size="medium"
      />
      <MetricCard
        title="活跃订阅者"
        value={stats.activeSubscribers}
        icon={<SwapOutlined />}
        color={colors.purple[500]}
        size="medium"
      />
      <MetricCard
        title="失败事件"
        value={stats.failedEvents}
        icon={<WarningOutlined />}
        color={colors.error[400]}
        size="medium"
      />
      <MetricCard
        title="事件速率"
        value={stats.eventRate}
        unit="evt/min"
        icon={<ClockCircleOutlined />}
        color={colors.success[500]}
        size="medium"
      />
    </div>
  );
};
