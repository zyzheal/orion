/**
 * QueueStatsPanel.tsx - 队列统计卡（4 个 Statistic）
 * 抽取自 index.tsx (P2-9 Phase 237)
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface Stats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface Props {
  stats?: Stats | null;
}

export const QueueStatsPanel: React.FC<Props> = ({ stats }) => {
  if (!stats) return null;
  return (
    <Card size="small" style={{ marginBottom: spacing.md }}>
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
