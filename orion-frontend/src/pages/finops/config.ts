/**
 * FinOps 页面配置常量与标签映射辅助
 *
 * 从 FinOpsPage.tsx 拆出，供列表列定义、表单 Select、
 * 状态渲染等多处共用。
 */

export const periodOptions = [
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每季', value: 'quarterly' },
  { label: '每年', value: 'yearly' },
];

export const entityTypeOptions = [
  { label: '项目', value: 'project' },
  { label: '租户', value: 'tenant' },
  { label: '团队', value: 'team' },
];

export const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '紧急' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'default', label: '低' },
};

export const statusConfig: Record<string, { color: string; label: string }> = {
  identified: { color: 'default', label: '已识别' },
  reviewing: { color: 'processing', label: '评审中' },
  approved: { color: 'blue', label: '已批准' },
  'in-progress': { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已拒绝' },
};

const categoryLabelMap: Record<string, string> = {
  compute: '计算资源',
  storage: '存储',
  network: '网络',
  saas: 'SaaS 工具',
  'right-sizing': '资源调整',
  'unused-resources': '闲置资源',
  'reserved-instances': '预留实例',
  'storage-optimization': '存储优化',
  'network-optimization': '网络优化',
  scheduling: '调度优化',
  architecture: '架构优化',
};

const entityTypeLabelMap: Record<string, string> = {
  project: '项目',
  tenant: '租户',
  team: '团队',
};

export function getCategoryLabel(value: string): string {
  return categoryLabelMap[value] || value;
}

export function getEntityTypeLabel(value: string): string {
  return entityTypeLabelMap[value] || value;
}
