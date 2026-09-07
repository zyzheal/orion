/**
 * constants.ts - RootCausePage 常量
 * 抽取自 observability/RootCausePage.tsx (P2-9 Phase 70)
 */

export const STATUS_COLOR_MAP: Record<string, string> = {
  analyzing: 'processing',
  completed: 'success',
  failed: 'error',
  partial: 'warning',
};

export const DEP_TYPE_COLOR_MAP: Record<string, string> = {
  sync: 'blue',
  async: 'green',
  database: 'orange',
  cache: 'purple',
  external: 'default',
};

/** RCA 状态色映射（analyzing/completed/failed/partial），与 STATUS_COLOR_MAP 同值 */
export const rcaStatusColorMap: Record<string, string> = {
  analyzing: 'processing',
  completed: 'success',
  failed: 'error',
  partial: 'warning',
};

/** 服务健康状态色映射 */
export const healthColorMap: Record<string, string> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'error',
};

/** 告警严重度色映射 */
export const severityColorMap: Record<string, string> = {
  critical: 'error',
  warning: 'warning',
  info: 'blue',
};

/** 阈值条件运算符符号映射 */
export const conditionLabels: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '==',
  gte: '>=',
  lte: '<=',
  neq: '!=',
};
