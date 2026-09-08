/**
 * WorkspaceStatsCards.tsx - Workspace 顶部统计卡
 * 抽取自 index.tsx (P2-9 Phase 221)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  ClusterOutlined,
  DatabaseOutlined,
  ProjectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  totalCount: number;
  activeCount: number;
  totalCpu: number;
  totalMemory: number;
}

export const WorkspaceStatsCards = ({ totalCount, activeCount, totalCpu, totalMemory }: Props) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="工作空间总数" value={totalCount} prefix={<DatabaseOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="活跃空间"
          value={activeCount}
          prefix={<ProjectOutlined />}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="CPU 配额总数"
          value={totalCpu}
          suffix="核"
          prefix={<ClusterOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic title="内存配额总数" value={totalMemory} suffix="G" prefix={<UserOutlined />} />
      </Card>
    </Col>
  </Row>
);
