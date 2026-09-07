/**
 * EngineerDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import { colors } from '@/tokens';

export const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

export const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
      return COLORS.error;
    case 'high':
      return colors.warning[500];
    case 'medium':
      return COLORS.warning;
    case 'low':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

export const priorityName = (priority: string): string => {
  const names: Record<string, string> = {
    critical: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };
  return names[priority] || priority;
};

export const statusName = (status: string): string => {
  const names: Record<string, string> = {
    'in-progress': '处理中',
    assigned: '已分配',
    pending: '待处理',
    resolved: '已解决',
  };
  return names[status] || status;
};

export const categoryName = (category: string): string => {
  const names: Record<string, string> = {
    infrastructure: '基础设施',
    application: '应用',
    database: '数据库',
    network: '网络',
    security: '安全',
    deployment: '部署',
    pipeline: '流水线',
    performance: '性能',
  };
  return names[category] || category;
};

export const gradeColorMap: Record<string, string> = {
  A: COLORS.success,
  'A-': COLORS.success,
  'B+': COLORS.info,
  B: COLORS.info,
  C: COLORS.warning,
  D: COLORS.error,
};
