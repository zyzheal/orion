/**
 * SuccessRateChart - 成功率分布环形进度
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, Progress, Row, Col, Typography } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { RunStats } from './types';

const { Text } = Typography;

export interface SuccessRateChartProps {
  stats: RunStats;
  status?: 'normal' | 'active' | 'exception' | 'success' | undefined;
}

export const SuccessRateChart: React.FC<SuccessRateChartProps> = ({ stats, status }) => (
  <Card title="成功率分布">
    <div style={{ textAlign: 'center', marginBottom: spacing.md }}>
      <Progress
        type="circle"
        percent={stats.successRate}
        size={120}
        status={status}
        format={(p) => (
          <span>
            <TrophyOutlined /> {p}%
          </span>
        )}
      />
    </div>
    <Row>
      <Col span={8}>
        <Text>成功</Text> <Text strong>{stats.success}</Text>
      </Col>
      <Col span={8}>
        <Text>失败</Text>{' '}
        <Text strong style={{ color: colors.error[500] }}>
          {stats.failed}
        </Text>
      </Col>
      <Col span={8}>
        <Text>取消</Text>{' '}
        <Text strong style={{ color: colors.warning[500] }}>
          {stats.cancelled}
        </Text>
      </Col>
    </Row>
  </Card>
);
