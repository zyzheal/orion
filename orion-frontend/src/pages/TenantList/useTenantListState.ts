/**
 * Tenant List 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { message, Form } from 'antd';
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getUsersByTenant,
  type TenantEntity,
  type CreateTenantRequest,
  type TenantUser,
} from '@/api/tenant';

interface TenantListPageProps {
  onTenantSelect?: (tenantId: string) => void;
}

export const useTenantListState = ({ onTenantSelect }: TenantListPageProps) => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTenant, setUserModalTenant] = useState<TenantEntity | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('enterprise');

  const loadTenants = useCallback(async () => {
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
      const bodyAny = body as Record<string, unknown>;
      const totalValue = bodyAny.total ?? bodyAny.totalPages;
      setTotal(totalValue ? (bodyAny.page as number) * ((bodyAny.limit as number) || 1) : 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载租户列表失败：${error.message}`);
      } else {
        message.error('加载租户列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const filteredTenants = useMemo(() => {
    let data = [...tenants];
    if (searchText) {
      const search = searchText.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          (t.display_name && t.display_name.toLowerCase().includes(search))
      );
    }
    if (statusFilter) {
      data = data.filter((t) => t.status === statusFilter);
    }
    return data;
  }, [tenants, searchText, statusFilter]);

  const handleCreate = useCallback(
    async (values: Record<string, unknown>) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const input: CreateTenantRequest = {
          name: values.name as string,
          display_name: values.display_name as string | undefined,
          settings: values.settings as Record<string, unknown> | undefined,
          autoAllocateNamespace: values.autoAllocateNamespace as boolean | undefined,
          initialNamespaceCount: (values.initialNamespaceCount as number | undefined) || 1,
          customQuota: values.customQuota
            ? {
                maxPipelines: values.maxPipelines as number | undefined,
                maxPipelineRunsPerDay: values.maxPipelineRunsPerDay as number | undefined,
                maxConcurrentRuns: values.maxConcurrentRuns as number | undefined,
                maxRunners: values.maxRunners as number | undefined,
                maxCpuCores: values.maxCpuCores as number | undefined,
                maxMemoryGb: values.maxMemoryGb as number | undefined,
                maxStorageGb: values.maxStorageGb as number | undefined,
                maxNamespaces: values.maxNamespaces as number | undefined,
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
        const err = error as {
          response?: { status?: number; data?: { message?: string } };
        };
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
        setSubmitting(false);
      }
    },
    [submitting, createForm, loadTenants]
  );

  const handleEdit = useCallback(
    async (values: Record<string, unknown>) => {
      if (!editingTenant) return;
      try {
        const input: Partial<CreateTenantRequest> = {
          name: values.name as string,
          display_name: values.display_name as string | undefined,
          settings: values.settings as Record<string, unknown> | undefined,
        };
        if (values.maxPipelines !== undefined) {
          input.customQuota = {
            maxPipelines: values.maxPipelines as number | undefined,
            maxPipelineRunsPerDay: values.maxPipelineRunsPerDay as number | undefined,
            maxConcurrentRuns: values.maxConcurrentRuns as number | undefined,
            maxRunners: values.maxRunners as number | undefined,
            maxCpuCores: values.maxCpuCores as number | undefined,
            maxMemoryGb: values.maxMemoryGb as number | undefined,
            maxStorageGb: values.maxStorageGb as number | undefined,
            maxNamespaces: values.maxNamespaces as number | undefined,
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
    },
    [editingTenant, loadTenants]
  );

  const handleDelete = useCallback(
    async (id: string) => {
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
    },
    [loadTenants]
  );

  const handleSwitchTenant = useCallback(
    (tenantId: string) => {
      localStorage.setItem('tenant_id', tenantId);
      message.success(`已切换到租户 ${tenantId.slice(0, 8)}...`);
      onTenantSelect?.(tenantId);
      window.location.reload();
    },
    [onTenantSelect]
  );

  const handleExportCSV = useCallback(() => {
    const exportData = searchText || statusFilter ? filteredTenants : tenants;

    if (exportData.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    const headers = ['租户名称', '显示名称', '状态', '创建时间'];
    const rows = exportData.map((t) => [
      t.name,
      t.display_name || '',
      t.status,
      t.created_at ? new Date(t.created_at).toLocaleString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const bom = '﻿';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `租户列表_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    message.success(`已导出 ${exportData.length} 条租户数据`);
  }, [filteredTenants, tenants, searchText, statusFilter]);

  const handleBatchDelete = useCallback(async () => {
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
  }, [selectedRowKeys, loadTenants]);

  const handleOpenUserModal = useCallback(async (tenant: TenantEntity) => {
    setUserModalTenant(tenant);
    setUserModalOpen(true);
    setUsersLoading(true);
    try {
      const res = await getUsersByTenant(tenant.id);
      const body = (res.data as { users?: TenantUser[] }) ?? res.data;
      setUsers(body.users || []);
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
  }, []);

  const handleOpenEditModal = useCallback(
    (record: TenantEntity) => {
      setEditingTenant(record);
      editForm.setFieldsValue(record);
      setEditModalOpen(true);
    },
    [editForm]
  );

  return {
    // state
    loading,
    tenants,
    setTenants,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    createModalOpen,
    setCreateModalOpen,
    editModalOpen,
    setEditModalOpen,
    editingTenant,
    setEditingTenant,
    submitting,
    createForm,
    editForm,
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    selectedRowKeys,
    setSelectedRowKeys,
    batchDeleting,
    userModalOpen,
    setUserModalOpen,
    userModalTenant,
    setUserModalTenant,
    users,
    setUsers,
    usersLoading,
    selectedTemplate,
    setSelectedTemplate,
    filteredTenants,
    // callbacks
    loadTenants,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSwitchTenant,
    handleExportCSV,
    handleBatchDelete,
    handleOpenUserModal,
    handleOpenEditModal,
  };
};

export type TenantListState = ReturnType<typeof useTenantListState>;
