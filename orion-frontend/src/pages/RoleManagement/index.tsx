/**
 * Role Management Page
 * Role CRUD, permission assignment, and assigned user viewing
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, message,
  Popconfirm, Drawer, Descriptions, Table as AntTable, Checkbox, Divider,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined,
  TeamOutlined, KeyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getRoles, createRole, deleteRole,
  type Role, type CreateRoleInput,
  COMMON_PERMISSIONS, PERMISSION_GROUPS,
} from '@/api/roles';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ---- Mock data ----

const MOCK_ROLES: Role[] = [
  {
    id: 'role-1', tenant_id: 'tenant-default', name: 'Admin',
    description: '系统管理员，拥有所有权限',
    permissions: COMMON_PERMISSIONS.map((p) => p.value),
    is_system: true, created_at: '2024-01-01T08:00:00Z', updated_at: '2024-01-01T08:00:00Z',
  },
  {
    id: 'role-2', tenant_id: 'tenant-default', name: 'Developer',
    description: '开发人员，可查看和执行流水线、部署',
    permissions: [
      'pipeline:read', 'pipeline:write', 'pipeline:execute',
      'deployment:read', 'deployment:execute',
      'monitoring:read', 'alert:read', 'alert:acknowledge',
      'config:read', 'artifact:read',
    ],
    created_at: '2024-01-15T08:00:00Z', updated_at: '2024-03-10T10:00:00Z',
  },
  {
    id: 'role-3', tenant_id: 'tenant-default', name: 'Viewer',
    description: '只读用户，仅可查看权限',
    permissions: [
      'pipeline:read', 'deployment:read', 'monitoring:read',
      'alert:read', 'config:read', 'artifact:read', 'cmdb:read',
      'audit:read', 'finops:read',
    ],
    created_at: '2024-02-01T08:00:00Z', updated_at: '2024-02-01T08:00:00Z',
  },
  {
    id: 'role-4', tenant_id: 'tenant-default', name: 'DevOps',
    description: '运维工程师，负责部署、配置、监控和告警管理',
    permissions: [
      'pipeline:read', 'pipeline:write', 'pipeline:execute', 'pipeline:delete',
      'deployment:read', 'deployment:write', 'deployment:execute', 'deployment:delete',
      'monitoring:read', 'monitoring:write',
      'alert:read', 'alert:write', 'alert:acknowledge',
      'config:read', 'config:write',
      'cmdb:read', 'cmdb:write',
      'artifact:read', 'artifact:write',
    ],
    created_at: '2024-02-10T08:00:00Z', updated_at: '2024-03-15T14:00:00Z',
  },
  {
    id: 'role-5', tenant_id: 'tenant-default', name: 'FinOps',
    description: '成本优化专员，查看和管理成本相关数据',
    permissions: [
      'finops:read', 'finops:write',
      'deployment:read', 'monitoring:read',
    ],
    created_at: '2024-03-01T08:00:00Z', updated_at: '2024-03-01T08:00:00Z',
  },
];

// Mock user assignments
const MOCK_USER_ASSIGNMENTS: Record<string, Array<{ id: string; name: string; email: string }>> = {
  'role-1': [
    { id: 'u1', name: 'Heal', email: 'heal@orion.dev' },
    { id: 'u2', name: 'Admin', email: 'admin@orion.dev' },
  ],
  'role-2': [
    { id: 'u3', name: 'Dev001', email: 'dev001@orion.dev' },
    { id: 'u4', name: 'Dev002', email: 'dev002@orion.dev' },
    { id: 'u5', name: 'Dev003', email: 'dev003@orion.dev' },
  ],
  'role-3': [
    { id: 'u6', name: 'Viewer001', email: 'viewer001@orion.dev' },
  ],
  'role-4': [
    { id: 'u7', name: 'Ops001', email: 'ops001@orion.dev' },
  ],
  'role-5': [
    { id: 'u8', name: 'FinOps001', email: 'finops001@orion.dev' },
  ],
};

// Default tenant ID for API calls
const DEFAULT_TENANT_ID = 'tenant-default';

// ---- Main Component ----

const RoleManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getRoles(DEFAULT_TENANT_ID);
      setRoles(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error: unknown) {
      // Fallback to mock data when backend is unavailable
      setRoles(MOCK_ROLES);
      if (error instanceof Error) {
        message.error(`加载角色列表失败：${error.message}`);
      } else {
        message.error('加载角色列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredData = useMemo(() => {
    if (!searchQuery) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [searchQuery, roles]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateRoleInput = {
        tenantId: DEFAULT_TENANT_ID,
        name: values.name,
        description: values.description || undefined,
        permissions: values.permissions || [],
      };
      await createRole(payload);
      message.success('角色创建成功');
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

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteRole(id);
      message.success(`角色 "${name}" 已删除`);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const openDetail = (role: Role) => {
    setSelectedRole(role);
    setDetailDrawerVisible(true);
  };

  // ---- Permission helpers ----

  const getPermissionColor = (value: string): string => {
    if (value.includes(':write') || value.includes(':execute') || value.includes(':delete') || value.includes(':manage')) return 'blue';
    if (value.includes(':read')) return 'green';
    return 'default';
  };

  // Mock user count per role
  const getUserCount = (roleId: string): number => {
    return MOCK_USER_ASSIGNMENTS[roleId]?.length || 0;
  };

  // ---- Table columns ----

  const columns: TableColumn<Role>[] = [
    {
      key: 'name', title: '角色名称', dataIndex: 'name', width: 180, sortable: true,
      render: (v: unknown, record: Role) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{String(v)}</Text>
            {record.is_system && <Tag color="gold" style={{ fontSize: 10 }}>系统</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description || '无描述'}</Text>
        </Space>
      ),
    },
    {
      key: 'permissions', title: '权限数量', width: 120,
      render: (_: unknown, record: Role) => (
        <Tag color="geekblue" icon={<KeyOutlined />}>{record.permissions.length} 项权限</Tag>
      ),
    },
    {
      key: 'users', title: '关联用户', width: 120,
      render: (_: unknown, record: Role) => (
        <Tag color="cyan" icon={<TeamOutlined />}>{getUserCount(record.id)} 位用户</Tag>
      ),
    },
    {
      key: 'createdAt', title: '创建时间', dataIndex: 'created_at', width: 160, sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      key: 'actions', title: '操作', width: 160, fixed: 'right' as const,
      render: (_: unknown, record: Role) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
          {!record.is_system && (
            <Popconfirm title={`确认删除角色 "${record.name}"?`} onConfirm={() => handleDelete(record.id, record.name)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ---- Detail Drawer content ----

  const renderPermissionGroup = (role: Role) => {
    return PERMISSION_GROUPS.map((group) => {
      const groupPerms = group.permissions.filter((p) =>
        role.permissions.includes(p.value)
      );
      if (groupPerms.length === 0) return null;
      return (
        <div key={group.group} style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13 }}>{group.group}</Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {groupPerms.map((p) => (
                <Tag key={p.value} color={getPermissionColor(p.value)}>{p.label}</Tag>
              ))}
            </Space>
          </div>
        </div>
      );
    });
  };

  const renderAssignedUsers = (roleId: string) => {
    const users = MOCK_USER_ASSIGNMENTS[roleId] || [];
    if (users.length === 0) {
      return <Text type="secondary">暂无关联用户</Text>;
    }
    return (
      <AntTable
        dataSource={users}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'name', key: 'name' },
          { title: '邮箱', dataIndex: 'email', key: 'email' },
        ]}
      />
    );
  };

  const isInitialLoading = loading && roles.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>角色管理</Title>
          <Text type="secondary">管理系统角色及其权限分配 (RBAC)</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建角色
          </Button>
        </Space>
      </div>

      {/* Role List */}
      <Card>
        <Input.Search
          placeholder="搜索角色名称或描述..."
          allowClear
          style={{ marginBottom: 16, maxWidth: 400 }}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建角色"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="如: Developer, Viewer" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="角色描述..." />
          </Form.Item>
          <Divider orientation="left" style={{ margin: '16px 0' }}>权限分配</Divider>
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
            <Form.Item name="permissions" valuePropName={undefined} noStyle>
              {PERMISSION_GROUPS.map((group) => {
                return (
                  <div key={group.group} style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 13 }}>{group.group}</Text>
                    <Checkbox.Group style={{ width: '100%', marginTop: 8, marginLeft: 0 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                        {group.permissions.map((p) => (
                          <Checkbox key={p.value} value={p.value}>{p.label}</Checkbox>
                        ))}
                      </div>
                    </Checkbox.Group>
                  </div>
                );
              })}
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedRole ? selectedRole.name : '角色详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={720}
        destroyOnClose
      >
        {selectedRole && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="角色名称">{selectedRole.name}</Descriptions.Item>
              <Descriptions.Item label="系统角色">
                {selectedRole.is_system ? <Tag color="gold">是</Tag> : <Tag>否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="权限数量">{selectedRole.permissions.length} 项</Descriptions.Item>
              <Descriptions.Item label="关联用户">{getUserCount(selectedRole.id)} 位</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedRole.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedRole.created_at ? dayjs(selectedRole.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedRole.updated_at ? dayjs(selectedRole.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider>权限列表</Divider>
            <div style={{ marginBottom: 24 }}>
              {renderPermissionGroup(selectedRole)}
            </div>

            <Divider>关联用户</Divider>
            {renderAssignedUsers(selectedRole.id)}
          </>
        )}
      </Drawer>
        </>
      )}
    </div>
  );
};

export default RoleManagement;
