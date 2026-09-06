/**
 * constants.tsx - DashboardNew 常量与工具函数
 * 抽取自 DashboardNew/index.tsx (P2-9 Phase 67)
 */
import {
  DashboardOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  AlertOutlined,
  RocketOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import type { DashboardLink, QuickAction } from './types';
import type { PipelineRun } from '@/api/pipelines';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export const dashboardLinks: DashboardLink[] = [
  {
    name: '总览看板',
    icon: <DashboardOutlined />,
    color: colors.primary[500],
    path: '/dashboard/executive',
    desc: '全局 KPI、趋势、排行',
  },
  {
    name: '经理看板',
    icon: <TeamOutlined />,
    color: colors.purple[500],
    path: '/dashboard/manager',
    desc: '团队明细、周环比',
  },
  {
    name: '个人看板',
    icon: <UserSwitchOutlined />,
    color: colors.success[500],
    path: '/dashboard/engineer',
    desc: '个人效能、在手工单',
  },
  {
    name: '告警中心',
    icon: <AlertOutlined />,
    color: colors.error[400],
    path: '/alerts',
    desc: '告警列表、确认处理',
  },
];

export const quickActions: QuickAction[] = [
  {
    name: '创建 Pipeline',
    icon: <RocketOutlined />,
    color: colors.primary[500],
    path: '/pipelines/new',
  },
  {
    name: '运行记录',
    icon: <HistoryOutlined />,
    color: colors.success[500],
    path: '/pipeline-runs',
  },
  {
    name: '部署管理',
    icon: <PlayCircleOutlined />,
    color: colors.purple[500],
    path: '/deployments',
  },
  { name: '告警管理', icon: <AlertOutlined />, color: colors.warning[500], path: '/alerts' },
];

export const statusColors: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
  pending: 'warning',
  healthy: 'success',
  warning: 'warning',
  error: 'error',
  cancelled: 'default',
};

export const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

export const formatDuration = (run: PipelineRun): string => {
  if (run.duration) {
    const seconds = run.duration / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
  return '-';
};

export const formatTimeRelative = (timeStr?: string): string => {
  if (!timeStr) return '-';
  return dayjs(timeStr).locale('zh-cn').fromNow();
};

export const formatTrigger = (trigger: string): string => {
  const map: Record<string, string> = {
    manual: '手动',
    push: '代码推送',
    schedule: '定时',
    api: 'API',
  };
  return map[trigger] || trigger;
};
