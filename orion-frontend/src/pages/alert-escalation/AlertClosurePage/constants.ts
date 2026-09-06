/**
 * constants.ts - 告警闭环与升级策略 常量
 * 抽取自 AlertClosurePage/index.tsx (P2-9 Phase 88)
 */

export const SEVERITY_MAP: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '致命' },
  warning: { color: 'orange', label: '警告' },
  info: { color: 'blue', label: '信息' },
};

export const CLOSURE_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待确认' },
  acknowledged: { color: 'gold', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
};
