/**
 * constants.ts - EphemeralEnvList 常量
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: '全部', value: 'all' },
  { label: 'Provisioning', value: 'provisioning' },
  { label: 'Running', value: 'running' },
  { label: 'Idle', value: 'idle' },
  { label: 'Tearing Down', value: 'tearing_down' },
  { label: 'Destroyed', value: 'destroyed' },
];

export const STATUS_TO_COLOR: Record<string, string> = {
  provisioning: 'processing',
  running: 'success',
  idle: 'warning',
  tearing_down: 'default',
  destroyed: 'error',
};

export const STATUS_LABEL: Record<string, string> = {
  provisioning: '创建中',
  running: '运行中',
  idle: '空闲',
  tearing_down: '销毁中',
  destroyed: '已销毁',
};

export const STATUS_FILTER_DEF: FilterDefinition = {
  key: 'status',
  label: '状态',
  options: STATUS_OPTIONS,
};

export const REPO_FILTER_BASE: FilterDefinition = {
  key: 'repo',
  label: '仓库',
  options: [{ label: '全部', value: 'all' }],
};
