/**
 * format.ts - PipelineDetail 时间格式化工具
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '-';
  const dur = dayjs.duration(seconds, 'seconds');
  const minutes = Math.floor(dur.asMinutes());
  const secs = dur.seconds();
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};
