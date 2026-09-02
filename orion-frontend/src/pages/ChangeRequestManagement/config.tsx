/**
 * Change Request Management - Config Constants
 *
 * All status labels, color maps, and display configuration
 * for the Change Request Management page.
 */
import { colors } from '@/tokens';

/* ==================== Status Map ==================== */

export const statusColor: Record<string, string> = {
  draft: 'default',
  pending_approval: 'processing',
  approved: 'success',
  rejected: 'error',
  implementing: 'warning',
  completed: 'success',
  cancelled: 'default',
};

export const statusLabel: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  implementing: '实施中',
  completed: '已完成',
  cancelled: '已取消',
};

/* ==================== Change Type Map ==================== */

export const changeTypeLabel: Record<string, string> = {
  standard: '标准变更',
  normal: '普通变更',
  emergency: '紧急变更',
};

/* ==================== Risk Level Map ==================== */

export const riskLevelColor: Record<string, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  critical: 'volcano',
};

export const riskLevelLabel: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

/* ==================== Impact Scope Map ==================== */

export const impactScopeLabel: Record<string, string> = {
  minor: '轻微',
  major: '重大',
  significant: '显著',
};

/* ==================== Approval Status Map ==================== */

export const approvalStatusLabel: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
};

export const approvalStatusColor: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
};

/* ==================== Execution Step Status Map ==================== */

export const executionStepStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
  skipped: colors.neutral[300],
};

export const executionStepStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};
