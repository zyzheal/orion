/**
 * AgentTable - Agent profile table with search and filter
 * Displays filtered agent list with action buttons
 */
import React from 'react';
import { Typography, Button, Space, Tag, Badge } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import type { AgentProfile } from '@/api/agents';
import dayjs from 'dayjs';
import { ROLE_OPTIONS } from './constants';

const { Text } = Typography;

interface AgentTableProps {
  agents: AgentProfile[];
  filteredAgents: AgentProfile[];
  loading: boolean;
  searchQuery: string;
  filters: Record<string, string | string[] | undefined>;
  onSearch: (query: string) => void;
  onFilter: (filters: Record<string, string | string[] | undefined>) => void;
  onViewDetail: (agent: AgentProfile) => void;
  onToggleAgent: (agent: AgentProfile) => void;
  onDeleteAgent: (agent: AgentProfile) => void;
}

const AgentTable: React.FC<AgentTableProps> = ({
  agents: _agents,
  filteredAgents,
  loading,
  searchQuery: _searchQuery,
  filters: _filters,
  onSearch,
  onFilter,
  onViewDetail,
  onToggleAgent,
  onDeleteAgent,
}) => {
  const filterDefs: FilterDefinition[] = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已启用', value: 'enabled' },
        { label: '已禁用', value: 'disabled' },
      ],
    },
    {
      key: 'role',
      label: '角色',
      options: [
        { label: '全部', value: 'all' },
        ...ROLE_OPTIONS,
      ],
    },
  ];

  const columns: TableColumn<AgentProfile>[] = [
    {
      key: 'name',
      title: 'Agent 名称',
      dataIndex: 'name',
      width: 180,
      render: (value: unknown) => (
        <Space>
          <ThunderboltOutlined style={{ color: colors.purple[500] }} />
          <Text strong>{String(value)}</Text>
        </Space>
      ),
    },
    {
      key: 'role',
      title: '角色',
      dataIndex: 'role',
      width: 140,
      render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (value: unknown) => (
        <Badge status={value ? 'success' : 'default'} text={value ? '已启用' : '已禁用'} />
      ),
    },
    {
      key: 'tools',
      title: '工具数',
      dataIndex: 'tools',
      width: 80,
      render: (value: unknown) => <Tag>{(value as Array<{ toolName: string; permission: string }>).length}</Tag>,
    },
    {
      key: 'llmModel',
      title: 'LLM 模型',
      dataIndex: 'llmConfig',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {(value as { model?: string })?.model || '-'}
        </Text>
      ),
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: unknown) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {value ? dayjs(String(value)).format('YYYY-MM-DD HH:mm') : '-'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: AgentProfile) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(record)}
            data-testid={`view-agent-${record.id}`}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => onToggleAgent(record)}
            data-testid={`toggle-agent-${record.id}`}
          >
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDeleteAgent(record)}
            data-testid={`delete-agent-${record.id}`}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        Agent Profiles
      </Typography.Title>
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={onSearch}
          onFilter={onFilter}
          filters={filterDefs}
          searchPlaceholder="搜索 Agent 名称、角色、描述..."
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredAgents}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="agent-table"
      />
    </div>
  );
};

export default AgentTable;
