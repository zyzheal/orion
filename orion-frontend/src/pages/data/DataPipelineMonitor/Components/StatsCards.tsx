/**
 * StatsCards - 统计卡片
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  DatabaseOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface StatsCardsProps {
  stats: {
    total: number;
    running: number;
    error: number;
    avgLatency: string;
  };
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => (
  <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card>
        <Statistic
          title="总管道数"
          value={stats.total}
          prefix={<DatabaseOutlined />}
          valueStyle={{ color: colors.primary[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="运行中"
          value={stats.running}
          prefix={<PlayCircleOutlined />}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="异常/失败"
          value={stats.error}
          prefix={<ExclamationCircleOutlined />}
          valueStyle={{ color: colors.error[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="平均延迟 (分钟)"
          value={stats.avgLatency}
          prefix={<SyncOutlined />}
          valueStyle={{ color: colors.warning[500] }}
        />
      </Card>
    </Col>
  </Row>
);
