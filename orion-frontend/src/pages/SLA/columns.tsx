/**
 * SLA table column definitions
 *
 * - defColumns: factory, takes edit/delete handlers
 * - trackingColumns: factory, takes status/breach handlers + definitionMap
 * - breachColumns: fully self-contained constant
 */
import {
  Typography, Space, Tag, Badge, Switch, Popconfirm, Button,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { SLADefinition, SLATracking, SLABreachEvent } from '@/api/sla';

import {
  TYPE_COLOR_MAP,
  TYPE_LABEL_MAP,
  DEF_STATUS_COLOR_MAP,
  DEF_STATUS_LABEL_MAP,
  PRIORITY_COLOR_MAP,
  PRIORITY_LABEL_MAP,
  ENTITY_TYPE_COLOR_MAP,
  ENTITY_TYPE_LABEL_MAP,
  TRACKING_STATUS_LABEL_MAP,
  TRACKING_STATUS_BADGE_MAP,
  EVENT_TYPE_COLOR_MAP,
  EVENT_TYPE_LABEL_MAP,
} from './config';

const { Text } = Typography;

// ==================== SLA Definition Columns ====================

export interface DefColumnHandlers {
  onEdit: (record: SLADefinition) => void;
  onDelete: (id: string) => void;
}

export function getDefColumns(
  handlers: DefColumnHandlers,
): TableColumn<SLADefinition>[] {
  const { onEdit, onDelete } = handlers;

  return [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SLADefinition) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value: unknown) => (
        <Tag color={TYPE_COLOR_MAP[String(value)] || 'default'}>
          {TYPE_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'target_value',
      title: '目标值',
      dataIndex: 'target_value',
      width: 140,
      render: (_: unknown, record: SLADefinition) => (
        <Text strong>
          {record.target_value} {record.target_unit}
        </Text>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (value: unknown) =>
        value ? (
          <Tag color={PRIORITY_COLOR_MAP[String(value)] || 'default'}>
            {PRIORITY_LABEL_MAP[String(value)] || String(value)}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'business_hours_only',
      title: '仅工作时间',
      dataIndex: 'business_hours_only',
      width: 110,
      render: (value: unknown) => <Switch checked={!!value} size="small" disabled />,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: unknown) => (
        <Tag color={DEF_STATUS_COLOR_MAP[String(value)] || 'default'}>
          {DEF_STATUS_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_: unknown, record: SLADefinition) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此 SLA 定义?"
            description="删除后不可恢复，关联的追踪记录也将失效。"
            onConfirm={() => onDelete(record.id)}
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
  ];
}

// ==================== SLA Tracking Columns ====================

export interface TrackingColumnHandlers {
  onStatusUpdate: (id: string, status: string) => void;
  onBreach: (id: string) => void;
  definitionMap: Record<string, SLADefinition>;
}

export function getTrackingColumns(
  handlers: TrackingColumnHandlers,
): TableColumn<SLATracking>[] {
  const { onStatusUpdate, onBreach, definitionMap } = handlers;

  return [
    {
      key: 'entity_type',
      title: '实体类型',
      dataIndex: 'entity_type',
      width: 100,
      render: (value: unknown) => (
        <Tag color={ENTITY_TYPE_COLOR_MAP[String(value)] || 'default'}>
          {ENTITY_TYPE_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'entity_id',
      title: '实体 ID',
      dataIndex: 'entity_id',
      width: 160,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'sla_definition_id',
      title: 'SLA 定义',
      dataIndex: 'sla_definition_id',
      width: 160,
      render: (value: unknown) => {
        const def = definitionMap[String(value)];
        return def ? (
          <Text strong>{def.name}</Text>
        ) : (
          <Text type="secondary">{String(value)}</Text>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const statusStr = String(value);
        return (
          <Badge
            status={
              TRACKING_STATUS_BADGE_MAP[statusStr] ?? ('warning' as const)
            }
            text={TRACKING_STATUS_LABEL_MAP[statusStr] || statusStr}
          />
        );
      },
    },
    {
      key: 'start_time',
      title: '开始时间',
      dataIndex: 'start_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="secondary">
            {dayjs(String(value)).format('YYYY-MM-DD HH:mm')}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'target_time',
      title: '目标时间',
      dataIndex: 'target_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text>{dayjs(String(value)).format('YYYY-MM-DD HH:mm')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'actual_time',
      title: '实际完成',
      dataIndex: 'actual_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="secondary">
            {dayjs(String(value)).format('YYYY-MM-DD HH:mm')}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'breach_time',
      title: '违约时间',
      dataIndex: 'breach_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="danger">
            {dayjs(String(value)).format('YYYY-MM-DD HH:mm')}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 220,
      render: (_: unknown, record: SLATracking) => {
        const status = record.status;
        return (
          <Space size="small">
            {status === 'tracking' && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => onStatusUpdate(record.id, 'met')}
                >
                  达成
                </Button>
                <Popconfirm
                  title="确认标记为违约?"
                  onConfirm={() => onBreach(record.id)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>
                    违约
                  </Button>
                </Popconfirm>
                <Button
                  type="link"
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={() => onStatusUpdate(record.id, 'paused')}
                >
                  暂停
                </Button>
              </>
            )}
            {status === 'paused' && (
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => onStatusUpdate(record.id, 'tracking')}
              >
                恢复
              </Button>
            )}
            {(status === 'met' || status === 'breached') && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                已结束
              </Text>
            )}
          </Space>
        );
      },
    },
  ];
}

// ==================== SLA Breach Event Columns ====================

export const breachColumns: TableColumn<SLABreachEvent>[] = [
  {
    key: 'event_type',
    title: '事件类型',
    dataIndex: 'event_type',
    width: 100,
    render: (value: unknown) => (
      <Tag color={EVENT_TYPE_COLOR_MAP[String(value)] || 'default'}>
        {EVENT_TYPE_LABEL_MAP[String(value)] || String(value)}
      </Tag>
    ),
  },
  {
    key: 'sla_tracking_id',
    title: '追踪 ID',
    dataIndex: 'sla_tracking_id',
    width: 200,
    render: (value: unknown) => <Text code>{String(value)}</Text>,
  },
  {
    key: 'event_time',
    title: '事件时间',
    dataIndex: 'event_time',
    width: 180,
    render: (value: unknown) =>
      value ? (
        <Text>{dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}</Text>
      ) : (
        <Text type="secondary">-</Text>
      ),
  },
  {
    key: 'details',
    title: '详情',
    dataIndex: 'details',
    width: 300,
    render: (value: unknown) => {
      if (!value) return <Text type="secondary">-</Text>;
      const detail = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return (
        <Text ellipsis={{ tooltip: detail }} style={{ maxWidth: 280 }}>
          {detail}
        </Text>
      );
    },
  },
  {
    key: 'notified_users',
    title: '通知用户',
    dataIndex: 'notified_users',
    width: 200,
    render: (value: unknown) => {
      if (!Array.isArray(value) || value.length === 0) {
        return <Text type="secondary">-</Text>;
      }
      return (
        <Space size={[0, 4]} wrap>
          {value.map((u: string, i: number) => (
            <Tag key={String(i)}>{u}</Tag>
          ))}
        </Space>
      );
    },
  },
];
