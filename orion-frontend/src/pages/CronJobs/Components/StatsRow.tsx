/**
 * CronJobs StatsRow
 * 抽取自 index.tsx (P2-9 Phase 195)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { CronJobStats } from '../useCronJobsState';

interface StatsRowProps {
  stats: CronJobStats;
}

export const StatsRow = ({ stats }: StatsRowProps) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic title="总任务数" value={stats.total} prefix={<ClockCircleOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="已启用"
          value={stats.enabled}
          valueStyle={{ color: colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="运行中"
          value={stats.running}
          valueStyle={{ color: colors.primary[500] }}
          prefix={<ThunderboltOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="异常"
          value={stats.error}
          valueStyle={{ color: stats.error > 0 ? colors.error[500] : undefined }}
          prefix={<ExclamationCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
