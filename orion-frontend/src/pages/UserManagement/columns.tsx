/**
 * columns.tsx - 用户管理表格列定义
 * 抽取自 UserManagement/index.tsx (P2-9 Phase 97)
 */
import {
  Space,
  Button,
  Tag,
  Popconfirm,
  Tooltip,
  Avatar,
  Typography,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  EyeOutlined,
  UnlockOutlined,
  LockOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { User } from '@/api/users';
import { colors } from '@/tokens/colors';
import { roleColorMap, roleLabelMap, statusColorMap, statusLabelMap } from './constants';
import type { TableColumn } from '@/components/Table';

const { Text } = Typography;

interface ColumnDeps {
  handleDelete: (id: string) => void;
  handleDisable: (id: string) => void;
  handleEnable: (id: string) => void;
  openDetail: (u: User) => void;
  openEdit: (u: User) => void;
  onResetPassword: (u: User) => void;
}

export const makeUserColumns = (deps: ColumnDeps): TableColumn<User>[] => [
  {
    key: 'user',
    title: '用户',
    width: 200,
    render: (_: unknown, record: User) => (
      <Space>
        <Avatar
          size="small"
          icon={<UserOutlined />}
          style={{
            backgroundColor:
              roleColorMap[record.role] === 'red'
                ? colors.error[500]
                : roleColorMap[record.role] === 'blue'
                  ? colors.primary[500]
                  : roleColorMap[record.role] === 'gold'
                    ? colors.warning[500]
                    : colors.neutral[300],
          }}
        >
          {record.name ? record.name.charAt(0) : record.username.charAt(0).toUpperCase()}
        </Avatar>
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => deps.openDetail(record)}>
            {record.name || record.username}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.username}
          </Text>
        </Space>
      </Space>
    ),
  },
  {
    key: 'email',
    title: '邮箱',
    dataIndex: 'email',
    width: 200,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {v ? String(v) : '-'}
      </Text>
    ),
  },
  {
    key: 'role',
    title: '角色',
    width: 100,
    render: (_: unknown, record: User) => (
      <Tag color={roleColorMap[record.role] || 'default'}>
        {roleLabelMap[record.role] || record.role}
      </Tag>
    ),
  },
  {
    key: 'status',
    title: '状态',
    width: 90,
    render: (_: unknown, record: User) => (
      <Tag color={statusColorMap[record.status] || 'default'}>
        {statusLabelMap[record.status] || record.status}
      </Tag>
    ),
  },
  {
    key: 'lastLogin',
    title: '最后登录',
    width: 160,
    render: (_: unknown, record: User) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {record.last_login_at
          ? dayjs(record.last_login_at).format('YYYY-MM-DD HH:mm')
          : '从未登录'}
      </Text>
    ),
  },
  {
    key: 'createdAt',
    title: '创建时间',
    dataIndex: 'created_at',
    width: 140,
    sortable: true,
    render: (v: unknown) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(String(v)).format('YYYY-MM-DD')}
      </Text>
    ),
  },
  {
    key: 'actions',
    title: '操作',
    width: 260,
    render: (_: unknown, record: User) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => deps.openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => deps.openEdit(record)}
          />
        </Tooltip>
        {record.status === 'active' ? (
          <Tooltip title="禁用">
            <Popconfirm title="确认禁用该用户?" onConfirm={() => deps.handleDisable(record.id)}>
              <Button type="link" size="small" danger icon={<LockOutlined />}>
                禁用
              </Button>
            </Popconfirm>
          </Tooltip>
        ) : record.status !== 'deleted' ? (
          <Tooltip title="启用">
            <Popconfirm title="确认启用该用户?" onConfirm={() => deps.handleEnable(record.id)}>
              <Button type="link" size="small" icon={<UnlockOutlined />}>
                启用
              </Button>
            </Popconfirm>
          </Tooltip>
        ) : null}
        <Tooltip title="重置密码">
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => deps.onResetPassword(record)}
          />
        </Tooltip>
        {record.role !== 'admin' && (
          <Tooltip title="删除">
            <Popconfirm title="确认删除该用户?" onConfirm={() => deps.handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        )}
      </Space>
    ),
  },
];
