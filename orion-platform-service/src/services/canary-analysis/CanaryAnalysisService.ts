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
import {
  CanaryAnalysisRepository,
  CanaryMetricResultRepository,
  CanaryMLResultRepository,
  CanaryAnalysisConfigRepository,
  CanaryDecisionRepository,
} from '../../repositories/CanaryAnalysisRepository';

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

  // Repositories
  private runRepository?: CanaryAnalysisRepository;
  private metricRepository?: CanaryMetricResultRepository;
  private mlRepository?: CanaryMLResultRepository;
  private configRepository?: CanaryAnalysisConfigRepository;
  private decisionRepository?: CanaryDecisionRepository;

  constructor(options?: { eventBus?: EventBusService; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventBus = options?.eventBus;
    if (options?.db) {
      this.runRepository = new CanaryAnalysisRepository(options.db);
      this.metricRepository = new CanaryMetricResultRepository(options.db);
      this.mlRepository = new CanaryMLResultRepository(options.db);
      this.configRepository = new CanaryAnalysisConfigRepository(options.db);
      this.decisionRepository = new CanaryDecisionRepository(options.db);
    }
  }

  // Run management
  async createRun(input: CanaryAnalysisRunCreateInput): Promise<CanaryAnalysisRun> {
    const run = createCanaryAnalysisRun(input);
    this.runs.set(run.id, run);
    this.metrics.set(run.id, []);
    this.mlResults.set(run.id, []);

    // Store in repository
    if (this.runRepository) {
      await this.runRepository.create({
        deploymentId: input.deploymentId,
        runNumber: input.runNumber ?? 1,
        trafficSplit: { canary: input.trafficSplit?.canary ?? 10, baseline: input.trafficSplit?.baseline ?? 90 } as Record<string, number>,
        status: 'running',
        confidence: null,
        decision: null,
        startedAt: run.startedAt,
        completedAt: null,
        durationMs: null,
      });
    }

    await this.eventBus?.publish('canary-analysis.run.started', {
      runId: run.id,
      deploymentId: input.deploymentId,
    });
    return run;
  }

  async getRunById(id: string): Promise<CanaryAnalysisRun | undefined> {
    const cached = this.runs.get(id);
    if (cached) return cached;

    // Load from repository
    if (this.runRepository) {
      const entity = await this.runRepository.findById(id);
      if (entity) {
        const run: CanaryAnalysisRun = {
          id: entity.id,
          deploymentId: entity.deploymentId,
          runNumber: entity.runNumber,
          trafficSplit: entity.trafficSplit,
          status: entity.status as CanaryStatus,
          confidence: entity.confidence ?? 0,
          decision: entity.decision as CanaryDecision ?? 'continue',
          startedAt: entity.startedAt,
          completedAt: entity.completedAt,
          durationMs: entity.durationMs,
        };
        this.runs.set(id, run);
        return run;
      }
    }
    return undefined;
  }

  async listRuns(filter: CanaryRunListFilter = {}): Promise<CanaryAnalysisRun[]> {
    // Use repository if available
    if (this.runRepository) {
      let entities;
      if (filter.deploymentId) {
        entities = await this.runRepository.findByDeployment(filter.deploymentId);
      } else if (filter.status) {
        entities = await this.runRepository.findByStatus(filter.status);
      } else {
        const result = await this.runRepository.findAll({ limit: 100 });
        entities = result.entities;
      }
      return entities.map(e => ({
        id: e.id,
        deploymentId: e.deploymentId,
        runNumber: e.runNumber,
        trafficSplit: e.trafficSplit,
        status: e.status as CanaryStatus,
        confidence: e.confidence ?? 0,
        decision: e.decision as CanaryDecision ?? 'continue',
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        durationMs: e.durationMs,
      }));
    }

    // Fallback to in-memory
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

    // Store to repository
    if (this.runRepository) {
      await this.runRepository.updateRunStatus(runId, status, run.decision, run.confidence, run.completedAt);
    }
    if (this.metricRepository && metricResults.length > 0) {
      await this.metricRepository.batchCreate(metricResults.map(m => ({
        runId,
        metricName: m.metricName,
        baselineValue: m.baselineValue,
        canaryValue: m.canaryValue,
        mannWhitneyP: m.mannWhitneyP,
        ksStatistic: m.ksStatistic,
        cliffDelta: m.cliffDelta,
        verdict: m.verdict,
        category: m.category,
      })));
    }
    if (this.mlRepository && mlResultList.length > 0) {
      await this.mlRepository.batchCreate(mlResultList.map(ml => ({
        runId,
        modelName: ml.modelName,
        prediction: ml.prediction,
        confidence: ml.confidence,
        shapExplanation: ml.shapExplanation,
        clusterId: ml.clusterId,
      })));
    }
    if (this.decisionRepository) {
      await this.decisionRepository.create({
        runId,
        decision: run.decision,
        reason: `Auto-decided based on analysis status: ${status}`,
        overriddenBy: null,
        overrideReason: null,
        decidedAt: new Date(),
      });
    }

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

    // Store in repository
    if (this.configRepository) {
      await this.configRepository.create({
        serviceName: input.serviceName,
        environment: input.environment,
        analysisIntervalSec: input.analysisIntervalSec ?? 300,
        maxRounds: input.maxRounds ?? 5,
        warmupPeriodSec: input.warmupPeriodSec ?? 600,
        promoteThreshold: input.promoteThreshold ?? 0.75,
        rollbackThreshold: input.rollbackThreshold ?? 0.60,
        trafficStep: input.trafficStep ?? 20,
        metricWeights: input.metricWeights ?? null,
        excludedMetrics: input.excludedMetrics ?? [],
        sloMetrics: input.sloMetrics ?? [],
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      });
    }

    await this.eventBus?.publish('canary-analysis.config.created', {
      configId: config.id,
      serviceName: config.serviceName,
    });
    return config;
  }

  async getConfigById(id: string): Promise<CanaryAnalysisConfig | undefined> {
    const cached = this.configs.get(id);
    if (cached) return cached;

    // Load from repository
    if (this.configRepository) {
      const entity = await this.configRepository.findById(id);
      if (entity) {
        const config: CanaryAnalysisConfig = {
          id: entity.id,
          serviceName: entity.serviceName,
          environment: entity.environment,
          analysisIntervalSec: entity.analysisIntervalSec,
          maxRounds: entity.maxRounds,
          warmupPeriodSec: entity.warmupPeriodSec,
          promoteThreshold: entity.promoteThreshold,
          rollbackThreshold: entity.rollbackThreshold,
          trafficStep: entity.trafficStep,
          metricWeights: entity.metricWeights,
          excludedMetrics: entity.excludedMetrics,
          sloMetrics: entity.sloMetrics,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
        this.configs.set(id, config);
        return config;
      }
    }
    return undefined;
  }

  async getConfigByServiceEnv(serviceName: string, environment: string): Promise<CanaryAnalysisConfig | undefined> {
    const cached = Array.from(this.configs.values()).find(
      c => c.serviceName === serviceName && c.environment === environment
    );
    if (cached) return cached;

    // Load from repository
    if (this.configRepository) {
      const entity = await this.configRepository.findByServiceEnv(serviceName, environment);
      if (entity) {
        const config: CanaryAnalysisConfig = {
          id: entity.id,
          serviceName: entity.serviceName,
          environment: entity.environment,
          analysisIntervalSec: entity.analysisIntervalSec,
          maxRounds: entity.maxRounds,
          warmupPeriodSec: entity.warmupPeriodSec,
          promoteThreshold: entity.promoteThreshold,
          rollbackThreshold: entity.rollbackThreshold,
          trafficStep: entity.trafficStep,
          metricWeights: entity.metricWeights,
          excludedMetrics: entity.excludedMetrics,
          sloMetrics: entity.sloMetrics,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        };
        this.configs.set(entity.id, config);
        return config;
      }
    }
    return undefined;
  }

  async listConfigs(): Promise<CanaryAnalysisConfig[]> {
    // Use repository if available
    if (this.configRepository) {
      const entities = await this.configRepository.findAll();
      return entities.map(e => ({
        id: e.id,
        serviceName: e.serviceName,
        environment: e.environment,
        analysisIntervalSec: e.analysisIntervalSec,
        maxRounds: e.maxRounds,
        warmupPeriodSec: e.warmupPeriodSec,
        promoteThreshold: e.promoteThreshold,
        rollbackThreshold: e.rollbackThreshold,
        trafficStep: e.trafficStep,
        metricWeights: e.metricWeights,
        excludedMetrics: e.excludedMetrics,
        sloMetrics: e.sloMetrics,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    }
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

    // Update in repository
    if (this.configRepository) {
      await this.configRepository.updateConfig(id, {
        analysisIntervalSec: input.analysisIntervalSec,
        maxRounds: input.maxRounds,
        warmupPeriodSec: input.warmupPeriodSec,
        promoteThreshold: input.promoteThreshold,
        rollbackThreshold: input.rollbackThreshold,
        trafficStep: input.trafficStep,
        metricWeights: input.metricWeights,
        excludedMetrics: input.excludedMetrics,
        sloMetrics: input.sloMetrics,
      });
    }

    return config;
  }

  async deleteConfig(id: string): Promise<boolean> {
    const deleted = this.configs.delete(id);

    // Delete from repository
    if (this.configRepository) {
      await this.configRepository.delete(id);
    }

    return deleted;
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
