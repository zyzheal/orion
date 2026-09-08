/**
 * CronManagement StatsRow
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { Col, Row } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import type { CronStats } from '../useCronManagementState';

interface StatsRowProps {
  stats: CronStats | null;
}

export const StatsRow = ({ stats }: StatsRowProps) => {
  if (!stats) return null;
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col span={8}>
        <MetricCard
          title="总任务数"
          value={stats.total}
          icon={<ClockCircleOutlined />}
          color={colors.primary[500]}
          size="medium"
        />
      </Col>
      <Col span={8}>
        <MetricCard
          title="已启用"
          value={stats.enabled}
          icon={<CheckCircleOutlined />}
          color={colors.success[500]}
          size="medium"
        />
      </Col>
      <Col span={8}>
        <MetricCard
          title="运行中"
          value={stats.running}
          icon={<PlayCircleOutlined />}
          color={colors.purple[500]}
          size="medium"
        />
      </Col>
    </Row>
  );
};
