/**
 * Traffic Governance constants
 * 抽取自 index.tsx (P2-9 Phase 157)
 */

export const STATUS_COLOR_MAP: Record<string, string> = {
  active: 'green',
  promoted: 'orange',
  completed: 'blue',
  rolled_back: 'red',
};

export const STATUS_LABEL_MAP: Record<string, string> = {
  active: '进行中',
  promoted: '已发布',
  completed: '已完成',
  rolled_back: '已回滚',
};

export function getEnvColor(env: string): string {
  if (env === 'production') return 'red';
  if (env === 'staging') return 'orange';
  return 'blue';
}

export const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
];
