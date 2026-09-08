/**
 * useGlobalParamsState.ts - 全局参数状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 201)
 */
import { useState, useEffect } from 'react';
import { Form, message, Modal } from 'antd';
import {
  getGlobalParams,
  createGlobalParam,
  updateGlobalParam,
  deleteGlobalParam,
  resolveGlobalParams,
  type GlobalParam,
  type CreateGlobalParamInput,
  type UpdateGlobalParamInput,
} from '@/api/global-params';

export interface GlobalParamFormValues {
  key: string;
  value: string;
  scope: string;
  description?: string;
  isSecret: boolean;
  expiresAt?: string;
}

export interface ResolveFormValues {
  keys: string;
}

export function useGlobalParamsState() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalParam[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GlobalParam | null>(null);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveResult, setResolveResult] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [form] = Form.useForm<GlobalParamFormValues>();
  const [resolveForm] = Form.useForm<ResolveFormValues>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getGlobalParams();
      setData(res.data || []);
    } catch {
      message.error('加载全局参数失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ scope: 'tenant', isSecret: false });
    setModalVisible(true);
  };

  const handleEdit = (record: GlobalParam) => {
    setEditingItem(record);
    form.setFieldsValue({
      key: record.key,
      value: record.value,
      description: record.description,
      isSecret: record.isSecret,
      scope: record.scope,
      expiresAt: record.expiresAt,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: GlobalParam) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除参数 "${record.key}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteGlobalParam(record.id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await updateGlobalParam(editingItem.id, values as UpdateGlobalParamInput);
        message.success('更新成功');
      } else {
        await createGlobalParam(values as CreateGlobalParamInput);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('保存参数失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const values = await resolveForm.validateFields();
      let keys: Record<string, string> = {};
      if (values.keys) {
        try {
          keys = typeof values.keys === 'string' ? JSON.parse(values.keys) : values.keys;
          if (typeof keys !== 'object' || Array.isArray(keys)) {
            message.error('Keys 必须是合法的 JSON 对象');
            return;
          }
          const keyCount = Object.keys(keys).length;
          if (keyCount > 100) {
            message.error('Keys 最多支持 100 个');
            return;
          }
          if (keyCount === 0) {
            message.error('Keys 不能为空');
            return;
          }
        } catch {
          message.error('Keys 必须是合法 JSON');
          return;
        }
      }
      const res = await resolveGlobalParams({ keys });
      setResolveResult(res.data || {});
      message.success('解析完成');
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('解析参数失败，请稍后重试');
    } finally {
      setResolving(false);
    }
  };

  const openResolve = () => {
    setResolveVisible(true);
    setResolveResult({});
    resolveForm.resetFields();
  };

  return {
    loading,
    data,
    modalVisible,
    setModalVisible,
    editingItem,
    resolveVisible,
    setResolveVisible,
    resolveResult,
    submitting,
    resolving,
    form,
    resolveForm,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleResolve,
    openResolve,
  };
}
