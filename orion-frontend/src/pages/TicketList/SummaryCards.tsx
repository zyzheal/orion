/**
 * SummaryCards.tsx - 工单摘要统计卡片
 * 抽取自 TicketList/index.tsx (P2-9 Phase 62)
 */
import React from 'react';
import MetricCard from '@/components/MetricCard';
import { InboxOutlined, ExclamationCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface SummaryCardsProps {
  openCount: number;
  inProgressCount: number;
  overdueCount: number;
  slaBreached: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  openCount,
  inProgressCount,
  overdueCount,
  slaBreached,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: spacing.md,
      marginBottom: spacing.lg,
    }}
    data-testid="ticket-summary-cards"
  >
    <MetricCard
      title="待处理"
      value={openCount}
      icon={<InboxOutlined />}
      color={colors.primary[500]}
      footer="需要分配的工单"
    />
    <MetricCard
      title="处理中"
      value={inProgressCount}
      icon={<ExclamationCircleOutlined />}
      color={colors.warning[500]}
      footer="正在进行处理的工单"
    />
    <MetricCard
      title="已超时"
      value={overdueCount}
      icon={<ClockCircleOutlined />}
      color={colors.error[400]}
      footer="超过 SLA 时限"
    />
    <MetricCard
      title="SLA 违约"
      value={slaBreached}
      icon={<WarningOutlined />}
      color={colors.purple[500]}
      footer="SLA 违约次数"
    />
  </div>
);
