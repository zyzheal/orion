/**
 * constants.ts - WorkflowTasks 状态与优先级常量
 * 抽取自 WorkflowTasks/index.tsx (P2-9 Phase 99)
 */
import type { TaskStatus } from '@/api/workflow-task';

export const statusColorMap: Record<TaskStatus, string> = {
  pending: 'processing',
  assigned: 'warning',
  completed: 'success',
  cancelled: 'default',
};

export const statusLabelMap: Record<TaskStatus, string> = {
  pending: '待认领',
  assigned: '已认领',
  completed: '已完成',
  cancelled: '已取消',
};

export const priorityColorMap: Record<string, string> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};

export const priorityLabelMap: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export const STATUS_FILTER_OPTIONS: Array<{ label: string; value: TaskStatus | 'all' }> = [
  { label: '全部状态', value: 'all' },
  { label: '待认领', value: 'pending' },
  { label: '已认领', value: 'assigned' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];
