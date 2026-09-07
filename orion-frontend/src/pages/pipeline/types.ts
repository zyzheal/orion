/**
 * Pipeline 重试与回滚相关类型
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */

export interface PipelineRunItem {
  id: string;
  pipelineId: string;
  pipelineName: string;
  runNumber: number;
  status: 'success' | 'failed' | 'running' | 'cancelled' | 'pending';
  trigger: 'manual' | 'push' | 'schedule' | 'api';
  branch: string;
  commit?: string;
  author: string;
  startTime: string;
  endTime?: string;
  duration?: number; // 秒
  stages: Array<{
    name: string;
    status: 'success' | 'failed' | 'running' | 'pending' | 'skipped';
    duration?: number;
  }>;
  stagesCompleted?: number;
  stagesTotal?: number;
}
