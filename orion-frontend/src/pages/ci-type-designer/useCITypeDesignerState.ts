/**
 * CI 类型设计器 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
import { useState, useCallback, useEffect } from 'react';
import { message, Form } from 'antd';
import {
  listCITypes,
  getCIType,
  createCIType,
  updateCIType,
  deleteCIType,
  getCITypeAttributes,
  setCITypeAttributes,
  getCITypeVersions,
  createCITypeVersion,
  rollbackCIType,
  type CIType,
  type CIAttribute,
  type CITypeVersion,
} from '@/api/ci-types';

export const useCITypeDesignerState = () => {
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<CIType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CIType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CIType | null>(null);
  const [attributes, setAttributes] = useState<CIAttribute[]>([]);
  const [versions, setVersions] = useState<CITypeVersion[]>([]);
  const [detailTab, setDetailTab] = useState('attributes');
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [attrForm] = Form.useForm();
  const [form] = Form.useForm();

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCITypes();
      const body = res.data as unknown;
      const items = Array.isArray(body) ? body : (body as { data?: CIType[] })?.data ?? [];
      setTypes(items);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 CI 类型失败');
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleCreate = useCallback(() => {
    setEditingType(null);
    form.resetFields();
    setModalOpen(true);
  }, [form]);

  const handleEdit = useCallback(
    async (record: CIType) => {
      setEditingType(record);
      try {
        const res = await getCIType(record.id);
        const detail = res.data as CIType;
        form.setFieldsValue({
          name: detail.name,
          displayName: detail.displayName,
          description: detail.description,
          icon: detail.icon,
          category: detail.category,
          enabled: detail.enabled,
        });
      } catch {
        form.setFieldsValue({
          name: record.name,
          displayName: record.displayName,
          description: record.description,
          enabled: record.enabled,
        });
      }
      setModalOpen(true);
    },
    [form]
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingType) {
        await updateCIType(editingType.id, values);
        message.success('更新 CI 类型成功');
      } else {
        await createCIType(values);
        message.success('创建 CI 类型成功');
      }
      setModalOpen(false);
      loadTypes();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, editingType, loadTypes]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCIType(id);
        message.success('删除成功');
        loadTypes();
      } catch (error: unknown) {
        message.error(error instanceof Error ? error.message : '删除失败');
      }
    },
    [loadTypes]
  );

  const loadAttributes = useCallback(async (typeId: string) => {
    try {
      const res = await getCITypeAttributes(typeId);
      const body = res.data as unknown;
      setAttributes(Array.isArray(body) ? body : (body as { data?: CIAttribute[] })?.data ?? []);
    } catch {
      message.error('加载属性列表失败');
      setAttributes([]);
    }
  }, []);

  const loadVersions = useCallback(async (typeId: string) => {
    try {
      const res = await getCITypeVersions(typeId);
      const body = res.data as unknown;
      setVersions(Array.isArray(body) ? body : (body as { data?: CITypeVersion[] })?.data ?? []);
    } catch {
      message.error('加载版本列表失败');
      setVersions([]);
    }
  }, []);

  const handleViewDetail = useCallback(
    async (record: CIType) => {
      setSelectedType(record);
      setDetailOpen(true);
      setDetailTab('attributes');
      loadAttributes(record.id);
      loadVersions(record.id);
    },
    [loadAttributes, loadVersions]
  );

  const handleSaveAttributes = useCallback(async () => {
    if (!selectedType) return;
    try {
      const values = await attrForm.validateFields();
      await setCITypeAttributes(selectedType.id, values.attributes || []);
      message.success('保存属性成功');
      setAttrModalOpen(false);
      loadAttributes(selectedType.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  }, [attrForm, selectedType, loadAttributes]);

  const handleCreateVersion = useCallback(async () => {
    if (!selectedType) return;
    try {
      await createCITypeVersion(selectedType.id);
      message.success('创建版本快照成功');
      loadVersions(selectedType.id);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建版本快照失败');
    }
  }, [selectedType, loadVersions]);

  const handleRollback = useCallback(
    async (versionId: string) => {
      if (!selectedType) return;
      try {
        await rollbackCIType(selectedType.id, versionId);
        message.success('回滚成功');
        loadTypes();
        loadAttributes(selectedType.id);
        loadVersions(selectedType.id);
      } catch (error: unknown) {
        message.error(error instanceof Error ? error.message : '回滚失败');
      }
    },
    [selectedType, loadTypes, loadAttributes, loadVersions]
  );

  return {
    // state
    loading,
    types,
    modalOpen,
    setModalOpen,
    editingType,
    setEditingType,
    submitting,
    setSubmitting,
    detailOpen,
    setDetailOpen,
    selectedType,
    setSelectedType,
    attributes,
    setAttributes,
    versions,
    setVersions,
    detailTab,
    setDetailTab,
    attrModalOpen,
    setAttrModalOpen,
    attrForm,
    form,
    // callbacks
    loadTypes,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleViewDetail,
    loadAttributes,
    loadVersions,
    handleSaveAttributes,
    handleCreateVersion,
    handleRollback,
  };
};

export type CITypeDesignerState = ReturnType<typeof useCITypeDesignerState>;
