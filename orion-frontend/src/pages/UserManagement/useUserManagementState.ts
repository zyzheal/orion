/**
 * useUserManagementState.ts - 用户管理状态钩子
 * 抽取自 UserManagement/index.tsx (P2-9 Phase 97)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message } from 'antd';
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

export const useUserManagementState = () => {
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

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      inactive: users.filter((u) => u.status !== 'active').length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users]
  );

  const isInitialLoading = loading && users.length === 0;

  return {
    // State
    loading,
    users,
    setUsers,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editingUser,
    setEditingUser,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedUser,
    setSelectedUser,
    changePwModalVisible,
    setChangePwModalVisible,
    submitting,
    setSubmitting,
    // Forms
    createForm,
    editForm,
    changePwForm,
    // Data
    filteredData,
    stats,
    isInitialLoading,
    // Actions
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleEnable,
    handleDisable,
    handleChangePassword,
    openEdit,
    openDetail,
  };
};

export type UserManagementState = ReturnType<typeof useUserManagementState>;
