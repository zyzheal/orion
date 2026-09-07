/**
 * NotificationRules IM columns
 * 抽取自 index.tsx (P2-9 Phase 175)
 */
import { Typography, Space, Tag, Button, Tooltip, Switch, Popconfirm } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import type { IMNotificationRule } from '@/api/notificationRules';
import dayjs from 'dayjs';
import { PLATFORM_CONFIG } from './constants';

const { Text } = Typography;

interface IMColumnsDeps {
  handleTest: (id: string) => void;
  handleDelete: (id: string) => void;
  handleToggle: (id: string, enabled: boolean) => void;
  openEdit: (rule: IMNotificationRule) => void;
}

export function buildIMColumns({ handleTest, handleDelete, handleToggle, openEdit }: IMColumnsDeps): TableColumn<IMNotificationRule>[] {
  return [
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'platform',
      width: 130,
      render: (v: unknown) => {
        const platform = String(v) as string;
        const cfg = PLATFORM_CONFIG[platform] ?? { color: 'default', label: platform };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'webhookUrl',
      title: 'Webhook URL',
      dataIndex: 'webhookUrl',
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
      width: 280,
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
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '—'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: IMNotificationRule) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleTest(record.id)}
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
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={(checked) => handleToggle(record.id, checked)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该 IM 通知规则?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
