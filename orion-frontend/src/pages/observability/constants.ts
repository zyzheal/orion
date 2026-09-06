/**
 * Observability constants
 * 全栈可观测性页常量（抽取自 ObservabilityPage.tsx）
 */

// 告警严重度颜色映射
export const severityColorMap: Record<string, string> = {
  critical: 'error',
  warning: 'warning',
  info: 'blue',
};

// 服务健康状态颜色映射
export const healthColorMap: Record<string, string> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

// 根因分析状态颜色映射
export const rcaStatusColorMap: Record<string, string> = {
  analyzing: 'processing',
  completed: 'success',
  failed: 'error',
};

// 告警条件标签映射
export const conditionLabels: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '==',
  gte: '>=',
  lte: '<=',
  neq: '!=',
};
