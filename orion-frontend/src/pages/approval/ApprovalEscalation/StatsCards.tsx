/**
 * StatsCards - 审批统计卡（4 张）
 * 数值为纯前端 Mock
 */
import React from 'react';
import { Typography, Card, Row, Col, Statistic } from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

export const StatsCards: React.FC = () => {
  return (
    <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.primary[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="活跃审批数"
            value={47}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: colors.primary[500] }}
            suffix="个"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.error[500] }}>+3</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.error[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="超时审批数"
            value={12}
            prefix={<WarningOutlined />}
            valueStyle={{ color: colors.error[500] }}
            suffix="个"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.error[500] }}>+2</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.info[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="平均审批时长"
            value={42}
            precision={1}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: colors.info[500] }}
            suffix="分钟"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.success[500] }}>-5 分钟</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.success[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="SLA 达标率"
            value={92.5}
            precision={1}
            prefix={<SafetyCertificateOutlined />}
            valueStyle={{ color: colors.success[500] }}
            suffix="%"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.success[500] }}>+1.2%</span>
          </Text>
        </Card>
      </Col>
    </Row>
  );
};
