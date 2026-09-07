/**
 * ManagerDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { colors } from '@/tokens';

export const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
};

export function msToHours(ms: number): string {
  const hours = ms / (1000 * 3600);
  return `${hours.toFixed(1)}h`;
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
    case 'A-':
      return COLORS.success;
    case 'B+':
    case 'B':
      return COLORS.info;
    case 'C':
      return COLORS.warning;
    case 'D':
      return COLORS.error;
    default:
      return colors.neutral[400];
  }
}
