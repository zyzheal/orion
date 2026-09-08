/**
 * StatsRow - 任务队列统计卡片
 * 抽取自 index.tsx (P2-9 Phase 209)
 */
import { Card, Row, Col, Statistic } from 'antd';
import { SyncOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { QueueStats } from '@/api/queue';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface Props {
  stats: QueueStats;
}

export const StatsRow = ({ stats }: Props) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic
          title="待处理"
          value={stats.pending}
          valueStyle={{ color: colors.neutral[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="处理中"
          value={stats.processing}
          prefix={<SyncOutlined spin />}
          valueStyle={{ color: colors.primary[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="已完成"
          value={stats.completed}
          prefix={<CheckCircleOutlined />}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="失败"
          value={stats.failed}
          valueStyle={{ color: stats.failed > 0 ? colors.error[500] : undefined }}
          prefix={<StopOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
