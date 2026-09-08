/**
 * CronJobs state hook
 * 抽取自 index.tsx (P2-9 Phase 195)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  executeCronJob,
  type CronJob,
  type CronJobInput,
} from '@/api/cron';

export type CronJobStats = {
  total: number;
  enabled: number;
  running: number;
  error: number;
};

export const useCronJobsState = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CronJobInput>();

  const { data: rawData, isLoading: loading, isError, error, refetch } = useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      const res = await getCronJobs();
      return (res.data as any)?.jobs || [];
    },
    retry: 0,
    staleTime: 30_000,
  });

  const jobs = rawData ?? [];

  // 加载失败反馈：当前锁定的 @tanstack/react-query 构建不调用 useQuery 的 onError
  // 选项（observer 级回调未实现），统一改用 isError + useEffect 保持错误可见。
  useEffect(() => {
    if (isError) {
      message.error(error instanceof Error ? error.message : '加载失败');
    }
  }, [isError, error]);

  const handleCreate = async (values: CronJobInput) => {
    try {
      setSubmitting(true);
      if (editingJob) {
        await updateCronJob(editingJob.id, values);
        message.success('更新成功');
      } else {
        await createCronJob(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      setEditingJob(null);
      form.resetFields();
      refetch();
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : (editingJob ? '更新' : '创建') + '失败'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    form.setFieldsValue({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingJob(null);
    form.resetFields();
    setModalVisible(true);
  };

  const closeCreate = () => {
    setModalVisible(false);
    setEditingJob(null);
    form.resetFields();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      message.success('删除成功');
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeCronJob(id);
      message.success('执行成功');
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '执行失败');
    }
  };

  const stats: CronJobStats = {
    total: jobs.length,
    enabled: jobs.filter((j) => j.enabled).length,
    running: jobs.filter((j) => j.status === 'running').length,
    error: jobs.filter((j) => j.status === 'error').length,
  };

  return {
    loading,
    modalVisible,
    editingJob,
    submitting,
    jobs,
    stats,
    form,
    handleCreate,
    handleEdit,
    handleDelete,
    handleExecute,
    openCreate,
    closeCreate,
    setModalVisible,
  };
};
