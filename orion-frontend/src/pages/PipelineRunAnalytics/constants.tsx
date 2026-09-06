/**
 * PipelineRunAnalytics Constants
 * statusConfig + computeStats + formatDuration
 */
import React from 'react';
import {
  CloseCircleOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { RunRecord, RunStats } from './types';

export const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  success: { color: 'green', icon: <CheckCircleOutlined />, label: '成功' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, label: '失败' },
  running: { color: 'blue', icon: <PauseCircleOutlined />, label: '运行中' },
  pending: { color: 'default', icon: <ClockCircleOutlined />, label: '等待' },
  cancelled: { color: 'orange', icon: <PauseCircleOutlined />, label: '取消' },
};

export const computeStats = (runs: RunRecord[]): RunStats => {
  const success = runs.filter((r) => r.status === 'success');
  const failed = runs.filter((r) => r.status === 'failed');
  const cancelled = runs.filter((r) => r.status === 'cancelled');
  const running = runs.filter((r) => r.status === 'running');
  const durations = success
    .map((r) => (typeof r.durationMs === 'string' ? parseInt(r.durationMs, 10) : r.durationMs))
    .filter((d): d is number => d != null && d > 0);
  const avgDurationMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
  const minDurationMs = durations.length > 0 ? Math.min(...durations) : 0;
  return {
    total: runs.length,
    success: success.length,
    failed: failed.length,
    cancelled: cancelled.length,
    running: running.length,
    successRate: runs.length > 0 ? Math.round((success.length / runs.length) * 100) : 0,
    avgDurationMs: Math.round(avgDurationMs),
    maxDurationMs,
    minDurationMs,
  };
};

export const formatDuration = (ms: number): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
};

export const toNumberMs = (v: number | string | undefined): number =>
  typeof v === 'string' ? parseInt(v, 10) : (v ?? 0);
