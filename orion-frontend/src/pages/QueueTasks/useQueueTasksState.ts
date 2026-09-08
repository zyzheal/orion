/**
 * useQueueTasksState.ts - 任务队列状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 209)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import {
  listJobs,
  enqueueJob,
  completeJob,
  failJob,
  getQueueStats,
  QueueJob,
  EnqueueInput,
  JobStatus,
  QueueStats,
} from '@/api/queue';
import { useQuery } from '@/providers/QueryProvider';

export function useQueueTasksState() {
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<JobStatus | undefined>();
  const [form] = Form.useForm<EnqueueInput>();

  const {
    data: jobs = [],
    isLoading: loading,
    isError,
    error,
    refetch: fetchJobs,
  } = useQuery<QueueJob[]>({
    queryKey: ['queue-jobs', filterStatus],
    queryFn: async () => {
      const res = await listJobs(filterStatus ? { status: filterStatus } : undefined);
      return res.data?.jobs || [];
    },
    staleTime: 30_000,
  });

  const {
    data: stats = { pending: 0, processing: 0, completed: 0, failed: 0 },
    refetch: fetchStats,
  } = useQuery<QueueStats>({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const res = await getQueueStats();
      return res.data || { pending: 0, processing: 0, completed: 0, failed: 0 };
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载失败');
  }, [isError, error]);

  const handleEnqueue = async (values: EnqueueInput) => {
    setSubmitting(true);
    try {
      const queueName = 'default';
      await enqueueJob(queueName, values);
      message.success('入队成功');
      setModalVisible(false);
      form.resetFields();
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '入队失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeJob(id);
      message.success('标记完成');
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleFail = async (id: string) => {
    try {
      await failJob(id);
      message.success('标记失败');
      fetchJobs();
      fetchStats();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const openEnqueueModal = () => setModalVisible(true);
  const closeEnqueueModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  return {
    modalVisible,
    submitting,
    filterStatus,
    setFilterStatus,
    form,
    jobs,
    loading,
    stats,
    handleEnqueue,
    handleComplete,
    handleFail,
    openEnqueueModal,
    closeEnqueueModal,
  };
}
