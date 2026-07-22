/**
 * AI Agent 列表表格组件
 *
 * 展示 Agent 列表，支持查看详情、执行、查看审计日志等操作
 */
import React from 'react';
import { Table, Tag, Button, Space, Typography } from 'antd';
import {
  EyeOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AgentInfo } from '@/api/ai-agents';
import { colors } from '@/tokens';

const { Text } = Typography;

interface AgentListProps {
  agents: AgentInfo[];
  loading: boolean;
  onViewDetail: (agent: AgentInfo) => void;
  onExecute: (agent: AgentInfo) => void;
  onViewAuditLog: (agent: AgentInfo) => void;
}

const statusColorMap: Record<string, string> = {
  active: colors.success[500],
  idle: colors.neutral[500],
  running: colors.primary[500],
  error: colors.error[500],
  disabled: colors.neutral[300],
};

/**
 * Agent 列表表格
 */
const AgentList: React.FC<AgentListProps> = ({
  agents,
  loading,
  onViewDetail,
  onExecute,
  onViewAuditLog,
}) => {
  const columns: ColumnsType<AgentInfo> = [
    {
      title: 'Agent ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id: string) => (
        <Text code style={{ fontSize: 12 }}>
          {id}
        </Text>
      ),
    },
    {
      title: '名称',
      dataIndex: ['config', 'name'],
      key: 'name',
      width: 180,
      render: (name: string) => name || '-',
    },
    {
      title: '类型',
      dataIndex: ['config', 'type'],
      key: 'type',
      width: 120,
      render: (type: string) => (type ? <Tag color="blue">{type}</Tag> : '-'),
    },
    {
      title: '模型',
      dataIndex: ['config', 'model'],
      key: 'model',
      width: 150,
      render: (model: string) => model || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status] || colors.neutral[500]}>
          {status || 'unknown'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: AgentInfo) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => onExecute(record)}
            disabled={record.status === 'disabled'}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => onViewAuditLog(record)}
          >
            日志
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table<AgentInfo>
      columns={columns}
      dataSource={agents}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 个 Agent`,
      }}
      style={{
        borderRadius: 12,
      }}
    />
  );
};

export default AgentList;
