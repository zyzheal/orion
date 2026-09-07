/**
 * HealthDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import { colors } from '@/tokens';

export const severityMap: Record<string, { color: string; text: string }> = {
  critical: { color: colors.error[500], text: '严重' },
  warning: { color: colors.warning[500], text: '警告' },
  info: { color: colors.info[500], text: '信息' },
};

export const alertStatusMap: Record<string, { color: string; text: string }> = {
  active: { color: colors.error[500], text: '活跃' },
  acknowledged: { color: colors.warning[500], text: '已确认' },
  resolved: { color: colors.success[500], text: '已解决' },
};

export const serviceStatusMap: Record<string, { color: string; text: string }> = {
  healthy: { color: colors.success[500], text: '健康' },
  degraded: { color: colors.warning[500], text: '降级' },
  unhealthy: { color: colors.error[500], text: '异常' },
};
