/**
 * AgentRunDetailDecisionTimeline - 决策时间线 Card
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Space, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import Timeline from '@/components/Timeline';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Text } = Typography;

interface AgentRunDetailDecisionTimelineProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailDecisionTimeline: React.FC<AgentRunDetailDecisionTimelineProps> = ({
  state,
}) => {
  const { decisions, timelineEvents } = state;

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          决策时间线
        </Space>
      }
      size="small"
      style={{ marginBottom: spacing.lg }}
    >
      {decisions.length > 0 ? (
        <Timeline events={timelineEvents} mode="left" />
      ) : (
        <Text type="secondary">暂无决策记录</Text>
      )}
    </Card>
  );
};
