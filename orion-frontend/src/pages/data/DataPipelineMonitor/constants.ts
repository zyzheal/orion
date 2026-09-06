/**
 * Data Pipeline Monitor 常量
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import { colors } from '@/tokens';

export const FREQUENCY_CONFIG: Record<string, { color: string; label: string }> = {
  realtime: { color: colors.success[500], label: '实时' },
  hourly: { color: colors.info[500], label: '每小时' },
  daily: { color: colors.warning[500], label: '每天' },
};

export const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  running: { color: colors.success[500], label: '运行中' },
  error: { color: colors.error[500], label: '异常' },
  paused: { color: colors.neutral[400], label: '已暂停' },
  maintenance: { color: colors.info[500], label: '维护中' },
};

export const ALERT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  delay: { color: colors.warning[500], label: '延迟超标' },
  missing: { color: colors.error[500], label: '数据缺失' },
  quality: { color: colors.purple[500], label: '质量不达标' },
  interrupted: { color: colors.error[500], label: '管道中断' },
};

export const ALERT_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.error[500], label: '活跃' },
  resolved: { color: colors.success[500], label: '已解决' },
  acknowledged: { color: colors.warning[500], label: '已确认' },
};

export const NODE_STATUS_COLOR: Record<string, string> = {
  running: colors.success[500],
  error: colors.error[500],
  idle: colors.neutral[400],
};

export const STATUS_OPTIONS = [
  { label: '运行中', value: 'running' },
  { label: '异常', value: 'error' },
  { label: '已暂停', value: 'paused' },
  { label: '维护中', value: 'maintenance' },
];

export const FREQUENCY_OPTIONS = [
  { label: '实时', value: 'realtime' },
  { label: '每小时', value: 'hourly' },
  { label: '每天', value: 'daily' },
];

export const NODE_POSITIONS: Record<string, [number, number]> = {
  s1: [40, 30],
  s2: [40, 150],
  s3: [40, 270],
  s4: [40, 390],
  t1: [250, 90],
  t2: [250, 210],
  t3: [250, 390],
  o1: [460, 60],
  o2: [460, 160],
  o3: [460, 290],
  o4: [460, 390],
};
