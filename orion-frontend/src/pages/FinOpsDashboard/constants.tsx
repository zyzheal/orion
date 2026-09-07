/**
 * FinOpsDashboard constants
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
export const effortConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: '低投入' },
  medium: { color: 'orange', label: '中投入' },
  high: { color: 'red', label: '高投入' },
};

export const optimizationStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  applied: { color: 'success', label: '已应用' },
  rejected: { color: 'error', label: '已拒绝' },
};

export const alertStatusConfig: Record<string, { color: string; label: string }> = {
  exceeded: { color: 'red', label: '已超支' },
  warning: { color: 'orange', label: '接近上限' },
  normal: { color: 'green', label: '正常' },
};
