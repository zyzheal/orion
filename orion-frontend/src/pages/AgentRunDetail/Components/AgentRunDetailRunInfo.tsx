/**
 * AgentRunDetailRunInfo - 运行信息 Card (Descriptions + 触发载荷 pre)
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Descriptions, Divider, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Title, Text } = Typography;

interface AgentRunDetailRunInfoProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailRunInfo: React.FC<AgentRunDetailRunInfoProps> = ({ state }) => {
  const { run } = state;

  if (!run) return null;

  return (
    <Card title="运行信息" size="small" style={{ marginBottom: spacing.lg }}>
      <Descriptions column={3} size="small">
        <Descriptions.Item label="运行 ID">
          <Text code>{run.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="工作流 ID">{run.workflowId || '-'}</Descriptions.Item>
        <Descriptions.Item label="触发事件">
          <Tag>{run.triggerEvent}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {dayjs(run.startedAt).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="完成时间">
          {run.completedAt ? dayjs(run.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="超时时间">
          {run.timeoutAt ? dayjs(run.timeoutAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* Trigger payload */}
      {run.triggerPayload && Object.keys(run.triggerPayload).length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Title level={5}>触发载荷</Title>
          <pre
            style={{
              background: colors.neutral[50],
              padding: spacing[3],
              borderRadius: 4,
              fontSize: spacing[3],
              overflow: 'auto',
              maxHeight: 200,
            }}
          >
            {JSON.stringify(run.triggerPayload, null, 2)}
          </pre>
        </>
      )}
    </Card>
  );
};
