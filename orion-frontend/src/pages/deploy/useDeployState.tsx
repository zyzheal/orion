/**
 * DeployPage state hook
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import dayjs from 'dayjs';
import type { Deployment } from '@/api/deployments';
import {
  getDeployments,
  createDeployment,
  cancelDeployment,
  rollbackDeployment,
  startDeployment,
} from '@/api/deployments';
import {
  getReleaseNotes,
  generateReleaseNotes,
  type ReleaseNotes,
} from '@/api/deploy';
import {
  createWindow,
  createProgressiveDeploy,
  advanceStage,
  rollbackStage,
} from '@/api/deploy-enhanced';
import type {
  ProgressiveDeployment,
  DeployWindow,
  ProgressiveStage,
} from './config';

export const useDeployState = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Emergency deploy modal
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [emergencyForm] = Form.useForm();
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  // Release Notes state
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);

  // Deploy Window state
  const [deployWindows, setDeployWindows] = useState<DeployWindow[]>([
    {
      id: '1',
      name: '生产窗口-工作日',
      environment: 'prod',
      startTime: '2026-05-06 10:00',
      endTime: '2026-05-06 16:00',
      recurring: true,
      recurringPattern: 'weekly',
      description: '生产环境工作日部署窗口',
      status: 'active',
    },
    {
      id: '2',
      name: '预发窗口',
      environment: 'staging',
      startTime: '2026-05-06 09:00',
      endTime: '2026-05-06 18:00',
      recurring: true,
      recurringPattern: 'daily',
      description: '预发环境日常部署窗口',
      status: 'active',
    },
    {
      id: '3',
      name: '开发窗口',
      environment: 'dev',
      startTime: '2026-05-01 00:00',
      endTime: '2026-05-31 23:59',
      recurring: false,
      description: '开发环境月度窗口',
      status: 'upcoming',
    },
  ]);
  const [deployWindowModalVisible, setDeployWindowModalVisible] = useState(false);
  const [deployWindowForm] = Form.useForm();
  const [deployWindowSubmitting, setDeployWindowSubmitting] = useState(false);

  // Progressive Deploy state
  const [progressiveDeploys, setProgressiveDeploys] = useState<ProgressiveDeployment[]>([
    {
      id: 'pd-001',
      appName: 'orion-platform',
      version: '2.1.0',
      environment: 'prod',
      currentStage: 2,
      status: 'running',
      createdAt: '2026-05-06 10:30',
      stages: [
        {
          name: 'Canary (5%)',
          status: 'completed',
          trafficPercent: 5,
          startedAt: '2026-05-06 10:30',
          completedAt: '2026-05-06 10:45',
        },
        {
          name: '25% 流量',
          status: 'completed',
          trafficPercent: 25,
          startedAt: '2026-05-06 10:45',
          completedAt: '2026-05-06 11:00',
        },
        { name: '50% 流量', status: 'running', trafficPercent: 50, startedAt: '2026-05-06 11:00' },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ],
    },
    {
      id: 'pd-002',
      appName: 'orion-api',
      version: '1.5.3',
      environment: 'staging',
      currentStage: 4,
      status: 'running',
      createdAt: '2026-05-06 09:00',
      stages: [
        { name: 'Canary (5%)', status: 'completed', trafficPercent: 5 },
        { name: '25% 流量', status: 'completed', trafficPercent: 25 },
        { name: '50% 流量', status: 'completed', trafficPercent: 50 },
        { name: '75% 流量', status: 'completed', trafficPercent: 75 },
        { name: '100% 全量', status: 'running', trafficPercent: 100 },
      ],
    },
    {
      id: 'pd-003',
      appName: 'orion-frontend',
      version: '3.0.0-beta',
      environment: 'prod',
      currentStage: 0,
      status: 'pending',
      createdAt: '2026-05-06 14:00',
      stages: [
        { name: 'Canary (5%)', status: 'pending', trafficPercent: 5 },
        { name: '25% 流量', status: 'pending', trafficPercent: 25 },
        { name: '50% 流量', status: 'pending', trafficPercent: 50 },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ],
    },
  ]);
  const [progressiveDeployModalVisible, setProgressiveDeployModalVisible] = useState(false);
  const [progressiveDeployForm] = Form.useForm();
  const [progressiveDeploySubmitting, setProgressiveDeploySubmitting] = useState(false);
  const [selectedProgressiveDeploy, setSelectedProgressiveDeploy] =
    useState<ProgressiveDeployment | null>(null);
  const [progressiveDetailVisible, setProgressiveDetailVisible] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDeployments({ page: 1, pageSize: 100 });
      const raw = res.data;
      setDeployments(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setDeployments([]);
      message.error(`加载部署列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return deployments.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !d.appName.toLowerCase().includes(q) &&
          !(d.version && d.version.toLowerCase().includes(q))
        )
          return false;
      }
      if (
        filters.environment &&
        filters.environment !== 'all' &&
        d.environment !== filters.environment
      )
        return false;
      if (filters.status && filters.status !== 'all' && d.status !== filters.status) return false;
      if (filters.strategy && filters.strategy !== 'all' && d.strategy !== filters.strategy)
        return false;
      return true;
    });
  }, [searchQuery, filters, deployments]);

  // Stats
  const stats = useMemo(() => {
    const total = deployments.length;
    const success = deployments.filter((d) => d.status === 'success').length;
    const deploying = deployments.filter((d) => d.status === 'deploying').length;
    const failed = deployments.filter((d) => d.status === 'failed').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    return { total, success, deploying, failed, successRate };
  }, [deployments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload = {
        appName: values.appName,
        version: values.version,
        environment: values.environment,
        strategy: values.strategy,
        pipelineRunId: values.pipelineRunId,
        commit: values.commit,
      };
      await createDeployment(payload);
      message.success('部署任务创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyDeploy = async () => {
    try {
      const values = await emergencyForm.validateFields();
      setEmergencyLoading(true);
      await createDeployment({
        appName: values.appName,
        version: values.version,
        environment: 'prod',
        strategy: 'rolling',
        commit: values.commit,
        pipelineRunId: values.pipelineRunId,
        isEmergency: true,
        reason: values.reason,
      });
      message.success('紧急部署任务已提交');
      setEmergencyModalVisible(false);
      emergencyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`紧急部署失败: ${(error as Error).message}`);
      }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await startDeployment(id);
      message.success('部署已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`启动失败: ${(error as Error).message}`);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelDeployment(id);
      message.success('部署已取消');
      loadData();
    } catch (error: unknown) {
      message.error(`取消失败: ${(error as Error).message}`);
    }
  };

  const handleRollback = async (id: string) => {
    try {
      await rollbackDeployment(id);
      message.success('回滚已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    }
  };

  // ---- Deploy Window Handlers ----

  const handleCreateDeployWindow = async () => {
    try {
      const values = await deployWindowForm.validateFields();
      setDeployWindowSubmitting(true);
      const payload = {
        name: values.name,
        environment: values.environment,
        startTime: values.startTime.format('YYYY-MM-DD HH:mm'),
        endTime: values.endTime.format('YYYY-MM-DD HH:mm'),
        recurring: values.recurring || false,
        recurringPattern: values.recurring ? values.recurringPattern : undefined,
        description: values.description,
      };
      const durationMinutes = Math.round(values.endTime.diff(values.startTime, 'minute'));
      const cronExpression = values.recurring
        ? `${values.startTime.minute()} ${values.startTime.hour()} * * * ?`
        : `${values.startTime.minute()} ${values.startTime.hour()} ${values.startTime.date()} ${values.startTime.month() + 1} ? ${values.startTime.year()}`;
      await createWindow({
        name: payload.name,
        cronExpression,
        environmentId: payload.environment,
        durationMinutes,
      });
      message.success('部署窗口创建成功');
      setDeployWindowModalVisible(false);
      deployWindowForm.resetFields();
      setDeployWindows((prev) => [
        ...prev,
        {
          id: `dw-${Date.now()}`,
          ...payload,
          status: 'upcoming',
        },
      ]);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setDeployWindowSubmitting(false);
    }
  };

  const handleDeleteDeployWindow = (id: string) => {
    setDeployWindows((prev) => prev.filter((w) => w.id !== id));
    message.success('部署窗口已删除');
  };

  // ---- Progressive Deploy Handlers ----

  const handleCreateProgressiveDeploy = async () => {
    try {
      const values = await progressiveDeployForm.validateFields();
      setProgressiveDeploySubmitting(true);
      const stages: ProgressiveStage[] = [
        { name: 'Canary (5%)', status: 'pending', trafficPercent: 5 },
        { name: '25% 流量', status: 'pending', trafficPercent: 25 },
        { name: '50% 流量', status: 'pending', trafficPercent: 50 },
        { name: '75% 流量', status: 'pending', trafficPercent: 75 },
        { name: '100% 全量', status: 'pending', trafficPercent: 100 },
      ];
      const backendStages = stages.map((s) => ({
        name: s.name,
        trafficPct: s.trafficPercent,
        durationSec: 60,
        status: s.status,
      }));
      await createProgressiveDeploy(values.appName, { stages: backendStages });
      message.success('渐进式部署任务创建成功');
      setProgressiveDeployModalVisible(false);
      progressiveDeployForm.resetFields();
      setProgressiveDeploys((prev) => [
        ...prev,
        {
          id: `pd-${Date.now()}`,
          appName: values.appName,
          version: values.version,
          environment: values.environment,
          currentStage: 0,
          stages,
          status: 'pending',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        },
      ]);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setProgressiveDeploySubmitting(false);
    }
  };

  const handleAdvanceStage = async (deployId: string) => {
    try {
      const currentDeploy = progressiveDeploys.find((d) => d.id === deployId);
      if (!currentDeploy) return;
      const stageIdx = currentDeploy.currentStage;

      setProgressiveDeploys((prev) =>
        prev.map((d) => {
          if (d.id !== deployId || d.currentStage >= d.stages.length - 1) return d;
          const newStages = d.stages.map((s, i) => {
            if (i === d.currentStage) {
              return {
                ...s,
                status: 'completed' as const,
                completedAt: dayjs().format('YYYY-MM-DD HH:mm'),
              };
            }
            if (i === d.currentStage + 1) {
              return {
                ...s,
                status: 'running' as const,
                startedAt: dayjs().format('YYYY-MM-DD HH:mm'),
              };
            }
            return s;
          });
          const newCurrentStage = d.currentStage + 1;
          const newStatus =
            newCurrentStage === d.stages.length - 1 &&
            newStages[newCurrentStage].status === 'completed'
              ? ('completed' as const)
              : d.status;
          return { ...d, currentStage: newCurrentStage, stages: newStages, status: newStatus };
        })
      );
      await advanceStage(deployId, { stageId: `stage-${stageIdx}` });
      message.success('阶段已推进');
    } catch (error: unknown) {
      message.error(`推进失败: ${(error as Error).message}`);
    }
  };

  const handleRollbackProgressive = async (deployId: string) => {
    try {
      const currentDeploy = progressiveDeploys.find((d) => d.id === deployId);
      if (!currentDeploy) return;
      const stageIdx = currentDeploy.currentStage;

      setProgressiveDeploys((prev) =>
        prev.map((d) => {
          if (d.id !== deployId) return d;
          return { ...d, status: 'rolled_back' as const };
        })
      );
      await rollbackStage(deployId, { stageId: `stage-${stageIdx}`, reason: 'manual rollback' });
      message.success('渐进式部署已回滚');
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    }
  };

  const openProgressiveDetail = (d: ProgressiveDeployment) => {
    setSelectedProgressiveDeploy(d);
    setProgressiveDetailVisible(true);
  };

  const openDetail = async (d: Deployment) => {
    setSelectedDeployment(d);
    setDetailDrawerVisible(true);
    setReleaseNotes(null);
    setReleaseNotesLoading(true);
    try {
      const notes = await getReleaseNotes(d.id);
      setReleaseNotes(notes);
    } catch {
      // 版本说明不存在时静默处理
    } finally {
      setReleaseNotesLoading(false);
    }
  };

  const handleGenerateReleaseNotes = async () => {
    if (!selectedDeployment) return;
    try {
      setGeneratingNotes(true);
      const notes = await generateReleaseNotes(selectedDeployment.id, {
        toCommit: selectedDeployment.commit,
      });
      setReleaseNotes(notes);
      message.success('版本说明生成成功');
    } catch (error: unknown) {
      message.error(`生成版本说明失败: ${(error as Error).message}`);
    } finally {
      setGeneratingNotes(false);
    }
  };

  return {
    // state
    loading,
    deployments,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    createModalVisible,
    setCreateModalVisible,
    createForm,
    submitting,
    emergencyModalVisible,
    setEmergencyModalVisible,
    emergencyForm,
    emergencyLoading,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedDeployment,
    releaseNotes,
    setReleaseNotes,
    releaseNotesLoading,
    generatingNotes,
    deployWindows,
    setDeployWindows,
    deployWindowModalVisible,
    setDeployWindowModalVisible,
    deployWindowForm,
    deployWindowSubmitting,
    progressiveDeploys,
    setProgressiveDeploys,
    progressiveDeployModalVisible,
    setProgressiveDeployModalVisible,
    progressiveDeployForm,
    progressiveDeploySubmitting,
    selectedProgressiveDeploy,
    progressiveDetailVisible,
    setProgressiveDetailVisible,
    // computed
    filteredData,
    stats,
    // handlers
    loadData,
    handleCreate,
    handleEmergencyDeploy,
    handleExecute,
    handleCancel,
    handleRollback,
    handleCreateDeployWindow,
    handleDeleteDeployWindow,
    handleCreateProgressiveDeploy,
    handleAdvanceStage,
    handleRollbackProgressive,
    openProgressiveDetail,
    openDetail,
    handleGenerateReleaseNotes,
  };
};

export type DeployState = ReturnType<typeof useDeployState>;
