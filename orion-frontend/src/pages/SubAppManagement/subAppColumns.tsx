/**
 * SubAppManagement columns
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Tag, Space, Tooltip, Switch, Button, Popconfirm, Typography } from 'antd';

const { Text } = Typography;
import {
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { SubAppConfig } from '@/stores/subappStore';

interface SubAppColumnsDeps {
  handleCopyLink: (path: string) => void;
  handleToggleStatus: (key: string) => void;
  handleShowHistory: (app: SubAppConfig) => void;
  handleEdit: (app: SubAppConfig) => void;
  handleDelete: (key: string) => void;
}

export interface SubAppColumn {
  title: string;
  dataIndex?: string;
  key: string;
  width?: number;
  render?: (value: unknown, record?: SubAppConfig) => React.ReactNode;
}

export const buildSubAppColumns = ({
  handleCopyLink,
  handleToggleStatus,
  handleShowHistory,
  handleEdit,
  handleDelete,
}: SubAppColumnsDeps): SubAppColumn[] => [
  {
    title: '状态',
    dataIndex: 'key',
    key: 'status',
    width: 90,
    render: (_: unknown, record?: SubAppConfig) => {
      if (!record) return null;
      const isEnabled = record.status === 'enabled';
      return (
        <Tag
          color={isEnabled ? colors.success[50] : colors.neutral[100]}
          style={{
            color: isEnabled ? colors.success[600] : colors.neutral[600],
            border: `1px solid ${isEnabled ? colors.success[200] : colors.neutral[200]}`,
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          {isEnabled ? '● 启用' : '○ 禁用'}
        </Tag>
      );
    },
  },
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (name: unknown, record?: SubAppConfig) =>
      record ? (
        <Space>
          <Text strong>{String(name)}</Text>
          <Tag>v{record.version}</Tag>
        </Space>
      ) : null,
  },
  {
    title: '标识',
    dataIndex: 'key',
    key: 'key',
    render: (key: unknown) => (
      <Tag
        color={colors.primary[50]}
        style={{
          color: colors.primary[600],
          border: `1px solid ${colors.primary[200]}`,
          borderRadius: 6,
          fontWeight: 500,
        }}
      >
        {String(key)}
      </Tag>
    ),
  },
  {
    title: '路由',
    dataIndex: 'routes',
    key: 'routes',
    render: (routes: unknown) => (
      <Space direction="vertical" size={0}>
        {(routes as string[])?.map((r) => (
          <Tag key={r} style={{ cursor: 'pointer' }} onClick={() => handleCopyLink(r)}>
            <CopyOutlined /> {r}
          </Tag>
        ))}
      </Space>
    ),
  },
  {
    title: '入口',
    dataIndex: 'entry_dev',
    key: 'entry',
    render: (dev: unknown, record?: SubAppConfig) =>
      record ? (
        <Tooltip title={record.entry_prod}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {String(dev)}
          </Text>
        </Tooltip>
      ) : null,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    render: (desc: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {(desc as string) || '-'}
      </Text>
    ),
  },
  {
    title: 'API 域',
    dataIndex: 'api_domain',
    key: 'api_domain',
    width: 100,
    render: (domain: unknown, record?: SubAppConfig) =>
      record ? (
        <Tag color={(domain as string | null) ? 'blue' : 'default'}>
          {(domain as string | null) || record.key}
        </Tag>
      ) : null,
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    render: (_: unknown, record?: SubAppConfig) =>
      record ? (
        <Space>
          <Switch
            checked={record.status === 'enabled'}
            onChange={() => handleToggleStatus(record.key)}
            size="small"
          />
          <Tooltip title="历史记录">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => handleShowHistory(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除子应用 "${record.name}" 吗？`}
            onConfirm={() => handleDelete(record.key)}
            okText="确认删除"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ) : null,
  },
];
