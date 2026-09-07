/**
 * SecretsManagement column definitions
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import { Typography, Space, Button, Popconfirm, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { Secret, SecretScope } from '@/api/secrets';
import { MASKED_VALUE, scopeLabelMap, scopeColorMap } from './constants';

const { Text } = Typography;

export interface SecretColumnsDeps {
  openEdit: (record: Secret) => void;
  handleDelete: (id: string) => void;
}

export const buildSecretColumns = ({ openEdit, handleDelete }: SecretColumnsDeps): TableColumn<Secret>[] => [
  {
    key: 'name',
    title: '名称',
    dataIndex: 'name',
    width: 250,
    sortable: true,
    filterable: true,
    render: (value: unknown, record) => (
      <Space direction="vertical" size={0}>
        <Text strong>{String(value)}</Text>
        {record.description && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        )}
      </Space>
    ),
  },
  {
    key: 'scope',
    title: '作用域',
    dataIndex: 'scope',
    width: 160,
    render: (value: unknown) => {
      const scope = value as SecretScope;
      return (
        <Tag color={scopeColorMap[scope] || 'default'}>{scopeLabelMap[scope] || scope}</Tag>
      );
    },
  },
  {
    key: 'value',
    title: 'Secret 值',
    width: 120,
    render: () => (
      <Text type="secondary" style={{ fontFamily: 'monospace' }}>
        {MASKED_VALUE}
      </Text>
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 160,
    sortable: true,
    render: (value: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(value)).fromNow()}
      </Text>
    ),
  },
  {
    key: 'createdBy',
    title: '创建人',
    dataIndex: 'createdBy',
    width: 140,
    render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
  },
  {
    key: 'actions',
    title: '操作',
    width: 160,
    render: (_: unknown, record) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(record)}
        >
          编辑
        </Button>
        <Popconfirm
          title="确认删除"
          description={`确定要删除 Secret "${record.name}" 吗？此操作不可撤销。`}
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
];
