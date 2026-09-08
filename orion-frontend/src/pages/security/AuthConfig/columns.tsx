/**
 * AuthConfig columns
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Button, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { AuthPolicy, AuthProvider } from './types';
import { STATUS_CONFIG, TYPE_CONFIG } from './constants';

const { Text } = Typography;

export function buildProviderColumns(): ColumnsType<AuthProvider> {
  return [
    {
      title: '认证源名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (val: AuthProvider['type']) => {
        const cfg = TYPE_CONFIG[val];
        return <Tag color={cfg.color}>{cfg.icon} {cfg.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: AuthProvider['status']) => (
        <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].label}</Tag>
      ),
    },
    {
      title: '绑定用户数',
      dataIndex: 'users',
      key: 'users',
      width: 100,
      render: (val: number) => <Text>{val}</Text>,
    },
    {
      title: '最后同步',
      dataIndex: 'lastSync',
      key: 'lastSync',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: () => (
        <Space size="small">
          <Tooltip title="编辑功能待实现" placement="topLeft">
            <Button size="small" icon={<EditOutlined />} disabled>编辑</Button>
          </Tooltip>
          <Tooltip title="删除功能待实现" placement="topLeft">
            <Button size="small" danger icon={<DeleteOutlined />} disabled>删除</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];
}

export function buildPolicyColumns(): ColumnsType<AuthPolicy> {
  return [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '范围',
      dataIndex: 'scope',
      key: 'scope',
      width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 90,
      render: (val: boolean) => (
        <Tooltip title="启用/禁用功能待实现" placement="top">
          <Switch checked={val} size="small" disabled />
        </Tooltip>
      ),
    },
  ];
}
