/**
 * useEnvironmentState.ts - 环境管理状态 Hook
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import { useState, useEffect, useMemo } from 'react';
import { message, Form } from 'antd';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  updateEnvironmentStatus,
  type Environment,
  type CreateEnvironmentInput,
  type UpdateEnvironmentInput,
  type EnvironmentStatus,
} from '@/api/environments';

const parseConfig = (raw?: string) => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const useEnvironmentState = () => {
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getEnvironments();
      setEnvironments(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setEnvironments([]);
      message.error(`加载环境列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredData = useMemo(() => {
    return environments.filter((env) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !env.name.toLowerCase().includes(q) &&
          !(env.cluster && env.cluster.toLowerCase().includes(q)) &&
          !(env.namespace && env.namespace.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.type && filters.type !== 'all' && env.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && env.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, environments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: CreateEnvironmentInput = {
        projectId: values.projectId,
        name: values.name,
        type: values.type,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: parseConfig(values.config),
      };
      await createEnvironment(payload);
      message.success('环境创建成功');
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
    if (!editingEnv) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const payload: UpdateEnvironmentInput = {
        name: values.name || undefined,
        type: values.type || undefined,
        cluster: values.cluster || undefined,
        namespace: values.namespace || undefined,
        config: parseConfig(values.config),
      };
      await updateEnvironment(editingEnv.id, payload);
      message.success('环境更新成功');
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
      await deleteEnvironment(id);
      message.success('环境已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const handleStatusChange = async (id: string, status: EnvironmentStatus) => {
    try {
      await updateEnvironmentStatus(id, { status });
      message.success('状态更新成功');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`状态更新失败：${error.message}`);
      } else {
        message.error('状态更新失败');
      }
    }
  };

  const openEdit = (env: Environment) => {
    setEditingEnv(env);
    editForm.setFieldsValue({
      name: env.name,
      type: env.type,
      cluster: env.cluster,
      namespace: env.namespace,
      config: env.config ? JSON.stringify(env.config, null, 2) : undefined,
    });
    setEditModalVisible(true);
  };

  const openDetail = (env: Environment) => {
    setSelectedEnv(env);
    setDetailDrawerVisible(true);
  };

  return {
    loading,
    environments,
    setSearchQuery,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedEnv,
    createForm,
    editForm,
    submitting,
    filteredData,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleStatusChange,
    openEdit,
    openDetail,
  };
};
