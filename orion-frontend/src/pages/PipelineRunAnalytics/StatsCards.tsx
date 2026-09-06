/**
 * StatsCards - Top 6 Statistic 卡片行
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { colors } from '@/tokens';
import type { RunStats } from './types';
import { formatDuration } from './constants';

export interface StatsCardsProps {
  stats: RunStats;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => (
  <Row gutter={16} style={{ marginBottom: 16 }}>
    <Col span={4}>
      <Card>
        <Statistic title="总运行" value={stats.total} />
      </Card>
    </Col>
    <Col span={4}>
      <Card>
        <Statistic
          title="成功"
          value={stats.success}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={4}>
      <Card>
        <Statistic
          title="失败"
          value={stats.failed}
          valueStyle={{ color: colors.error[500] }}
        />
      </Card>
    </Col>
    <Col span={4}>
      <Card>
        <Statistic
          title="取消"
          value={stats.cancelled}
          valueStyle={{ color: colors.warning[500] }}
        />
      </Card>
    </Col>
    <Col span={4}>
      <Card>
        <Statistic title="成功率" value={stats.successRate} suffix="%" />
      </Card>
    </Col>
    <Col span={4}>
      <Card>
        <Statistic
          title="平均耗时"
          value={formatDuration(stats.avgDurationMs)}
          valueStyle={{ fontSize: 14 }}
        />
      </Card>
    </Col>
  </Row>
);
