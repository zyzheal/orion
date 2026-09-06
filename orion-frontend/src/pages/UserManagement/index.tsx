import { PermissionGuard } from '@/components/PermissionGuard';
/**
 * User Management Page
 * List, create, edit, enable/disable users, role assignment, and detail view
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  message,
  Popconfirm,
  Descriptions,
  Tooltip,
  Statistic,
  Row,
  Col,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EyeOutlined,
  UnlockOutlined,
  LockOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  adminResetPassword,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/api/users';
import { UserManagementModals } from './UserManagementModals';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

// ---- Color & label maps ----

const roleColorMap: Record<string, string> = {
  admin: 'red',
  developer: 'blue',
  viewer: 'default',
  manager: 'gold',
  user: 'default',
};

const roleLabelMap: Record<string, string> = {
  admin: '管理员',
  developer: '开发者',
  viewer: '观察者',
  manager: '经理',
  user: '普通用户',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  deleted: 'error',
  locked: 'orange',
};

const statusLabelMap: Record<string, string> = {
  active: '已启用',
  inactive: '已禁用',
  deleted: '已删除',
  locked: '已锁定',
};

// ---- Main Component ----

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [_total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [changePwModalVisible, setChangePwModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [changePwForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // ---- Data loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listUsers({ page: 1, limit: 100 });
      const data = res.data?.data;
      setUsers(Array.isArray(data) ? data : []);
      setTotal(res.data?.total ?? 0);
    } catch (error: unknown) {
      setUsers([]);
      setTotal(0);
      if (error instanceof Error) {
        message.error(`加载用户数据失败：${error.message}`);
      } else {
        message.error('加载用户数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ---- Filtering ----

  const filteredData = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [u.username, u.email, u.name].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filters.role && filters.role !== 'all' && u.role !== filters.role) return false;
      if (filters.status && filters.status !== 'all' && u.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, users]);

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateUserInput = {
        username: values.username,
        email: values.email || undefined,
        passwordHash: values.password,
        name: values.name || undefined,
        role: values.role || 'user',
      };
      await createUser(payload);
      message.success('用户创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '创建失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateUserInput = {
        username: values.username,
        email: values.email || undefined,
        name: values.name || undefined,
        role: values.role,
      };
      await updateUser(editingUser.id, payload);
      message.success('用户更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '更新失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('用户已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleEnable = async (id: string) => {
    try {
      await updateUser(id, { status: 'active' });
      message.success('用户已启用');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`启用失败：${error.message}`);
      } else {
        message.error('启用失败');
      }
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await updateUser(id, { status: 'inactive' });
      message.success('用户已禁用');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`禁用失败：${error.message}`);
      } else {
        message.error('禁用失败');
      }
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;
    try {
      await changePwForm.validateFields();
      setSubmitting(true);
      const values = changePwForm.getFieldsValue();
      await adminResetPassword(selectedUser.id, { newPassword: values.newPassword });
      setChangePwModalVisible(false);
      changePwForm.resetFields();
      message.success('密码重置成功');
      await loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (err.errorFields) return;
      message.error(error instanceof Error ? error.message : '密码重置失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    editForm.setFieldsValue({
      username: u.username,
      email: u.email,
      name: u.name,
      role: u.role,
    });
    setEditModalVisible(true);
  };

  const openDetail = (u: User) => {
    setSelectedUser(u);
    setDetailDrawerVisible(true);
  };

  // ---- Table columns ----

  const columns: TableColumn<User>[] = useMemo<TableColumn<User>[]>(
    () => [
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
              <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
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
                onClick={() => openDetail(record)}
              >
                详情
              </Button>
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
            {record.status === 'active' ? (
              <Tooltip title="禁用">
                <Popconfirm title="确认禁用该用户?" onConfirm={() => handleDisable(record.id)}>
                  <Button type="link" size="small" danger icon={<LockOutlined />}>
                    禁用
                  </Button>
                </Popconfirm>
              </Tooltip>
            ) : record.status !== 'deleted' ? (
              <Tooltip title="启用">
                <Popconfirm title="确认启用该用户?" onConfirm={() => handleEnable(record.id)}>
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
                onClick={() => {
                  setSelectedUser(record);
                  setChangePwModalVisible(true);
                }}
              />
            </Tooltip>
            {record.role !== 'admin' && (
              <Tooltip title="删除">
                <Popconfirm title="确认删除该用户?" onConfirm={() => handleDelete(record.id)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    [handleDelete, handleDisable, handleEnable, openDetail, openEdit]
  );

  // ---- Filter definitions ----

  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'role',
        label: '角色',
        options: [
          { label: '全部', value: 'all' },
          { label: '管理员', value: 'admin' },
          { label: '开发者', value: 'developer' },
          { label: '经理', value: 'manager' },
          { label: '观察者', value: 'viewer' },
          { label: '普通用户', value: 'user' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '已启用', value: 'active' },
          { label: '已禁用', value: 'inactive' },
          { label: '已锁定', value: 'locked' },
        ],
      },
    ],
    []
  );

  // ---- Stats ----

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      inactive: users.filter((u) => u.status !== 'active').length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users]
  );

  // ---- Detail Drawer ----

  const detailItems = useMemo(() => {
    if (!selectedUser) return null;
    const u = selectedUser;
    return (
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="用户名">{u.username}</Descriptions.Item>
        <Descriptions.Item label="显示名称">{u.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="邮箱">{u.email || '-'}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color={roleColorMap[u.role] || 'default'}>{roleLabelMap[u.role] || u.role}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[u.status] || 'default'}>
            {statusLabelMap[u.status] || u.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建者">{u.created_by || '-'}</Descriptions.Item>
        <Descriptions.Item label="最后登录">
          {u.last_login_at ? dayjs(u.last_login_at).format('YYYY-MM-DD HH:mm:ss') : '从未登录'}
        </Descriptions.Item>
        <Descriptions.Item label="登录IP">{u.last_login_ip || '-'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(u.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(u.updated_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        {u.settings && Object.keys(u.settings).length > 0 && (
          <Descriptions.Item label="用户设置" span={2}>
            <Space wrap>
              {Object.entries(u.settings).map(([k, v]) => (
                <Tag key={String(k)}>
                  {k}: {String(v)}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  }, [selectedUser]);

  const roleOptions = Object.entries(roleLabelMap).map(([v, l]) => ({ label: l, value: v }));

  const isInitialLoading = loading && users.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton cards={4} rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: spacing.lg,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
                <UserOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                用户管理
              </Title>
              <Text type="secondary">管理系统用户、角色分配和账户状态</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建用户
              </Button>
            </Space>
          </div>

          {/* Stats Panel */}
          <Card size="small" style={{ marginBottom: spacing.md }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="用户总数" value={stats.total} prefix={<UserOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已启用"
                  value={stats.active}
                  valueStyle={{ color: colors.success[500] }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已禁用/锁定"
                  value={stats.inactive}
                  valueStyle={{ color: colors.warning[500] }}
                  prefix={<StopOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="管理员"
                  value={stats.admins}
                  valueStyle={{ color: colors.error[500] }}
                />
              </Col>
            </Row>
          </Card>

          {/* User List */}
          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={setSearchQuery}
                onFilter={setFilters}
                filters={filterDefs}
                searchPlaceholder="搜索用户名、邮箱或姓名..."
              />
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          <UserManagementModals
            createModalVisible={createModalVisible}
            setCreateModalVisible={setCreateModalVisible}
            editModalVisible={editModalVisible}
            setEditModalVisible={setEditModalVisible}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            detailDrawerVisible={detailDrawerVisible}
            setDetailDrawerVisible={setDetailDrawerVisible}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            changePwModalVisible={changePwModalVisible}
            setChangePwModalVisible={setChangePwModalVisible}
            createForm={createForm}
            editForm={editForm}
            changePwForm={changePwForm}
            submitting={submitting}
            setSubmitting={setSubmitting}
            handleCreate={handleCreate}
            handleEdit={handleEdit}
            handleChangePassword={handleChangePassword}
            handleEnable={handleEnable}
            handleDisable={handleDisable}
            openEdit={openEdit}
            roleOptions={roleOptions}
            detailItems={detailItems}
          />
        </>
      )}
    </div>
  );
};

export default () => (
  <PermissionGuard requiredRoles={['admin', 'platform_admin']} pageLevel resourceName="用户管理">
    <UserManagement />
  </PermissionGuard>
);
