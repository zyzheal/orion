/**
 * Cost Operations - 常量与类型映射
 * 从 CostOperationsPage.tsx 抽取
 */

export const severityColorMap: Record<string, string> = {
  low: 'blue',
  medium: 'warning',
  high: 'orange',
};

export const suggestionStatusMap: Record<string, string> = {
  pending: 'default',
  accepted: 'processing',
  rejected: 'error',
  implemented: 'success',
};

export const categoryLabelMap: Record<string, string> = {
  compute: '计算资源',
  storage: '存储资源',
  network: '网络资源',
  idle: '闲置资源',
  rightsizing: '规格优化',
};

export const anomalyTypeMap: Record<string, string> = {
  spike: '成本突增',
  drop: '成本骤降',
  pattern_change: '模式变化',
};

export const effortColorMap: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

export const periodMap: Record<string, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
};
