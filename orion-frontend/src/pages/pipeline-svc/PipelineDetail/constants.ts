/**
 * constants.ts - PipelineDetail 常量
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import { colors } from '@/tokens';

// Status color map for stages
export const stageStatusColors: Record<string, string> = {
  success: colors.success[500],
  running: colors.primary[500],
  failed: colors.error[500],
  pending: colors.neutral[300],
  warning: colors.warning[500],
  cancelled: colors.neutral[400],
};

export const triggerLabel: Record<string, string> = {
  manual: '手动触发',
  push: 'Push 触发',
  schedule: '定时触发',
  api: 'API 触发',
};
