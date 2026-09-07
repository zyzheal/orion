/**
 * AgentRunDetailResult - 运行结果 Card (Alert PR/summary/error + pre JSON)
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Space, Typography, Alert } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Paragraph } = Typography;

interface AgentRunDetailResultProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailResult: React.FC<AgentRunDetailResultProps> = ({ state }) => {
  const { run } = state;

  if (!run?.result || Object.keys(run.result).length === 0) return null;

  return (
    <Card
      title={
        <Space>
          <CheckCircleOutlined style={{ color: colors.success[500] }} />
          运行结果
        </Space>
      }
      size="small"
    >
      {Boolean(run.result.prUrl) && (
        <Alert
          message="PR 已创建"
          description={run.result.prUrl as string}
          type="success"
          showIcon
          style={{ marginBottom: spacing[3] }}
        />
      )}
      {Boolean(run.result.summary) && <Paragraph>{run.result.summary as string}</Paragraph>}
      {Boolean(run.result.errorMessage) && (
        <Alert
          message="失败原因"
          description={run.result.errorMessage as string}
          type="error"
          showIcon
          style={{ marginBottom: spacing[3] }}
        />
      )}
      <pre
        style={
          {
            background: colors.neutral[50],
            padding: spacing[3],
            borderRadius: 4,
            fontSize: spacing[3],
            overflow: 'auto',
            maxHeight: 300,
          } as React.CSSProperties
        }
      >
        {JSON.stringify(run.result, null, 2)}
      </pre>
    </Card>
  );
};
