/**
 * NotificationCenter - StatsRow
 * 顶部 4 张统计卡片
 *
 * 从 index.tsx 的 renderStatsRow() 抽出。
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { BellOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export interface StatsRowProps {
  stats: { unread: number; critical: number; today: number; thisWeek: number };
}

export const StatsRow: React.FC<StatsRowProps> = ({ stats }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="未读"
          value={stats.unread}
          valueStyle={{
            color: stats.unread > 0 ? colors.error[500] : undefined,
            fontSize: spacing[6],
          }}
          prefix={<BellOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="紧急"
          value={stats.critical}
          valueStyle={{
            color: stats.critical > 0 ? colors.error[500] : undefined,
            fontSize: spacing[6],
          }}
          prefix={<ExclamationCircleOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="今日"
          value={stats.today}
          valueStyle={{ fontSize: spacing[6] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="本周"
          value={stats.thisWeek}
          valueStyle={{ fontSize: spacing[6] }}
          prefix={<BellOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
