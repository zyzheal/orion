/**
 * TestSelector StatsCards
 * 抽取自 index.tsx (P2-9 Phase 171)
 */
import { AppstoreOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import type { TestStats } from '../types';

interface StatsCardsProps {
  testStats: TestStats;
  loading: boolean;
}

export const StatsCards = ({ testStats, loading }: StatsCardsProps) => (
  <div style={{ marginBottom: spacing[6] }}>
    <DashboardLayout columns={4} gap={spacing[4]}>
      <MetricCard
        title="Total Tests"
        value={testStats.total}
        loading={loading}
        icon={<AppstoreOutlined style={{ color: colors.primary[500] }} />}
      />
      <MetricCard
        title="Passed"
        value={testStats.passed}
        unit={`(${testStats.passRate})`}
        loading={loading}
        color={colors.success[500]}
        icon={<CheckCircleOutlined />}
      />
      <MetricCard
        title="Failed"
        value={testStats.failed}
        loading={loading}
        color={colors.error[500]}
        icon={<CloseCircleOutlined />}
      />
      <MetricCard
        title="Skipped"
        value={testStats.skipped}
        loading={loading}
        color={colors.neutral[400]}
        icon={<MinusCircleOutlined />}
      />
    </DashboardLayout>
  </div>
);
