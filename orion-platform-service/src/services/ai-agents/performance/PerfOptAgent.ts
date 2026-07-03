/**
 * PerfOptAgent - 性能优化 Agent
 *
 * 职责：
 * 1. 分析性能指标（CPU、内存、响应时间等）
 * 2. 识别性能瓶颈和问题
 * 3. 生成优化建议
 * 4. 调用 monitoring 工具获取指标数据
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import {
  AgentConfig,
  AgentExecutionContext,
  AgentStatus,
} from '../base/types';
import { BaseAgent } from '../base/BaseAgent';
import { ToolAdapter } from '../base/ToolAdapter';
import { AIGateway } from '../../ai/AIGateway';
import {
  PerformanceAnalysisInput,
  PerformanceAnalysisResult,
  PerformanceMetrics,
  PerformanceIssue,
  OptimizationRecommendation,
  ResourceAnalysis,
  PerformanceIssueType,
  PerformanceThresholds,
  TrendAnalysis,
  ResourceMetricAnalysis,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 默认性能阈值
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  cpuWarningPercent: 70,
  cpuCriticalPercent: 90,
  memoryWarningPercent: 75,
  memoryCriticalPercent: 90,
  responseTimeWarningMs: 500,
  responseTimeCriticalMs: 2000,
  errorRateWarningPercent: 1,
  errorRateCriticalPercent: 5,
};

/**
 * 性能优化 Agent
 *
 * 分析系统性能指标，识别瓶颈，并提供优化建议
 */
export class PerfOptAgent extends BaseAgent {
  private thresholds: PerformanceThresholds;

  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    toolAdapter: ToolAdapter,
    thresholds?: PerformanceThresholds
  ) {
    super(config, aiGateway, toolAdapter);
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 分析性能指标
   *
   * @param input 性能分析输入
   * @param context 执行上下文
   * @returns 性能分析结果
   */
  async analyze(
    input: PerformanceAnalysisInput,
    context: AgentExecutionContext
  ): Promise<PerformanceAnalysisResult> {
    return this.execute(input, context);
  }

  /**
   * 从 Monitoring 工具获取实时指标
   *
   * @param metricType 指标类型
   * @param timeRange 时间范围
   * @param context 执行上下文
   * @returns 性能指标数据
   */
  async fetchMetricsFromMonitoring(
    metricType: string,
    timeRange: string,
    context: AgentExecutionContext
  ): Promise<PerformanceMetrics> {
    const result = await this.callTool(
      'monitoring',
      {
        action: 'metrics',
        metricType,
        timeRange,
      },
      context
    );

    if (!result || !result.metrics) {
      logger.warn({
        msg: 'No metrics returned from monitoring tool',
        metricType,
        timeRange,
      });
      return {};
    }

    // 转换为 PerformanceMetrics 格式
    const metrics: PerformanceMetrics = {};
    for (const m of result.metrics) {
      switch (m.name) {
        case 'system.cpu.usage':
          metrics.cpuUsage = m.value;
          break;
        case 'system.memory.usage':
          metrics.memoryUsage = m.value;
          break;
        case 'system.memory.used':
          metrics.memoryUsed = m.value;
          break;
        case 'system.disk.usage':
          metrics.diskUsage = m.value;
          break;
        case 'system.load.1m':
          metrics.load1m = m.value;
          break;
        case 'system.load.5m':
          metrics.load5m = m.value;
          break;
        case 'system.load.15m':
          metrics.load15m = m.value;
          break;
        case 'app.http.latency':
          metrics.responseTime = m.value;
          break;
        case 'app.errors.count':
          metrics.errorRate = m.value;
          break;
        case 'app.throughput':
          metrics.throughput = m.value;
          break;
      }
    }

    metrics.timestamp = new Date().toISOString();
    return metrics;
  }

  /**
   * 获取当前 Agent 配置的性能阈值
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * 更新性能阈值
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  // ==================== Protected Methods ====================

  /**
   * 实现具体的执行逻辑
   */
  protected async doExecute(
    input: PerformanceAnalysisInput,
    context: AgentExecutionContext
  ): Promise<PerformanceAnalysisResult> {
    const startTime = Date.now();
    const analysisId = uuidv4();

    // 验证上下文
    this.validateContext(context);

    // 如果需要获取历史数据，进行趋势分析
    const historicalMetrics: PerformanceMetrics[] = input.historicalMetrics || [];
    if (input.type === 'trend' && !historicalMetrics.length) {
      // 尝试从 monitoring 工具获取历史数据
      try {
        const historyResult = await this.callTool(
          'monitoring',
          {
            action: 'metrics',
            metricType: 'system',
            timeRange: input.timeRange?.start && input.timeRange?.end
              ? `${input.timeRange.start},${input.timeRange.end}`
              : '1h',
          },
          context
        );
        // 解析历史数据（简化处理）
        logger.debug({ msg: 'Historical metrics fetched', analysisId });
      } catch (error) {
        logger.warn({
          msg: 'Failed to fetch historical metrics',
          analysisId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 分析性能指标
    const issues = this.analyzePerformanceIssues(input.metrics, input.performanceTargets);
    const resourceAnalysis = this.analyzeResources(input.metrics);

    // 生成优化建议
    const recommendations = this.generateRecommendations(issues, resourceAnalysis);

    // 生成趋势分析（如果有历史数据）
    let trendAnalysis: TrendAnalysis | undefined;
    if (historicalMetrics.length > 1) {
      trendAnalysis = this.analyzeTrend(historicalMetrics, input.metrics);
    }

    // 计算健康评分
    const healthScore = this.calculateHealthScore(issues, resourceAnalysis);

    // 生成 AI 详细报告（可选）
    let detailedReport: string | undefined;
    if (this.getConfig().modelConfig?.maxTokens && issues.length > 0) {
      try {
        detailedReport = await this.generateDetailedReport(
          input,
          issues,
          recommendations,
          resourceAnalysis
        );
      } catch (error) {
        logger.warn({
          msg: 'Failed to generate AI report',
          analysisId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 构建分析结果
    const result: PerformanceAnalysisResult = {
      analysisId,
      inputType: input.type,
      summary: this.generateSummary(healthScore, issues, recommendations),
      healthScore,
      issues,
      recommendations,
      resourceAnalysis,
      trendAnalysis,
      detailedReport,
      analyzedAt: new Date().toISOString(),
      analysisDurationMs: Date.now() - startTime,
    };

    logger.info({
      msg: 'Performance analysis completed',
      analysisId,
      healthScore,
      issueCount: issues.length,
      recommendationCount: recommendations.length,
      durationMs: result.analysisDurationMs,
    });

    return result;
  }

  // ==================== Private Analysis Methods ====================

  /**
   * 分析性能问题
   */
  private analyzePerformanceIssues(
    metrics: PerformanceMetrics,
    targets?: { responseTimeMs?: number; throughput?: number; errorRatePercent?: number }
  ): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // CPU 分析
    if (metrics.cpuUsage !== undefined) {
      const severity = this.getSeverity(metrics.cpuUsage, this.thresholds.cpuWarningPercent!, this.thresholds.cpuCriticalPercent!);
      if (severity) {
        issues.push({
          id: uuidv4(),
          type: 'high_cpu' as PerformanceIssueType,
          severity,
          title: 'CPU 使用率过高',
          description: `当前 CPU 使用率为 ${metrics.cpuUsage.toFixed(1)}%，${severity === 'critical' ? '已达到危险水平' : '超过警告阈值'}`,
          affectedMetrics: ['cpuUsage', 'load1m', 'load5m', 'load15m'],
          currentValue: metrics.cpuUsage,
          threshold: severity === 'critical' ? this.thresholds.cpuCriticalPercent : this.thresholds.cpuWarningPercent,
        });
      }
    }

    // 内存分析
    if (metrics.memoryUsage !== undefined) {
      const severity = this.getSeverity(metrics.memoryUsage, this.thresholds.memoryWarningPercent!, this.thresholds.memoryCriticalPercent!);
      if (severity) {
        issues.push({
          id: uuidv4(),
          type: 'high_memory' as PerformanceIssueType,
          severity,
          title: '内存使用率过高',
          description: `当前内存使用率为 ${metrics.memoryUsage.toFixed(1)}%，${severity === 'critical' ? '已达到危险水平' : '超过警告阈值'}`,
          affectedMetrics: ['memoryUsage', 'memoryUsed'],
          currentValue: metrics.memoryUsage,
          threshold: severity === 'critical' ? this.thresholds.memoryCriticalPercent : this.thresholds.memoryWarningPercent,
        });
      }
    }

    // 磁盘分析
    if (metrics.diskUsage !== undefined && metrics.diskUsage > 80) {
      const severity = metrics.diskUsage > 90 ? 'critical' : 'warning';
      issues.push({
        id: uuidv4(),
        type: 'high_disk' as PerformanceIssueType,
        severity,
        title: '磁盘使用率过高',
        description: `当前磁盘使用率为 ${metrics.diskUsage.toFixed(1)}%`,
        affectedMetrics: ['diskUsage'],
        currentValue: metrics.diskUsage,
        threshold: 80,
      });
    }

    // 响应时间分析
    if (metrics.responseTime !== undefined) {
      const severity = this.getSeverity(metrics.responseTime, this.thresholds.responseTimeWarningMs!, this.thresholds.responseTimeCriticalMs!);
      if (severity) {
        issues.push({
          id: uuidv4(),
          type: 'high_latency' as PerformanceIssueType,
          severity,
          title: '响应时间过高',
          description: `当前响应时间为 ${metrics.responseTime.toFixed(0)}ms，${severity === 'critical' ? '已严重影响用户体验' : '需要关注'}`,
          affectedMetrics: ['responseTime'],
          currentValue: metrics.responseTime,
          threshold: severity === 'critical' ? this.thresholds.responseTimeCriticalMs : this.thresholds.responseTimeWarningMs,
        });
      }
    }

    // 错误率分析
    if (metrics.errorRate !== undefined) {
      const severity = this.getSeverity(metrics.errorRate, this.thresholds.errorRateWarningPercent!, this.thresholds.errorRateCriticalPercent!);
      if (severity) {
        issues.push({
          id: uuidv4(),
          type: 'high_error_rate' as PerformanceIssueType,
          severity,
          title: '错误率过高',
          description: `当前错误率为 ${metrics.errorRate.toFixed(2)}%，${severity === 'critical' ? '已达到危险水平' : '超过可接受范围'}`,
          affectedMetrics: ['errorRate'],
          currentValue: metrics.errorRate,
          threshold: severity === 'critical' ? this.thresholds.errorRateCriticalPercent : this.thresholds.errorRateWarningPercent,
        });
      }
    }

    // 吞吐量分析
    if (targets?.throughput && metrics.throughput !== undefined) {
      const ratio = metrics.throughput / targets.throughput;
      if (ratio < 0.5) {
        issues.push({
          id: uuidv4(),
          type: 'low_throughput' as PerformanceIssueType,
          severity: 'critical',
          title: '吞吐量严重不足',
          description: `当前吞吐量 ${metrics.throughput} req/s，仅为目标 ${targets.throughput} req/s 的 ${(ratio * 100).toFixed(0)}%`,
          affectedMetrics: ['throughput'],
          currentValue: metrics.throughput,
          threshold: targets.throughput * 0.5,
        });
      } else if (ratio < 0.8) {
        issues.push({
          id: uuidv4(),
          type: 'low_throughput' as PerformanceIssueType,
          severity: 'warning',
          title: '吞吐量偏低',
          description: `当前吞吐量 ${metrics.throughput} req/s，低于目标的 80%`,
          affectedMetrics: ['throughput'],
          currentValue: metrics.throughput,
          threshold: targets.throughput * 0.8,
        });
      }
    }

    // 缓存命中率分析
    if (metrics.cacheHitRate !== undefined && metrics.cacheHitRate < 70) {
      const severity = metrics.cacheHitRate < 50 ? 'critical' : 'warning';
      issues.push({
        id: uuidv4(),
        type: 'cache_miss' as PerformanceIssueType,
        severity,
        title: '缓存命中率过低',
        description: `当前缓存命中率为 ${metrics.cacheHitRate.toFixed(1)}%，大量请求未命中缓存`,
        affectedMetrics: ['cacheHitRate'],
        currentValue: metrics.cacheHitRate,
        threshold: 70,
      });
    }

    // 数据库分析
    if (metrics.dbQueryTime !== undefined && metrics.dbQueryTime > 1000) {
      const severity = metrics.dbQueryTime > 5000 ? 'critical' : 'warning';
      issues.push({
        id: uuidv4(),
        type: 'db_slow_query' as PerformanceIssueType,
        severity,
        title: '数据库查询过慢',
        description: `平均数据库查询时间为 ${metrics.dbQueryTime.toFixed(0)}ms`,
        affectedMetrics: ['dbQueryTime'],
        currentValue: metrics.dbQueryTime,
        threshold: 1000,
      });
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * 分析资源使用情况
   */
  private analyzeResources(metrics: PerformanceMetrics): ResourceAnalysis {
    const cpuStatus = this.getResourceStatus(
      metrics.cpuUsage || 0,
      this.thresholds.cpuWarningPercent!,
      this.thresholds.cpuCriticalPercent!
    );

    const memoryStatus = this.getResourceStatus(
      metrics.memoryUsage || 0,
      this.thresholds.memoryWarningPercent!,
      this.thresholds.memoryCriticalPercent!
    );

    const diskStatus = this.getResourceStatus(
      metrics.diskUsage || 0,
      80,
      90
    );

    const networkStatus = this.getNetworkStatus(metrics);

    return {
      cpu: this.createResourceAnalysis('CPU', metrics.cpuUsage || 0, 100, cpuStatus, metrics.load1m),
      memory: this.createResourceAnalysis('内存', metrics.memoryUsage || 0, 100, memoryStatus, metrics.memoryUsed),
      disk: this.createResourceAnalysis('磁盘', metrics.diskUsage || 0, 100, diskStatus),
      network: networkStatus,
    };
  }

  /**
   * 创建资源分析
   */
  private createResourceAnalysis(
    name: string,
    currentValue: number,
    maxValue: number,
    status: 'healthy' | 'warning' | 'critical',
    peak?: number
  ): ResourceMetricAnalysis {
    const usagePercent = (currentValue / maxValue) * 100;
    let analysis = '';

    switch (status) {
      case 'critical':
        analysis = `${name}使用率处于危险水平，需要立即处理`;
        break;
      case 'warning':
        analysis = `${name}使用率偏高，建议关注并考虑优化`;
        break;
      default:
        analysis = `${name}使用率处于正常范围`;
    }

    return {
      currentValue: Math.round(currentValue * 100) / 100,
      maxValue,
      usagePercent: Math.round(usagePercent * 100) / 100,
      status,
      analysis,
      peak: peak ? Math.round(peak * 100) / 100 : undefined,
      average: currentValue,
    };
  }

  /**
   * 获取网络状态
   */
  private getNetworkStatus(metrics: PerformanceMetrics): ResourceMetricAnalysis {
    const hasNetworkIssue = (metrics.networkBytesRecv || 0) > 1e9 || (metrics.networkBytesSent || 0) > 1e9;
    const status = hasNetworkIssue ? 'warning' : 'healthy';

    return {
      currentValue: (metrics.networkBytesRecv || 0) + (metrics.networkBytesSent || 0),
      maxValue: 0,
      usagePercent: 0,
      status,
      analysis: hasNetworkIssue ? '网络流量较大，建议监控带宽使用' : '网络使用正常',
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    issues: PerformanceIssue[],
    resourceAnalysis: ResourceAnalysis
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'high_cpu':
          recommendations.push({
            id: uuidv4(),
            type: 'scale_out',
            priority: issue.severity === 'critical' ? 'high' : 'medium',
            title: '考虑横向扩展',
            description: 'CPU 使用率较高，建议增加实例数量或升级 CPU 配置',
            expectedImprovement: '可提升 30-50% 的处理能力',
            implementationEffort: 'medium',
            commands: [
              'kubectl scale deployment <name> --replicas=3',
              'kubectl patch deployment <name> -p \'{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"cpu":"2000m"}}}]}}}\'',
            ],
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
          recommendations.push({
            id: uuidv4(),
            type: 'code_optimization',
            priority: issue.severity === 'critical' ? 'high' : 'medium',
            title: '优化代码减少 CPU 消耗',
            description: '分析 CPU 热点代码，考虑算法优化或使用更高效的实现',
            expectedImprovement: '可降低 20-40% 的 CPU 使用',
            implementationEffort: 'high',
            relatedIssueIds: [issue.id],
            riskLevel: 'medium',
            rollbackPlan: '回滚代码变更',
          });
          break;

        case 'high_memory':
          recommendations.push({
            id: uuidv4(),
            type: 'scale_up',
            priority: issue.severity === 'critical' ? 'high' : 'medium',
            title: '增加内存配置',
            description: '内存使用率较高，建议增加容器内存限制',
            expectedImprovement: '避免 OOM，提高稳定性',
            implementationEffort: 'low',
            configChanges: [
              {
                configPath: 'deployment.yaml',
                key: 'resources.limits.memory',
                currentValue: '512Mi',
                newValue: '2Gi',
                reason: '当前内存不足，需要扩容',
              },
            ],
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
          break;

        case 'high_latency':
          recommendations.push({
            id: uuidv4(),
            type: 'cache_optimization',
            priority: 'high',
            title: '增加缓存层',
            description: '响应时间较高，建议引入缓存减少数据库压力',
            expectedImprovement: '可降低 50-80% 的响应时间',
            implementationEffort: 'medium',
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
          break;

        case 'high_error_rate':
          recommendations.push({
            id: uuidv4(),
            type: 'configuration_tuning',
            priority: 'critical',
            title: '排查错误根因',
            description: '错误率较高，建议立即查看错误日志定位问题',
            expectedImprovement: '降低错误率至正常水平',
            implementationEffort: 'low',
            commands: [
              'kubectl logs <pod-name> --previous --tail=100',
            ],
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
          break;

        case 'cache_miss':
          recommendations.push({
            id: uuidv4(),
            type: 'cache_optimization',
            priority: 'high',
            title: '优化缓存策略',
            description: '缓存命中率低，建议调整缓存键或过期时间',
            expectedImprovement: '可提升缓存命中率至 90% 以上',
            implementationEffort: 'medium',
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
          break;

        case 'db_slow_query':
          recommendations.push({
            id: uuidv4(),
            type: 'query_optimization',
            priority: 'high',
            title: '优化数据库查询',
            description: '数据库查询时间过长，建议添加索引或优化 SQL',
            expectedImprovement: '可降低 50-90% 的查询时间',
            implementationEffort: 'medium',
            relatedIssueIds: [issue.id],
            riskLevel: 'medium',
            rollbackPlan: '回滚索引变更',
          });
          break;

        default:
          recommendations.push({
            id: uuidv4(),
            type: 'configuration_tuning',
            priority: 'medium',
            title: '进一步分析',
            description: issue.description,
            expectedImprovement: '需要更多数据才能给出具体建议',
            implementationEffort: 'low',
            relatedIssueIds: [issue.id],
            riskLevel: 'low',
          });
      }
    }

    // 如果没有具体问题但资源使用率高，也给出预防性建议
    if (issues.length === 0) {
      if (resourceAnalysis.cpu.usagePercent > 50) {
        recommendations.push({
          id: uuidv4(),
          type: 'scale_out',
          priority: 'low',
          title: '预防性扩容准备',
          description: 'CPU 使用率超过 50%，建议提前准备好扩容方案',
          expectedImprovement: '提高系统弹性',
          implementationEffort: 'low',
          riskLevel: 'low',
        });
      }
    }

    return recommendations;
  }

  /**
   * 分析趋势
   */
  private analyzeTrend(
    historicalMetrics: PerformanceMetrics[],
    currentMetrics: PerformanceMetrics
  ): TrendAnalysis {
    // 简化趋势分析：比较最近的值与历史平均值
    const recentMetrics = historicalMetrics.slice(-5);
    const avgCpu = recentMetrics.reduce((sum, m) => sum + (m.cpuUsage || 0), 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / recentMetrics.length;

    const cpuChange = currentMetrics.cpuUsage ? ((currentMetrics.cpuUsage - avgCpu) / avgCpu) * 100 : 0;
    const memoryChange = currentMetrics.memoryUsage ? ((currentMetrics.memoryUsage - avgMemory) / avgMemory) * 100 : 0;

    const changeRate = (cpuChange + memoryChange) / 2;
    let direction: 'improving' | 'stable' | 'degrading';
    if (changeRate > 10) {
      direction = 'degrading';
    } else if (changeRate < -10) {
      direction = 'improving';
    } else {
      direction = 'stable';
    }

    // 简单预测：假设线性增长
    const predictions = [];
    if (direction === 'degrading' && currentMetrics.cpuUsage) {
      for (let i = 1; i <= 3; i++) {
        predictions.push({
          timestamp: new Date(Date.now() + i * 3600000).toISOString(),
          metric: 'cpuUsage',
          predictedValue: Math.min(100, currentMetrics.cpuUsage + (cpuChange / 5) * i),
          confidence: Math.max(0, 1 - Math.abs(changeRate) / 100),
        });
      }
    }

    return {
      direction,
      changeRate: Math.round(changeRate * 100) / 100,
      predictions,
      analysis: direction === 'degrading'
        ? '性能呈下降趋势，建议采取措施'
        : direction === 'improving'
        ? '性能有所改善'
        : '性能保持稳定',
    };
  }

  /**
   * 计算健康评分
   */
  private calculateHealthScore(issues: PerformanceIssue[], resourceAnalysis: ResourceAnalysis): number {
    let score = 100;

    // 根据问题扣分
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    }

    // 根据资源状态扣分
    if (resourceAnalysis.cpu.status === 'critical') score -= 15;
    else if (resourceAnalysis.cpu.status === 'warning') score -= 5;

    if (resourceAnalysis.memory.status === 'critical') score -= 15;
    else if (resourceAnalysis.memory.status === 'warning') score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成摘要
   */
  private generateSummary(healthScore: number, issues: PerformanceIssue[], recommendations: OptimizationRecommendation[]): string {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (healthScore >= 90) {
      return '系统运行良好，性能指标正常';
    } else if (healthScore >= 70) {
      return `发现 ${warningCount} 个警告级别问题，建议关注`;
    } else {
      return `发现 ${criticalCount} 个严重问题和 ${warningCount} 个警告，需要立即处理`;
    }
  }

  /**
   * 生成详细的 AI 报告
   */
  private async generateDetailedReport(
    input: PerformanceAnalysisInput,
    issues: PerformanceIssue[],
    recommendations: OptimizationRecommendation[],
    resourceAnalysis: ResourceAnalysis
  ): Promise<string> {
    const prompt = `请生成一份详细的性能分析报告，包含以下内容：

## 输入信息
- 服务: ${input.serviceName || '未知'}
- 环境: ${input.environment || '未知'}
- 分析类型: ${input.type}

## 发现的问题 (${issues.length}个)
${issues.map(i => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

## 资源使用情况
- CPU: ${resourceAnalysis.cpu.usagePercent}% (${resourceAnalysis.cpu.status})
- 内存: ${resourceAnalysis.memory.usagePercent}% (${resourceAnalysis.memory.status})
- 磁盘: ${resourceAnalysis.disk.usagePercent}% (${resourceAnalysis.disk.status})

## 优化建议 (${recommendations.length}个)
${recommendations.slice(0, 5).map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n')}

请用简洁的中文生成一份技术报告，侧重于可操作的建议。`;

    try {
      return await this.callAI(prompt);
    } catch (error) {
      logger.error({
        msg: 'Failed to generate AI report',
        error: error instanceof Error ? error.message : String(error),
      });
      return 'AI 报告生成失败';
    }
  }

  // ==================== Helper Methods ====================

  /**
   * 获取严重程度
   */
  private getSeverity(value: number, warning: number, critical: number): 'critical' | 'warning' | null {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
    return null;
  }

  /**
   * 获取资源状态
   */
  private getResourceStatus(value: number, warning: number, critical: number): 'healthy' | 'warning' | 'critical' {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
    return 'healthy';
  }
}

/**
 * PerfOptAgent 工厂函数
 */
export function createPerfOptAgent(
  config: AgentConfig,
  aiGateway: AIGateway,
  toolAdapter: ToolAdapter,
  thresholds?: PerformanceThresholds
): PerfOptAgent {
  return new PerfOptAgent(config, aiGateway, toolAdapter, thresholds);
}