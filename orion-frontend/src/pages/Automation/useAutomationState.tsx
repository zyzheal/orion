/**
 * useAutomationState - Automation Job 状态 + 加载器 + CRUD/执行/历史处理器
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Modal, Typography } from 'antd';
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  executeJob,
  toggleJob,
  getJobExecutions,
  type AutoJob,
  type CreateJobInput,
  type UpdateJobInput,
  type JobExecutionRecord,
} from '@/api/automation';
import { parseJSON } from './constants';

const { Text } = Typography;

export const useAutomationState = () => {
  // === State ===
  const [jobs, setJobs] = useState<AutoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<AutoJob | null>(null);

  // Execution history drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState<AutoJob | null>(null);
  const [executions, setExecutions] = useState<JobExecutionRecord[]>([]);
  const [execLoading, setExecLoading] = useState(false);

  // ==================== Load Jobs ====================

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean | undefined> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await listJobs(params);
      setJobs(response.data || []);
    } catch {
      message.error('加载自动化作业失败');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // ==================== CRUD Handlers ====================

  const handleOpenCreate = () => {
    setEditingJob(null);
    setModalOpen(true);
  };

  const handleOpenEdit = async (job: AutoJob) => {
    try {
      const response = await getJob(job.id);
      const detail: AutoJob = response.data;
      setEditingJob(detail);
      setModalOpen(true);
    } catch {
      message.error('加载作业详情失败');
    }
  };

  const handleSave = async (values: any) => {
    const config = parseJSON(values.config);

    setSaving(true);
    try {
      if (editingJob) {
        const payload: UpdateJobInput = {
          name: values.name,
          description: values.description,
          config,
          enabled: values.enabled,
          schedule: values.schedule || null,
          tags: values.tags || [],
        };
        await updateJob(editingJob.id, payload);
        message.success('作业更新成功');
      } else {
        const payload: CreateJobInput = {
          name: values.name,
          description: values.description,
          type: values.type,
          config,
          enabled: values.enabled,
          schedule: values.schedule,
          tags: values.tags || [],
        };
        await createJob(payload);
        message.success('作业创建成功');
      }
      setModalOpen(false);
      loadJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (job: AutoJob) => {
    Modal.confirm({
      title: '确认删除作业',
      content: (
        <div>
          <p>
            确定要删除作业 <Text strong>{job.name}</Text> 吗？
          </p>
          <p>
            <Text type="secondary">此操作不可恢复，所有执行历史将被保留。</Text>
          </p>
        </div>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteJob(job.id);
          message.success('作业删除成功');
          loadJobs();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleToggle = async (job: AutoJob) => {
    const newEnabled = !job.enabled;
    setTogglingId(job.id);
    try {
      await toggleJob(job.id, newEnabled);
      message.success(`作业已${newEnabled ? '启用' : '停用'}`);
      loadJobs();
    } catch {
      message.error('状态切换失败');
    } finally {
      setTogglingId(null);
    }
  };

  const handleExecute = async (job: AutoJob) => {
    if (!job.enabled) {
      message.warning('该作业处于停用状态，无法执行');
      return;
    }
    setExecuting(job.id);
    try {
      const response = await executeJob(job.id, {});
      message.success(`作业已执行，执行 ID: ${response.data.id}`);
      loadJobs();
    } catch {
      message.error('执行失败');
    } finally {
      setExecuting(null);
    }
  };

  // ==================== Execution History ====================

  const handleViewExecutions = async (job: AutoJob) => {
    setCurrentJob(job);
    setDrawerOpen(true);
    setExecLoading(true);
    try {
      const response = await getJobExecutions(job.id, 20);
      setExecutions(response.data);
    } catch {
      message.error('加载执行历史失败');
      setExecutions([]);
    } finally {
      setExecLoading(false);
    }
  };

  // ==================== Filtered Data ====================

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (typeFilter && job.type !== typeFilter) return false;
        if (statusFilter && job.status !== statusFilter) return false;
        if (searchText) {
          const search = searchText.toLowerCase();
          const nameMatch = job.name.toLowerCase().includes(search);
          const tagMatch = job.tags.some((t) => t.toLowerCase().includes(search));
          if (!nameMatch && !tagMatch) return false;
        }
        return true;
      }),
    [jobs, typeFilter, statusFilter, searchText]
  );

  // ==================== Stats ====================

  const stats = useMemo(
    () => ({
      total: filteredJobs.length,
      enabled: filteredJobs.filter((j) => j.enabled).length,
      running: filteredJobs.filter((j) => j.status === 'running').length,
      failed: filteredJobs.filter((j) => j.status === 'failed').length,
    }),
    [filteredJobs]
  );

  return {
    // state
    jobs,
    loading,
    saving,
    executing,
    togglingId,
    searchText,
    setSearchText,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    modalOpen,
    setModalOpen,
    editingJob,
    drawerOpen,
    setDrawerOpen,
    currentJob,
    executions,
    setExecutions,
    execLoading,
    // derived
    filteredJobs,
    stats,
    // handlers
    loadJobs,
    handleOpenCreate,
    handleOpenEdit,
    handleSave,
    handleDelete,
    handleToggle,
    handleExecute,
    handleViewExecutions,
  };
};
