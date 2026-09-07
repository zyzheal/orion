/**
 * CodeScan stats row
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import {
  BugOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface StatsRowProps {
  scanCount: number;
  totalVulns: number;
  highAndAboveVulns: number;
  passRate: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  scanCount,
  totalVulns,
  highAndAboveVulns,
  passRate,
}) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="扫描任务数" value={scanCount} prefix={<SafetyOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="漏洞总数"
          value={totalVulns}
          prefix={<BugOutlined />}
          valueStyle={{ color: colors.error[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="严重+高危漏洞"
          value={highAndAboveVulns}
          valueStyle={{ color: colors.error[500] }}
          prefix={<ExclamationCircleOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="安全通过率"
          value={passRate}
          suffix="%"
          valueStyle={{
            color: passRate >= 80 ? colors.success[500] : colors.warning[500],
          }}
          prefix={<ClockCircleOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
