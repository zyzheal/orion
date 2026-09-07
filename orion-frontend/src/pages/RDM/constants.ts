/**
 * RDM constants
 * 抽取自 index.tsx (P2-9 Phase 155)
 */
import { colors } from '@/tokens';

export const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[500], label: 'Critical' },
  high: { color: colors.warning[500], label: 'High' },
  medium: { color: colors.info[500], label: 'Medium' },
  low: { color: colors.success[500], label: 'Low' },
};

export const STATUS_MAP: Record<string, { color: string; label: string }> = {
  backlog: { color: colors.neutral[300], label: 'Backlog' },
  pending: { color: colors.warning[500], label: 'Pending' },
  in_progress: { color: colors.info[500], label: 'In Progress' },
  done: { color: colors.success[500], label: 'Done' },
  open: { color: colors.info[500], label: 'Open' },
  resolved: { color: colors.success[500], label: 'Resolved' },
  closed: { color: colors.neutral[300], label: 'Closed' },
  active: { color: colors.info[500], label: 'Active' },
  completed: { color: colors.success[500], label: 'Completed' },
};

export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
