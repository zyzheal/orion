/**
 * EphemeralEnvDetail state hook
 * 抽取自 index.tsx (P2-9 Phase 115)
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  CloudServerOutlined,
  PoweroffOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import {
  getEphemeralEnv,
  wakeEphemeralEnv,
  teardownEphemeralEnv,
  getEphemeralEnvCost,
  type EphemeralEnvironment,
  type EphemeralEnvCost,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';
import type { TimelineEvent } from '@/components/Timeline';

export const statusToBadge: Record<
  string,
  'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'
> = {
  provisioning: 'pending',
  running: 'running',
  idle: 'warning',
  tearing_down: 'cancelled',
  destroyed: 'failed',
};

export const statusLabel: Record<string, string> = {
  provisioning: '创建中',
  running: '运行中',
  idle: '空闲',
  tearing_down: '销毁中',
  destroyed: '已销毁',
};

export const useEphemeralEnvDetailState = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [env, setEnv] = useState<EphemeralEnvironment | null>(null);
  const [cost, setCost] = useState<EphemeralEnvCost | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async (envId: string) => {
    setLoading(true);
    try {
      const envRes = await getEphemeralEnv(envId).catch(() => null);
      setEnv(envRes ? envRes.data : null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        message.error(`加载环境详情失败：${err.message}`);
      } else {
        message.error('加载环境详情失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadCost = async (envId: string) => {
    setCostLoading(true);
    try {
      const costRes = await getEphemeralEnvCost(envId).catch(() => null);
      setCost(costRes ? costRes.data : null);
    } catch {
      setCost(null);
    } finally {
      setCostLoading(false);
    }
  };

  const handleWake = async () => {
    if (!env) return;
    setActionLoading('wake');
    try {
      await wakeEphemeralEnv(env.id);
      message.success('环境已唤醒');
      await loadData(env.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`唤醒失败：${error.message}`);
      } else {
        message.error('唤醒失败');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeardown = async () => {
    if (!env) return;
    setActionLoading('teardown');
    try {
      await teardownEphemeralEnv(env.id);
      message.success('环境销毁已触发');
      await loadData(env.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`销毁失败：${error.message}`);
      } else {
        message.error('销毁失败');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPreview = () => {
    if (env?.previewUrl) {
      window.open(env.previewUrl, '_blank');
    } else {
      message.warning('该环境暂无 Preview URL');
    }
  };

  const isTeardownable = env ? ['running', 'idle'].includes(env.status) : false;
  const isWakable = env?.status === 'idle';

  // Build event timeline from env lifecycle
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!env) return [];
    const events: TimelineEvent[] = [];

    events.push({
      id: 'provisioning',
      time: env.createdAt,
      title: '环境创建',
      description: `Namespace: ${env.namespace} · PR #${env.prId} · ${env.repoId}`,
      status: 'running',
      icon: <CloudServerOutlined />,
    });

    if (env.status !== 'provisioning' && env.status !== 'destroyed') {
      const runningTime = env.idleSince || env.createdAt;
      events.push({
        id: 'running',
        time: runningTime,
        title: '环境就绪',
        description: env.previewUrl ? `Preview URL: ${env.previewUrl}` : '服务已启动',
        status: 'success',
        icon: <GlobalOutlined />,
      });
    }

    if (env.idleSince && ['idle'].includes(env.status)) {
      events.push({
        id: 'idle',
        time: env.idleSince,
        title: '进入空闲状态',
        description: '无访问活动，等待自动回收或手动唤醒',
        status: 'warning',
        icon: <ClockCircleOutlined />,
      });
    }

    if (['tearing_down', 'destroyed'].includes(env.status)) {
      const teardownTime = env.destroyedAt || env.createdAt;
      events.push({
        id: 'teardown',
        time: teardownTime,
        title: env.status === 'destroyed' ? '环境已销毁' : '正在销毁',
        description:
          env.status === 'destroyed' ? 'Namespace 及所有资源已清理' : '正在清理资源...',
        status: env.status === 'destroyed' ? 'failed' : 'pending',
        icon: <PoweroffOutlined />,
      });
    }

    if (env.autoDestroyAt && !['destroyed', 'tearing_down'].includes(env.status)) {
      const autoDestroyTime = dayjs(env.autoDestroyAt);
      const hoursLeft = autoDestroyTime.diff(dayjs(), 'hour');
      if (hoursLeft <= 0) {
        // already past
      }
    }

    return events;
  }, [env]);

  // Simulated services
  const services = useMemo(() => {
    if (!env) return [];
    if (env.status === 'destroyed') return [];
    return [
      {
        key: '1',
        name: 'frontend',
        image: `frontend:${env.commitSha?.slice(0, 7)}`,
        replicas: 1,
        health: env.status === 'running' ? 'healthy' : 'pending',
      },
      {
        key: '2',
        name: 'backend',
        image: `backend:${env.commitSha?.slice(0, 7)}`,
        replicas: 1,
        health: env.status === 'running' ? 'healthy' : 'pending',
      },
      {
        key: '3',
        name: 'database',
        image: 'postgres:15-alpine',
        replicas: 1,
        health: env.status === 'running' ? 'healthy' : 'pending',
      },
      {
        key: '4',
        name: 'cache',
        image: 'redis:7-alpine',
        replicas: 1,
        health: env.status === 'running' ? 'healthy' : 'pending',
      },
    ];
  }, [env]);

  return {
    navigate,
    id,
    loading,
    env,
    cost,
    costLoading,
    actionLoading,
    isTeardownable,
    isWakable,
    timelineEvents,
    services,
    loadData,
    loadCost,
    handleWake,
    handleTeardown,
    handleOpenPreview,
  };
};

export type EphemeralEnvDetailState = ReturnType<typeof useEphemeralEnvDetailState>;
