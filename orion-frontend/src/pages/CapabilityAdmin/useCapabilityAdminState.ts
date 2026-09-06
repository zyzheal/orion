/**
 * useCapabilityAdminState.ts - 能力权限配置状态 Hook
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
import { useState, useEffect } from 'react';
import { message, Modal, Form } from 'antd';
import {
  capabilityApi,
  type Capability,
  type TemporaryPermission,
  type CapabilityAuditLog,
} from '@/api/capability';

export const useCapabilityAdminState = () => {
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [form] = Form.useForm();

  // Temporary permissions state
  const [tempPerms, setTempPerms] = useState<TemporaryPermission[]>([]);
  const [tempPermLoading, setTempPermLoading] = useState(false);
  const [tempPermModalVisible, setTempPermModalVisible] = useState(false);
  const [tempPermForm] = Form.useForm();

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<CapabilityAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  // Permission request state
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestForm] = Form.useForm();

  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const result = await capabilityApi.list();
      setCapabilities((result.data as unknown as Capability[]) || []);
    } catch (error) {
      message.error('加载能力列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTempPerms = async () => {
    setTempPermLoading(true);
    try {
      const result = await capabilityApi.getUserTemporaryPermissions('current-user');
      setTempPerms((result.data as unknown as TemporaryPermission[]) || []);
    } catch (error) {
      // 静默失败，可能还没有临时权限
    } finally {
      setTempPermLoading(false);
    }
  };

  const loadAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const result = await capabilityApi.getAuditLogs({ limit: 20, offset: (page - 1) * 20 });
      const payload = result.data as { logs?: CapabilityAuditLog[]; total?: number } | null;
      setAuditLogs(payload?.logs || []);
      setAuditTotal(payload?.total || 0);
      setAuditPage(page);
    } catch (error) {
      message.error('加载审计日志失败');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadCapabilities();
    loadTempPerms();
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    setModalType('create');
    form.resetFields();
    form.setFieldValue('risk_level', 1);
    form.setFieldValue('requires_approval', false);
    setModalVisible(true);
  };

  const handleEdit = (record: Capability) => {
    setModalType('edit');
    setSelectedCapability(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (record: Capability) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除能力 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await capabilityApi.delete(record.capability_id);
          message.success('删除成功');
          loadCapabilities();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (modalType === 'create') {
        await capabilityApi.create(values);
        message.success('创建成功');
      } else {
        if (!selectedCapability) return;
        await capabilityApi.update(selectedCapability.capability_id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      loadCapabilities();
    } catch (error: unknown) {
      message.error((error as Error).message || '操作失败');
    }
  };

  const handleGrantTempPerm = async () => {
    const values = await tempPermForm.validateFields();
    try {
      await capabilityApi.grantTemporary(values);
      message.success('临时权限已授予');
      setTempPermModalVisible(false);
      loadTempPerms();
    } catch (error: unknown) {
      message.error((error as Error).message || '授予失败');
    }
  };

  const handleRevokeTempPerm = async (id: number) => {
    try {
      await capabilityApi.revokeTemporary(id, '手动撤销');
      message.success('临时权限已撤销');
      loadTempPerms();
    } catch (error: unknown) {
      message.error((error as Error).message || '撤销失败');
    }
  };

  const handleRequestPermission = async () => {
    const values = await requestForm.validateFields();
    try {
      await capabilityApi.requestPermission(values);
      message.success('权限申请已提交，等待审批');
      setRequestModalVisible(false);
    } catch (error: unknown) {
      message.error((error as Error).message || '申请失败');
    }
  };

  const handleCleanup = async () => {
    try {
      const result = await capabilityApi.cleanup();
      const payload = result.data as { cleaned?: number } | null;
      message.success(`清理完成，共清理 ${payload?.cleaned || 0} 条过期权限`);
      loadTempPerms();
      loadAuditLogs();
    } catch (error: unknown) {
      message.error((error as Error).message || '清理失败');
    }
  };

  const handleCleanupTempPerm = () => {
    tempPermForm.resetFields();
    tempPermForm.setFieldValue('expires_in_hours', 8);
    setTempPermModalVisible(true);
  };

  const handleRequestPermissionOpen = () => {
    requestForm.resetFields();
    requestForm.setFieldValue('duration_hours', 8);
    setRequestModalVisible(true);
  };

  return {
    loading,
    capabilities,
    selectedCapability,
    modalVisible,
    setModalVisible,
    modalType,
    form,
    tempPerms,
    tempPermLoading,
    tempPermModalVisible,
    tempPermForm,
    auditLogs,
    auditLoading,
    auditTotal,
    auditPage,
    requestModalVisible,
    setRequestModalVisible,
    setTempPermModalVisible,
    requestForm,
    loadAuditLogs,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleGrantTempPerm,
    handleRevokeTempPerm,
    handleRequestPermission,
    handleCleanup,
    handleCleanupTempPerm,
    handleRequestPermissionOpen,
  };
};
