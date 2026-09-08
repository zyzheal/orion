import { Row, Col } from 'antd';
import {
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

interface Props {
  stats: {
    total: number;
    successful: number;
    failed: number;
    lastBackupTime: string | null;
  } | null;
}

export function StatsCards({ stats }: Props) {
  if (!stats) return null;

  return (
    <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
      <Col span={6}>
        <MetricCard
          title="备份总数"
          value={stats.total}
          icon={<CloudServerOutlined style={{ fontSize: 20, color: colors.primary[500] }} />}
          color={colors.primary[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="成功"
          value={stats.successful}
          icon={<CheckCircleOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
          color={colors.success[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="失败"
          value={stats.failed}
          icon={<CloseCircleOutlined style={{ fontSize: 20, color: colors.error[500] }} />}
          color={colors.error[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="上次备份"
          value={stats.lastBackupTime ? dayjs(stats.lastBackupTime).fromNow() : '暂无数据'}
          icon={<ClockCircleOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
          color={colors.warning[500]}
        />
      </Col>
    </Row>
  );
}
