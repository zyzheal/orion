/**
 * useSecretsManagementState - SecretsManagement 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import {
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  type Secret,
  type SecretScope,
  type CreateSecretInput,
  type UpdateSecretInput,
} from '@/api/secrets';

// Tenant ID — in a real app this comes from auth store or context
const TENANT_ID = 'default-tenant';

export const useSecretsManagementState = () => {
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [confirmEditVisible, setConfirmEditVisible] = useState(false);

  // Form instances
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const response = await getSecrets(TENANT_ID);
      const data = response.data;
      setSecrets(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      message.error(`加载 Secret 列表失败: ${(error as Error).message}`);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  const filteredSecrets = useMemo(() => {
    return secrets.filter((secret) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !secret.name.toLowerCase().includes(query) &&
          !(secret.description && secret.description.toLowerCase().includes(query))
        ) {
          return false;
        }
      }
      const scopeFilter = filters.scope;
      if (scopeFilter && scopeFilter !== 'all' && secret.scope !== scopeFilter) {
        return false;
      }
      return true;
    });
  }, [searchQuery, filters, secrets]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);

      const payload: CreateSecretInput = {
        name: values.name.trim(),
        value: values.value,
        scope: values.scope as SecretScope,
        description: values.description?.trim() || undefined,
      };

      await createSecret(TENANT_ID, payload);
      message.success('Secret 创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadSecrets();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (record: Secret) => {
    setEditingSecret(record);
    editForm.resetFields();
    editForm.setFieldsValue({
      description: record.description || '',
    });
    setConfirmEditVisible(true);
  };

  const handleEditConfirm = () => {
    setConfirmEditVisible(false);
    setEditModalVisible(true);
  };

  const handleEdit = async () => {
    if (!editingSecret) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);

      const payload: UpdateSecretInput = { value: '' };
      if (values.value) {
        payload.value = values.value;
      }
      if (values.description !== undefined) {
        payload.description = values.description.trim() || undefined;
      }

      if (!payload.value && payload.description === undefined) {
        message.warning('请至少输入新的 Secret 值或描述');
        return;
      }

      await updateSecret(TENANT_ID, editingSecret.id, payload);
      message.success('Secret 更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setEditingSecret(null);
      await loadSecrets();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSecret(TENANT_ID, id);
      message.success('Secret 已删除');
      await loadSecrets();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const openCreate = () => {
    createForm.resetFields();
    setCreateModalVisible(true);
  };

  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'scope',
        label: '作用域',
        options: [
          { label: '全部', value: 'all' },
          { label: '组织 (org)', value: 'org' },
          { label: '环境 (environment)', value: 'environment' },
          { label: '项目 (project)', value: 'project' },
        ],
      },
    ],
    []
  );

  return {
    loading,
    secrets,
    searchQuery,
    filters,
    createModalVisible,
    editModalVisible,
    editingSecret,
    confirmEditVisible,
    createForm,
    editForm,
    submitting,
    filteredSecrets,
    filterDefs,
    loadSecrets,
    handleCreate,
    openEdit,
    handleEditConfirm,
    handleEdit,
    handleDelete,
    openCreate,
    setSearchQuery,
    setFilters,
    setCreateModalVisible,
    setEditModalVisible,
    setConfirmEditVisible,
    setEditingSecret,
  };
};

export type SecretsManagementState = ReturnType<typeof useSecretsManagementState>;
