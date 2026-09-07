/**
 * UEBA Stats Row
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { spacing } from '@/tokens';
import { commonStyle, statCardStyle } from '../constants';

const { Text } = Typography;

interface UEBAStatsRowProps {
  monitoredUsers: number;
  anomalyEvents: number;
  highRiskUsers: number;
  modelAccuracy: number;
}

export const UEBAStatsRow: React.FC<UEBAStatsRowProps> = ({
  monitoredUsers,
  anomalyEvents,
  highRiskUsers,
  modelAccuracy,
}) => {
  const suffix = (text: string) => (
    <Text type="secondary" style={{ fontSize: 14 }}>
      {text}
    </Text>
  );
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card style={statCardStyle(commonStyle.primary)}>
          <Statistic
            title="监控用户数"
            value={monitoredUsers}
            valueStyle={{ color: commonStyle.primary }}
            suffix={suffix('人')}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={statCardStyle(commonStyle.error)}>
          <Statistic
            title="异常事件数"
            value={anomalyEvents}
            valueStyle={{ color: commonStyle.error }}
            suffix={suffix('起')}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={statCardStyle(commonStyle.warning)}>
          <Statistic
            title="高危用户数"
            value={highRiskUsers}
            valueStyle={{ color: commonStyle.warning }}
            suffix={suffix('人')}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card style={statCardStyle(commonStyle.success)}>
          <Statistic
            title="检测模型准确率"
            value={modelAccuracy}
            precision={1}
            valueStyle={{ color: commonStyle.success }}
            suffix={suffix('%')}
          />
        </Card>
      </Col>
    </Row>
  );
};
