/**
 * TestReport SummaryRow
 * 抽取自 index.tsx (P2-9 Phase 191)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TestReportSummary } from '@/api/testReports';

interface SummaryRowProps {
  summary: TestReportSummary;
}

export const SummaryRow = ({ summary }: SummaryRowProps) => (
  <Card style={{ marginBottom: spacing.lg }}>
    <Row gutter={16}>
      <Col span={4}>
        <Statistic title="总计" value={summary.totalTests} prefix={<FileTextOutlined />} />
      </Col>
      <Col span={4}>
        <Statistic
          title="通过"
          value={summary.totalPassed}
          valueStyle={{ color: colors.success?.[500] || colors.success[500] }}
          prefix={<CheckCircleOutlined />}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="失败"
          value={summary.totalFailed}
          valueStyle={{ color: colors.error?.[500] || colors.error[400] }}
          prefix={<CloseCircleOutlined />}
        />
      </Col>
      <Col span={4}>
        <Statistic title="跳过" value={summary.totalSkipped} prefix={<MinusCircleOutlined />} />
      </Col>
      <Col span={4}>
        <Statistic title="通过率" value={summary.passRate} precision={1} suffix="%" />
      </Col>
      <Col span={4}>
        <Statistic
          title="平均耗时"
          value={summary.avgDuration / 1000}
          precision={1}
          suffix="s"
        />
      </Col>
    </Row>
  </Card>
);
