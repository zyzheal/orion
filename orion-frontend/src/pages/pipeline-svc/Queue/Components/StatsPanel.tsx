/**
 * StatsPanel - 队列统计面板
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { QueueStats } from '@/api/queue';

interface StatsPanelProps {
  stats: QueueStats | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  if (!stats) return null;
  return (
    <Card size="small" style={{ marginBottom: spacing.md }} className="queue-stats-panel">
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="等待中"
            value={stats.pending}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: colors.primary[500] }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="处理中"
            value={stats.processing}
            prefix={<SyncOutlined spin />}
            valueStyle={{ color: colors.warning[500] }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已完成"
            value={stats.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: colors.success[500] }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已失败"
            value={stats.failed}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: colors.error[400] }}
          />
        </Col>
      </Row>
    </Card>
  );
};
