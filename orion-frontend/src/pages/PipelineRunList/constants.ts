/**
 * PipelineRunList constants
 * 抽取自 index.tsx (P2-9 Phase 180)
 */
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export const TRIGGER_LABEL: Record<string, string> = {
  manual: '手动触发',
  push: 'Push 触发',
  schedule: '定时触发',
  api: 'API 触发',
};

export const TRIGGER_TAG_COLORS: Record<string, string> = {
  manual: 'blue',
  push: 'green',
  schedule: 'orange',
  api: 'purple',
};

export function formatDuration(ms?: number | string): string {
  const numMs = typeof ms === 'string' ? parseInt(ms, 10) : ms;
  if (!numMs || numMs <= 0) return '-';
  const dur = dayjs.duration(numMs, 'milliseconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export const STATUS_FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '运行中', value: 'running' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
  { label: '等待中', value: 'pending' },
];
