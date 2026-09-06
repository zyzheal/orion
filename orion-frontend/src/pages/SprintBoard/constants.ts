import { colors } from '@/tokens';

export const sprintStatusColor: Record<string, string> = {
  planning: 'default',
  active: 'processing',
  completed: 'success',
  cancelled: 'error',
};

export const sprintStatusLabel: Record<string, string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

export const priorityColor: Record<string, string> = {
  critical: colors.error[500],
  high: colors.warning[500],
  medium: colors.primary[500],
  low: colors.neutral[400],
};

export const priorityLabel: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const kanbanColumnLabels: Record<string, string> = {
  open: '待处理',
  in_progress: '进行中',
  in_review: '评审中',
  done: '已完成',
  closed: '已关闭',
};
