/**
 * AgentDetailDrawer - Detail panel for an Agent Profile
 */
import React from 'react';
import { Typography, Tag, Badge, Descriptions, Divider, Drawer } from 'antd';
import Table from '@/components/Table';
import type { AgentProfile } from '@/api/agents';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface AgentDetailDrawerProps {
  agent: AgentProfile | null;
  open: boolean;
  onClose: () => void;
}

const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({ agent, open, onClose }) => {
  if (!agent) return null;

  return (
    <Drawer
      title={`Agent 详情 - ${agent.name}`}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      data-testid="agent-detail-drawer"
    >
      <Descriptions title="基本信息" column={1} bordered size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="名称">{agent.name}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color="blue">{agent.role}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="描述">{agent.description || '-'}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Badge
            status={agent.enabled ? 'success' : 'default'}
            text={agent.enabled ? '已启用' : '已禁用'}
          />
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(agent.createdAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(agent.updatedAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Title level={5}>工具集</Title>
      {agent.tools.length > 0 ? (
        <Table
          columns={[
            { key: 'toolName', title: '工具名称', dataIndex: 'toolName', width: 160 },
            {
              key: 'permission',
              title: '权限',
              dataIndex: 'permission',
              width: 100,
              render: (v: unknown) => (
                <Tag color={String(v) === 'read' ? 'green' : 'orange'}>{String(v)}</Tag>
              ),
            },
          ]}
          dataSource={agent.tools}
          rowKey="toolName"
          size="small"
          clientPagination={false}
        />
      ) : (
        <Text type="secondary">无工具配置</Text>
      )}

      {agent.llmConfig && (
        <>
          <Divider />
          <Title level={5}>LLM 配置</Title>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="模型">{agent.llmConfig.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="Temperature">
              {agent.llmConfig.temperature ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Max Tokens">
              {agent.llmConfig.maxTokens ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}

      {agent.capabilities && (
        <>
          <Divider />
          <Title level={5}>能力配置</Title>
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="最大步骤">
              {agent.capabilities.maxSteps ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="超时(秒)">
              {agent.capabilities.timeoutSec ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="重试次数">
              {agent.capabilities.retryCount ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Drawer>
  );
};

export default AgentDetailDrawer;
