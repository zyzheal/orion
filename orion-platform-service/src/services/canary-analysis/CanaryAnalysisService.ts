/**
 * CanaryAnalysisService - ML 金丝雀分析服务
 *
 * 负责 ML 金丝雀分析的完整生命周期：运行管理、指标分析、ML 结果、配置管理
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
  CanaryRetrainJobRepository,
} from '../../repositories/CanaryAnalysisRepository';

import {
  CanaryAnalysisRun,
  CanaryAnalysisRunCreateInput,
  createCanaryAnalysisRun,
  CanaryAnalysisConfig,
  CanaryAnalysisConfigCreateInput,
  CanaryAnalysisConfigUpdateInput,
  createCanaryAnalysisConfig,
  CanaryMetricResult,
  createCanaryMetricResult,
  CanaryMLResult,
  createCanaryMLResult,
  CanaryDecisionRecord,
  createCanaryDecision,
  CanaryDecision,
  MetricVerdict,
  MetricCategory,
} from '../../models/CanaryAnalysis';

// ==================== Types ====================

export interface ListRunsOptions {
  deploymentId?: string;
  status?: string;
}

export interface RunSummary {
  run: CanaryAnalysisRun;
  metrics: CanaryMetricResult[];
  mlResults: CanaryMLResult[];
}

export interface MetricsSummary {
  totalRuns: number;
  promotedRuns: number;
  rolledBackRuns: number;
  inconclusiveRuns: number;
  averageConfidence: number;
  passRate: number;
}

// ==================== Service ====================

export class CanaryAnalysisServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'CanaryAnalysisServiceError';
  }
}

export class CanaryAnalysisService {
  private runRepository: CanaryAnalysisRepository;
  private metricRepository: CanaryMetricResultRepository;
  private mlRepository: CanaryMLResultRepository;
  private configRepository: CanaryAnalysisConfigRepository;
  private decisionRepository: CanaryDecisionRepository;
  private retrainRepository: CanaryRetrainJobRepository;

  constructor(
    runRepository: CanaryAnalysisRepository,
    metricRepository: CanaryMetricResultRepository,
    mlRepository: CanaryMLResultRepository,
    configRepository: CanaryAnalysisConfigRepository,
    decisionRepository: CanaryDecisionRepository,
    retrainRepository: CanaryRetrainJobRepository,
  ) {
    this.runRepository = runRepository;
    this.metricRepository = metricRepository;
    this.mlRepository = mlRepository;
    this.configRepository = configRepository;
    this.decisionRepository = decisionRepository;
    this.retrainRepository = retrainRepository;
  }

  // ==================== Runs ====================

  /**
   * 列出分析运行记录
   */
  async listRuns(options: ListRunsOptions = {}): Promise<CanaryAnalysisRun[]> {
    try {
      if (options.deploymentId) {
        return await this.runRepository.findByDeployment(options.deploymentId);
      }
      if (options.status) {
        return await this.runRepository.findByStatus(options.status);
      }
      // Return all runs if no filters
      const result = await this.runRepository.findAll({ limit: 100 });
      return result.entities as unknown as CanaryAnalysisRun[];
    } catch (error) {
      console.error('[CanaryAnalysisService] listRuns failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to list runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_RUNS_FAILED'
      );
    }
  }

  /**
   * 获取单个运行记录
   */
  async getRunById(id: string): Promise<CanaryAnalysisRun | null> {
    try {
      const run = await this.runRepository.findById(id);
      return run ? run as unknown as CanaryAnalysisRun : null;
    } catch (error) {
      console.error('[CanaryAnalysisService] getRunById failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to get run: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_RUN_FAILED'
      );
    }
  }

  /**
   * 模拟完整的分析运行（生成随机指标和 ML 结果）
   * 用于演示和测试
   */
  async simulateAnalysisRun(input: {
    deploymentId: string;
    runNumber?: number;
    trafficSplit?: { canary: number; baseline: number };
  }): Promise<RunSummary> {
    try {
      // 1. Create the run
      const runInput: CanaryAnalysisRunCreateInput = {
        deploymentId: input.deploymentId,
        runNumber: input.runNumber || 1,
        trafficSplit: input.trafficSplit || { canary: 10, baseline: 90 },
      };
      const newRun = createCanaryAnalysisRun(runInput);

      const created = await this.runRepository.create({
        id: newRun.id,
        deploymentId: newRun.deploymentId,
        runNumber: newRun.runNumber,
        trafficSplit: newRun.trafficSplit,
        status: newRun.status,
        confidence: null,
        decision: null,
        startedAt: newRun.startedAt,
        completedAt: null,
        durationMs: null,
      });

      // 2. Generate simulated metrics based on traffic split
      const metrics = await this.generateSimulatedMetrics(newRun.id);

      // 3. Generate simulated ML results
      const mlResults = await this.generateSimulatedMLResults(newRun.id, metrics);

      // 4. Calculate overall decision
      const decision = this.calculateDecision(metrics, mlResults);
      const confidence = this.calculateConfidence(metrics, mlResults);

      // 5. Update run with decision
      const completedAt = new Date();
      await this.runRepository.updateRunStatus(
        newRun.id,
        decision === 'promote' ? 'promote' : decision === 'rollback' ? 'rollback' : 'inconclusive',
        decision,
        confidence,
        completedAt
      );

      // 6. Record the decision
      const decisionRecord = createCanaryDecision({
        runId: newRun.id,
        decision,
        reason: this.getDecisionReason(metrics, mlResults),
      });
      await this.decisionRepository.create({
        id: decisionRecord.id,
        runId: decisionRecord.runId,
        decision: decisionRecord.decision,
        reason: decisionRecord.reason || null,
        overriddenBy: null,
        overrideReason: null,
        decidedAt: decisionRecord.decidedAt,
      });

      return {
        run: {
          ...newRun,
          status: decision === 'promote' ? 'promote' : decision === 'rollback' ? 'rollback' : 'inconclusive',
          decision,
          confidence,
          completedAt,
          durationMs: completedAt.getTime() - newRun.startedAt.getTime(),
        },
        metrics,
        mlResults,
      };
    } catch (error) {
      console.error('[CanaryAnalysisService] simulateAnalysisRun failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to simulate analysis run: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIMULATE_RUN_FAILED'
      );
    }
  }

  // ==================== Metrics ====================

  /**
   * 获取运行的所有指标
   */
  async getMetrics(runId: string): Promise<CanaryMetricResult[]> {
    try {
      return await this.metricRepository.findByRun(runId);
    } catch (error) {
      console.error('[CanaryAnalysisService] getMetrics failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_METRICS_FAILED'
      );
    }
  }

  /**
   * 获取运行的 ML 结果
   */
  async getMLResults(runId: string): Promise<CanaryMLResult[]> {
    try {
      return await this.mlRepository.findByRun(runId);
    } catch (error) {
      console.error('[CanaryAnalysisService] getMLResults failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to get ML results: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_ML_RESULTS_FAILED'
      );
    }
  }

  // ==================== Configs ====================

  /**
   * 列出所有配置
   */
  async listConfigs(): Promise<CanaryAnalysisConfig[]> {
    try {
      const result = await this.configRepository.findAll();
      return result.entities as unknown as CanaryAnalysisConfig[];
    } catch (error) {
      console.error('[CanaryAnalysisService] listConfigs failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to list configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_CONFIGS_FAILED'
      );
    }
  }

  /**
   * 创建配置
   */
  async createConfig(input: CanaryAnalysisConfigCreateInput): Promise<CanaryAnalysisConfig> {
    try {
      const config = createCanaryAnalysisConfig(input);
      const created = await this.configRepository.create({
        id: config.id,
        serviceName: config.serviceName,
        environment: config.environment,
        analysisIntervalSec: config.analysisIntervalSec,
        maxRounds: config.maxRounds,
        warmupPeriodSec: config.warmupPeriodSec,
        promoteThreshold: config.promoteThreshold,
        rollbackThreshold: config.rollbackThreshold,
        trafficStep: config.trafficStep,
        metricWeights: config.metricWeights || null,
        excludedMetrics: config.excludedMetrics,
        sloMetrics: config.sloMetrics,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      });
      return created as unknown as CanaryAnalysisConfig;
    } catch (error) {
      console.error('[CanaryAnalysisService] createConfig failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to create config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CREATE_CONFIG_FAILED'
      );
    }
  }

  /**
   * 根据服务名和环境获取配置
   */
  async getConfigByServiceEnv(serviceName: string, environment: string): Promise<CanaryAnalysisConfig | null> {
    try {
      const config = await this.configRepository.findByServiceEnv(serviceName, environment);
      return config ? config as unknown as CanaryAnalysisConfig : null;
    } catch (error) {
      console.error('[CanaryAnalysisService] getConfigByServiceEnv failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to get config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_CONFIG_FAILED'
      );
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, updates: CanaryAnalysisConfigUpdateInput): Promise<CanaryAnalysisConfig | null> {
    try {
      const existing = await this.configRepository.findById(id);
      if (!existing) {
        return null;
      }

      const translatedUpdates: Record<string, unknown> = {};
      if (updates.analysisIntervalSec !== undefined) translatedUpdates.analysisIntervalSec = updates.analysisIntervalSec;
      if (updates.maxRounds !== undefined) translatedUpdates.maxRounds = updates.maxRounds;
      if (updates.warmupPeriodSec !== undefined) translatedUpdates.warmupPeriodSec = updates.warmupPeriodSec;
      if (updates.promoteThreshold !== undefined) translatedUpdates.promoteThreshold = updates.promoteThreshold;
      if (updates.rollbackThreshold !== undefined) translatedUpdates.rollbackThreshold = updates.rollbackThreshold;
      if (updates.trafficStep !== undefined) translatedUpdates.trafficStep = updates.trafficStep;
      if (updates.metricWeights !== undefined) translatedUpdates.metricWeights = updates.metricWeights;
      if (updates.excludedMetrics !== undefined) translatedUpdates.excludedMetrics = updates.excludedMetrics;
      if (updates.sloMetrics !== undefined) translatedUpdates.sloMetrics = updates.sloMetrics;

      const updated = await this.configRepository.updateConfig(id, translatedUpdates as any);
      return updated as unknown as CanaryAnalysisConfig | null;
    } catch (error) {
      console.error('[CanaryAnalysisService] updateConfig failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to update config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_CONFIG_FAILED'
      );
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    try {
      return await this.configRepository.delete(id);
    } catch (error) {
      console.error('[CanaryAnalysisService] deleteConfig failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to delete config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_CONFIG_FAILED'
      );
    }
  }

  // ==================== Force Actions ====================

  /**
   * 强制提升
   */
  async forcePromote(runId: string, reason: string): Promise<CanaryAnalysisRun> {
    try {
      const existing = await this.runRepository.findById(runId);
      if (!existing) {
        throw new CanaryAnalysisServiceError(`Run not found: ${runId}`, 'RUN_NOT_FOUND');
      }

      const completedAt = new Date();
      await this.runRepository.updateRunStatus(runId, 'promote', 'promote', 1.0, completedAt);

      // Record override decision
      const decisionRecord = createCanaryDecision({
        runId,
        decision: 'promote',
        reason: `Force promote: ${reason}`,
        overriddenBy: 'admin',
        overrideReason: reason,
      });
      await this.decisionRepository.create({
        id: decisionRecord.id,
        runId: decisionRecord.runId,
        decision: decisionRecord.decision,
        reason: decisionRecord.reason || null,
        overriddenBy: decisionRecord.overriddenBy || null,
        overrideReason: decisionRecord.overrideReason || null,
        decidedAt: decisionRecord.decidedAt,
      });

      return {
        ...existing,
        status: 'promote',
        decision: 'promote',
        confidence: 1.0,
        completedAt,
      } as unknown as CanaryAnalysisRun;
    } catch (error) {
      if (error instanceof CanaryAnalysisServiceError) throw error;
      console.error('[CanaryAnalysisService] forcePromote failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to force promote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FORCE_PROMOTE_FAILED'
      );
    }
  }

  /**
   * 强制回滚
   */
  async forceRollback(runId: string, reason: string): Promise<CanaryAnalysisRun> {
    try {
      const existing = await this.runRepository.findById(runId);
      if (!existing) {
        throw new CanaryAnalysisServiceError(`Run not found: ${runId}`, 'RUN_NOT_FOUND');
      }

      const completedAt = new Date();
      await this.runRepository.updateRunStatus(runId, 'rollback', 'rollback', 0.0, completedAt);

      // Record override decision
      const decisionRecord = createCanaryDecision({
        runId,
        decision: 'rollback',
        reason: `Force rollback: ${reason}`,
        overriddenBy: 'admin',
        overrideReason: reason,
      });
      await this.decisionRepository.create({
        id: decisionRecord.id,
        runId: decisionRecord.runId,
        decision: decisionRecord.decision,
        reason: decisionRecord.reason || null,
        overriddenBy: decisionRecord.overriddenBy || null,
        overrideReason: decisionRecord.overrideReason || null,
        decidedAt: decisionRecord.decidedAt,
      });

      return {
        ...existing,
        status: 'rollback',
        decision: 'rollback',
        confidence: 0.0,
        completedAt,
      } as unknown as CanaryAnalysisRun;
    } catch (error) {
      if (error instanceof CanaryAnalysisServiceError) throw error;
      console.error('[CanaryAnalysisService] forceRollback failed:', error);
      throw new CanaryAnalysisServiceError(
        `Failed to force rollback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FORCE_ROLLBACK_FAILED'
      );
    }
  }

  // ==================== Metrics Summary ====================

  /**
   * 获取指标汇总（支持租户维度）
   */
  async getMetricsSummary(tenantId?: string): Promise<MetricsSummary> {
    try {
      // Get all runs
      const result = await this.runRepository.findAll({ limit: 1000 });
      const runs = result.entities;

      if (runs.length === 0) {
        return {
          totalRuns: 0,
          promotedRuns: 0,
          rolledBackRuns: 0,
          inconclusiveRuns: 0,
          averageConfidence: 0,
          passRate: 0,
        };
      }

      const promotedRuns = runs.filter(r => r.status === 'promote').length;
      const rolledBackRuns = runs.filter(r => r.status === 'rollback').length;
      const inconclusiveRuns = runs.filter(r => r.status === 'inconclusive').length;

      const confidenceSum = runs.reduce((sum, r) => sum + (r.confidence || 0), 0);
      const averageConfidence = runs.length > 0 ? confidenceSum / runs.length : 0;

      const completedRuns = promotedRuns + rolledBackRuns;
      const passRate = completedRuns > 0 ? promotedRuns / completedRuns : 0;

      return {
        totalRuns: runs.length,
        promotedRuns,
        rolledBackRuns,
        inconclusiveRuns,
        averageConfidence,
        passRate,
      };
    } catch (error) {
      console.error('[CanaryAnalysisService] getMetricsSummary failed:', error);
      // Return default on error (for DB unavailability)
      return {
        totalRuns: 0,
        promotedRuns: 0,
        rolledBackRuns: 0,
        inconclusiveRuns: 0,
        averageConfidence: 0,
        passRate: 0,
      };
    }
  }

  // ==================== Model Retraining ====================

  /**
   * 获取可发现的指标列表
   */
  async discoverMetrics(): Promise<{ metrics: Array<{ name: string; category: string; description: string }> }> {
    // Return static list of typical canary metrics
    const metrics = [
      { name: 'request_latency_p50', category: 'latency', description: 'P50 request latency (ms)' },
      { name: 'request_latency_p95', category: 'latency', description: 'P95 request latency (ms)' },
      { name: 'request_latency_p99', category: 'latency', description: 'P99 request latency (ms)' },
      { name: 'error_rate', category: 'error_rate', description: 'Error rate (errors per second)' },
      { name: '5xx_rate', category: 'error_rate', description: '5xx error rate' },
      { name: 'throughput', category: 'throughput', description: 'Requests per second' },
      { name: 'cpu_utilization', category: 'saturation', description: 'CPU utilization (%)' },
      { name: 'memory_utilization', category: 'saturation', description: 'Memory utilization (%)' },
    ];
    return { metrics };
  }

  /**
   * 触发模型重训练
   */
  async triggerModelRetraining(modelName: string): Promise<{ jobId: string; status: string }> {
    const jobId = uuidv4();
    await this.retrainRepository.createJob({
      id: jobId,
      model_name: modelName,
      status: 'queued',
    });
    return { jobId, status: 'queued' };
  }

  /**
   * 重训练模型 (alias for triggerModelRetraining)
   */
  async retrainModel(modelName: string): Promise<{ jobId: string; status: string }> {
    return this.triggerModelRetraining(modelName);
  }

  // ==================== Private Helpers ====================

  /**
   * 生成模拟指标数据
   */
  private async generateSimulatedMetrics(runId: string): Promise<CanaryMetricResult[]> {
    const categories: MetricCategory[] = ['latency', 'error_rate', 'throughput', 'saturation'];
    const metrics: CanaryMetricResult[] = [];

    for (const category of categories) {
      let metricName: string;
      let baselineValue: number;
      let canaryValue: number;

      switch (category) {
        case 'latency':
          metricName = 'request_latency_p99';
          baselineValue = 100 + Math.random() * 50;
          canaryValue = baselineValue * (0.9 + Math.random() * 0.3); // Sometimes better, sometimes worse
          break;
        case 'error_rate':
          metricName = 'error_rate';
          baselineValue = 0.01 + Math.random() * 0.02;
          canaryValue = baselineValue * (0.5 + Math.random() * 1.5);
          break;
        case 'throughput':
          metricName = 'throughput';
          baselineValue = 1000 + Math.random() * 500;
          canaryValue = baselineValue * (0.95 + Math.random() * 0.15);
          break;
        case 'saturation':
          metricName = 'cpu_utilization';
          baselineValue = 50 + Math.random() * 30;
          canaryValue = baselineValue * (0.8 + Math.random() * 0.5);
          break;
      }

      // Calculate statistical significance (simulated)
      const mannWhitneyP = Math.random();
      const ksStatistic = Math.random() * 0.3;
      const cliffDelta = (canaryValue - baselineValue) / baselineValue;

      // Determine verdict based on change direction
      let verdict: MetricVerdict;
      const percentChange = Math.abs(cliffDelta);

      if (category === 'error_rate' || category === 'saturation') {
        // Lower is better
        if (percentChange < 0.05) verdict = 'pass';
        else if (percentChange < 0.15) verdict = 'warn';
        else verdict = 'fail';
      } else {
        // Higher is better for throughput, lower is better for latency
        if (category === 'throughput') {
          if (cliffDelta > -0.05) verdict = 'pass';
          else if (cliffDelta > -0.15) verdict = 'warn';
          else verdict = 'fail';
        } else {
          if (cliffDelta < 0.05) verdict = 'pass';
          else if (cliffDelta < 0.15) verdict = 'warn';
          else verdict = 'fail';
        }
      }

      const metric = createCanaryMetricResult({
        runId,
        metricName,
        baselineValue,
        canaryValue,
        mannWhitneyP,
        ksStatistic,
        cliffDelta,
        verdict,
        category,
      });

      // Save to database
      const saved = await this.metricRepository.create({
        id: metric.id,
        runId: metric.runId,
        metricName: metric.metricName,
        baselineValue: metric.baselineValue ?? null,
        canaryValue: metric.canaryValue ?? null,
        mannWhitneyP: metric.mannWhitneyP ?? null,
        ksStatistic: metric.ksStatistic ?? null,
        cliffDelta: metric.cliffDelta ?? null,
        verdict: metric.verdict ?? null,
        category: metric.category ?? null,
      });

      metrics.push(metric);
    }

    return metrics;
  }

  /**
   * 生成模拟 ML 结果
   */
  private async generateSimulatedMLResults(runId: string, metrics: CanaryMetricResult[]): Promise<CanaryMLResult[]> {
    const models = ['xgboost', 'random_forest', 'logistic_regression'];
    const results: CanaryMLResult[] = [];

    // Calculate overall health score
    const passCount = metrics.filter(m => m.verdict === 'pass').length;
    const healthScore = passCount / metrics.length;

    for (const modelName of models) {
      const prediction = healthScore > 0.7 ? 'healthy' : healthScore > 0.4 ? 'uncertain' : 'unhealthy';
      const confidence = 0.6 + Math.random() * 0.35;

      const mlResult = createCanaryMLResult({
        runId,
        modelName,
        prediction,
        confidence,
        shapExplanation: {
          latency_contribution: Math.random() * 0.3,
          error_rate_contribution: Math.random() * 0.3,
          throughput_contribution: Math.random() * 0.2,
          saturation_contribution: Math.random() * 0.2,
        },
      });

      // Save to database
      await this.mlRepository.create({
        id: mlResult.id,
        runId: mlResult.runId,
        modelName: mlResult.modelName,
        prediction: mlResult.prediction ?? null,
        confidence: mlResult.confidence ?? null,
        shapExplanation: mlResult.shapExplanation ?? null,
        clusterId: mlResult.clusterId ?? null,
      });

      results.push(mlResult);
    }

    return results;
  }

  /**
   * 计算决策
   */
  private calculateDecision(metrics: CanaryMetricResult[], mlResults: CanaryMLResult[]): CanaryDecision {
    // Simple voting: if majority metrics pass and ML predicts healthy, promote
    const passCount = metrics.filter(m => m.verdict === 'pass').length;
    const failCount = metrics.filter(m => m.verdict === 'fail').length;
    const warnCount = metrics.filter(m => m.verdict === 'warn').length;

    const healthyPredictions = mlResults.filter(r => r.prediction === 'healthy').length;
    const unhealthyPredictions = mlResults.filter(r => r.prediction === 'unhealthy').length;

    // Rule-based decision
    if (failCount > passCount || unhealthyPredictions > healthyPredictions) {
      return 'rollback';
    }
    if (passCount > failCount + warnCount && healthyPredictions >= unhealthyPredictions) {
      return 'promote';
    }
    return 'inconclusive';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(metrics: CanaryMetricResult[], mlResults: CanaryMLResult[]): number {
    const passCount = metrics.filter(m => m.verdict === 'pass').length;
    const totalMetrics = metrics.length || 1;
    const metricScore = passCount / totalMetrics;

    const avgMLConfidence = mlResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / (mlResults.length || 1);

    return (metricScore + avgMLConfidence) / 2;
  }

  /**
   * 获取决策原因
   */
  private getDecisionReason(metrics: CanaryMetricResult[], mlResults: CanaryMLResult[]): string {
    const passes = metrics.filter(m => m.verdict === 'pass').map(m => m.metricName);
    const fails = metrics.filter(m => m.verdict === 'fail').map(m => m.metricName);

    const parts: string[] = [];
    if (passes.length > 0) parts.push(`Passed: ${passes.join(', ')}`);
    if (fails.length > 0) parts.push(`Failed: ${fails.join(', ')}`);

    const healthyML = mlResults.filter(r => r.prediction === 'healthy').length;
    if (healthyML > 0) parts.push(`ML: ${healthyML}/${mlResults.length} models predict healthy`);

    return parts.join('; ') || 'Automatic analysis';
  }
}

export default CanaryAnalysisService;