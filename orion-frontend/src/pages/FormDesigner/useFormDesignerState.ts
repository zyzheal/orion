/**
 * FormDesigner state hook
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message, Modal } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { listForms, createForm, updateForm, deleteForm } from '@/api/lowcode';
import { listConditions, createCondition, updateCondition, deleteCondition } from './api';
import type { FormSchema, ConditionRule } from './types';

export function useFormDesignerState() {
  const [activeTab, setActiveTab] = useState<'forms' | 'conditions'>('forms');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSchema, setPreviewSchema] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // ---- 数据加载 ----
  const {
    data: forms,
    isLoading: formsLoading,
    isError: formsError,
    error: formsQueryError,
    refetch: refetchForms,
  } = useQuery<FormSchema[]>({
    queryKey: ['lowcode-forms'],
    queryFn: async () => {
      const data = await listForms();
      const list = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && 'data' in data
          ? ((data as { data: FormSchema[] }).data ?? [])
          : [];
      return list as FormSchema[];
    },
    staleTime: 30_000,
  });

  const {
    data: conditions,
    isLoading: conditionsLoading,
    isError: conditionsError,
    error: conditionsQueryError,
    refetch: refetchConditions,
  } = useQuery<ConditionRule[]>({
    queryKey: ['lowcode-conditions'],
    queryFn: async () => {
      const res = await listConditions();
      return Array.isArray(res) ? res : ((res as { data?: ConditionRule[] }).data ?? []);
    },
    staleTime: 30_000,
  });

  const loading = activeTab === 'forms' ? formsLoading : conditionsLoading;

  useEffect(() => {
    if (formsError)
      message.error(formsQueryError instanceof Error ? formsQueryError.message : '加载表单失败');
  }, [formsError, formsQueryError]);

  useEffect(() => {
    if (conditionsError)
      message.error(
        conditionsQueryError instanceof Error ? conditionsQueryError.message : '加载条件失败',
      );
  }, [conditionsError, conditionsQueryError]);

  const fetchData = useCallback(() => {
    if (activeTab === 'forms') return refetchForms();
    return refetchConditions();
  }, [activeTab, refetchForms, refetchConditions]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (activeTab === 'forms') {
            await deleteForm(id);
          } else {
            await deleteCondition(id);
          }
          message.success('删除成功');
          fetchData();
        } catch (err: any) {
          message.error(err?.message || '删除失败');
        }
      },
    });
  };

  const handlePreview = (schema: Record<string, any>) => {
    setPreviewSchema(JSON.stringify(schema, null, 2));
    setPreviewOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      let schemaObj = values.schema;
      if (typeof schemaObj === 'string') {
        try {
          schemaObj = JSON.parse(schemaObj);
        } catch {
          message.error('Schema 格式无效，请输入合法的 JSON');
          return;
        }
      }

      if (editingItem) {
        if (activeTab === 'forms') {
          await updateForm(editingItem.id, { ...values, schema: schemaObj });
        } else {
          await updateCondition(editingItem.id, values);
        }
        message.success('更新成功');
      } else {
        if (activeTab === 'forms') {
          await createForm({ ...values, schema: schemaObj });
        } else {
          await createCondition(values);
        }
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const e = err as Error;
      if (e?.message) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activeTab, setActiveTab,
    modalOpen, setModalOpen,
    previewOpen, setPreviewOpen,
    previewSchema,
    editingItem, setEditingItem,
    submitting,
    form,
    forms, conditions,
    formsLoading, conditionsLoading,
    loading,
    handleCreate, handleEdit, handleDelete, handlePreview, handleSubmit,
    fetchData,
  };
}
