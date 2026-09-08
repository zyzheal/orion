/**
 * ApiKeyManagement StatsRow
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { KeyOutlined } from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';

interface Props {
  total: number;
  active: number;
  expired: number;
}

export const StatsRow = ({ total, active, expired }: Props) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: spacing.md,
      marginBottom: spacing.lg,
    }}
  >
    <MetricCard
      title="总数"
      value={total}
      icon={<KeyOutlined />}
      color={colors.success[500]}
      size="medium"
    />
    <MetricCard
      title="活跃"
      value={active}
      icon={<KeyOutlined />}
      color={colors.success[500]}
      size="medium"
    />
    <MetricCard
      title="已过期"
      value={expired}
      icon={ <KeyOutlined /> }
      color={colors.error[500]}
      size="medium"
    />
  </div>
);
