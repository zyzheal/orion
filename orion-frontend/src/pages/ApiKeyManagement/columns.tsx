/**
 * ApiKeyManagement columns
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ApiKey } from '@/api/api-key';

const { Text } = Typography;

interface Props {
  onCopyKey: (key: string) => void;
  onRevoke: (id: string) => void;
}

export function buildColumns({ onCopyKey, onRevoke }: Props): TableColumn<ApiKey>[] {
  return [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'key',
      title: 'Key',
      dataIndex: 'key',
      width: 280,
      render: (v: unknown) => {
        const keyStr = String(v);
        const display =
          keyStr.length > 20 ? `${keyStr.slice(0, 8)}...${keyStr.slice(-4)}` : keyStr;
        return (
          <Space>
            <Text code style={{ fontSize: 12 }}>
              {display}
            </Text>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => onCopyKey(keyStr)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) =>
        v ? <Tag color="success">活跃</Tag> : <Tag color="default">已撤销</Tag>,
    },
    {
      key: 'expiresAt',
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 150,
      render: (v: unknown) => {
        if (!v) return <Tag>永不过期</Tag>;
        const expired = dayjs(String(v)).isBefore(dayjs());
        return (
          <Tag color={expired ? 'error' : 'processing'}>
            {dayjs(String(v)).format('YYYY-MM-DD')}
          </Tag>
        );
      },
    },
    {
      key: 'lastUsedAt',
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      width: 150,
      render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '从未使用'),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: ApiKey) =>
        record.enabled ? (
          <Popconfirm title="确认撤销该 API Key?" onConfirm={() => onRevoke(record.id)}>
            <Tooltip title="撤销">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        ) : (
          '—'
        ),
    },
  ];
}
