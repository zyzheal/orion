/**
 * WorkflowTriggers state hook
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, message } from 'antd';
import {
  getTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  enableTrigger,
  disableTrigger,
  type WorkflowTrigger,
  type CreateWorkflowTriggerInput,
} from '@/api/workflow-trigger';
import { getWorkflowList, type WorkflowDefinition } from '@/api/workflow';

export const useWorkflowTriggerState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WorkflowTrigger | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [form] = Form.useForm();

  const loadTriggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTriggers({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setTriggers(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载触发器失败'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadWorkflows = useCallback(async () => {
    try {
      const list = await getWorkflowList({ limit: 100 });
      setWorkflows(list);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  }, []);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreate = useCallback(
    async (values: CreateWorkflowTriggerInput) => {
      setSubmitting(true);
      try {
        await createTrigger(values);
        message.success('触发器已创建');
        setModalVisible(false);
        form.resetFields();
        loadTriggers();
      } catch {
        message.error('创建失败');
      } finally {
        setSubmitting(false);
      }
    },
    [form, loadTriggers]
  );

  const handleUpdate = useCallback(
    async (values: CreateWorkflowTriggerInput) => {
      if (!editingTrigger) return;
      setSubmitting(true);
      try {
        await updateTrigger(editingTrigger.id, values);
        message.success('触发器已更新');
        setModalVisible(false);
        setEditingTrigger(null);
        form.resetFields();
        loadTriggers();
      } catch {
        message.error('更新失败');
      } finally {
        setSubmitting(false);
      }
    },
    [editingTrigger, form, loadTriggers]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTrigger(id);
        message.success('触发器已删除');
        loadTriggers();
      } catch {
        message.error('删除失败');
      }
    },
    [loadTriggers]
  );

  const handleToggle = useCallback(
    async (trigger: WorkflowTrigger) => {
      try {
        if (trigger.enabled) {
          await disableTrigger(trigger.id);
          message.success('触发器已禁用');
        } else {
          await enableTrigger(trigger.id);
          message.success('触发器已启用');
        }
        loadTriggers();
      } catch {
        message.error('操作失败');
      }
    },
    [loadTriggers]
  );

  const openEdit = useCallback(
    (trigger: WorkflowTrigger) => {
      setEditingTrigger(trigger);
      form.setFieldsValue({
        name: trigger.name,
        type: trigger.type,
        workflowId: trigger.workflowId,
        eventType: trigger.eventType,
        cronExpression: trigger.cronExpression,
        enabled: trigger.enabled,
        description: trigger.description,
      });
      setModalVisible(true);
    },
    [form]
  );

  const openCreate = useCallback(() => {
    setEditingTrigger(null);
    form.resetFields();
    setModalVisible(true);
  }, [form]);

  return {
    loading,
    error,
    triggers,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    modalVisible,
    setModalVisible,
    editingTrigger,
    setEditingTrigger,
    submitting,
    workflows,
    form,
    loadTriggers,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    openEdit,
    openCreate,
  };
};

export type WorkflowTriggerState = ReturnType<typeof useWorkflowTriggerState>;
