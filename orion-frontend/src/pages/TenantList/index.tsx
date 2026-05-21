/**
 * Tenant List Page
 * Admin view: create, manage, and switch between tenants
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Tooltip,
  Popconfirm,
  Divider,
  Empty,
  Row,
  Col,
} from 'antd';
import { colors } from '@/tokens';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  BankOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  type TenantEntity,
  type CreateTenantRequest,
} from '@/api/tenant';
import { getUsersByTenant, type User } from '@/api/users';

const { Title, Text } = Typography;

interface TenantListPageProps {
  onTenantSelect?: (tenantId: string) => void;
}

const TenantListPage: React.FC<TenantListPageProps> = ({ onTenantSelect }) => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantEntity | null>(null);
  const [submitting, setSubmitting] = useState(false); // P1 修复：防重复提交
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // P1-3 修复：用户管理相关状态
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTenant, setUserModalTenant] = useState<TenantEntity | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await listTenants(page, pageSize);
      const body = (res.data as any)?.data ?? res.data;
      setTenants(body?.data || body || []);
      setTotal(body?.total ?? body?.totalPages ? (body.page * body.limit) : 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载租户列表失败：${error.message}`);
      } else {
        message.error('加载租户列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [page, pageSize]);

  // P1 修复：防重复提交
  const handleCreate = async (values: any) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const input: CreateTenantRequest = {
        name: values.name,
        display_name: values.display_name,
        settings: values.settings,
        autoAllocateNamespace: values.autoAllocateNamespace,
        initialNamespaceCount: values.initialNamespaceCount || 1,
        customQuota: values.customQuota ? {
          maxPipelines: values.maxPipelines,
          maxPipelineRunsPerDay: values.maxPipelineRunsPerDay,
          maxConcurrentRuns: values.maxConcurrentRuns,
          maxRunners: values.maxRunners,
          maxCpuCores: values.maxCpuCores,
          maxMemoryGb: values.maxMemoryGb,
          maxStorageGb: values.maxStorageGb,
          maxNamespaces: values.maxNamespaces,
        } : undefined,
      };

      const res = await createTenant(input);
      const body = (res.data as any) ?? res.data;
      message.success(body.message || '租户创建成功');

      if (body.allocatedNamespaces?.length > 0) {
        message.success(`已分配 ${body.allocatedNamespaces.length} 个 Namespace`);
      }

      setCreateModalOpen(false);
      createForm.resetFields();
      loadTenants();
    } catch (error: unknown) {
      // P0-5 修复：创建时 name 重复无明确反馈
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 400) {
        if (err.response.data?.message?.includes('unique') || err.response.data?.message?.includes('already exist')) {
          message.error('租户标识已存在，请使用其他标识');
          return;
        }
        message.error(err.response.data?.message || '创建失败，请检查输入');
      } else if (error instanceof Error) {
        message.error(`创建租户失败：${error.message}`);
      } else {
        message.error('创建租户失败，请稍后重试');
      }
    } finally {
      setSubmitting(false); // P1 修复：防重复提交
    }
  };

  const handleEdit = async (values: any) => {
    if (!editingTenant) return;
    try {
      await updateTenant(editingTenant.id, {
        name: values.name,
        display_name: values.display_name,
        settings: values.settings,
      });
      message.success('租户更新成功');
      setEditModalOpen(false);
      loadTenants();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新租户失败：${error.message}`);
      } else {
        message.error('更新租户失败，请稍后重试');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTenant(id);
      message.success('租户已删除');
      loadTenants();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除租户失败：${error.message}`);
      } else {
        message.error('删除租户失败，请稍后重试');
      }
    }
  };

  const handleSwitchTenant = (tenantId: string) => {
    localStorage.setItem('tenant_id', tenantId);
    message.success(`已切换到租户 ${tenantId.slice(0, 8)}...`);
    onTenantSelect?.(tenantId);
    // Reload page to apply tenant context
    window.location.reload();
  };

  // P1-3 修复：加载租户用户列表
  const handleOpenUserModal = async (tenant: TenantEntity) => {
    setUserModalTenant(tenant);
    setUserModalOpen(true);
    setUsersLoading(true);
    try {
      const res = await getUsersByTenant(tenant.id);
      const body = (res.data as any)?.data ?? res.data;
      setUsers(Array.isArray(body) ? body : body?.users || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载用户列表失败：${error.message}`);
      } else {
        message.error('加载用户列表失败，请稍后重试');
      }
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TenantEntity) => (
        <Space>
          <Text strong>{record.display_name || name}</Text>
          {record.display_name && <Text type="secondary" code>{name}</Text>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          inactive: 'default',
          deleted: 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: TenantEntity) => (
        <Space>
          <Tooltip title="切换到此租户">
            <Button
              type="link"
              size="small"
              icon={<SwapOutlined />}
              onClick={() => handleSwitchTenant(record.id)}
            >
              切换
            </Button>
          </Tooltip>
          <Tooltip title="编辑租户">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingTenant(record);
                editForm.setFieldsValue(record);
                setEditModalOpen(true);
              }}
            >
              编辑
            </Button>
          </Tooltip>
          {/* P1-3 修复：添加用户管理入口 */}
          <Tooltip title="用户管理">
            <Button
              type="link"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => handleOpenUserModal(record)}
            >
              用户
            </Button>
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description={`确定要删除租户 "${record.name}" 吗？此操作将软删除该租户。`}
            onConfirm={() => handleDelete(record.id)}
            okText="确认删除"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BankOutlined style={{ marginRight: 12, color: '#3370E6' }} />
            租户管理
          </Title>
          <Text type="secondary">
            创建和管理租户，分配资源配额和 Namespace
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTenants} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建租户
          </Button>
        </Space>
      </div>

      {/* Tenant List */}
      <Card>
        <Table
          columns={columns}
          dataSource={tenants}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个租户`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无租户"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                  创建第一个租户
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create Tenant Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            创建租户
          </Space>
        }
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        width={700}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            autoAllocateNamespace: true,
            initialNamespaceCount: 1,
            maxPipelines: 100,
            maxPipelineRunsPerDay: 1000,
            maxConcurrentRuns: 10,
            maxRunners: 5,
            maxCpuCores: 16,
            maxMemoryGb: 32,
            maxStorageGb: 100,
            maxNamespaces: 10,
          }}
        >
          <Divider orientation="left">基本信息</Divider>
          <Form.Item
            label="租户标识"
            name="name"
            rules={[
              { required: true, message: '请输入租户标识' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
            ]}
            tooltip="租户的唯一标识，创建后不可修改"
          >
            <Input placeholder="例如：acme-corp" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="例如：ACME 公司" />
          </Form.Item>

          <Divider orientation="left">Namespace 分配</Divider>
          <Form.Item
            label="自动分配 Namespace"
            name="autoAllocateNamespace"
            valuePropName="checked"
            tooltip="创建租户时自动从池中分配 Namespace"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.autoAllocateNamespace !== curr.autoAllocateNamespace}
          >
            {({ getFieldValue }) =>
              getFieldValue('autoAllocateNamespace') && (
                <Form.Item label="初始 Namespace 数量" name="initialNamespaceCount">
                  <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>
              )
            }
          </Form.Item>

          <Divider orientation="left">
            <Space>
              资源配额
              <Tooltip title="租户可使用的资源上限，可随时修改">
                <InfoCircleOutlined style={{ color: colors.neutral[500] }} />
              </Tooltip>
            </Space>
          </Divider>
          <Form.Item name="customQuota" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="自定义配额" unCheckedChildren="使用默认配额" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.customQuota !== curr.customQuota}
          >
            {({ getFieldValue }) =>
              getFieldValue('customQuota') && (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大 Pipeline 数" name="maxPipelines">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="每日最大运行次数" name="maxPipelineRunsPerDay">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大并发运行数" name="maxConcurrentRuns">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大 Runner 数" name="maxRunners">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大 CPU 核心数" name="maxCpuCores">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大内存 (GB)" name="maxMemoryGb">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大存储 (GB)" name="maxStorageGb">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大 Namespace 数" name="maxNamespaces">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            编辑租户
          </Space>
        }
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingTenant(null);
        }}
        onOk={() => editForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="租户标识" name="name">
            <Input disabled />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="例如：ACME 公司" />
          </Form.Item>
          {/* P0-4 修复：移除后端不支持的 settings.notes 字段
          <Form.Item label="备注" name={['settings', 'notes']}>
            <Input.TextArea rows={3} placeholder="租户备注信息" />
          </Form.Item>
          */}
        </Form>
      </Modal>

      {/* P1-3 修复：用户管理 Modal */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            用户管理 - {userModalTenant?.display_name || userModalTenant?.name}
          </Space>
        }
        open={userModalOpen}
        onCancel={() => {
          setUserModalOpen(false);
          setUserModalTenant(null);
          setUsers([]);
        }}
        footer={[
          <Button key="close" onClick={() => setUserModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {usersLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : users.length === 0 ? (
          <Empty description="该租户暂无用户" />
        ) : (
          <Table
            dataSource={users}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '用户名',
                dataIndex: 'username',
                key: 'username',
                render: (val: string, record: User) => (
                  <Space>
                    <Text strong>{record.name || val}</Text>
                    {record.name && <Text type="secondary" code>{val}</Text>}
                  </Space>
                ),
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                key: 'email',
                render: (val: string | null) => val || '-',
              },
              {
                title: '角色',
                dataIndex: 'role',
                key: 'role',
                render: (val: string) => {
                  const roleMap: Record<string, string> = {
                    admin: '管理员',
                    member: '成员',
                    viewer: '查看者',
                  };
                  return <Tag>{roleMap[val] || val}</Tag>;
                },
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (val: string) => {
                  const colorMap: Record<string, string> = {
                    active: 'green',
                    inactive: 'default',
                    locked: 'red',
                  };
                  return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
                },
              },
              {
                title: '最后登录',
                dataIndex: 'last_login_at',
                key: 'last_login_at',
                render: (val: string | null) =>
                  val ? new Date(val).toLocaleString() : '未登录',
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default TenantListPage;
