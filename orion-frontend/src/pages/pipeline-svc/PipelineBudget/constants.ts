/**
 * Pipeline Budget constants
 * 抽取自 index.tsx (P2-9 Phase 152)
 */
export interface AlertLevelConfigItem {
  label: string;
  color: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export const ALERT_LEVEL_CONFIG: Record<string, AlertLevelConfigItem> = {
  info: { label: '提示', color: 'blue', type: 'info' },
  warning: { label: '警告', color: 'orange', type: 'warning' },
  critical: { label: '严重', color: 'red', type: 'error' },
  resolved: { label: '已解决', color: 'green', type: 'success' },
};

export const POLICY_LABEL_MAP: Record<string, string> = {
  warn: '仅警告',
  block: '阻断执行',
  rollback: '回滚',
};

export const TIME_POLICY_OPTIONS: Array<{ value: 'warn' | 'block' | 'rollback'; label: string }> = [
  { value: 'warn', label: '仅警告 - 记录警告但不中断' },
  { value: 'block', label: '阻断执行 - 超过预算后阻止运行' },
  { value: 'rollback', label: '回滚 - 超时后自动回滚' },
];

export const COST_POLICY_OPTIONS: Array<{ value: 'warn' | 'block'; label: string }> = [
  { value: 'warn', label: '仅警告 - 记录警告但不中断' },
  { value: 'block', label: '阻断执行 - 超过预算后阻止运行' },
];
