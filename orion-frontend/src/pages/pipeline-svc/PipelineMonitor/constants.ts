/**
 * PipelineMonitor constants
 * 运行监控页常量（抽取自 index.tsx）
 */
import { colors } from '@/tokens/colors';

// ============ 实时监控轮询间隔 ============
export const POLLING_INTERVAL_MS = 10000;

// 趋势图最大高度
export const CHART_HEIGHT = 160;

// 状态颜色映射
export const statusColorMap: Record<string, string> = {
  success: colors.success[500],
  failed: colors.error[500],
  running: colors.primary[500],
  cancelled: colors.neutral[500],
  pending: colors.warning[500],
};

// 触发方式标签映射
export const triggerTypeMap: Record<string, string> = {
  manual: '手动',
  push: '推送',
  schedule: '定时',
  api: 'API',
};

// 时间范围选项
export const dayRangeOptions = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
];
