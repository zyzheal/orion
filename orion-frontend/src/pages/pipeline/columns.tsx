/**
 * columns.tsx - 数据管道表格列定义 + StatusTag
 * 抽取自 PipelineManagementPage.tsx (P2-9 Phase 90)
 */
import React from 'react';
import { Space, Tag, Button, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { DataPipeline } from '@/api/data-pipeline';
import type { TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';
import { statusConfig } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.pending;
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

interface ColumnDeps {
  navigate: (path: string) => void;
  actionLoading: Record<string, boolean>;
  handleOpenEdit: (pipeline: DataPipeline) => void;
  handleDelete: (pipeline: DataPipeline) => void;
  handleRun: (pipeline: DataPipeline) => void;
  handlePause: (pipeline: DataPipeline) => void;
  handleResume: (pipeline: DataPipeline) => void;
  handleViewLogs: (pipeline: DataPipeline) => void;
  handleViewLineage: (pipeline: DataPipeline) => void;
}

export const makePipelineColumns = (deps: ColumnDeps): TableColumn<DataPipeline>[] => [
  {
    key: 'name',
    title: '管道名称',
    dataIndex: 'name',
    width: 200,
    render: (value: any, record: DataPipeline) => (
      <Space direction="vertical" size={0}>
        <Text
          strong
          style={{ color: colors.primary[500], cursor: 'pointer' }}
          onClick={() => deps.navigate(`/data-pipeline/${record.id}`)}
        >
          {(value as string) || '-'}
        </Text>
        <Text
          type="secondary"
          style={{ fontSize: spacing[3] }}
          ellipsis={{ tooltip: record.description }}
        >
          {record.description || '-'}
        </Text>
      </Space>
    ),
  },
  {
    key: 'source',
    title: '源表',
    dataIndex: 'sourceTable',
    width: 140,
    render: (value: any) => (
      <Tag color="blue" style={{ fontSize: spacing[3] }}>
        {(value as string) || '-'}
      </Tag>
    ),
  },
  {
    key: 'target',
    title: '目标表',
    dataIndex: 'targetTable',
    width: 140,
    render: (value: any) => (
      <Tag color="green" style={{ fontSize: spacing[3] }}>
        {(value as string) || '-'}
      </Tag>
    ),
  },
  {
    key: 'schedule',
    title: '调度',
    dataIndex: 'schedule',
    width: 120,
    render: (value: any) => (
      <Text type="secondary" style={{ fontSize: spacing[3], fontFamily: 'monospace' }}>
        {(value as string) || '手动'}
      </Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (value: any) => <StatusTag status={(value as string) || '-'} />,
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 140,
    render: (value: any) => (
      <Text type="secondary" style={{ fontSize: spacing[3] }}>
        {(value as string) ? dayjs(value as string).fromNow() : '-'}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 200,
    render: (_: any, record: DataPipeline) => (
      <Space size="small" wrap>
        {record.status !== 'running' && (
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={deps.actionLoading[record.id]}
            onClick={() => deps.handleRun(record)}
          >
            运行
          </Button>
        )}
        {record.status === 'running' && (
          <Button
            type="link"
            size="small"
            icon={<PauseCircleOutlined />}
            loading={deps.actionLoading[record.id]}
            onClick={() => deps.handlePause(record)}
          >
            暂停
          </Button>
        )}
        {record.status === 'paused' && (
          <Button
            type="link"
            size="small"
            icon={<ArrowRightOutlined />}
            loading={deps.actionLoading[record.id]}
            onClick={() => deps.handleResume(record)}
          >
            恢复
          </Button>
        )}
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => deps.handleOpenEdit(record)}
        >
          编辑
        </Button>
        <Button
          type="link"
          size="small"
          icon={<DeleteOutlined />}
          danger
          onClick={() => deps.handleDelete(record)}
        >
          删除
        </Button>
        <Button
          type="link"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => deps.handleViewLogs(record)}
        >
          日志
        </Button>
        <Button
          type="link"
          size="small"
          icon={<DatabaseOutlined />}
          onClick={() => deps.handleViewLineage(record)}
        >
          血缘
        </Button>
      </Space>
    ),
  },
];
