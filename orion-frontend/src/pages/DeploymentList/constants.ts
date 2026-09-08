/**
 * DeploymentList constants
 * 抽取自 index.tsx (P2-9 Phase 198)
 */
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const ENV_COLORS: Record<string, string> = {
  production: 'red',
  staging: 'orange',
  development: 'blue',
  test: 'default',
};

export const STRATEGY_LABELS: Record<string, string> = {
  rolling: '滚动更新',
  'blue-green': '蓝绿部署',
  canary: '金丝雀',
  recreate: '重建部署',
};

export const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'status',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '成功', value: 'success' },
      { label: '运行中', value: 'running' },
      { label: '失败', value: 'failed' },
      { label: '警告', value: 'warning' },
    ],
  },
  {
    key: 'environment',
    label: '环境',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Production', value: 'production' },
      { label: 'Staging', value: 'staging' },
      { label: 'Development', value: 'development' },
      { label: 'Test', value: 'test' },
    ],
  },
];
