import { ChatOpsExecutionRepository } from '../../repositories/ChatOpsRepository';

export interface DashboardMetrics {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardTrend {
  date: string;
  executions: number;
  successRate: number;
}

export interface TopCommand {
  command: string;
  count: number;
  successRate: number;
}

export interface PlatformDist {
  platform: string;
  count: number;
}

export interface RecentExecution {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  status: string;
  startTime: Date;
  endTime: Date | null;
}

export interface MetricsComparison {
  totalExecutions: number;
  successRate: number;
  failedCount: number;
  avgResponseTime: number;
}

export interface DashboardStats {
  metrics: DashboardMetrics;
  trends: DashboardTrend[];
  topCommands: TopCommand[];
  platformDistribution: PlatformDist[];
  recentExecutions: RecentExecution[];
  comparison: MetricsComparison;
}

export type TimeRange = '7d' | '30d' | 'month' | 'custom';

export interface TimeRangeParams {
  range: TimeRange;
  startDate?: string;
  endDate?: string;
}

export class DashboardService {
  private executionRepo: ChatOpsExecutionRepository;

  constructor(executionRepo: ChatOpsExecutionRepository) {
    this.executionRepo = executionRepo;
  }

  /** 解析时间范围 */
  private parseTimeRange(params: TimeRangeParams): { start: Date; end: Date } {
    const now = new Date();

    switch (params.range) {
      case '7d': {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return { start, end: now };
      }
      case '30d': {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        return { start, end: now };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
      }
      case 'custom': {
        if (!params.startDate || !params.endDate) {
          throw new Error('custom range requires startDate and endDate');
        }
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 90) {
          throw new Error('custom range cannot exceed 90 days');
        }
        return { start, end };
      }
      default:
        throw new Error(`invalid time range: ${(params as any).range}`);
    }
  }

  /** 计算环比变化 */
  private calcComparison(
    current: DashboardMetrics,
    previous: DashboardMetrics,
  ): MetricsComparison {
    return {
      totalExecutions:
        previous.totalExecutions === 0
          ? 0
          : Math.round(
              ((current.totalExecutions - previous.totalExecutions) /
                previous.totalExecutions) *
                100,
            ),
      successRate:
        previous.successRate === 0
          ? 0
          : Math.round(current.successRate - previous.successRate),
      failedCount:
        previous.failedCount === 0
          ? 0
          : Math.round(
              ((current.failedCount - previous.failedCount) /
                previous.failedCount) *
                100,
            ),
      avgResponseTime:
        previous.avgResponseTime === 0
          ? 0
          : parseFloat(
              (current.avgResponseTime - previous.avgResponseTime).toFixed(1),
            ),
    };
  }

  /** 获取看板统计数据 */
  async getStats(params: TimeRangeParams): Promise<DashboardStats> {
    const { start, end } = this.parseTimeRange(params);

    const currentStats =
      await this.executionRepo.getStatsByTimeRange(start, end);
    const trends = await this.executionRepo.getDailyTrends(start, end);
    const topCommands = await this.executionRepo.getTopCommands(start, end);
    const platformDist =
      await this.executionRepo.getPlatformDistribution(start, end);
    const recentExecs = await this.executionRepo.getRecentExecutions();

    const metrics: DashboardMetrics = {
      totalExecutions: currentStats.total,
      successRate:
        currentStats.total === 0
          ? 0
          : Math.round((currentStats.completed / currentStats.total) * 100),
      failedCount: currentStats.failed,
      avgResponseTime: currentStats.avgResponseTime,
    };

    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime());
    const previousStats =
      await this.executionRepo.getStatsByTimeRange(prevStart, prevEnd);

    const previousMetrics: DashboardMetrics = {
      totalExecutions: previousStats.total,
      successRate:
        previousStats.total === 0
          ? 0
          : Math.round((previousStats.completed / previousStats.total) * 100),
      failedCount: previousStats.failed,
      avgResponseTime: previousStats.avgResponseTime,
    };

    const comparison = this.calcComparison(metrics, previousMetrics);

    return {
      metrics,
      trends,
      topCommands,
      platformDistribution: platformDist,
      recentExecutions: recentExecs,
      comparison,
    };
  }
}
