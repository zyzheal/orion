/**
 * Tenant List Page
 * Admin view: create, manage, and switch between tenants
 */
// P2 修复: 添加批量操作和搜索筛选功能
import React, { useState, useEffect, useMemo } from 'react';
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
  Select,
  message,
  Tooltip,
  Popconfirm,
  Tabs,
  Divider,
  Empty,
  Row,
  Col,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  BankOutlined,
  TeamOutlined,
  SettingOutlined,
  DownloadOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  type TenantEntity,
  type CreateTenantRequest,
} from '@/api/tenant';
import { getUsersByTenant, type TenantUser } from '@/api/tenant';
import { TenantListModals } from './TenantListModals';

const { Title, Text } = Typography;

interface TenantListPageProps {
  onTenantSelect?: (tenantId: string) => void;
}

// P2-5 修复: 预设模板配置
interface QuotaTemplate {
  name: string;
  label: string;
  quota: {
    maxPipelines: number;
    maxPipelineRunsPerDay: number;
    maxConcurrentRuns: number;
    maxRunners: number;
    maxCpuCores: number;
    maxMemoryGb: number;
    maxStorageGb: number;
    maxNamespaces: number;
  };
}

const QUOTA_TEMPLATES: QuotaTemplate[] = [
  {
    name: 'startup',
    label: '初创团队',
    quota: {
      maxPipelines: 50,
      maxPipelineRunsPerDay: 500,
      maxConcurrentRuns: 5,
      maxRunners: 2,
      maxCpuCores: 8,
      maxMemoryGb: 16,
      maxStorageGb: 50,
      maxNamespaces: 5,
    },
  },
  {
    name: 'enterprise',
    label: '企业标准',
    quota: {
      maxPipelines: 100,
      maxPipelineRunsPerDay: 1000,
      maxConcurrentRuns: 10,
      maxRunners: 5,
      maxCpuCores: 16,
      maxMemoryGb: 32,
      maxStorageGb: 100,
      maxNamespaces: 10,
    },
  },
  {
    name: 'saas',
    label: 'SaaS 客户',
    quota: {
      maxPipelines: 500,
      maxPipelineRunsPerDay: 5000,
      maxConcurrentRuns: 50,
      maxRunners: 20,
      maxCpuCores: 64,
      maxMemoryGb: 128,
      maxStorageGb: 500,
      maxNamespaces: 50,
    },
  },
];

// P2 修复: 搜索筛选和批量操作状态
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
  // P2 修复: 搜索和筛选状态
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // P2 修复: 批量选择状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // P1-3 修复：用户管理相关状态
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTenant, setUserModalTenant] = useState<TenantEntity | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // P2-5 修复: 模板选择状态
  const [selectedTemplate, setSelectedTemplate] = useState<string>('enterprise');

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await listTenants(page, pageSize);
      const body =
        (res.data as {
          data?:
            | TenantEntity[]
            | { data?: TenantEntity[]; total?: number; page?: number; limit?: number };
        }) ?? res.data;
      setTenants((body?.data || body || []) as TenantEntity[]);
      setTotal(
        ((body as any)?.total ?? (body as any)?.totalPages)
          ? (body as any).page * ((body as any).limit || 1)
          : 0
      );
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
        customQuota: values.customQuota
          ? {
              maxPipelines: values.maxPipelines,
              maxPipelineRunsPerDay: values.maxPipelineRunsPerDay,
              maxConcurrentRuns: values.maxConcurrentRuns,
              maxRunners: values.maxRunners,
              maxCpuCores: values.maxCpuCores,
              maxMemoryGb: values.maxMemoryGb,
              maxStorageGb: values.maxStorageGb,
              maxNamespaces: values.maxNamespaces,
            }
          : undefined,
      };

      const res = await createTenant(input);
      const body =
        (res.data as { message?: string; allocatedNamespaces?: { id: string }[] }) ?? res.data;
      message.success(body.message || '租户创建成功');

      if (body.allocatedNamespaces && body.allocatedNamespaces.length > 0) {
        message.success(`已分配 ${body.allocatedNamespaces.length} 个 Namespace`);
      }

      setCreateModalOpen(false);
      createForm.resetFields();
      loadTenants();
    } catch (error: unknown) {
      // P0-5 修复：创建时 name 重复无明确反馈
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 400) {
        if (
          err.response.data?.message?.includes('unique') ||
          err.response.data?.message?.includes('already exist')
        ) {
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

  // P1-1 修复：更新租户时同时更新配额信息
  const handleEdit = async (values: any) => {
    if (!editingTenant) return;
    try {
      const input: Partial<CreateTenantRequest> = {
        name: values.name,
        display_name: values.display_name,
        settings: values.settings,
      };
      // P1-1 修复：包含自定义配额
      if (values.maxPipelines !== undefined) {
        input.customQuota = {
          maxPipelines: values.maxPipelines,
          maxPipelineRunsPerDay: values.maxPipelineRunsPerDay,
          maxConcurrentRuns: values.maxConcurrentRuns,
          maxRunners: values.maxRunners,
          maxCpuCores: values.maxCpuCores,
          maxMemoryGb: values.maxMemoryGb,
          maxStorageGb: values.maxStorageGb,
          maxNamespaces: values.maxNamespaces,
        };
      }
      await updateTenant(editingTenant.id, input);
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

  // P2-3 修复: 导出 CSV 功能
  const handleExportCSV = () => {
    // 使用过滤后的数据，如果没有过滤则使用全部数据
    const exportData = searchText || statusFilter ? filteredTenants : tenants;

    if (exportData.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    // CSV 表头
    const headers = ['租户名称', '显示名称', '状态', '创建时间'];
    // CSV 数据行
    const rows = exportData.map((t) => [
      t.name,
      t.display_name || '',
      t.status,
      t.created_at ? new Date(t.created_at).toLocaleString() : '',
    ]);

    // 构建 CSV 内容
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // 创建 Blob 并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `租户列表_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`已导出 ${exportData.length} 条租户数据`);
  };

  // P2 修复: 过滤后的数据 (本地搜索和状态筛选)
  const filteredTenants = useMemo(() => {
    let data = [...tenants];
    // 按名称/显示名称搜索
    if (searchText) {
      const search = searchText.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          (t.display_name && t.display_name.toLowerCase().includes(search))
      );
    }
    // 按状态筛选
    if (statusFilter) {
      data = data.filter((t) => t.status === statusFilter);
    }
    return data;
  }, [tenants, searchText, statusFilter]);

  // P2 修复: 批量删除处理
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setBatchDeleting(true);
    try {
      let successCount = 0;
      for (const id of selectedRowKeys) {
        await deleteTenant(id as string);
        successCount++;
      }
      message.success(`成功删除 ${successCount} 个租户`);
      setSelectedRowKeys([]);
      loadTenants();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`批量删除失败：${error.message}`);
      } else {
        message.error('批量删除失败，请稍后重试');
      }
    } finally {
      setBatchDeleting(false);
    }
  };

  // P1-3 修复：加载租户用户列表
  const handleOpenUserModal = async (tenant: TenantEntity) => {
    setUserModalTenant(tenant);
    setUserModalOpen(true);
    setUsersLoading(true);
    try {
      const res = await getUsersByTenant(tenant.id);
      const body =
        (res.data as {
          data?:
            | TenantEntity[]
            | { data?: TenantEntity[]; total?: number; page?: number; limit?: number };
        }) ?? res.data;
      setUsers(Array.isArray(body) ? body : (body as any)?.users || []);
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
          {record.display_name && (
            <Text type="secondary" code>
              {name}
            </Text>
          )}
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
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BankOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            租户管理
          </Title>
          <Text type="secondary">创建和管理租户，分配资源配额和 Namespace</Text>
        </div>
        <Space>
          {/* P2 修复: 批量删除按钮 - 有选中项时显示 */}
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowKeys.length} 个租户吗？此操作将软删除这些租户。`}
              onConfirm={handleBatchDelete}
              okText="确认删除"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} loading={batchDeleting}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadTenants} loading={loading}>
            刷新
          </Button>
          {/* P2-3 修复: 导出 CSV 按钮 */}
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            导出 CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建租户
          </Button>
        </Space>
      </div>

      {/* P2 修复: 搜索和筛选区域 */}
      <Card style={{ marginBottom: spacing.md }}>
        <Row gutter={16} align="middle">
          <Col>
            <Input.Search
              placeholder="搜索租户名称/显示名称"
              allowClear
              style={{ width: 250 }}
              onSearch={(value) => setSearchText(value)}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col>
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 150 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: 'active', value: 'active' },
                { label: 'inactive', value: 'inactive' },
                { label: 'deleted', value: 'deleted' },
              ]}
            />
          </Col>
          <Col>
            <Text type="secondary">
              {filteredTenants.length !== tenants.length
                ? `筛选结果: ${filteredTenants.length} / ${tenants.length} 个租户`
                : `共 ${tenants.length} 个租户`}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Tenant List */}
      <Card>
        <Table
          // P2 修复: 使用过滤后的数据
          dataSource={searchText || statusFilter ? filteredTenants : tenants}
          loading={loading}
          rowKey="id"
          // P2 修复: 批量选择功能
          rowSelection={{
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            current: page,
            pageSize,
            total: searchText || statusFilter ? filteredTenants.length : total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个租户`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={columns}
          locale={{
            emptyText: (
              <Empty description="暂无租户" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  创建第一个租户
                </Button>
              </Empty>
            ),
          }}
        />
      </Card>

      <TenantListModals
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        editingTenant={editingTenant}
        setEditingTenant={setEditingTenant}
        submitting={submitting}
        createForm={createForm}
        editForm={editForm}
        handleCreate={handleCreate}
        handleEdit={handleEdit}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        userModalOpen={userModalOpen}
        setUserModalOpen={setUserModalOpen}
        userModalTenant={userModalTenant}
        users={users}
        usersLoading={usersLoading}
        QUOTA_TEMPLATES={QUOTA_TEMPLATES}
      />
    </div>
  );
};

export default TenantListPage;
