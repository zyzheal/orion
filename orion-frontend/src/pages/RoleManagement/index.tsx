/**
 * Role Management Page
 * Role CRUD, permission assignment, and assigned user viewing
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Drawer,
  Descriptions,
  Checkbox,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getRoles,
  createRole,
  deleteRole,
  type Role,
  type CreateRoleInput,
  PERMISSION_GROUPS,
} from '@/api/roles';
import dayjs from 'dayjs';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

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
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setRoles([]);
      if (error instanceof Error) {
        message.error(`加载角色列表失败：${error.message}`);
      } else {
        message.error('加载角色列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    if (
      value.includes(':write') ||
      value.includes(':execute') ||
      value.includes(':delete') ||
      value.includes(':manage')
    )
      return 'blue';
    if (value.includes(':read')) return 'green';
    return 'default';
  };

  // ---- Table columns ----

  const columns: TableColumn<Role>[] = [
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

  // ---- Detail Drawer content ----

  const renderPermissionGroup = (role: Role) => {
    return PERMISSION_GROUPS.map((group) => {
      const groupPerms = group.permissions.filter((p) => role.permissions.includes(p.value));
      if (groupPerms.length === 0) return null;
      return (
        <div key={group.group} style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13 }}>
            {group.group}
          </Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {groupPerms.map((p) => (
                <Tag key={p.value} color={getPermissionColor(p.value)}>
                  {p.label}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      );
    });
  };

  const renderAssignedUsers = (_roleId: string) => {
    return <Text type="secondary">暂无关联用户</Text>;
  };

  const isInitialLoading = loading && roles.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 24,
            }}
          >
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>
                <TeamOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
                角色管理
              </Title>
              <Text type="secondary">管理系统角色及其权限分配 (RBAC)</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
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
              <Divider orientation="left" style={{ margin: '16px 0' }}>
                权限分配
              </Divider>
              <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                <Form.Item name="permissions" valuePropName={undefined} noStyle>
                  {PERMISSION_GROUPS.map((group) => {
                    return (
                      <div key={group.group} style={{ marginBottom: 16 }}>
                        <Text strong style={{ fontSize: 13 }}>
                          {group.group}
                        </Text>
                        <Checkbox.Group style={{ width: '100%', marginTop: 8, marginLeft: 0 }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '4px 16px',
                            }}
                          >
                            {group.permissions.map((p) => (
                              <Checkbox key={p.value} value={p.value}>
                                {p.label}
                              </Checkbox>
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
                  <Descriptions.Item label="权限数量">
                    {selectedRole.permissions.length} 项
                  </Descriptions.Item>
                  <Descriptions.Item label="关联用户">
                    {selectedRole.user_count || 0} 位
                  </Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>
                    {selectedRole.description || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {selectedRole.created_at
                      ? dayjs(selectedRole.created_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    {selectedRole.updated_at
                      ? dayjs(selectedRole.updated_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider>权限列表</Divider>
                <div style={{ marginBottom: 24 }}>{renderPermissionGroup(selectedRole)}</div>

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
