/**
 * TicketColumns.tsx - Ticket 表格列配置 Hook
 * 抽取自 TicketList/index.tsx (P2-9 Phase 62)
 */
import { useMemo } from 'react';
import { Typography, Space, Tag, Badge, Button, Popconfirm } from 'antd';
import {
  ClockCircleOutlined,
  EyeOutlined,
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { type TableColumn } from "@/components/Table";
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { priorityConfig, statusConfig, categoryLabels, calculateSLA } from './constants';
import type { Ticket } from './types';

const { Text } = Typography;

interface UseTicketColumnsParams {
  navigate: (path: string) => void;
  handleEdit: (ticket: Ticket) => void;
  handleAssign: (ticket: Ticket) => void;
  handleDelete: (ticket: Ticket) => void;
  handleStatusTransition: (ticket: Ticket, action: string) => void;
}

export const useTicketColumns = ({
  navigate,
  handleEdit,
  handleAssign,
  handleDelete,
  handleStatusTransition,
}: UseTicketColumnsParams): TableColumn<Ticket>[] => {
  return useMemo<TableColumn<Ticket>[]>(() => [
    {
      key: 'id',
      title: '工单ID',
      dataIndex: 'id',
      width: 100,
      render: (value: unknown, record: Ticket) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => navigate(`/tickets/${record.id}`)}
          data-testid={`ticket-link-${record.id}`}
        >
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 280,
      render: (value: unknown, record: Ticket) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/tickets/${record.id}`)}
          >
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            来源:{' '}
            {record.source === 'alert'
              ? '告警'
              : record.source === 'incident'
                ? '事件'
                : record.source === 'api'
                  ? 'API'
                  : '手动'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 110,
      render: (value: unknown) => (
        <Tag color="cyan" style={{ margin: 0 }}>
          {categoryLabels[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (value: unknown) => {
        const config = priorityConfig[String(value)] || { color: 'default', label: String(value) };
        return (
          <Tag color={config.color} style={{ margin: 0, fontWeight: 500 }}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const config = statusConfig[String(value)] || { color: 'default', label: String(value) };
        return (
          <Badge
            status={config.color as 'success' | 'processing' | 'error' | 'default' | 'warning'}
            text={config.label}
          />
        );
      },
    },
    {
      key: 'assignee',
      title: '负责人',
      dataIndex: 'assignee',
      width: 100,
      render: (value: unknown) => (
        <Text>{value ? String(value) : <Text type="secondary">未分配</Text>}</Text>
      ),
    },
    {
      key: 'sla',
      title: 'SLA 剩余',
      width: 110,
      render: (_: unknown, record: Ticket) => {
        const sla = calculateSLA(record);
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: sla.color }} />
            <Text style={{ color: sla.color, fontWeight: sla.overdue ? 700 : 400 }}>
              {sla.text}
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 280,
      render: (_: unknown, record: Ticket) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tickets/${record.id}`)}
            data-testid={`view-ticket-${record.id}`}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            data-testid={`edit-ticket-${record.id}`}
          >
            编辑
          </Button>
          {(record.status === 'open' || record.status === 'assigned') && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleStatusTransition(record, 'start')}
              data-testid={`start-ticket-${record.id}`}
            >
              处理中
            </Button>
          )}
          {record.status === 'in-progress' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              style={{ color: colors.success[500] }}
              onClick={() => handleStatusTransition(record, 'resolve')}
              data-testid={`resolve-ticket-${record.id}`}
            >
              解决
            </Button>
          )}
          {record.status === 'resolved' && (
            <Button
              type="link"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleStatusTransition(record, 'close')}
              data-testid={`close-ticket-${record.id}`}
            >
              关闭
            </Button>
          )}
          {!record.assignee && (
            <Button
              type="link"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => handleAssign(record)}
              data-testid={`assign-ticket-${record.id}`}
            >
              分配
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这个工单吗？此操作不可恢复。"
            onConfirm={() => handleDelete(record)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              data-testid={`delete-ticket-${record.id}`}
            >
              删除
            </Button>
          </Popconfirm>
          {record.escalationLevel > 0 && (
            <Tag color="red" style={{ margin: 0 }}>
              升级 L{record.escalationLevel}
            </Tag>
          )}
        </Space>
      ),
    },
  ], [handleAssign, handleDelete, handleEdit, handleStatusTransition, navigate]);
};
