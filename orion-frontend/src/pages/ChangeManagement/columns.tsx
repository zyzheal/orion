/**
 * Change Management — Table Column Definitions
 *
 * Extracted from index.tsx (lines 692-964) to reduce main file size.
 * Each column set is a factory function accepting the handler callbacks it references.
 */
import { useMemo } from 'react';
import { Button, Popconfirm, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { ChangeRequest, RFC, CABMeeting } from '@/api/change';
import {
  typeConfig,
  priorityConfig,
  riskConfig,
  statusConfig,
  rfcStatusConfig,
  cabStatusConfig,
} from './config';

// ============================================================================
// Change Request Columns
// ============================================================================

interface ChangeRequestColumnsProps {
  handleDelete: (id: string) => void;
  handleViewDetail: (record: ChangeRequest) => void;
  handleOpenEditModal: () => void;
  setSelectedChange: (record: ChangeRequest | null) => void;
}

export function useChangeColumns({
  handleDelete,
  handleViewDetail,
  handleOpenEditModal,
  setSelectedChange,
}: ChangeRequestColumnsProps): TableColumn<ChangeRequest>[] {
  return useMemo<TableColumn<ChangeRequest>[]>(
    () => [
      {
        key: 'title',
        title: '标题',
        dataIndex: 'title',
        ellipsis: true,
        render: (_: unknown, record: ChangeRequest) => (
          <a onClick={() => handleViewDetail(record)}>{record.title}</a>
        ),
      },
      {
        key: 'type',
        title: '类型',
        dataIndex: 'type',
        width: 80,
        render: (_: unknown, record: ChangeRequest) => {
          const cfg = typeConfig[record.type];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.type}</Tag>;
        },
      },
      {
        key: 'priority',
        title: '优先级',
        dataIndex: 'priority',
        width: 80,
        render: (_: unknown, record: ChangeRequest) => {
          const cfg = priorityConfig[record.priority];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.priority}</Tag>;
        },
      },
      {
        key: 'risk_level',
        title: '风险',
        dataIndex: 'risk_level',
        width: 90,
        render: (_: unknown, record: ChangeRequest) => {
          const cfg = riskConfig[record.risk_level];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.risk_level}</Tag>;
        },
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (_: unknown, record: ChangeRequest) => {
          const cfg = statusConfig[record.status];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
        },
      },
      {
        key: 'requester_id',
        title: '申请人',
        dataIndex: 'requester_id',
        width: 100,
        ellipsis: true,
      },
      {
        key: 'scheduled_start',
        title: '计划开始',
        dataIndex: 'scheduled_start',
        width: 140,
        render: (_: unknown, record: ChangeRequest) =>
          record.scheduled_start ? dayjs(record.scheduled_start).format('YYYY-MM-DD HH:mm') : '-',
      },
      {
        key: 'actions',
        title: '操作',
        width: 160,
        fixed: 'right',
        render: (_: unknown, record: ChangeRequest) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedChange(record);
                handleOpenEditModal();
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description="确定要删除此变更请求吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, handleViewDetail]
  );
}

// ============================================================================
// RFC Columns
// ============================================================================

interface RFCColumnsProps {
  handleViewRfc: (record: RFC) => void;
  handleEditRfc: (record: RFC) => void;
}

export function useRFCColumns({
  handleViewRfc,
  handleEditRfc,
}: RFCColumnsProps): TableColumn<RFC>[] {
  return useMemo<TableColumn<RFC>[]>(
    () => [
      {
        key: 'rfc_number',
        title: 'RFC 编号',
        dataIndex: 'rfc_number',
        width: 140,
        render: (_: unknown, record: RFC) => (
          <a onClick={() => handleViewRfc(record)}>{record.rfc_number}</a>
        ),
      },
      {
        key: 'change_request_id',
        title: '关联变更',
        dataIndex: 'change_request_id',
        width: 200,
        ellipsis: true,
      },
      {
        key: 'justification',
        title: '变更理由',
        dataIndex: 'justification',
        ellipsis: true,
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (_: unknown, record: RFC) => {
          const cfg = rfcStatusConfig[record.status];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
        },
      },
      {
        key: 'reviewed_by',
        title: '审核人',
        dataIndex: 'reviewed_by',
        width: 100,
        ellipsis: true,
        render: (_: unknown, record: RFC) => record.reviewed_by || '-',
      },
      {
        key: 'created_at',
        title: '创建时间',
        dataIndex: 'created_at',
        width: 140,
        render: (_: unknown, record: RFC) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm'),
      },
      {
        key: 'actions',
        title: '操作',
        width: 140,
        fixed: 'right',
        render: (_: unknown, record: RFC) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewRfc(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditRfc(record)}
            >
              编辑
            </Button>
          </Space>
        ),
      },
    ],
    [handleEditRfc, handleViewRfc]
  );
}

// ============================================================================
// CAB Meeting Columns
// ============================================================================

interface CABColumnsProps {
  handleViewCab: (record: CABMeeting) => void;
  handleEditCab: (record: CABMeeting) => void;
}

export function useCABColumns({
  handleViewCab,
  handleEditCab,
}: CABColumnsProps): TableColumn<CABMeeting>[] {
  return useMemo<TableColumn<CABMeeting>[]>(
    () => [
      {
        key: 'title',
        title: '会议标题',
        dataIndex: 'title',
        ellipsis: true,
        render: (_: unknown, record: CABMeeting) => (
          <a onClick={() => handleViewCab(record)}>{record.title}</a>
        ),
      },
      {
        key: 'scheduled_at',
        title: '会议时间',
        dataIndex: 'scheduled_at',
        width: 160,
        render: (_: unknown, record: CABMeeting) =>
          record.scheduled_at ? dayjs(record.scheduled_at).format('YYYY-MM-DD HH:mm') : '-',
      },
      {
        key: 'location',
        title: '地点',
        dataIndex: 'location',
        width: 120,
        ellipsis: true,
        render: (_: unknown, record: CABMeeting) => record.location || '-',
      },
      {
        key: 'attendees',
        title: '参会人',
        dataIndex: 'attendees',
        width: 200,
        render: (_: unknown, record: CABMeeting) =>
          record.attendees?.length ? (
            <Space size={4} wrap>
              {record.attendees.slice(0, 3).map((a) => (
                <Tag key={a}>{a}</Tag>
              ))}
              {record.attendees.length > 3 && <Tag>+{record.attendees.length - 3}</Tag>}
            </Space>
          ) : (
            '-'
          ),
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (_: unknown, record: CABMeeting) => {
          const cfg = cabStatusConfig[record.status];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{record.status}</Tag>;
        },
      },
      {
        key: 'actions',
        title: '操作',
        width: 140,
        fixed: 'right',
        render: (_: unknown, record: CABMeeting) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewCab(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditCab(record)}
            >
              编辑
            </Button>
          </Space>
        ),
      },
    ],
    [handleEditCab, handleViewCab]
  );
}
