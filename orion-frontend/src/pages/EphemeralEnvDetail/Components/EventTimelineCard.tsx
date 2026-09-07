/**
 * EventTimelineCard - 事件时间线卡片
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import React from 'react';
import { Card, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import Timeline from '@/components/Timeline';
import type { EphemeralEnvDetailState } from '../useEphemeralEnvDetailState';

interface EventTimelineCardProps {
  state: EphemeralEnvDetailState;
}

export const EventTimelineCard: React.FC<EventTimelineCardProps> = ({ state }) => {
  const { timelineEvents } = state;
  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          事件时间线
        </Space>
      }
      size="small"
      style={{ marginBottom: spacing.lg }}
    >
      <Timeline events={timelineEvents} mode="left" />
    </Card>
  );
};
