import { Row, Col } from 'antd';
import {
  DatabaseOutlined,
  DesktopOutlined,
  ClusterOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { StatCard } from '@/components/charts';

export interface CMDBStats {
  ciTotal: number;
  hostCount: number;
  k8sCount: number;
  cicdCount: number;
}

interface Props {
  stats: CMDBStats;
}

export function CMDBStatsCards({ stats }: Props) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="配置项 (CI)"
          value={stats.ciTotal}
          icon={<DatabaseOutlined style={{ color: colors.primary[500], fontSize: 20 }} />}
          color={colors.primary[500]}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="主机"
          value={stats.hostCount}
          icon={<DesktopOutlined style={{ color: colors.success[500], fontSize: 20 }} />}
          color={colors.success[500]}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="K8s 资源"
          value={stats.k8sCount}
          icon={<ClusterOutlined style={{ color: colors.info[500], fontSize: 20 }} />}
          color={colors.info[500]}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="CICD 资源"
          value={stats.cicdCount}
          icon={<RocketOutlined style={{ color: colors.warning[500], fontSize: 20 }} />}
          color={colors.warning[500]}
        />
      </Col>
    </Row>
  );
}
