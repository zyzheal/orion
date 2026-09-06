/**
 * constants.ts - Cost Allocation 常量
 * 抽取自 CostAllocation/index.tsx (P2-9 Phase 72)
 */

export const scopeTypeLabel: Record<string, string> = {
  cluster: '集群',
  namespace: '命名空间',
  team: '团队',
};

export const scopeTypeColor: Record<string, string> = {
  cluster: 'blue',
  namespace: 'cyan',
  team: 'purple',
};

export const formatCost = (value?: number | null): string => {
  if (value == null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
