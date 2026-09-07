/**
 * useEnvProfilesState hook
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { useEffect, useState } from 'react';
import { Modal, Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getEnvProfiles,
  createEnvProfile,
  updateEnvProfile,
  deleteEnvProfile,
  getEnvironmentsForProfile,
  resolveEnvVariables,
  type EnvProfile,
  type CreateEnvProfileInput,
  type UpdateEnvProfileInput,
} from '@/api/env-profiles';

export function useEnvProfilesState() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EnvProfile | null>(null);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveResult, setResolveResult] = useState<Record<string, string>>({});
  const [selectedProfile, setSelectedProfile] = useState<EnvProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [resolveForm] = Form.useForm();

  const {
    data,
    isLoading: loading,
    error: queryError,
    isError,
    refetch: loadData,
  } = useQuery<EnvProfile[]>({
    queryKey: ['env-profiles'],
    queryFn: async () => {
      const res = await getEnvProfiles();
      return res.data || [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isError) message.error(queryError instanceof Error ? queryError.message : '加载环境配置失败');
  }, [isError, queryError]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: EnvProfile) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      environment: record.environment,
      variables: JSON.stringify(record.variables, null, 2),
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: EnvProfile) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除配置 "${record.name}/${record.environment}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEnvProfile(record.id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewEnvironments = async (record: EnvProfile) => {
    setSelectedProfile(record);
    setEnvError(null);
    setEnvLoading(true);
    try {
      const res = await getEnvironmentsForProfile(record.name);
      setEnvironments(res.data || []);
    } catch {
      setEnvError('加载环境列表失败');
    } finally {
      setEnvLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      let variables: Record<string, string> = {};
      if (values.variables) {
        try {
          variables =
            typeof values.variables === 'string' ? JSON.parse(values.variables) : values.variables;
          if (typeof variables !== 'object' || Array.isArray(variables)) {
            message.error('Variables 必须是合法 JSON 对象');
            return;
          }
          const varCount = Object.keys(variables).length;
          if (varCount > 200) {
            message.error('Variables 最多支持 200 个键');
            return;
          }
        } catch {
          message.error('Variables 必须是合法 JSON');
          return;
        }
      }
      if (editingItem) {
        await updateEnvProfile(editingItem.id, { ...values, variables } as UpdateEnvProfileInput);
        message.success('更新成功');
      } else {
        await createEnvProfile({ ...values, variables } as CreateEnvProfileInput);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('保存环境配置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedProfile) return;
    setResolving(true);
    try {
      const values = await resolveForm.validateFields();
      let overrides: Record<string, string> | undefined;
      if (values.overrides) {
        try {
          overrides =
            typeof values.overrides === 'string' ? JSON.parse(values.overrides) : values.overrides;
          if (typeof overrides !== 'object' || Array.isArray(overrides)) {
            message.error('Overrides 必须是合法 JSON 对象');
            return;
          }
        } catch {
          message.error('Overrides 必须是合法 JSON');
          return;
        }
      }
      const res = await resolveEnvVariables({
        name: selectedProfile.name,
        environment: selectedProfile.environment,
        overrides,
      });
      setResolveResult(res.data || {});
      message.success('解析完成');
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('解析变量失败，请稍后重试');
    } finally {
      setResolving(false);
    }
  };

  const handleResolveOpen = (record: EnvProfile) => {
    setSelectedProfile(record);
    setResolveVisible(true);
    setResolveResult({});
    resolveForm.resetFields();
  };

  return {
    data,
    loading,
    loadData,
    modalVisible,
    setModalVisible,
    editingItem,
    resolveVisible,
    setResolveVisible,
    resolveResult,
    selectedProfile,
    setSelectedProfile,
    submitting,
    resolving,
    environments,
    envLoading,
    envError,
    form,
    resolveForm,
    handleCreate,
    handleEdit,
    handleDelete,
    handleViewEnvironments,
    handleSubmit,
    handleResolve,
    handleResolveOpen,
  };
}
