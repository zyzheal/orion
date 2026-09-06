/**
 * PipelineRunLive Constants
 * 状态颜色映射、时间格式化、日志 ID 生成
 */
import { colors } from '@/tokens';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export const stageStatusColors: Record<string, string> = {
  success: colors.success[500],
  running: colors.primary[500],
  failed: colors.error[500],
  pending: colors.neutral[300],
  warning: colors.warning[500],
  cancelled: colors.neutral[400],
};

export const logLevelColors: Record<string, string> = {
  info: colors.neutral[300],
  warn: colors.warning[400],
  error: colors.error[400],
  debug: colors.purple[400],
};

export const logLevelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

export function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  const dur = dayjs.duration(seconds, 'seconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function formatTime(date: Date | string): string {
  return dayjs(date).format('HH:mm:ss.SSS');
}

let logIdCounter = 0;
export function makeLogId(): string {
  return `log-${++logIdCounter}-${Date.now()}`;
}
