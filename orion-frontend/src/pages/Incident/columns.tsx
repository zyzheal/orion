/**
 * Incident page table column and filter definitions.
 * Extracted from index.tsx to reduce line count and improve readability.
 *
 * Columns are built via a factory function that receives page-context
 * handler callbacks (handleViewDetail, handleOpenEdit, handleDelete).
 * Filter definitions are static and exported as a constant.
 */
import {
  Typography, Space, Button, Tag, Popconfirm,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import type { Incident } from '@/api/incident';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import { spacing } from '@/tokens';
import { severityConfig, statusConfig, priorityConfig } from './config';

// ============================================================================
// Column factory
// ============================================================================

export interface IncidentColumnHandlers {
  handleViewDetail: (record: Incident) => void;
  handleOpenEdit: (record: Incident) => void;
  handleDelete: (record: Incident) => void;
}

/** Build incident list table columns given handler callbacks */
export function buildIncidentColumns(
  handlers: IncidentColumnHandlers
): TableColumn<Incident>[] {
  const { handleViewDetail, handleOpenEdit, handleDelete } = handlers;

  return [
    {
      key: 'title',
      title: '事件标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_val: unknown, record: Incident) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 500 }}
          onClick={() => handleViewDetail(record)}
        >
          {record.title}
        </Button>
      ),
    },
    {
      key: 'severity',
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (_val: unknown, record: Incident) => {
        const cfg = severityConfig[record.severity];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.severity}</Tag>;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_val: unknown, record: Incident) => {
        const cfg = statusConfig[record.status];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
      },
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      render: (_val: unknown, record: Incident) => {
        const cfg = priorityConfig[record.priority ?? ''];
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>-</Tag>;
      },
    },
    {
      key: 'assigned_to',
      title: '负责人',
      dataIndex: 'assigned_to',
      width: 120,
      render: (_val: unknown, record: Incident) =>
        record.assigned_to ? (
          <Space size={4}>
            <UserOutlined style={{ color: colors.neutral[500] }} />
            <Text>{record.assigned_to}</Text>
          </Space>
        ) : (
          <Text type="secondary">未分配</Text>
        ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (_val: unknown, record: Incident) => (
        <Text type="secondary">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_val: unknown, record: Incident) => (
        <Space size={spacing.xs}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此事件?"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ============================================================================
// Static filter definitions
// ============================================================================

import { severityFilterOptions, statusFilterOptions } from './config';

const { Text } = Typography;


/** Filter definitions for SearchFilterBar */
export const incidentFilterDefs: FilterDefinition[] = [
  {
    key: 'severity',
    label: '严重程度',
    options: severityFilterOptions,
  },
  {
    key: 'status',
    label: '状态',
    options: statusFilterOptions,
  },
];
