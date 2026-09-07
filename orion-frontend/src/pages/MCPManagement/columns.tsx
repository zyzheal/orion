/**
 * MCP Management table column builders
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import { Button, Popconfirm, Space, Switch, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, ToolOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MCPService, MCPTool } from './types';

const { Text } = Typography;

export interface ServerColumnDeps {
  handleViewTools: (record: MCPService) => void;
  handleOpenEdit: (record: MCPService) => void;
  handleDelete: (id: string, name: string) => void;
  handleToggle: (id: string, current: boolean) => void;
}

export function buildServerColumns(deps: ServerColumnDeps): ColumnsType<MCPService> {
  const { handleViewTools, handleOpenEdit, handleDelete, handleToggle } = deps;
  return [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (val: string) => (
        <Text code style={{ fontSize: 12 }}>
          {val}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (val: boolean, record: MCPService) => (
        <Switch size="small" checked={val} onChange={() => handleToggle(record.id, val)} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: MCPService) => (
        <Space size="small">
          <Button size="small" icon={<ToolOutlined />} onClick={() => handleViewTools(record)}>
            工具
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除此 MCP 服务？"
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export function buildToolColumns(): ColumnsType<MCPTool> {
  return [
    {
      title: '工具 ID',
      dataIndex: 'id',
      key: 'id',
      render: (v: string) => (
        <Text code style={{ fontSize: 11 }}>
          {v.slice(0, 8)}
        </Text>
      ),
    },
    { title: '工具名称', dataIndex: 'name', key: 'name' },
    {
      title: '参数',
      dataIndex: 'params',
      key: 'params',
      render: (v: string) => (
        <Text
          code
          style={
            v
              ? {
                  fontSize: 11,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }
              : { fontSize: 11 }
          }
        >
          {v || '-'}
        </Text>
      ),
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  ];
}
