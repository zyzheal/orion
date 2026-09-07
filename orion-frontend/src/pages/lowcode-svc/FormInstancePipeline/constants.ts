/**
 * FormInstancePipeline constants
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  submitted: { color: 'gold', label: '已提交' },
  approved: { color: 'green', label: '已批准' },
  rejected: { color: 'red', label: '已拒绝' },
  pending: { color: 'orange', label: '待审批' },
};

export const STATUS_OPTIONS = [
  { value: 'submitted', label: '已提交' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已拒绝' },
];
