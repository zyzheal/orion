/**
 * Runbook Management state hook
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  listRunbooks,
  createRunbook,
  updateRunbook,
  deleteRunbook,
  executeRunbook,
  getExecutionHistory,
  type RunbookDefinition,
  type RunbookExecution,
  type CreateRunbookInput,
} from '@/api/runbooks';

export function useRunbookManagementState() {
  const [runbooks, setRunbooks] = useState<RunbookDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<RunbookDefinition | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRunbook, setSelectedRunbook] = useState<RunbookDefinition | null>(null);
  const [executions, setExecutions] = useState<RunbookExecution[]>([]);
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<RunbookExecution | null>(null);
  const [activeTab, setActiveTab] = useState('definitions');
  const [form] = Form.useForm();

  const fetchRunbooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRunbooks();
      setRunbooks(res.data ?? []);
    } catch {
      message.error('获取 Runbook 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRunbooks();
  }, [fetchRunbooks]);

  const handleCreate = () => {
    setEditingRunbook(null);
    form.resetFields();
    form.setFieldsValue({ steps: [{}] });
    setModalVisible(true);
  };

  const handleEdit = (record: RunbookDefinition) => {
    setEditingRunbook(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      category: record.category,
      steps: record.steps,
      enabled: record.enabled,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const input: CreateRunbookInput = {
        name: values.name,
        description: values.description,
        category: values.category,
        steps: values.steps ?? [],
        enabled: values.enabled ?? true,
      };
      if (editingRunbook) {
        await updateRunbook(editingRunbook.id, input);
        message.success('Runbook 更新成功');
      } else {
        await createRunbook(input);
        message.success('Runbook 创建成功');
      }
      setModalVisible(false);
      fetchRunbooks();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRunbook(id);
      message.success('删除成功');
      fetchRunbooks();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeRunbook(id, { triggeredBy: 'ui' });
      message.success('Runbook 执行已启动');
      fetchRunbooks();
    } catch {
      message.error('执行失败');
    }
  };

  const handleViewDetail = async (record: RunbookDefinition) => {
    setSelectedRunbook(record);
    setDrawerVisible(true);
    try {
      const res = await getExecutionHistory(record.id, { limit: 20 });
      setExecutions(res.data ?? []);
    } catch {
      // ignore
    }
  };

  const handleViewExecution = async (execution: RunbookExecution) => {
    setSelectedExecution(execution);
    setExecutionDrawerVisible(true);
  };

  return {
    runbooks,
    loading,
    modalVisible,
    editingRunbook,
    drawerVisible,
    selectedRunbook,
    executions,
    executionDrawerVisible,
    selectedExecution,
    activeTab,
    form,
    setActiveTab,
    setModalVisible,
    setDrawerVisible,
    setExecutionDrawerVisible,
    fetchRunbooks,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
    handleExecute,
    handleViewDetail,
    handleViewExecution,
  };
}
