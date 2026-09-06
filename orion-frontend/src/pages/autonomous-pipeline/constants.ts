/**
 * constants.ts - Autonomous Pipeline 常量
 * 抽取自 autonomous-pipeline/AutonomousPipelinePage.tsx (P2-9 Phase 73)
 */

export const categoryColorMap: Record<string, string> = {
  infrastructure: 'blue',
  application: 'purple',
  network: 'orange',
  timeout: 'gold',
  permission: 'red',
  unknown: 'default',
};

export const severityColorMap: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'orange',
  critical: 'error',
};
