/**
 * DORA 指标增强计算服务
 *
 * 在 DoraMetricsService 基础上，提供带趋势、目标值、状态的标准指标格式：
 * { value, trend, target, status }
 *
 * 使用 Map 内存存储历史数据，支持趋势分析
 */

import {
  TimeWindow,
  TimeWindowConfig,
  DeploymentRecord,
  PipelineCompletionRecord,
  IncidentRecord,
} from '../efficiency/types';
import { DoraMetricsService } from '../efficiency/DoraMetricsService';

/**
 * 标准指标结果格式
 */
export interface DORAMetricResult {
  /** 指标值 */
  value: number;
  /** 趋势：上升/下降/稳定 */
  trend: 'up' | 'down' | 'stable';
  /** 目标值 */
  target: number;
  /** 状态：达标/预警/不达标 */
  status: 'met' | 'warning' | 'missed';
}

/**
 * 全部 DORA 指标汇总
 */
export interface AllDORAResult {
  deploymentFrequency: DORAMetricResult;
  leadTime: DORAMetricResult;
  changeFailureRate: DORAMetricResult;
  mttr: DORAMetricResult;
  computedAt: Date;
}

/**
 * 历史指标快照
 */
interface MetricSnapshot {
  tenantId: string;
  timeWindow: string;
  deploymentFrequency: number;
  leadTimeMs: number;
  changeFailureRate: number;
  mttrMs: number;
  capturedAt: Date;
}

/**
 * DORA 趋势对比结果
 */
export interface DORATrendResult {
  /** 当前时间段指标 */
  current: AllDORAResult;
  /** 上一个时间段指标 */
  previous: AllDORAResult;
  /** 各指标变化百分比 */
  changes: {
    deploymentFrequency: number;
    leadTime: number;
    changeFailureRate: number;
    mttr: number;
  };
  /** 时间段描述 */
  currentPeriod: string;
  previousPeriod: string;
}

/**
 * 默认 DORA 目标值
 */
const DEFAULT_TARGETS = {
  deploymentsPerDay: 3,      // 日均部署 >= 3 次
  leadTimeHours: 24,         // 变更前置时间 < 24 小时
  changeFailureRate: 5,      // 变更失败率 < 5%
  mttrHours: 1,              // 平均恢复时间 < 1 小时
};

/**
 * DORA 指标增强计算服务
 */
export class DORACalculator {
  private doraService: DoraMetricsService;
  /** 历史快照存储 */
  private snapshotHistory: Map<string, MetricSnapshot[]> = new Map();

  constructor() {
    this.doraService = new DoraMetricsService();
  }

  /**
   * 计算部署频率
   */
  calculateDeploymentFrequency(
    tenantId: string,
    deployments: DeploymentRecord[],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): DORAMetricResult {
    const windowConfig = this.doraService.buildTimeWindow(timeWindow, windowSize);
    const frequency = this.doraService.calculateDeploymentFrequency(deployments, windowConfig);

    // 保存快照
    this.saveSnapshot(tenantId, timeWindow, {
      deploymentFrequency: frequency.deploymentsPerDay,
      leadTimeMs: 0,
      changeFailureRate: 0,
      mttrMs: 0,
    });

    const target = DEFAULT_TARGETS.deploymentsPerDay;
    const trend = this.getTrend(tenantId, 'deploymentFrequency');

    return {
      value: frequency.deploymentsPerDay,
      trend,
      target,
      status: frequency.deploymentsPerDay >= target ? 'met' :
              frequency.deploymentsPerDay >= target * 0.7 ? 'warning' : 'missed',
    };
  }

  /**
   * 计算变更前置时间（返回小时数）
   */
  calculateLeadTime(
    tenantId: string,
    pipelineRecords: PipelineCompletionRecord[],
    deployments: DeploymentRecord[] = [],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): DORAMetricResult {
    const windowConfig = this.doraService.buildTimeWindow(timeWindow, windowSize);
    const leadTime = this.doraService.calculateLeadTimeForChanges(pipelineRecords, windowConfig, deployments);

    const leadTimeHours = leadTime.averageLeadTimeMs / (1000 * 60 * 60);

    this.saveSnapshot(tenantId, timeWindow, {
      deploymentFrequency: 0,
      leadTimeMs: leadTime.averageLeadTimeMs,
      changeFailureRate: 0,
      mttrMs: 0,
    });

    const target = DEFAULT_TARGETS.leadTimeHours;
    const trend = this.getTrend(tenantId, 'leadTimeMs');

    // Lead Time 越低越好，所以趋势和状态判断相反
    return {
      value: Math.round(leadTimeHours * 100) / 100,
      trend: trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'stable',
      target,
      status: leadTimeHours <= target ? 'met' :
              leadTimeHours <= target * 1.5 ? 'warning' : 'missed',
    };
  }

  /**
   * 计算变更失败率
   */
  calculateChangeFailureRate(
    tenantId: string,
    deployments: DeploymentRecord[],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): DORAMetricResult {
    const windowConfig = this.doraService.buildTimeWindow(timeWindow, windowSize);
    const failureRate = this.doraService.calculateChangeFailureRate(deployments, windowConfig);

    this.saveSnapshot(tenantId, timeWindow, {
      deploymentFrequency: 0,
      leadTimeMs: 0,
      changeFailureRate: failureRate.failureRate,
      mttrMs: 0,
    });

    const target = DEFAULT_TARGETS.changeFailureRate;
    const trend = this.getTrend(tenantId, 'changeFailureRate');

    // 失败率越低越好
    return {
      value: failureRate.failureRate,
      trend: trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'stable',
      target,
      status: failureRate.failureRate <= target ? 'met' :
              failureRate.failureRate <= target * 2 ? 'warning' : 'missed',
    };
  }

  /**
   * 计算平均恢复时间（返回小时数）
   */
  calculateMTTR(
    tenantId: string,
    deployments: DeploymentRecord[],
    incidents: IncidentRecord[] = [],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): DORAMetricResult {
    const windowConfig = this.doraService.buildTimeWindow(timeWindow, windowSize);
    const mttr = this.doraService.calculateMeanTimeToRecovery(deployments, windowConfig, incidents);

    const mttrHours = mttr.averageRecoveryTimeMs / (1000 * 60 * 60);

    this.saveSnapshot(tenantId, timeWindow, {
      deploymentFrequency: 0,
      leadTimeMs: 0,
      changeFailureRate: 0,
      mttrMs: mttr.averageRecoveryTimeMs,
    });

    const target = DEFAULT_TARGETS.mttrHours;
    const trend = this.getTrend(tenantId, 'mttrMs');

    // MTTR 越低越好
    return {
      value: Math.round(mttrHours * 100) / 100,
      trend: trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'stable',
      target,
      status: mttrHours <= target ? 'met' :
              mttrHours <= target * 2 ? 'warning' : 'missed',
    };
  }

  /**
   * 计算全部 DORA 指标
   */
  calculateAllDORA(
    tenantId: string,
    deployments: DeploymentRecord[],
    pipelineRecords: PipelineCompletionRecord[],
    incidents: IncidentRecord[] = [],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): AllDORAResult {
    return {
      deploymentFrequency: this.calculateDeploymentFrequency(tenantId, deployments, timeWindow, windowSize),
      leadTime: this.calculateLeadTime(tenantId, pipelineRecords, deployments, timeWindow, windowSize),
      changeFailureRate: this.calculateChangeFailureRate(tenantId, deployments, timeWindow, windowSize),
      mttr: this.calculateMTTR(tenantId, deployments, incidents, timeWindow, windowSize),
      computedAt: new Date(),
    };
  }

  /**
   * 获取 DORA 趋势（对比当前时间段与上一个时间段）
   */
  getDORATrend(
    tenantId: string,
    deployments: DeploymentRecord[],
    pipelineRecords: PipelineCompletionRecord[],
    incidents: IncidentRecord[] = [],
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): DORATrendResult {
    // 计算当前时间段的指标
    const current = this.calculateAllDORA(
      tenantId, deployments, pipelineRecords, incidents, timeWindow, windowSize
    );

    // 计算上一个时间段的指标（使用相同大小的前一个时间窗口）
    // 通过过滤出更早的数据来模拟上一个时间段
    const now = new Date();
    const windowMs = this.getWindowDurationMs(timeWindow, windowSize);
    const previousStart = new Date(now.getTime() - windowMs * 2);
    const previousEnd = new Date(now.getTime() - windowMs);

    const previousDeployments = deployments.filter((d) => {
      const deployedAt = d.deployedAt instanceof Date ? d.deployedAt : new Date(d.deployedAt as unknown as string);
      return deployedAt >= previousStart && deployedAt < previousEnd;
    });
    const previousPipelines = pipelineRecords.filter((r) => {
      const completedAt = r.completedAt instanceof Date ? r.completedAt : new Date(r.completedAt as unknown as string);
      return completedAt >= previousStart && completedAt < previousEnd;
    });
    const previousIncidents = incidents.filter((i) => {
      const detectedAt = i.detectedAt instanceof Date ? i.detectedAt : new Date(i.detectedAt as unknown as string);
      return detectedAt >= previousStart && detectedAt < previousEnd;
    });

    const previous = this.calculateAllDORA(
      tenantId, previousDeployments, previousPipelines, previousIncidents, timeWindow, windowSize
    );

    // 计算变化百分比
    const changes = {
      deploymentFrequency: this.calcPercentageChange(
        current.deploymentFrequency.value, previous.deploymentFrequency.value
      ),
      leadTime: this.calcPercentageChange(current.leadTime.value, previous.leadTime.value),
      changeFailureRate: this.calcPercentageChange(
        current.changeFailureRate.value, previous.changeFailureRate.value
      ),
      mttr: this.calcPercentageChange(current.mttr.value, previous.mttr.value),
    };

    return {
      current,
      previous,
      changes,
      currentPeriod: `last ${windowSize} ${timeWindow}(s)`,
      previousPeriod: `${windowSize} ${timeWindow}(s) before that`,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 保存指标快照
   */
  private saveSnapshot(
    tenantId: string,
    timeWindow: TimeWindow,
    metrics: Omit<MetricSnapshot, 'tenantId' | 'timeWindow' | 'capturedAt'>
  ): void {
    const history = this.snapshotHistory.get(tenantId) ?? [];
    history.push({
      tenantId,
      timeWindow,
      ...metrics,
      capturedAt: new Date(),
    });
    // 保留最近 100 条快照
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.snapshotHistory.set(tenantId, history);
  }

  /**
   * 获取指标趋势（与上一次快照对比）
   */
  private getTrend(tenantId: string, metricKey: keyof Pick<MetricSnapshot, 'deploymentFrequency' | 'leadTimeMs' | 'changeFailureRate' | 'mttrMs'>): 'up' | 'down' | 'stable' {
    const history = this.snapshotHistory.get(tenantId);
    if (!history || history.length < 2) {
      return 'stable';
    }

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const currentValue = latest[metricKey];
    const previousValue = previous[metricKey];

    if (currentValue === 0 && previousValue === 0) {
      return 'stable';
    }
    if (previousValue === 0) {
      return currentValue > 0 ? 'up' : 'stable';
    }

    const change = (currentValue - previousValue) / previousValue;
    const threshold = 0.05; // 5% 变化才算趋势

    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'stable';
  }

  /**
   * 获取时间窗口的毫秒数
   */
  private getWindowDurationMs(timeWindow: TimeWindow, size: number): number {
    const dayMs = 24 * 60 * 60 * 1000;
    switch (timeWindow) {
      case 'day':
        return dayMs * size;
      case 'week':
        return dayMs * 7 * size;
      case 'month':
        return dayMs * 30 * size;
      case 'quarter':
        return dayMs * 90 * size;
      default:
        return dayMs * 7 * size;
    }
  }

  /**
   * 计算变化百分比
   */
  private calcPercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }
}
