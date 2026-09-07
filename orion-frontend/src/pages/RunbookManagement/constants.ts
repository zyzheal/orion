/**
 * Runbook Management constants
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { colors } from '@/tokens';

export const statusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
  cancelled: colors.warning[500],
  skipped: colors.neutral[300],
};

export const statusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
};

export const categoryOptions = [
  { label: '故障处理', value: 'incident' },
  { label: '部署运维', value: 'deployment' },
  { label: '日常维护', value: 'maintenance' },
  { label: '安全响应', value: 'security' },
];
