/**
 * BurndownChart - Sprint 燃尽图组件
 * 抽取自 index.tsx renderBurndown
 */
import React from 'react';
import { Typography, Card, Empty, Progress, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { BurndownData } from '@/api/sprints';

const { Text } = Typography;

export interface BurndownChartProps {
  selectedSprintId: string | null;
  burndownData: BurndownData[];
  burndownLoading: boolean;
  burndownPercent: number;
}

export const BurndownChart: React.FC<BurndownChartProps> = ({
  selectedSprintId,
  burndownData,
  burndownLoading,
  burndownPercent,
}) => {
  if (!selectedSprintId) return null;

  return (
    <Card
      title="燃尽图"
      size="small"
      style={{
        marginTop: spacing.md,
        borderRadius: componentRadius.card,
        boxShadow: shadows.card,
      }}
    >
      {burndownLoading ? (
        <Text type="secondary">加载中...</Text>
      ) : burndownData.length === 0 ? (
        <Empty description="暂无燃尽数据" />
      ) : (
        <div style={{ textAlign: 'center', padding: spacing.md }}>
          <Progress
            type="dashboard"
            percent={burndownPercent}
            format={(percent) => `剩余 ${percent}%`}
            strokeColor={burndownPercent > 50 ? colors.warning[500] : colors.success[500]}
            size={160}
          />
          <div style={{ marginTop: spacing.sm }}>
            <Text type="secondary">
              最新剩余: {burndownData[burndownData.length - 1].remainingPoints} 点 / 理想:{' '}
              {burndownData[burndownData.length - 1].idealPoints} 点
            </Text>
          </div>
          <div style={{ marginTop: spacing.md, textAlign: 'left' }}>
            {burndownData.slice(-5).map((item) => (
              <Row key={item.date} justify="space-between" style={{ marginBottom: 4 }}>
                <Col>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(item.date).format('MM/DD')}
                  </Text>
                </Col>
                <Col>
                  <Text style={{ fontSize: 12 }}>{item.remainingPoints} 点</Text>
                </Col>
              </Row>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
