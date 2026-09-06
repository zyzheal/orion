/**
 * Table column definitions for Problem page lists.
 *
 * Columns are exported as factory functions because their render cells
 * depend on handler callbacks (view / edit / delete).  Callers wrap
 * these with useMemo, passing stable handlers.
 */
import {
  Typography, Button, Popconfirm, Space, Tag} from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, componentRadius } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { Problem, KnownError } from '@/api/problem';
import { severityConfig, statusConfig, knownErrorStatusConfig } from './config';

const { Text } = Typography;


// ---------------------------------------------------------------------------
// Problem list columns
// ---------------------------------------------------------------------------

export interface ProblemColumnsDeps {
  handleViewDetail: (problem: Problem) => void;
  handleOpenEditModal: (problem: Problem) => void;
  handleDelete: (id: string) => void;
}

export function buildProblemColumns(deps: ProblemColumnsDeps): TableColumn<Problem>[] {
  const { handleViewDetail, handleOpenEditModal, handleDelete } = deps;
  return [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      render: (_value, record) => (
        <Text
          strong
          style={{ color: colors.primary[600], cursor: 'pointer' }}
          onClick={() => handleViewDetail(record)}
        >
          {record.title}
        </Text>
      ),
    },
    {
      key: 'severity',
      title: '严重级别',
      dataIndex: 'severity',
      width: 90,
      render: (_value, record) => {
        const sev = severityConfig[record.severity] || severityConfig.medium;
        return (
          <Tag color={sev.color} icon={sev.icon}>
            {sev.label}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_value, record) => {
        const st = statusConfig[record.status] || statusConfig.known;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (_value, record) => <Text type="secondary">{record.category || '-'}</Text>,
    },
    {
      key: 'assigned_to',
      title: '负责人',
      dataIndex: 'assigned_to',
      width: 120,
      render: (_value, record) => <Text>{record.assigned_to || '-'}</Text>,
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (_value, record) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_value, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
            title="查看详情"
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(record)}
            title="编辑"
          />
          <Popconfirm
            title="确定删除此问题?"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// KEDB columns
// ---------------------------------------------------------------------------

export interface KedbColumnsDeps {
  handleOpenKedbEditModal: (ke: KnownError) => void;
  handleDeleteKnownError: (id: string) => void;
}

export function buildKedbColumns(deps: KedbColumnsDeps): TableColumn<KnownError>[] {
  const { handleOpenKedbEditModal, handleDeleteKnownError } = deps;
  return [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      render: (_value, record) => <Text strong>{record.title}</Text>,
    },
    {
      key: 'symptoms',
      title: '症状',
      dataIndex: 'symptoms',
      width: 180,
      ellipsis: true,
      render: (_value, record) => <Text type="secondary">{record.symptoms || '-'}</Text>,
    },
    {
      key: 'root_cause',
      title: '根因',
      dataIndex: 'root_cause',
      width: 180,
      ellipsis: true,
      render: (_value, record) => <Text type="secondary">{record.root_cause || '-'}</Text>,
    },
    {
      key: 'workaround',
      title: '临时方案',
      dataIndex: 'workaround',
      width: 180,
      ellipsis: true,
      render: (_value, record) => <Text type="secondary">{record.workaround || '-'}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_value, record) => {
        const keStatus = knownErrorStatusConfig[record.status] || knownErrorStatusConfig.active;
        return <Tag color={keStatus.color}>{keStatus.label}</Tag>;
      },
    },
    {
      key: 'keywords',
      title: '关键词',
      width: 160,
      render: (_value, record) => (
        <Space wrap size={4}>
          {(record.keywords || []).slice(0, 3).map((kw) => (
            <Tag key={kw} style={{ borderRadius: componentRadius.tag }}>
              {kw}
            </Tag>
          ))}
          {(record.keywords || []).length > 3 && (
            <Tag>+{record.keywords.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (_value, record) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_value, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenKedbEditModal(record)}
            title="编辑"
          />
          <Popconfirm
            title="确定删除此已知错误?"
            onConfirm={() => handleDeleteKnownError(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
