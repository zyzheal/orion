/**
 * ModuleManager constants
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import { colors } from '@/tokens';
import type { ModuleState } from '@/api/module-manager';

export const LEVEL_OPTIONS = [
  { label: '全部层级', value: 'all' },
  { label: '核心 (Core)', value: 'core' },
  { label: '域 (Domain)', value: 'domain' },
  { label: '服务 (Service)', value: 'service' },
  { label: '特性 (Feature)', value: 'feature' },
];

export const STATUS_OPTIONS = [
  { label: '全部状态', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '已注册', value: 'registered' },
  { label: '已停止', value: 'stopped' },
  { label: '失败', value: 'failed' },
];

export const stateColor: Record<ModuleState, string> = {
  active: colors.success[500],
  registered: colors.neutral[400],
  starting: colors.warning[500],
  stopping: colors.warning[500],
  stopped: colors.error[500],
  failed: colors.error[500],
};

export const stateLabel: Record<ModuleState, string> = {
  active: '活跃',
  registered: '已注册',
  starting: '启动中',
  stopping: '停止中',
  stopped: '已停止',
  failed: '失败',
};

export const levelColor: Record<string, string> = {
  core: colors.error[500],
  domain: colors.purple[500],
  service: colors.info[500],
  feature: colors.success[500],
};

export const levelLabel: Record<string, string> = {
  core: '核心',
  domain: '域',
  service: '服务',
  feature: '特性',
};
