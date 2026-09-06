/**
 * constants.ts - 联邦调度常量
 * 抽取自 FederationPage.tsx (P2-9 Phase 89)
 */

export const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  degraded: 'orange',
  healthy: 'green',
  unhealthy: 'red',
};

export const statusLabelMap: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  degraded: '降级',
  healthy: '健康',
  unhealthy: '不健康',
};

export const jobColorMap: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
};

export const jobLabelMap: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
};
