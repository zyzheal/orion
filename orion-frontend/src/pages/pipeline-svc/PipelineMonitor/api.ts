/**
 * PipelineMonitor API
 */
import api from '@/api/client';

export interface RunStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  failedCount: number;
}

/**
 * 获取 Pipeline 运行统计数据
 * 备用接口：如果后端没有专门的 stats 端点，使用 getAllPipelineRuns 聚合
 */
export function getRunStats(params?: { days?: number }): Promise<{ data: RunStats }> {
  return api.get('/v1/pipelines/stats', { params });
}

/**
 * 获取 Pipeline 指标数据（SSE metrics 端点，首次请求返回快照）
 */
export function getPipelineMetrics(): Promise<{ data: { data: any[] } }> {
  return api.get('/v1/pipelines/sse/metrics');
}