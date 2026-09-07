/**
 * Runbook Management table columns
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { Button, Popconfirm, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  type RunbookDefinition,
  type RunbookExecution,
} from '@/api/runbooks';
import { statusColor, statusLabel } from './constants';

export interface RunbookColumnsDeps {
  handleViewDetail: (record: RunbookDefinition) => void | Promise<void>;
  handleEdit: (record: RunbookDefinition) => void;
  handleDelete: (id: string) => Promise<void>;
  handleExecute: (id: string) => Promise<void>;
}

export function buildRunbookColumns(deps: RunbookColumnsDeps): ColumnsType<RunbookDefinition> {
  const { handleViewDetail, handleEdit, handleDelete, handleExecute } = deps;
  return [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '步骤数',
      key: 'steps',
      render: (_, record) => record.steps?.length ?? 0,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record.id)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export interface ExecutionColumnsDeps {
  handleViewExecution: (execution: RunbookExecution) => void | Promise<void>;
}

export function buildExecutionColumns(
  deps: ExecutionColumnsDeps
): ColumnsType<RunbookExecution> {
  const { handleViewExecution } = deps;
  return [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status]}>{statusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '触发者',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
    },
    {
      title: '当前步骤',
      dataIndex: 'currentStepIndex',
      key: 'currentStepIndex',
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" icon={<HistoryOutlined />} onClick={() => handleViewExecution(record)}>
          详情
        </Button>
      ),
    },
  ];
}
