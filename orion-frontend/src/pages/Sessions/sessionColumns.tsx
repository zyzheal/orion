/**
 * Sessions table columns
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import { Typography, Space, Tag, Button, Tooltip, Popconfirm } from 'antd';
import { EyeOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import type { TableColumn } from '@/components/Table';
import type { UserSession } from './types';
import { statusColorMap, statusLabelMap, statusIconMap } from './constants';
import { formatDuration } from './helpers';

const { Text } = Typography;

interface SessionColumnsDeps {
  openDetail: (session: UserSession) => void;
  handleRevoke: (id: string) => void;
}

export const buildSessionColumns = ({
  openDetail,
  handleRevoke,
}: SessionColumnsDeps): TableColumn<UserSession>[] => [
  {
    key: 'user',
    title: '用户',
    dataIndex: 'userId',
    width: 180,
    render: (v: unknown) => (
      <Space>
        <UserOutlined style={{ color: colors.neutral[400] }} />
        <Text strong style={{ fontSize: 13 }}>
          {String(v)}
        </Text>
      </Space>
    ),
  },
  {
    key: 'sessionId',
    title: 'Session ID',
    dataIndex: 'sessionId',
    width: 140,
    render: (v: unknown) => (
      <Text code style={{ fontSize: 11 }}>
        {String(v).substring(0, 8)}...
      </Text>
    ),
  },
  {
    key: 'ipAddress',
    title: 'IP 地址',
    dataIndex: 'ipAddress',
    width: 130,
    render: (v: unknown) => (
      <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v)}</Text>
    ),
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (_v: unknown, record?: UserSession) =>
      record ? (
        <Tag color={statusColorMap[record.status]} icon={statusIconMap[record.status]}>
          {statusLabelMap[record.status]}
        </Tag>
      ) : null,
  },
  {
    key: 'startedAt',
    title: '开始时间',
    dataIndex: 'startedAt',
    width: 140,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).format('MM-DD HH:mm')}
      </Text>
    ),
  },
  {
    key: 'lastActive',
    title: '最后活跃',
    dataIndex: 'lastActive',
    width: 130,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'duration',
    title: '时长',
    dataIndex: 'duration',
    width: 80,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {formatDuration(typeof v === 'number' ? v : 0)}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    render: (_: unknown, record?: UserSession) =>
      record ? (
        <Space size="small" wrap>
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
          {record.status === 'active' && (
            <Popconfirm title="确认撤销该会话?" onConfirm={() => handleRevoke(record.id)}>
              <Tooltip title="撤销会话">
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  撤销
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ) : null,
  },
];
