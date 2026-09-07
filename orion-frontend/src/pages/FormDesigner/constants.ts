/**
 * FormDesigner static constants
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { colors } from '@/tokens';

export const COND_KEY = 'formdesigner:conditions';

export const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: colors.neutral[300], label: '草稿' },
  published: { color: colors.success[500], label: '已发布' },
  archived: { color: colors.warning[500], label: '已归档' },
};
