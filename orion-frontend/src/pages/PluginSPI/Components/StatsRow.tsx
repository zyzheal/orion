/**
 * StatsRow - 4 张统计 MetricCard
 * 抽取自 index.tsx (P2-9 Phase 213)
 */
import { Row, Col } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import type { SPIStats } from '../types';

interface Props {
  stats: SPIStats;
}

export const StatsRow = ({ stats }: Props) => (
  <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
    <Col span={6}>
      <MetricCard
        title="扩展点总数"
        value={stats.totalExtensionPoints}
        icon={<ApiOutlined style={{ fontSize: 20, color: colors.purple[500] }} />}
        color={colors.purple[500]}
      />
    </Col>
    <Col span={6}>
      <MetricCard
        title="活跃扩展点"
        value={stats.activePoints}
        icon={<CheckCircleOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
        color={colors.success[500]}
      />
    </Col>
    <Col span={6}>
      <MetricCard
        title="插件注册总数"
        value={stats.totalRegistrations}
        icon={<LinkOutlined style={{ fontSize: 20, color: colors.primary[500] }} />}
        color={colors.primary[500]}
      />
    </Col>
    <Col span={6}>
      <MetricCard
        title="已启用插件"
        value={stats.enabledPlugins}
        icon={<SafetyOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
        color={colors.warning[500]}
      />
    </Col>
  </Row>
);
