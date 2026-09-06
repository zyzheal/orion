/**
 * constants.ts - 数据管道常量
 * 抽取自 PipelineManagementPage.tsx (P2-9 Phase 90)
 */
export const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'processing', label: '运行中' },
  paused: { color: 'warning', label: '已暂停' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  pending: { color: 'default', label: '等待中' },
};

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '运行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'pending', label: '等待中' },
];
