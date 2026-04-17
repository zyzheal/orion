/**
 * Canary Analysis Service - ML 金丝雀分析
 */

import { EventBusService } from '../event-bus-service';
import {
  CanaryAnalysisRun,
  CanaryAnalysisRunCreateInput,
  createCanaryAnalysisRun,
  CanaryMetricResult,
  CanaryMetricResultCreateInput,
  createCanaryMetricResult,
  CanaryMLResult,
  CanaryMLResultCreateInput,
  createCanaryMLResult,
  CanaryAnalysisConfig,
  CanaryAnalysisConfigCreateInput,
  CanaryAnalysisConfigUpdateInput,
  createCanaryAnalysisConfig,
  CanaryDecisionRecord,
  CanaryDecisionCreateInput,
  createCanaryDecision,
  CanaryStatus,
  CanaryDecision,
} from '../../models/CanaryAnalysis';

export interface CanaryRunListFilter {
  deploymentId?: string;
  status?: CanaryStatus;
}

export class CanaryAnalysisService {
  private runs: Map<string, CanaryAnalysisRun> = new Map();
  private metrics: Map<string, CanaryMetricResult[]> = new Map();
  private mlResults: Map<string, CanaryMLResult[]> = new Map();
  private configs: Map<string, CanaryAnalysisConfig> = new Map();
  private decisions: Map<string, CanaryDecisionRecord[]> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  // Run management
  async createRun(input: CanaryAnalysisRunCreateInput): Promise<CanaryAnalysisRun> {
    const run = createCanaryAnalysisRun(input);
    this.runs.set(run.id, run);
    this.metrics.set(run.id, []);
    this.mlResults.set(run.id, []);

    await this.eventBus?.publish('canary-analysis.run.started', {
      runId: run.id,
      deploymentId: input.deploymentId,
    });
    return run;
  }

  async getRunById(id: string): Promise<CanaryAnalysisRun | undefined> {
    return this.runs.get(id);
  }

  async listRuns(filter: CanaryRunListFilter = {}): Promise<CanaryAnalysisRun[]> {
    let items = Array.from(this.runs.values());

    if (filter.deploymentId) {
      items = items.filter(r => r.deploymentId === filter.deploymentId);
    }
    if (filter.status) {
      items = items.filter(r => r.status === filter.status);
    }

    return items.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Complete a run with mock ML analysis results
   */
  async completeRun(
    runId: string,
    status: CanaryStatus,
    metrics: CanaryMetricResultCreateInput[],
    mlResults: CanaryMLResultCreateInput[]
  ): Promise<CanaryAnalysisRun> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Canary run ${runId} not found`);

    run.status = status;
    run.completedAt = new Date();
    run.durationMs = run.completedAt.getTime() - run.startedAt.getTime();

    // Determine decision based on status
    if (status === 'promote') {
      run.decision = 'promote';
      run.confidence = 0.92;
    } else if (status === 'rollback') {
      run.decision = 'rollback';
      run.confidence = 0.87;
    } else {
      run.decision = 'continue';
      run.confidence = 0.55;
    }

    // Store metrics
    const metricResults = metrics.map(m => {
      const result = createCanaryMetricResult({ ...m, runId });
      return result;
    });
    this.metrics.set(runId, metricResults);

    // Store ML results
    const mlResultList = mlResults.map(m => {
      const result = createCanaryMLResult({ ...m, runId });
      return result;
    });
    this.mlResults.set(runId, mlResultList);

    // Record decision
    const decision = createCanaryDecision({
      runId,
      decision: run.decision,
      reason: `Auto-decided based on analysis status: ${status}`,
    });
    const runDecisions = this.decisions.get(runId) ?? [];
    runDecisions.push(decision);
    this.decisions.set(runId, runDecisions);

    this.runs.set(runId, run);

    await this.eventBus?.publish('canary-analysis.run.completed', {
      runId,
      status,
      decision: run.decision,
      confidence: run.confidence,
    });

    return run;
  }

  /**
   * Simulate a full canary analysis round with mock data
   */
  async simulateAnalysisRun(input: CanaryAnalysisRunCreateInput): Promise<{
    run: CanaryAnalysisRun;
    metrics: CanaryMetricResult[];
    mlResults: CanaryMLResult[];
  }> {
    const run = await this.createRun(input);

    // Mock metric results
    const mockMetrics: CanaryMetricResult[] = [
      createCanaryMetricResult({
        runId: run.id,
        metricName: 'http_request_duration_seconds',
        baselineValue: 0.125,
        canaryValue: 0.132,
        mannWhitneyP: 0.42,
        ksStatistic: 0.05,
        cliffDelta: 0.02,
        verdict: 'pass',
        category: 'latency',
      }),
      createCanaryMetricResult({
        runId: run.id,
        metricName: 'http_requests_errors_total',
        baselineValue: 0.001,
        canaryValue: 0.0012,
        mannWhitneyP: 0.78,
        ksStatistic: 0.02,
        cliffDelta: 0.01,
        verdict: 'pass',
        category: 'error_rate',
      }),
      createCanaryMetricResult({
        runId: run.id,
        metricName: 'http_requests_total',
        baselineValue: 1500,
        canaryValue: 1480,
        mannWhitneyP: 0.65,
        ksStatistic: 0.03,
        cliffDelta: 0.01,
        verdict: 'pass',
        category: 'throughput',
      }),
      createCanaryMetricResult({
        runId: run.id,
        metricName: 'process_cpu_seconds_total',
        baselineValue: 0.45,
        canaryValue: 0.62,
        mannWhitneyP: 0.08,
        ksStatistic: 0.18,
        cliffDelta: 0.15,
        verdict: 'warn',
        category: 'saturation',
      }),
    ];
    this.metrics.set(run.id, mockMetrics);

    // Mock ML results
    const mockML: CanaryMLResult[] = [
      createCanaryMLResult({
        runId: run.id,
        modelName: 'xgboost',
        prediction: 'healthy',
        confidence: 0.92,
        shapExplanation: {
          latency: -0.02,
          error_rate: -0.01,
          throughput: 0.01,
          saturation: 0.08,
        },
      }),
      createCanaryMLResult({
        runId: run.id,
        modelName: 'dbscan',
        prediction: 'healthy',
        confidence: 0.88,
        clusterId: 0,
      }),
    ];
    this.mlResults.set(run.id, mockML);

    // Complete the run
    await this.completeRun(run.id, 'promote', [], []);

    return { run, metrics: mockMetrics, mlResults: mockML };
  }

  // Metric results
  async getMetrics(runId: string): Promise<CanaryMetricResult[]> {
    return this.metrics.get(runId) ?? [];
  }

  // ML results
  async getMLResults(runId: string): Promise<CanaryMLResult[]> {
    return this.mlResults.get(runId) ?? [];
  }

  // Config CRUD
  async createConfig(input: CanaryAnalysisConfigCreateInput): Promise<CanaryAnalysisConfig> {
    const config = createCanaryAnalysisConfig(input);
    this.configs.set(config.id, config);

    await this.eventBus?.publish('canary-analysis.config.created', {
      configId: config.id,
      serviceName: config.serviceName,
    });
    return config;
  }

  async getConfigById(id: string): Promise<CanaryAnalysisConfig | undefined> {
    return this.configs.get(id);
  }

  async getConfigByServiceEnv(serviceName: string, environment: string): Promise<CanaryAnalysisConfig | undefined> {
    return Array.from(this.configs.values()).find(
      c => c.serviceName === serviceName && c.environment === environment
    );
  }

  async listConfigs(): Promise<CanaryAnalysisConfig[]> {
    return Array.from(this.configs.values());
  }

  async updateConfig(id: string, input: CanaryAnalysisConfigUpdateInput): Promise<CanaryAnalysisConfig | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    if (input.analysisIntervalSec !== undefined) config.analysisIntervalSec = input.analysisIntervalSec;
    if (input.maxRounds !== undefined) config.maxRounds = input.maxRounds;
    if (input.warmupPeriodSec !== undefined) config.warmupPeriodSec = input.warmupPeriodSec;
    if (input.promoteThreshold !== undefined) config.promoteThreshold = input.promoteThreshold;
    if (input.rollbackThreshold !== undefined) config.rollbackThreshold = input.rollbackThreshold;
    if (input.trafficStep !== undefined) config.trafficStep = input.trafficStep;
    if (input.metricWeights !== undefined) config.metricWeights = input.metricWeights;
    if (input.excludedMetrics !== undefined) config.excludedMetrics = input.excludedMetrics;
    if (input.sloMetrics !== undefined) config.sloMetrics = input.sloMetrics;
    config.updatedAt = new Date();

    this.configs.set(id, config);
    return config;
  }

  async deleteConfig(id: string): Promise<boolean> {
    return this.configs.delete(id);
  }

  // Force promote
  async forcePromote(runId: string, reason: string): Promise<CanaryAnalysisRun> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Canary run ${runId} not found`);

    run.status = 'promote';
    run.decision = 'promote';
    run.confidence = 1.0;
    run.completedAt = new Date();

    const decision = createCanaryDecision({
      runId,
      decision: 'promote',
      reason: `Force promoted: ${reason}`,
      overriddenBy: 'admin',
      overrideReason: reason,
    });
    const runDecisions = this.decisions.get(runId) ?? [];
    runDecisions.push(decision);
    this.decisions.set(runId, runDecisions);

    this.runs.set(runId, run);

    await this.eventBus?.publish('canary-analysis.force-promoted', { runId, reason });
    return run;
  }

  // Force rollback
  async forceRollback(runId: string, reason: string): Promise<CanaryAnalysisRun> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Canary run ${runId} not found`);

    run.status = 'rollback';
    run.decision = 'rollback';
    run.confidence = 1.0;
    run.completedAt = new Date();

    const decision = createCanaryDecision({
      runId,
      decision: 'rollback',
      reason: `Force rollback: ${reason}`,
      overriddenBy: 'admin',
      overrideReason: reason,
    });
    const runDecisions = this.decisions.get(runId) ?? [];
    runDecisions.push(decision);
    this.decisions.set(runId, runDecisions);

    this.runs.set(runId, run);

    await this.eventBus?.publish('canary-analysis.force-rollback', { runId, reason });
    return run;
  }

  // Get decisions for a run
  async getDecisions(runId: string): Promise<CanaryDecisionRecord[]> {
    return this.decisions.get(runId) ?? [];
  }
}
