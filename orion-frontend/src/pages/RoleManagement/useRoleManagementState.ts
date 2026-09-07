/**
 * Role Management state hook
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { getRoles, createRole, deleteRole, type Role, type CreateRoleInput } from '@/api/roles';
import { DEFAULT_TENANT_ID } from './constants';

export function useRoleManagementState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const {
    data: roles = [] as Role[],
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await getRoles(DEFAULT_TENANT_ID);
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (!isError) return;
    if (error instanceof Error) {
      message.error(`加载角色列表失败：${error.message}`);
    } else {
      message.error('加载角色列表失败，请稍后重试');
    }
  }, [isError, error]);

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

  const openCreateModal = () => {
    createForm.resetFields();
    setCreateModalVisible(true);
  };

  const isInitialLoading = loading && roles.length === 0;

  return {
    searchQuery,
    setSearchQuery,
    createModalVisible,
    setCreateModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedRole,
    setSelectedRole,
    createForm,
    submitting,
    setSubmitting,
    roles,
    loading,
    loadData,
    filteredData,
    handleCreate,
    handleDelete,
    openDetail,
    openCreateModal,
    isInitialLoading,
  };
}
