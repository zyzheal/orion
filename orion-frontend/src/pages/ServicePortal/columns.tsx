/**
 * ITSM Self-Service Portal — table column definitions
 *
 * Extracted from index.tsx. The "我的工单" table columns depend on page-level
 * handlers, so they are built through a factory function (getTicketColumns)
 * that receives the callbacks and dynamic context from the parent component.
 */
import React from 'react';
import { Typography, Tag, Badge, Space, Button, Popconfirm } from 'antd';
import type { TableColumnsType } from 'antd';
import { EyeOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius } from '@/tokens';
import type { SelfServiceTicket } from '@/api/self-service';
import { PRIORITY_CONFIG, TICKET_STATUS_CONFIG } from './config';

const { Text } = Typography;

/** Dynamic fallback when no config entry exists for a value */
const DEFAULT_TAG_CONFIG: { color: string; label: string } = {
  color: 'default',
  label: '',
};

/** Priority value → tag color + label, with safe fallback */
function tagConfig(config: Record<string, { color: string; label: string }>, value: string) {
  return config[value] || { color: DEFAULT_TAG_CONFIG.color, label: value };
}

/** 我的工单表格列所需的页面级回调 */
export interface TicketColumnHandlers {
  /** 打开工单详情 */
  handleViewTicket: (ticket: SelfServiceTicket) => void;
  /** 取消待处理工单 */
  handleCancelTicket: (ticket: SelfServiceTicket) => void;
  /** 当前进行中的操作标识（如 `cancel-${id}`），用于 loading 状态 */
  actionLoading: string | null;
  /** 当前筛选后的工单列表（工单 ID 列通过它反查记录） */
  filteredTickets: SelfServiceTicket[];
}

/** 构建“我的工单”表格列 */
export function getTicketColumns(handlers: TicketColumnHandlers): TableColumnsType<SelfServiceTicket> {
  const { handleViewTicket, handleCancelTicket, actionLoading, filteredTickets } = handlers;

  return [
    {
      title: '工单ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (value: string) => (
        <Text
          strong
          style={{ color: colors.primary[500], cursor: 'pointer' }}
          onClick={() => handleViewTicket({ ...filteredTickets.find((t) => t.id === value) } as any)}
        >
          {value}
        </Text>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      render: (value: string, record: SelfServiceTicket) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => handleViewTicket(record)}
          >
            {value}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.service_name || record.category_name || ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (value: string) => {
        const cfg = tagConfig(PRIORITY_CONFIG, value);
        return (
          <Tag color={cfg.color} style={{ margin: 0, borderRadius: componentRadius.tag }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const cfg = tagConfig(TICKET_STATUS_CONFIG, value);
        return <Badge status={cfg.color as any} text={cfg.label} />;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (value: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {dayjs(value).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: SelfServiceTicket) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewTicket(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <Popconfirm
              title="确定要取消此工单吗？"
              onConfirm={() => handleCancelTicket(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                loading={actionLoading === `cancel-${record.id}`}
              >
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}
