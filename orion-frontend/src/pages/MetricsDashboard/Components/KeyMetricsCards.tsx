/**
 * Key Metrics Cards
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import React from 'react';
import { Typography } from 'antd';
import { SyncOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import { StatCard } from '@/components/charts';
import type { MetricSummary } from '../types';

const { Title } = Typography;

interface KeyMetricsCardsProps {
  metricSummary: MetricSummary | null;
  sparklineData: {
    requestRate: number[];
    errorRate: number[];
    latencyP50: number[];
    throughput: number[];
  };
}

export const KeyMetricsCards: React.FC<KeyMetricsCardsProps> = ({
  metricSummary,
  sparklineData,
}) => (
  <div style={{ marginBottom: spacing[6] }}>
    <Title level={5}>Key Metrics</Title>
    <DashboardLayout columns={4} gap={spacing[4]}>
      <StatCard
        title="Request Rate"
        value={metricSummary?.requestRate ?? '-'}
        suffix="req/min"
        trend={{ value: 8.2, direction: 'up', good: 'up' }}
        sparklineData={sparklineData.requestRate}
        icon={<SyncOutlined style={{ color: colors.success[500] }} />}
      />
      <StatCard
        title="Error Rate"
        value={metricSummary?.errorRate ?? '-'}
        suffix="%"
        trend={{ value: 15.3, direction: 'down', good: 'down' }}
        sparklineData={sparklineData.errorRate}
        color={
          metricSummary && metricSummary.errorRate > 1
            ? colors.error[500]
            : colors.success[500]
        }
      />
      <StatCard
        title="Latency (P50)"
        value={metricSummary?.latencyP50 ?? '-'}
        suffix="ms"
        trend={{ value: 2.1, direction: 'flat', good: 'down' }}
        sparklineData={sparklineData.latencyP50}
      />
      <StatCard
        title="Throughput"
        value={metricSummary?.throughput ?? '-'}
        suffix="ops/min"
        trend={{ value: 5.7, direction: 'up', good: 'up' }}
        sparklineData={sparklineData.throughput}
        icon={<ArrowUpOutlined style={{ color: colors.success[500] }} />}
      />
    </DashboardLayout>
  </div>
);
