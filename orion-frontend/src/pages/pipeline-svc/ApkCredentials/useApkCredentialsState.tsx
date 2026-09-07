/**
 * ApkCredentials state hook
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import {
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  type Secret,
  type SecretScope,
  type CreateSecretInput,
} from '@/api/secrets';
import { useAuthStore } from '@/stores/authStore';
import { getMarketName, getSecretName, MARKET_OPTIONS } from './constants';
import type { CredentialRecord, EditingCredential } from './types';

export const useApkCredentialsState = () => {
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCredential, setEditingCredential] = useState<EditingCredential | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('huawei');
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();
  const tenantId = useAuthStore((state) => (state.user as any).tenantId) || 'default-tenant';

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSecrets(tenantId);
      const data = response.data;
      const allSecrets: Secret[] = Array.isArray(data) ? data : [];

      const apkSecrets = allSecrets
        .filter((s) => s.name.startsWith('apk-') && s.name.endsWith('-credentials'))
        .map((s) => {
          const market = s.name.replace('apk-', '').replace('-credentials', '');
          return {
            id: s.id,
            market,
            name: s.name,
            description: s.description,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          } as CredentialRecord;
        });

      setCredentials(apkSecrets);
    } catch (error: unknown) {
      message.error(`加载凭证失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const secretName = getSecretName(selectedMarket);
      const existing = credentials.find((c) => c.market === selectedMarket);

      if (existing) {
        message.warning('该市场的凭证已存在，请使用编辑功能更新');
        setSubmitting(false);
        return;
      }

      const credentialsJson = JSON.stringify(values, null, 0);
      const input: CreateSecretInput = {
        name: secretName,
        value: credentialsJson,
        scope: 'project' as SecretScope,
        description: `${getMarketName(selectedMarket)} 上传凭证`,
      };

      await createSecret(tenantId, input);
      message.success('凭证保存成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadCredentials();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [form, credentials, selectedMarket, tenantId, loadCredentials]);

  const handleUpdate = useCallback(async () => {
    if (!editingCredential) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const credentialsJson = JSON.stringify(values, null, 0);

      await updateSecret(tenantId, editingCredential.id, {
        value: credentialsJson,
        description: `${getMarketName(editingCredential.market)} 上传凭证`,
      });

      message.success('凭证更新成功');
      setEditModalVisible(false);
      setEditingCredential(null);
      form.resetFields();
      loadCredentials();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [form, editingCredential, tenantId, loadCredentials]);

  const handleDelete = useCallback(
    async (id: string, market: string) => {
      try {
        await deleteSecret(tenantId, id);
        message.success(`已删除 ${getMarketName(market)} 的凭证`);
        loadCredentials();
      } catch (error: unknown) {
        message.error(`删除失败: ${(error as Error).message}`);
      }
    },
    [tenantId, loadCredentials]
  );

  const openCreateModal = useCallback(
    (market?: string) => {
      setSelectedMarket(market || 'huawei');
      form.resetFields();
      setCreateModalVisible(true);
    },
    [form]
  );

  const openEditModal = useCallback(
    (record: EditingCredential) => {
      setEditingCredential(record);
      setSelectedMarket(record.market);
      form.resetFields();
      // Note: Can't pre-fill values since they're encrypted - user must re-enter
      setEditModalVisible(true);
    },
    [form]
  );

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingCredential(null);
    form.resetFields();
  }, [form]);

  const configuredMarkets = useMemo(() => credentials.map((c) => c.market), [credentials]);
  const unconfiguredMarkets = useMemo(
    () => MARKET_OPTIONS.filter((m) => !configuredMarkets.includes(m.value)),
    [configuredMarkets]
  );

  return {
    loading,
    credentials,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    closeEditModal,
    editingCredential,
    selectedMarket,
    setSelectedMarket,
    submitting,
    form,
    loadCredentials,
    handleCreate,
    handleUpdate,
    handleDelete,
    openCreateModal,
    openEditModal,
    configuredMarkets,
    unconfiguredMarkets,
  };
};

export type ApkCredentialsState = ReturnType<typeof useApkCredentialsState>;
