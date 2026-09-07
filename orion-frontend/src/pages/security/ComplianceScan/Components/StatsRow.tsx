/**
 * ComplianceScan StatsRow
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Row, Col, Card, Statistic } from 'antd';
import {
  FileProtectOutlined,
  CheckCircleOutlined,
  ScanOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface StatsRowProps {
  baselineCount: number;
  totalRules: number;
  avgPassRate: number;
  criticalCount: number;
}

export const StatsRow = ({ baselineCount, totalRules, avgPassRate, criticalCount }: StatsRowProps) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="合规基线数" value={baselineCount} prefix={<FileProtectOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic title="规则总数" value={totalRules} prefix={<CheckCircleOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="平均合规率"
          value={avgPassRate}
          suffix="%"
          valueStyle={{ color: avgPassRate >= 80 ? colors.success[500] : colors.warning[500] }}
          prefix={<ScanOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="高危发现数"
          value={criticalCount}
          valueStyle={{ color: colors.error[500] }}
          prefix={<ExclamationCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
