/**
 * DORA 指标计算服务
 *
 * 计算 DORA 四项核心指标：
 * 1. Deployment Frequency (部署频率)
 * 2. Lead Time for Changes (变更前置时间)
 * 3. Change Failure Rate (变更失败率)
 * 4. Mean Time to Recovery (平均恢复时间)
 *
 * 支持按日/周/月/季度聚合
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TimeWindow,
  TimeWindowConfig,
  DeploymentFrequency,
  LeadTimeForChanges,
  ChangeFailureRate,
  MeanTimeToRecovery,
  DoraMetricsReport,
  PipelineCompletionRecord,
  DeploymentRecord,
  DeploymentFailureRecord,
  IncidentRecord,
} from '../types/efficiency';

/**
 * DORA 等级评估阈值
 */
const DORA_THRESHOLDS = {
  deploymentFrequency: {
    on_demand: 1,    // 按需部署（每天多次）
    daily: 1 / 7,    // 每天至少 1 次
    weekly: 1 / 30,  // 每周至少 1 次
    monthly: 1 / 180,// 每月至少 1 次
  },
  leadTimeMs: {
    elite: 3600000,       // < 1 小时
    high: 86400000,       // < 1 天
    medium: 604800000,    // < 1 周
  },
  failureRate: {
    elite: 5,    // < 5%
    high: 10,    // < 10%
    medium: 15,  // < 15%
  },
  recoveryTimeMs: {
    elite: 3600000,       // < 1 小时
    high: 86400000,       // < 1 天
    medium: 604800000,    // < 1 周
  },
};

/**
 * DORA 指标计算服务
 */
export class DoraMetricsService {
  /**
   * 构建时间窗口配置
   */
  buildTimeWindow(window: TimeWindow, size: number = 1, referenceDate: Date = new Date()): TimeWindowConfig {
    const now = referenceDate;
    let start: Date;
    const end: Date = new Date(now);

    switch (window) {
      case 'day':
        start = new Date(now);
        start.setDate(start.getDate() - size);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - size * 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - size);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(start.getMonth() - size * 3);
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 7); // 默认一周
    }

    return {
      window,
      size,
      start,
      end,
    };
  }

  /**
   * 计算部署频率 (Deployment Frequency)
   *
   * 单位时间内成功部署到生产环境的次数
   */
  calculateDeploymentFrequency(
    deployments: DeploymentRecord[],
    windowConfig: TimeWindowConfig
  ): DeploymentFrequency {
    // 筛选时间窗口内的部署
    const windowDeployments = deployments.filter(
      (d) => d.deployedAt >= windowConfig.start && d.deployedAt <= windowConfig.end
    );

    const successful = windowDeployments.filter((d) => d.status === 'success').length;
    const failed = windowDeployments.filter((d) => d.status === 'failed').length;
    const total = windowDeployments.length;

    // 计算日均部署次数
    const daysInWindow = this.getDaysInWindow(windowConfig);
    const deploymentsPerDay = daysInWindow > 0 ? total / daysInWindow : 0;

    // 评估等级
    const frequencyLevel = this.evaluateDeploymentFrequency(deploymentsPerDay);

    return {
      window: windowConfig,
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: failed,
      deploymentsPerDay: Math.round(deploymentsPerDay * 100) / 100,
      frequencyLevel,
    };
  }

  /**
   * 计算变更前置时间 (Lead Time for Changes)
   *
   * 优先使用 commit_committed_at → deployed_at 真实链路时间
   * 如果缺少 commit 时间，回退到 Pipeline durationMs 近似值
   */
  calculateLeadTimeForChanges(
    pipelineRecords: PipelineCompletionRecord[],
    windowConfig: TimeWindowConfig,
    deployments?: DeploymentRecord[]
  ): LeadTimeForChanges {
    // 尝试使用真实 commit → deploy 链路计算
    if (deployments && deployments.length > 0) {
      const validDeployments = deployments.filter(
        (d) =>
          d.status === 'success' &&
          d.commitCommittedAt &&
          d.deployedAt >= windowConfig.start &&
          d.deployedAt <= windowConfig.end
      );

      if (validDeployments.length > 0) {
        // 真实 Lead Time: deployed_at - commit_committed_at
        const leadTimes = validDeployments
          .map((d) => {
            const deployedAt = new Date(d.deployedAt).getTime();
            const committedAt = new Date(d.commitCommittedAt!).getTime();
            return deployedAt - committedAt;
          })
          .sort((a, b) => a - b);

        const totalChanges = leadTimes.length;
        const averageLeadTimeMs = leadTimes.reduce((sum, t) => sum + t, 0) / totalChanges;
        const medianLeadTimeMs = this.getPercentile(leadTimes, 50);
        const p90LeadTimeMs = this.getPercentile(leadTimes, 90);
        const p99LeadTimeMs = this.getPercentile(leadTimes, 99);
        const leadTimeLevel = this.evaluateLeadTime(averageLeadTimeMs);

        return {
          window: windowConfig,
          totalChanges,
          averageLeadTimeMs: Math.round(averageLeadTimeMs),
          medianLeadTimeMs: Math.round(medianLeadTimeMs),
          p90LeadTimeMs: Math.round(p90LeadTimeMs),
          p99LeadTimeMs: Math.round(p99LeadTimeMs),
          leadTimeLevel,
          calculationMethod: 'commit_to_deploy',
        };
      }
    }

    // 回退：使用 Pipeline durationMs 近似值
    const windowRecords = pipelineRecords.filter(
      (r) =>
        r.status === 'success' &&
        r.completedAt >= windowConfig.start &&
        r.completedAt <= windowConfig.end
    );

    const leadTimes = windowRecords.map((r) => r.durationMs).sort((a, b) => a - b);
    const totalChanges = leadTimes.length;

    if (totalChanges === 0) {
      return {
        window: windowConfig,
        totalChanges: 0,
        averageLeadTimeMs: 0,
        medianLeadTimeMs: 0,
        p90LeadTimeMs: 0,
        p99LeadTimeMs: 0,
        leadTimeLevel: 'low',
        calculationMethod: 'pipeline_duration',
      };
    }

    const averageLeadTimeMs = leadTimes.reduce((sum, t) => sum + t, 0) / totalChanges;
    const medianLeadTimeMs = this.getPercentile(leadTimes, 50);
    const p90LeadTimeMs = this.getPercentile(leadTimes, 90);
    const p99LeadTimeMs = this.getPercentile(leadTimes, 99);

    const leadTimeLevel = this.evaluateLeadTime(averageLeadTimeMs);

    return {
      window: windowConfig,
      totalChanges,
      averageLeadTimeMs: Math.round(averageLeadTimeMs),
      medianLeadTimeMs: Math.round(medianLeadTimeMs),
      p90LeadTimeMs: Math.round(p90LeadTimeMs),
      p99LeadTimeMs: Math.round(p99LeadTimeMs),
      leadTimeLevel,
      calculationMethod: 'pipeline_duration',
    };
  }

  /**
   * 计算变更失败率 (Change Failure Rate)
   *
   * 部署到生产环境后导致失败的百分比
   */
  calculateChangeFailureRate(
    deployments: DeploymentRecord[],
    windowConfig: TimeWindowConfig
  ): ChangeFailureRate {
    // 筛选时间窗口内的部署
    const windowDeployments = deployments.filter(
      (d) => d.deployedAt >= windowConfig.start && d.deployedAt <= windowConfig.end
    );

    const total = windowDeployments.length;
    const failed = windowDeployments.filter(
      (d) => d.status === 'failed' || d.status === 'rolled_back'
    );

    const failureRate = total > 0 ? (failed.length / total) * 100 : 0;
    const failureRateLevel = this.evaluateFailureRate(failureRate);

    // 构建失败详情
    const failureDetails: DeploymentFailureRecord[] = failed.map((d) => ({
      deploymentId: d.deploymentId,
      service: d.service,
      environment: d.environment,
      failedAt: d.deployedAt,
      recoveryTimeMs: d.recoveryTimeMs,
    }));

    return {
      window: windowConfig,
      totalDeployments: total,
      failedDeployments: failed.length,
      failureRate: Math.round(failureRate * 100) / 100,
      failureRateLevel,
      failureDetails,
    };
  }

  /**
   * 计算平均恢复时间 (Mean Time to Recovery)
   *
   * 优先使用 incidents 表的真实恢复时间
   * 如果缺少 incidents 数据，回退到 deployments 的 recoveryTimeMs 近似值
   */
  calculateMeanTimeToRecovery(
    deployments: DeploymentRecord[],
    windowConfig: TimeWindowConfig,
    incidents?: IncidentRecord[]
  ): MeanTimeToRecovery {
    // 尝试使用真实 incidents 数据计算 MTTR
    if (incidents && incidents.length > 0) {
      const resolvedIncidents = incidents.filter(
        (i) =>
          i.status === 'resolved' &&
          i.recoveryTimeMs !== undefined &&
          i.detectedAt >= windowConfig.start &&
          i.detectedAt <= windowConfig.end
      );

      if (resolvedIncidents.length > 0) {
        const recoveryTimes = resolvedIncidents
          .map((i) => i.recoveryTimeMs!)
          .sort((a, b) => a - b);

        const totalIncidents = incidents.filter(
          (i) => i.detectedAt >= windowConfig.start && i.detectedAt <= windowConfig.end
        ).length;

        const averageRecoveryTimeMs = recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length;
        const medianRecoveryTimeMs = this.getPercentile(recoveryTimes, 50);
        const p90RecoveryTimeMs = this.getPercentile(recoveryTimes, 90);
        const p99RecoveryTimeMs = this.getPercentile(recoveryTimes, 99);
        const recoveryTimeLevel = this.evaluateRecoveryTime(averageRecoveryTimeMs);

        return {
          window: windowConfig,
          totalIncidents,
          recoveredIncidents: resolvedIncidents.length,
          averageRecoveryTimeMs: Math.round(averageRecoveryTimeMs),
          medianRecoveryTimeMs: Math.round(medianRecoveryTimeMs),
          p90RecoveryTimeMs: Math.round(p90RecoveryTimeMs),
          p99RecoveryTimeMs: Math.round(p99RecoveryTimeMs),
          recoveryTimeLevel,
          calculationMethod: 'incidents_table',
        };
      }
    }

    // 回退：使用 deployments 的 recoveryTimeMs 近似值
    const windowIncidents = deployments.filter(
      (d) =>
        (d.status === 'failed' || d.status === 'rolled_back') &&
        d.deployedAt >= windowConfig.start &&
        d.deployedAt <= windowConfig.end
    );

    const totalIncidents = windowIncidents.length;

    // 使用有恢复时间记录的作为已恢复
    const recovered = windowIncidents.filter((d) => d.recoveryTimeMs !== undefined);

    if (totalIncidents === 0) {
      return {
        window: windowConfig,
        totalIncidents: 0,
        recoveredIncidents: 0,
        averageRecoveryTimeMs: 0,
        medianRecoveryTimeMs: 0,
        p90RecoveryTimeMs: 0,
        recoveryTimeLevel: 'low',
        calculationMethod: 'deployment_recovery',
      };
    }

    const recoveryTimes = recovered.map((d) => d.recoveryTimeMs!).sort((a, b) => a - b);
    const totalRecoveryMs = recoveryTimes.reduce((sum, t) => sum + t, 0);
    const averageRecoveryTimeMs = recoveryTimes.length > 0 ? totalRecoveryMs / recoveryTimes.length : 0;
    const medianRecoveryTimeMs = recoveryTimes.length > 0 ? this.getPercentile(recoveryTimes, 50) : 0;
    const p90RecoveryTimeMs = recoveryTimes.length > 0 ? this.getPercentile(recoveryTimes, 90) : 0;
    const p99RecoveryTimeMs = recoveryTimes.length > 0 ? this.getPercentile(recoveryTimes, 99) : 0;

    const recoveryTimeLevel = this.evaluateRecoveryTime(averageRecoveryTimeMs);

    return {
      window: windowConfig,
      totalIncidents,
      recoveredIncidents: recovered.length,
      averageRecoveryTimeMs: Math.round(averageRecoveryTimeMs),
      medianRecoveryTimeMs: Math.round(medianRecoveryTimeMs),
      p90RecoveryTimeMs: Math.round(p90RecoveryTimeMs),
      p99RecoveryTimeMs: Math.round(p99RecoveryTimeMs),
      recoveryTimeLevel,
      calculationMethod: 'deployment_recovery',
    };
  }

  /**
   * 生成完整的 DORA 指标报告
   */
  generateReport(
    tenantId: string,
    pipelineRecords: PipelineCompletionRecord[],
    deployments: DeploymentRecord[],
    windowConfig: TimeWindowConfig
  ): DoraMetricsReport {
    const deploymentFrequency = this.calculateDeploymentFrequency(deployments, windowConfig);
    const leadTimeForChanges = this.calculateLeadTimeForChanges(pipelineRecords, windowConfig);
    const changeFailureRate = this.calculateChangeFailureRate(deployments, windowConfig);
    const meanTimeToRecovery = this.calculateMeanTimeToRecovery(deployments, windowConfig);

    // 计算综合效能等级（取最差的一项作为整体等级）
    const overallLevel = this.calculateOverallLevel(
      deploymentFrequency.frequencyLevel,
      leadTimeForChanges.leadTimeLevel,
      changeFailureRate.failureRateLevel,
      meanTimeToRecovery.recoveryTimeLevel
    );

    return {
      reportId: uuidv4(),
      tenantId,
      window: windowConfig,
      deploymentFrequency,
      leadTimeForChanges,
      changeFailureRate,
      meanTimeToRecovery,
      overallLevel,
      generatedAt: new Date(),
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 计算时间窗口的天数
   */
  private getDaysInWindow(windowConfig: TimeWindowConfig): number {
    const msInDay = 24 * 60 * 60 * 1000;
    return Math.max(1, (windowConfig.end.getTime() - windowConfig.start.getTime()) / msInDay);
  }

  /**
   * 计算百分位数
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * 评估部署频率等级
   */
  private evaluateDeploymentFrequency(deploymentsPerDay: number): DeploymentFrequency['frequencyLevel'] {
    if (deploymentsPerDay >= DORA_THRESHOLDS.deploymentFrequency.on_demand) {
      return 'on-demand';
    }
    if (deploymentsPerDay >= DORA_THRESHOLDS.deploymentFrequency.daily) {
      return 'daily';
    }
    if (deploymentsPerDay >= DORA_THRESHOLDS.deploymentFrequency.weekly) {
      return 'weekly';
    }
    if (deploymentsPerDay >= DORA_THRESHOLDS.deploymentFrequency.monthly) {
      return 'monthly';
    }
    return 'yearly';
  }

  /**
   * 评估变更前置时间等级
   */
  private evaluateLeadTime(averageMs: number): LeadTimeForChanges['leadTimeLevel'] {
    if (averageMs < DORA_THRESHOLDS.leadTimeMs.elite) return 'elite';
    if (averageMs < DORA_THRESHOLDS.leadTimeMs.high) return 'high';
    if (averageMs < DORA_THRESHOLDS.leadTimeMs.medium) return 'medium';
    return 'low';
  }

  /**
   * 评估变更失败率等级
   */
  private evaluateFailureRate(rate: number): ChangeFailureRate['failureRateLevel'] {
    if (rate <= DORA_THRESHOLDS.failureRate.elite) return 'elite';
    if (rate <= DORA_THRESHOLDS.failureRate.high) return 'high';
    if (rate <= DORA_THRESHOLDS.failureRate.medium) return 'medium';
    return 'low';
  }

  /**
   * 评估恢复时间等级
   */
  private evaluateRecoveryTime(averageMs: number): MeanTimeToRecovery['recoveryTimeLevel'] {
    if (averageMs < DORA_THRESHOLDS.recoveryTimeMs.elite) return 'elite';
    if (averageMs < DORA_THRESHOLDS.recoveryTimeMs.high) return 'high';
    if (averageMs < DORA_THRESHOLDS.recoveryTimeMs.medium) return 'medium';
    return 'low';
  }

  /**
   * 计算综合效能等级（取最差的一项）
   */
  private calculateOverallLevel(
    ...levels: Array<'elite' | 'high' | 'medium' | 'low' | 'on-demand' | 'daily' | 'weekly' | 'monthly' | 'yearly'>
  ): DoraMetricsReport['overallLevel'] {
    // 将部署频率等级映射到 DORA 等级
    const frequencyMap: Record<string, number> = {
      elite: 4,
      'on-demand': 4,
      high: 3,
      daily: 3,
      medium: 2,
      weekly: 2,
      low: 1,
      monthly: 1,
      yearly: 0,
    };

    const numericLevels = levels.map((l) => frequencyMap[l] ?? 0);
    const minLevel = Math.min(...numericLevels);

    const reverseMap: Record<number, 'elite' | 'high' | 'medium' | 'low'> = {
      4: 'elite',
      3: 'high',
      2: 'medium',
      1: 'low',
      0: 'low',
    };

    return reverseMap[minLevel] ?? 'low';
  }
}
