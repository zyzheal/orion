/**
 * PipelineMonitor API
 */
import api from '@/api/client';
import { getPipelineRunStages } from '@/api/pipelineRuns';

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

/**
 * 每日运行趋势数据类型
 */
export interface DailyRunStats {
  date: string;
  success: number;
  failed: number;
  running: number;
  cancelled: number;
  total: number;
  avgDuration: number;
}

/**
 * 失败阶段统计
 */
export interface FailedStageStat {
  stageName: string;
  count: number;
}

/**
 * 从运行列表构建每日趋势数据
 */
export function buildDailyStats(
  runs: Array<{ status: string; durationMs?: number | string; createdAt: string }>
): DailyRunStats[] {
  const dayMap = new Map<
    string,
    { success: number; failed: number; running: number; cancelled: number; durations: number[] }
  >();

  runs.forEach((run) => {
    const day = run.createdAt?.slice(0, 10);
    if (!day) return;
    if (!dayMap.has(day)) {
      dayMap.set(day, { success: 0, failed: 0, running: 0, cancelled: 0, durations: [] });
    }
    const entry = dayMap.get(day)!;
    if (run.status === 'success') entry.success++;
    else if (run.status === 'failed') entry.failed++;
    else if (run.status === 'running') entry.running++;
    else if (run.status === 'cancelled') entry.cancelled++;
    const dur = typeof run.durationMs === 'string' ? parseFloat(run.durationMs) : run.durationMs;
    if (dur && dur > 0) entry.durations.push(dur);
  });

  // 按日期排序
  const sortedDays = Array.from(dayMap.keys()).sort();

  return sortedDays.map((date) => {
    const entry = dayMap.get(date)!;
    const avgDuration =
      entry.durations.length > 0
        ? entry.durations.reduce((s, d) => s + d, 0) / entry.durations.length
        : 0;
    return {
      date,
      success: entry.success,
      failed: entry.failed,
      running: entry.running,
      cancelled: entry.cancelled,
      total: entry.success + entry.failed + entry.running + entry.cancelled,
      avgDuration,
    };
  });
}

/**
 * 计算百分位耗时
 */
export function calculatePercentile(durations: number[], percentile: number): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 获取失败运行阶段的 Top N 统计
 * 通过 getPipelineRunStages 获取每个失败运行的实际失败阶段
 * 使用缓存避免重复请求
 */
export async function getFailedStageStats(
  failedRunIds: string[],
  cache: Map<string, Array<{ name: string; status: string }>>
): Promise<FailedStageStat[]> {
  const stageCountMap = new Map<string, number>();

  // 批量获取阶段数据（带缓存）
  const uncachedIds = failedRunIds.filter((id) => !cache.has(id));

  // 限制并发请求数量，避免过多 API 调用
  const batchSize = 5;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (runId) => {
        try {
          const res = await getPipelineRunStages(runId);
          const rawData = (res.data as any)?.data ?? res.data ?? [];
          const stages: Array<{ name: string; status: string }> = Array.isArray(rawData)
            ? rawData
            : [];
          cache.set(runId, stages);
        } catch {
          cache.set(runId, []);
        }
      })
    );
  }

  // 统计失败阶段
  failedRunIds.forEach((runId) => {
    const stages = cache.get(runId) || [];
    // 找到状态为 failed 的阶段
    const failedStages = stages.filter(
      (s: { name: string; status: string }) => s.status === 'failed'
    );
    failedStages.forEach((stage: { name: string; status: string }) => {
      const name = stage.name || 'Unknown Stage';
      stageCountMap.set(name, (stageCountMap.get(name) || 0) + 1);
    });
    // 如果运行失败但没有找到 failed 阶段，标记为整体失败
    if (failedStages.length === 0 && stages.length > 0) {
      // 取最后一个阶段作为失败阶段
      const lastStage = stages[stages.length - 1];
      const name = lastStage.name || 'Unknown Stage';
      stageCountMap.set(name, (stageCountMap.get(name) || 0) + 1);
    } else if (stages.length === 0) {
      stageCountMap.set('未知阶段', (stageCountMap.get('未知阶段') || 0) + 1);
    }
  });

  return Array.from(stageCountMap.entries())
    .map(([stageName, count]) => ({ stageName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
