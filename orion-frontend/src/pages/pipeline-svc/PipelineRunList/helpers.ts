/**
 * PipelineRunList helpers
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import type { Duration } from 'dayjs/plugin/duration';

dayjs.extend(duration);

/** Format duration in ms to human-readable string */
export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '-';
  const dur: Duration = dayjs.duration(ms, 'milliseconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
