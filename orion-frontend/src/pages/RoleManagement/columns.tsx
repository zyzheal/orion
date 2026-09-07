/**
 * Role Management table columns
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined, KeyOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TableColumn } from '@/components/Table';
import type { Role } from '@/api/roles';

const { Text } = Typography;

export interface RoleColumnsDeps {
  handleDelete: (id: string, name: string) => Promise<void>;
  openDetail: (role: Role) => void;
}

export function buildRoleColumns(deps: RoleColumnsDeps): TableColumn<Role>[] {
  const { handleDelete, openDetail } = deps;
  return [
    {
      key: 'name',
      title: '角色名称',
      dataIndex: 'name',
      width: 180,
      sortable: true,
      render: (v: unknown, record: Role) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
              {String(v)}
            </Text>
            {record.is_system && (
              <Tag color="gold" style={{ fontSize: 10 }}>
                系统
              </Tag>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description || '无描述'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'permissions',
      title: '权限数量',
      width: 120,
      render: (_: unknown, record: Role) => (
        <Tag color="geekblue" icon={<KeyOutlined />}>
          {record.permissions.length} 项权限
        </Tag>
      ),
    },
    {
      key: 'users',
      title: '关联用户',
      width: 120,
      render: (_: unknown, record: Role) => (
        <Tag color="cyan" icon={<TeamOutlined />}>
          {record.user_count || 0} 位用户
        </Tag>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: Role) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
          {!record.is_system && (
            <Popconfirm
              title={`确认删除角色 "${record.name}"?`}
              onConfirm={() => handleDelete(record.id, record.name)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}
