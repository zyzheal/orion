/**
 * WebhookManagement columns
 * 抽取自 index.tsx (P2-9 Phase 172)
 */
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { Webhook, WebhookLog } from '@/api/webhook';

const { Text } = Typography;

interface BuildColumnsDeps {
  handleTest: (id: string) => void;
  handleViewLogs: (webhook: Webhook) => void;
  openEdit: (webhook: Webhook) => void;
  handleDelete: (id: string) => void;
}

export function buildColumns({
  handleTest,
  handleViewLogs,
  openEdit,
  handleDelete,
}: BuildColumnsDeps): TableColumn<Webhook>[] {
  return [
    {
      key: 'url',
      title: 'URL',
      dataIndex: 'url',
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'events',
      title: '订阅事件',
      dataIndex: 'events',
      width: 250,
      render: (v: unknown) => (
        <Space wrap>
          {(v as string[]).map((e) => (
            <Tag key={e} color="blue" style={{ fontSize: 11 }}>
              {e}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => (v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      key: 'failureCount',
      title: '失败次数',
      dataIndex: 'failureCount',
      width: 80,
      render: (v: unknown) => {
        const count = typeof v === 'number' ? v : 0;
        return <Text style={{ color: count > 3 ? colors.error[500] : 'inherit' }}>{count}</Text>;
      },
    },
    {
      key: 'lastStatus',
      title: '最后状态',
      dataIndex: 'lastStatus',
      width: 90,
      render: (v: unknown) => {
        if (!v) return <Text type="secondary">—</Text>;
        const status = typeof v === 'number' ? v : 0;
        return status >= 200 && status < 300 ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            {status}
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            {status}
          </Tag>
        );
      },
    },
    {
      key: 'lastTriggeredAt',
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      width: 150,
      render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '—'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: Webhook) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleTest(record.id)}
            />
          </Tooltip>
          <Tooltip title="日志">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewLogs(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该 Webhook?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export function buildLogColumns(): TableColumn<WebhookLog>[] {
  return [
    {
      key: 'event',
      title: '事件',
      dataIndex: 'event',
      width: 180,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'status',
      title: 'HTTP 状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const s = typeof v === 'number' ? v : 0;
        return <Tag color={s >= 200 && s < 300 ? 'success' : 'error'}>{s}</Tag>;
      },
    },
    {
      key: 'error',
      title: '错误',
      dataIndex: 'error',
      ellipsis: true,
      render: (v: unknown) => (v ? <Text type="danger">{String(v)}</Text> : '—'),
    },
    {
      key: 'createdAt',
      title: '时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => dayjs(String(v)).format('MM-DD HH:mm:ss'),
    },
  ];
}
