/**
 * CronManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  executeCronJob,
  getCronStatus,
  type CronJob,
  type CronJobInput,
} from '@/api/cron';

export type CronStats = { running: number; total: number; enabled: number };

export const useCronManagementState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<CronStats | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [form] = Form.useForm();

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, statusRes] = await Promise.all([getCronJobs(), getCronStatus()]);
      setJobs((jobsRes.data as any)?.jobs ?? []);
      setStats(statusRes.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载定时任务失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleCreate = async (values: CronJobInput) => {
    try {
      await createCronJob(values);
      message.success('定时任务已创建');
      setModalVisible(false);
      form.resetFields();
      loadJobs();
    } catch {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: CronJobInput) => {
    if (!editingJob) return;
    try {
      await updateCronJob(editingJob.id, values);
      message.success('定时任务已更新');
      setModalVisible(false);
      setEditingJob(null);
      form.resetFields();
      loadJobs();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      message.success('定时任务已删除');
      loadJobs();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await executeCronJob(id);
      message.success('定时任务已触发执行');
      loadJobs();
    } catch {
      message.error('执行失败');
    }
  };

  const openEdit = (job: CronJob) => {
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

  const closeModal = () => {
    setModalVisible(false);
    setEditingJob(null);
  };

  return {
    loading,
    error,
    jobs,
    stats,
    modalVisible,
    editingJob,
    form,
    loadJobs,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleExecute,
    openEdit,
    openCreate,
    closeModal,
  };
};
