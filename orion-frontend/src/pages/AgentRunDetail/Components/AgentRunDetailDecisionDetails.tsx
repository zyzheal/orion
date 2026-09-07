/**
 * AgentRunDetailDecisionDetails - 决策详情 Card (Collapse accordion)
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import { Card, Collapse, Descriptions, Space, Tag, Typography, Alert } from 'antd';
import dayjs from 'dayjs';
import { ThunderboltOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { actionIconMap } from '../constants';
import type { AgentRunDetailState } from '../useAgentRunDetailState';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface AgentRunDetailDecisionDetailsProps {
  state: AgentRunDetailState;
}

export const AgentRunDetailDecisionDetails: React.FC<AgentRunDetailDecisionDetailsProps> = ({
  state,
}) => {
  const { decisions } = state;

  if (decisions.length === 0) return null;

  return (
    <Card title="决策详情" size="small" style={{ marginBottom: spacing.lg }}>
      <Collapse accordion>
        {decisions
          .sort((a, b) => a.stepNumber - b.stepNumber)
          .map((decision) => (
            <Panel
              key={decision.id}
              header={
                <Space>
                  {actionIconMap[decision.action] || <ThunderboltOutlined />}
                  <Text strong>
                    步骤 {decision.stepNumber}: {decision.action}
                  </Text>
                  {decision.error && <Tag color="red">错误</Tag>}
                </Space>
              }
            >
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Agent ID">
                  <Text code>{decision.agentId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="操作">{decision.action}</Descriptions.Item>
                <Descriptions.Item label="输入">
                  <pre
                    style={{
                      margin: 0,
                      fontSize: spacing[3],
                      background: colors.neutral[50],
                      padding: spacing.sm,
                      borderRadius: 4,
                    }}
                  >
                    {JSON.stringify(decision.actionInput, null, 2)}
                  </pre>
                </Descriptions.Item>
                {decision.actionOutput && (
                  <Descriptions.Item label="输出">
                    <pre
                      style={{
                        margin: 0,
                        fontSize: spacing[3],
                        background: colors.neutral[50],
                        padding: spacing.sm,
                        borderRadius: 4,
                      }}
                    >
                      {JSON.stringify(decision.actionOutput, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
                {decision.toolResult && (
                  <Descriptions.Item label="工具结果">
                    <pre
                      style={{
                        margin: 0,
                        fontSize: spacing[3],
                        background: colors.neutral[50],
                        padding: spacing.sm,
                        borderRadius: 4,
                      }}
                    >
                      {JSON.stringify(decision.toolResult, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
                {decision.reasoning && (
                  <Descriptions.Item label="推理过程">
                    <Paragraph style={{ margin: 0 }}>{decision.reasoning}</Paragraph>
                  </Descriptions.Item>
                )}
                {decision.error && (
                  <Descriptions.Item label="错误">
                    <Alert
                      message={decision.error}
                      type="error"
                      showIcon
                      style={{ fontSize: spacing[3] }}
                    />
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="创建时间">
                  {dayjs(decision.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Panel>
          ))}
      </Collapse>
    </Card>
  );
};
