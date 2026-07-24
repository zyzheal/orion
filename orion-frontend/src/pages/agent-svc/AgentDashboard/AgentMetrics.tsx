/**
 * AgentMetrics - Summary metric cards for AgentDashboard
 * Displays: active agents, today's runs, success rate, avg duration
 */
import React from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { spacing } from '@/tokens';

interface AgentMetricsProps {
  activeAgentCount: number;
  todayRunCount: number;
  successRate: number;
  avgDuration: number;
}

const AgentMetrics: React.FC<AgentMetricsProps> = ({
  activeAgentCount,
  todayRunCount,
  successRate,
  avgDuration,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
      data-testid="agent-summary-cards"
    >
      <MetricCard
        title="活跃 Agent"
        value={activeAgentCount}
        icon={<AppstoreOutlined />}
        color="colors.purple[500]"
        footer="已启用的 Agent 数量"
      />
      <MetricCard
        title="今日运行"
        value={todayRunCount}
        icon={<PlayCircleOutlined />}
        color="colors.primary[500]"
        footer="今天触发的运行次数"
      />
      <MetricCard
        title="成功率"
        value={`${successRate}%`}
        icon={<CheckCircleOutlined />}
        color="colors.success[500]"
        footer="运行成功占比"
      />
      <MetricCard
        title="平均耗时"
        value={`${avgDuration}s`}
        icon={<ClockCircleOutlined />}
        color="colors.warning[500]"
        footer="成功运行的平均时长"
      />
    </div>
  );
};

export default AgentMetrics;
