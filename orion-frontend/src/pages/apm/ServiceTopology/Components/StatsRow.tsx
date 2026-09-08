/**
 * StatsRow - APM Service Topology 统计卡片
 * 抽取自 index.tsx (P2-9 Phase 218)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  DeploymentUnitOutlined,
  ArrowRightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface Props {
  serviceCount: number;
  relationCount: number;
  totalCalls: number;
  highErrorCount: number;
  hasHighError: boolean;
}

export const StatsRow = ({
  serviceCount,
  relationCount,
  totalCalls,
  highErrorCount,
  hasHighError,
}: Props) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic title="服务数" value={serviceCount} prefix={<DeploymentUnitOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic title="调用关系" value={relationCount} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="总调用次数"
          value={totalCalls}
          prefix={<ArrowRightOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="高错误服务"
          value={highErrorCount}
          prefix={<WarningOutlined />}
          valueStyle={{ color: hasHighError ? colors.error[500] : colors.success[500] }}
        />
      </Card>
    </Col>
  </Row>
);
