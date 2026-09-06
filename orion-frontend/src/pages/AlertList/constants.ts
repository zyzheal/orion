/**
 * constants.ts - AlertList 常量
 * 抽取自 AlertList/index.tsx (P2-9 Phase 64)
 */
import { colors } from '@/tokens';
import type { AlertSeverity, AlertStatus } from '@/types/pages';

export const severityConfig: Record<AlertSeverity, { color: string; label: string; icon: string }> = {
  critical: { color: colors.error[500], label: '严重', icon: '⚠' },
  warning: { color: colors.warning[500], label: '警告', icon: '⚡' },
  info: { color: colors.primary[500], label: '提示', icon: 'ℹ' },
};

export const statusConfig: Record<AlertStatus, { color: string; label: string }> = {
  active: { color: 'red', label: '活跃' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
  suppressed: { color: 'default', label: '已抑制' },
};
