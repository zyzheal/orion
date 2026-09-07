/**
 * ServiceCatalog constants
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  approved: { color: 'green', label: '已批准' },
  in_progress: { color: 'gold', label: '处理中' },
  fulfilled: { color: 'green', label: '已完成' },
  rejected: { color: 'red', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};
