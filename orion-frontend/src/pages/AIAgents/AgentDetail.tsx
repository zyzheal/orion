/**
 * AI Agent 详情面板组件
 *
 * 展示 Agent 的完整配置信息和状态
 */
import React from 'react';
import { Descriptions, Tag, Typography, Card, Divider } from 'antd';
import type { AgentInfo } from '@/api/ai-agents';
import { colors } from '@/tokens';

const { Title, Paragraph, Text } = Typography;

interface AgentDetailProps {
  agent: AgentInfo | null;
}

const statusColorMap: Record<string, string> = {
  active: colors.success[500],
  idle: colors.neutral[500],
  running: colors.primary[500],
  error: colors.error[500],
  disabled: colors.neutral[300],
};

/**
 * Agent 详情展示
 */
const AgentDetail: React.FC<AgentDetailProps> = ({ agent }) => {
  if (!agent) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Text type="secondary">请选择一个 Agent 查看详情</Text>
      </div>
    );
  }

  const { config } = agent;

  return (
    <div>
      {/* 基本信息 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 8 }}>
          {config.name || agent.id}
        </Title>
        <Paragraph type="secondary">Agent 详细配置与状态</Paragraph>
      </div>

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Agent ID" span={2}>
          <Text code>{agent.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="名称">
          {config.name || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[agent.status] || colors.neutral[500]}>
            {agent.status || 'unknown'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="类型">
          {config.type || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="模型">
          {config.model || '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* 工具列表 */}
      {config.tools && config.tools.length > 0 && (
        <>
          <Divider orientation="left">工具列表</Divider>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {config.tools.map((tool: string | Record<string, any>, index: number) => {
              const toolName = typeof tool === 'string' ? tool : tool.toolName || tool.name || `tool-${index}`;
              return (
                <Tag key={index} color="geekblue">
                  {toolName}
                </Tag>
              );
            })}
          </div>
        </>
      )}

      {/* 完整配置 JSON */}
      <Divider orientation="left">完整配置</Divider>
      <Card
        size="small"
        style={{
          backgroundColor: colors.light.bg.secondary,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(agent, null, 2)}
        </pre>
      </Card>
    </div>
  );
};

export default AgentDetail;
