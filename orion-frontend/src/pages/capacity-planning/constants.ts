/**
 * constants.ts - 容量规划常量
 * 抽取自 CapacityPlanningPage.tsx (P2-9 Phase 92)
 */
import { colors } from '@/tokens/colors';

export const impactColorMap: Record<string, string> = {
  high: colors.error[500],
  medium: colors.warning[500],
  low: colors.info[500],
};

export const severityColorMap: Record<string, string> = {
  critical: colors.error[500],
  warning: colors.warning[500],
  info: colors.info[500],
};

export const typeColorMap: Record<string, string> = {
  compute: colors.primary[500],
  storage: colors.info[500],
  network: colors.success[500],
  database: colors.warning[500],
};
