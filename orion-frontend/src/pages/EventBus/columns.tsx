/**
 * EventBus Monitoring table columns
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors } from '@/tokens/colors';
import type { TableColumn } from '@/components/Table';
import type { EventBusEvent } from './types';
import { statusColorMap, statusLabelMap, statusIconMap, formatPayloadSize } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface EventColumnsDeps {
  openDetail: (event: EventBusEvent) => void;
}

export function buildEventColumns(deps: EventColumnsDeps): TableColumn<EventBusEvent>[] {
  const { openDetail } = deps;
  return [
    {
      key: 'eventType',
      title: '事件类型',
      dataIndex: 'eventType',
      width: 220,
      render: (_v: unknown, record: EventBusEvent) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ fontSize: 13, cursor: 'pointer' }}
            onClick={() => openDetail(record)}
          >
            {record.eventType}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Topic: {record.topic}
          </Text>
        </Space>
      ),
    },
    {
      key: 'source',
      title: '来源',
      dataIndex: 'source',
      width: 140,
      render: (v: unknown) => (
        <Tag color="blue" style={{ fontSize: 11 }}>
          {String(v)}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_v: unknown, record: EventBusEvent) => (
        <Tag color={statusColorMap[record.status]} icon={statusIconMap[record.status]}>
          {statusLabelMap[record.status]}
        </Tag>
      ),
    },
    {
      key: 'subscribers',
      title: '订阅数',
      dataIndex: 'subscriberCount',
      width: 80,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'payloadSize',
      title: 'Payload',
      dataIndex: 'payloadSize',
      width: 100,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 11, color: colors.neutral[600] }}>
          {formatPayloadSize(typeof v === 'number' ? v : 0)}
        </Text>
      ),
    },
    {
      key: 'timestamp',
      title: '时间',
      dataIndex: 'timestamp',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: EventBusEvent) => (
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
      ),
    },
  ];
}
