/**
 * useWorkflowTasksState.ts - WorkflowTasks 状态钩子
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import {
  getTasks,
  getTask,
  claimTask,
  completeTask,
  type WorkflowTask,
  type TaskStatus,
} from '@/api/workflow-task';

export const useWorkflowTasksState = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Claim modal
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimTaskId, setClaimTaskId] = useState('');
  const [claimForm] = Form.useForm();
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Complete modal
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState('');
  const [completeForm] = Form.useForm();
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  // Current user from auth store
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTasks();
      const list = res.data;
      setTasks(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setTasks([]);
      message.error(`加载任务数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [statusFilter, tasks]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      assigned: tasks.filter((t) => t.status === 'assigned').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    }),
    [tasks],
  );

  const handleClaim = async () => {
    try {
      const values = await claimForm.validateFields();
      setClaimSubmitting(true);
      await claimTask(claimTaskId, { comment: values.comment });
      message.success('任务认领成功');
      setClaimModalVisible(false);
      claimForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`认领失败：${error.message}`);
        } else {
          message.error('认领失败');
        }
      }
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      const values = await completeForm.validateFields();
      setCompleteSubmitting(true);
      const result = await completeTask(completeTaskId, {
        comment: values.comment,
        formData: values.formData ? JSON.parse(values.formData) : undefined,
      });
      if (result.warning) {
        message.warning(result.warning);
      } else {
        message.success('任务完成');
      }
      setCompleteModalVisible(false);
      completeForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        if (error instanceof Error) {
          message.error(`完成失败：${error.message}`);
        } else {
          message.error('完成失败');
        }
      }
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const openClaimModal = (taskId: string) => {
    setClaimTaskId(taskId);
    claimForm.resetFields();
    setClaimModalVisible(true);
  };

  const openCompleteModal = (taskId: string) => {
    setCompleteTaskId(taskId);
    completeForm.resetFields();
    setCompleteModalVisible(true);
  };

  const openDetail = async (task: WorkflowTask) => {
    setSelectedTask(task);
    setDetailDrawerVisible(true);

    // Refresh detail from API
    if (task.id) {
      setDetailLoading(true);
      try {
        const detail = await getTask(task.id);
        setSelectedTask(detail);
      } catch {
        // Keep existing data
      } finally {
        setDetailLoading(false);
      }
    }
  };

  /**
   * formData JSON 实时校验：onBlur 时验证格式
   */
  const validateFormDataJson = () => {
    const value = completeForm.getFieldValue('formData');
    if (value && typeof value === 'string' && value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        message.error('表单数据 JSON 格式不正确，请检查格式');
      }
    }
  };

  return {
    loading,
    tasks,
    statusFilter,
    setStatusFilter,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedTask,
    setSelectedTask,
    detailLoading,
    claimModalVisible,
    setClaimModalVisible,
    claimTaskId,
    claimForm,
    claimSubmitting,
    completeModalVisible,
    setCompleteModalVisible,
    completeTaskId,
    completeForm,
    completeSubmitting,
    currentUserId,
    loadData,
    filteredTasks,
    stats,
    handleClaim,
    handleComplete,
    openClaimModal,
    openCompleteModal,
    openDetail,
    validateFormDataJson,
  };
};

export type WorkflowTasksState = ReturnType<typeof useWorkflowTasksState>;
