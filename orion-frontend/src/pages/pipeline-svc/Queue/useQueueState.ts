/**
 * Queue Management 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { message, Form } from 'antd';
import {
  listJobs,
  enqueueJob,
  dequeueJob,
  completeJob,
  failJob,
  getQueueStats,
  type QueueJob,
  type JobStatus,
  type EnqueueInput,
  type QueueStats,
} from '@/api/queue';

export const useQueueState = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [enqueueModalVisible, setEnqueueModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);
  const [dequeueModalVisible, setDequeueModalVisible] = useState(false);
  const [enqueueForm] = Form.useForm();
  const [dequeueForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: JobStatus; queue?: string } = {};
      if (statusFilter !== 'all') params.status = statusFilter as JobStatus;
      if (queueFilter !== 'all') params.queue = queueFilter;
      const res = await listJobs(params);
      const jobsData = res.data?.jobs;
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    } catch (error: unknown) {
      setJobs([]);
      message.error(`加载任务数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, queueFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await getQueueStats();
      setStats(res.data || null);
    } catch (error: unknown) {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStats();
  }, [loadData, loadStats]);

  // Extract unique queue names from jobs
  const queueNames = useMemo(() => {
    const names = new Set<string>();
    jobs.forEach((j) => names.add(j.queue));
    return Array.from(names);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs;
  }, [jobs]);

  const handleEnqueue = useCallback(async () => {
    try {
      const values = await enqueueForm.validateFields();
      setSubmitting(true);
      const payload: EnqueueInput = {
        tenantId: values.tenantId,
        payload: JSON.parse(values.payload),
      };
      await enqueueJob(values.queueName, payload);
      message.success('任务入队成功');
      setEnqueueModalVisible(false);
      enqueueForm.resetFields();
      loadData();
      loadStats();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('JSON')) {
        message.error('Payload 格式错误，请输入有效的 JSON');
      } else if (err instanceof Error) {
        message.error(`入队失败：${err.message}`);
      } else {
        message.error('入队失败');
      }
    } finally {
      setSubmitting(false);
    }
  }, [enqueueForm, loadData, loadStats]);

  const handleDequeue = useCallback(async () => {
    try {
      const values = await dequeueForm.validateFields();
      setSubmitting(true);
      const res = await dequeueJob(values.queueName, {
        limit: values.limit ? parseInt(values.limit) : 1,
      });
      const count = res.data?.count || 0;
      message.success(`出队成功，获取 ${count} 个任务`);
      setDequeueModalVisible(false);
      dequeueForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`出队失败：${error.message}`);
      } else {
        message.error('出队失败');
      }
    } finally {
      setSubmitting(false);
    }
  }, [dequeueForm, loadData, loadStats]);

  const handleComplete = useCallback(async (id: string) => {
    try {
      await completeJob(id);
      message.success('任务已标记为完成');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  }, [loadData, loadStats]);

  const handleFail = useCallback(async (id: string) => {
    try {
      await failJob(id);
      message.success('任务已标记为失败');
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败：${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  }, [loadData, loadStats]);

  const openDetail = useCallback((job: QueueJob) => {
    setSelectedJob(job);
    setDetailDrawerVisible(true);
  }, []);

  const openEnqueue = useCallback(() => {
    setEnqueueModalVisible(true);
  }, []);

  const openDequeue = useCallback(() => {
    setDequeueModalVisible(true);
  }, []);

  return {
    // state
    loading,
    jobs,
    stats,
    statusFilter,
    setStatusFilter,
    queueFilter,
    setQueueFilter,
    enqueueModalVisible,
    setEnqueueModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedJob,
    setSelectedJob,
    dequeueModalVisible,
    setDequeueModalVisible,
    enqueueForm,
    dequeueForm,
    submitting,
    queueNames,
    filteredJobs,
    // callbacks
    loadData,
    loadStats,
    handleEnqueue,
    handleDequeue,
    handleComplete,
    handleFail,
    openDetail,
    openEnqueue,
    openDequeue,
  };
};

export type QueueState = ReturnType<typeof useQueueState>;
