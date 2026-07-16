/**
 * CanaryAnalysis 模型测试
 */
import {
  createCanaryAnalysisRun,
  createCanaryMetricResult,
  createCanaryMLResult,
  createCanaryAnalysisConfig,
  createCanaryDecision,
} from '../CanaryAnalysis';

describe('CanaryAnalysis', () => {
  describe('createCanaryAnalysisRun', () => {
    it('should create run with defaults', () => {
      const run = createCanaryAnalysisRun({
        deploymentId: 'dep-1',
        runNumber: 1,
        trafficSplit: { canary: 10, baseline: 90 },
      });

      expect(run.id).toBeDefined();
      expect(run.deploymentId).toBe('dep-1');
      expect(run.runNumber).toBe(1);
      expect(run.trafficSplit).toEqual({ canary: 10, baseline: 90 });
      expect(run.status).toBe('running');
      expect(run.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('createCanaryMetricResult', () => {
    it('should create metric result', () => {
      const result = createCanaryMetricResult({
        runId: 'run-1',
        metricName: 'latency_p99',
        baselineValue: 100,
        canaryValue: 120,
        mannWhitneyP: 0.05,
        verdict: 'pass',
        category: 'latency',
      });

      expect(result.id).toBeDefined();
      expect(result.runId).toBe('run-1');
      expect(result.metricName).toBe('latency_p99');
      expect(result.baselineValue).toBe(100);
      expect(result.canaryValue).toBe(120);
      expect(result.verdict).toBe('pass');
      expect(result.category).toBe('latency');
    });
  });

  describe('createCanaryMLResult', () => {
    it('should create ML result', () => {
      const result = createCanaryMLResult({
        runId: 'run-1',
        modelName: 'anomaly-detector',
        prediction: 'normal',
        confidence: 0.95,
        shapExplanation: { feature1: 0.3 },
        clusterId: 2,
      });

      expect(result.id).toBeDefined();
      expect(result.modelName).toBe('anomaly-detector');
      expect(result.prediction).toBe('normal');
      expect(result.confidence).toBe(0.95);
      expect(result.shapExplanation).toEqual({ feature1: 0.3 });
      expect(result.clusterId).toBe(2);
    });
  });

  describe('createCanaryAnalysisConfig', () => {
    it('should create config with defaults', () => {
      const config = createCanaryAnalysisConfig({
        serviceName: 'my-svc',
        environment: 'staging',
      });

      expect(config.id).toBeDefined();
      expect(config.serviceName).toBe('my-svc');
      expect(config.environment).toBe('staging');
      expect(config.analysisIntervalSec).toBe(300);
      expect(config.maxRounds).toBe(5);
      expect(config.warmupPeriodSec).toBe(600);
      expect(config.promoteThreshold).toBe(0.75);
      expect(config.rollbackThreshold).toBe(0.60);
      expect(config.trafficStep).toBe(20);
      expect(config.excludedMetrics).toEqual([]);
      expect(config.sloMetrics).toEqual([]);
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept custom values', () => {
      const config = createCanaryAnalysisConfig({
        serviceName: 'svc',
        environment: 'prod',
        analysisIntervalSec: 60,
        maxRounds: 10,
        promoteThreshold: 0.9,
        rollbackThreshold: 0.5,
        trafficStep: 10,
        excludedMetrics: ['cpu'],
        sloMetrics: ['latency'],
      });

      expect(config.analysisIntervalSec).toBe(60);
      expect(config.maxRounds).toBe(10);
      expect(config.promoteThreshold).toBe(0.9);
      expect(config.excludedMetrics).toEqual(['cpu']);
    });
  });

  describe('createCanaryDecision', () => {
    it('should create decision record', () => {
      const decision = createCanaryDecision({
        runId: 'run-1',
        decision: 'promote',
        reason: 'All metrics pass',
      });

      expect(decision.id).toBeDefined();
      expect(decision.runId).toBe('run-1');
      expect(decision.decision).toBe('promote');
      expect(decision.reason).toBe('All metrics pass');
      expect(decision.decidedAt).toBeInstanceOf(Date);
    });

    it('should accept override fields', () => {
      const decision = createCanaryDecision({
        runId: 'run-1',
        decision: 'rollback',
        overriddenBy: 'admin',
        overrideReason: 'Manual override',
      });

      expect(decision.overriddenBy).toBe('admin');
      expect(decision.overrideReason).toBe('Manual override');
    });
  });
});
