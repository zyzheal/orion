/**
 * PipelineRunAnalytics Types
 * RunRecord / PipelineSummary / RunStats / Bottleneck / DurationBucket
 */

export interface RunRecord {
  id: string;
  pipelineId: string;
  pipelineVersion?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'push' | 'schedule' | 'api';
  triggerBy?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number | string;
  createdAt: string;
}

export interface PipelineSummary {
  id: string;
  name: string;
}

export interface RunStats {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  running: number;
  successRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
}

export interface Bottleneck {
  stageName: string;
  failureCount: number;
  avgDurationMs: number;
  pipelineId: string;
  pipelineName: string;
}

export interface DurationBucket {
  label: string;
  count: number;
  avgMs: number;
}
