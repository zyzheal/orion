/**
 * TrendCard - 审批时效趋势卡（近 7 天）
 */
import React from 'react';
import { Typography, Card, Space, Row, Col, Statistic, Divider } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { MOCK_TREND } from './constants';
import { TrendChart } from './TrendChart';

const { Text } = Typography;

export const TrendCard: React.FC = () => {
  if (MOCK_TREND.length === 0) return null;
  const avgOfAll = MOCK_TREND.reduce((s, d) => s + d.avgDuration, 0) / MOCK_TREND.length;
  const maxOfAll = Math.max(...MOCK_TREND.map((d) => d.maxDuration));
  const slaAvg = MOCK_TREND.reduce((s, d) => s + d.slaRate, 0) / MOCK_TREND.length;
  const lastSla = MOCK_TREND[MOCK_TREND.length - 1].slaRate;
  const prevSla = MOCK_TREND[MOCK_TREND.length - 2]?.slaRate ?? lastSla;
  const slaChange = lastSla - prevSla;

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined style={{ color: colors.info[500] }} />
          <Text strong>审批时效趋势（近 7 天）</Text>
        </Space>
      }
    >
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Statistic
            title="平均审批时长"
            value={Math.round(avgOfAll)}
            valueStyle={{ color: colors.primary[500], fontSize: 24 }}
            suffix="分钟"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="最长等待"
            value={maxOfAll}
            valueStyle={{ color: colors.warning[500], fontSize: 24 }}
            suffix="分钟"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="SLA 达标率"
            value={slaAvg.toFixed(1)}
            valueStyle={{ color: colors.success[500], fontSize: 24 }}
            suffix="%"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较前一日{' '}
            <span style={{ color: slaChange >= 0 ? colors.success[500] : colors.error[500] }}>
              {slaChange >= 0 ? '+' : ''}
              {slaChange}%
            </span>
          </Text>
        </Col>
      </Row>

      <Divider style={{ margin: `${spacing.sm} 0` }} />

      <TrendChart data={MOCK_TREND} />
    </Card>
  );
};
