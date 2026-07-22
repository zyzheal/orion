/**
 * AutoProgressionEngine - 金丝雀流量自动推进引擎单元测试
 *
 * 测试覆盖: 分析推进、指标对比、统计测试、动作决策、回滚/升级/保持
 */

import { AutoProgressionEngine } from '../AutoProgressionEngine';

describe('AutoProgressionEngine', () => {
  let engine: AutoProgressionEngine;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    engine = new AutoProgressionEngine(mockPool as any);
  });

  // Helper: create metric samples
  const createSamples = (count: number, overrides: Partial<any> = {}) => {
    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - (count - i) * 60000),
      errorRate: 0.01,
      latencyP50: 50,
      latencyP95: 100,
      latencyP99: 200,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
      requestRate: 100,
      ...overrides,
    }));
  };

  // Helper: mock canary deployment
  const mockCanary = (overrides: Partial<any> = {}) => ({
    id: 'canary-1',
    service_name: 'svc-1',
    baseline_version: 'v1.0',
    canary_version: 'v1.1',
    current_percent: 10,
    max_percent: 100,
    increment_percent: 10,
    status: 'running',
    ...overrides,
  });

  // Helper: mock DB responses for analyzeAndProgress
  const mockAnalyzeFlow = (canary: any, baselineRows: any[], canaryRows: any[]) => {
    mockPool.query
      // getCanaryDeployment
      .mockResolvedValueOnce({ rows: [canary] })
      // collectMetrics baseline
      .mockResolvedValueOnce({ rows: baselineRows })
      // collectMetrics canary
      .mockResolvedValueOnce({ rows: canaryRows })
      // applyAction - update deployment
      .mockResolvedValueOnce({ rows: [] })
      // applyAction - insert analysis result
      .mockResolvedValueOnce({ rows: [] });
  };

  // ==================== analyzeAndProgress ====================

  describe('analyzeAndProgress', () => {
    it('should advance when all metrics are healthy', async () => {
      const canary = mockCanary();
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, metricRows, metricRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('advance');
      expect(result.canaryId).toBe('canary-1');
      expect(result.nextPercent).toBe(20); // 10 + 10
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should rollback when error rate is high', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.15', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, baselineRows, canaryRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('rollback');
      expect(result.nextPercent).toBe(0);
    });

    it('should hold when there are warnings', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      // High latency increase (between 62.5% and 125% threshold for warn)
      // threshold=1.25, warn range: 1+1.25*0.5=1.625 to 1+1.25=2.25
      // 180/100 = 1.80 → warn
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '180', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      // hold doesn't update deployment, only inserts analysis
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: baselineRows })
        .mockResolvedValueOnce({ rows: canaryRows })
        .mockResolvedValueOnce({ rows: [] }); // insert analysis result

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('hold');
      expect(result.nextPercent).toBe(10); // stays at current
    });

    it('should complete when at max percent', async () => {
      const canary = mockCanary({ current_percent: 100, max_percent: 100 });
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: [] }) // update to promoted
        .mockResolvedValueOnce({ rows: [] }); // insert analysis

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('complete');
    });

    it('should hold when insufficient baseline samples', async () => {
      const canary = mockCanary();
      const fewRows = Array.from({ length: 5 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      let callCount = 0;
      mockPool.query.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { rows: [canary] };
        return { rows: fewRows };
      });

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('hold');
      expect(result.recommendation).toContain('Insufficient baseline');
    });

    it('should hold when insufficient canary samples', async () => {
      const canary = mockCanary();
      const manyRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      const fewRows = Array.from({ length: 5 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: manyRows })
        .mockResolvedValueOnce({ rows: fewRows });

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('hold');
      expect(result.recommendation).toContain('Insufficient canary');
    });

    it('should throw when canary not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(engine.analyzeAndProgress('non-existent')).rejects.toThrow('not found');
    });

    it('should throw when canary is not running', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockCanary({ status: 'completed' })] });

      await expect(engine.analyzeAndProgress('canary-1')).rejects.toThrow('not in running state');
    });
  });

  // ==================== getMetricComparison ====================

  describe('getMetricComparison', () => {
    it('should return metric comparison with pass verdict', async () => {
      const canary = mockCanary();
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: metricRows });

      const result = await engine.getMetricComparison('canary-1');

      expect(result.canaryId).toBe('canary-1');
      expect(result.serviceName).toBe('svc-1');
      expect(result.baselineVersion).toBe('v1.0');
      expect(result.canaryVersion).toBe('v1.1');
      expect(result.comparisons).toHaveLength(6);
      expect(result.overallVerdict).toBe('pass');
    });

    it('should return fail verdict when metrics degraded', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.10', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: baselineRows })
        .mockResolvedValueOnce({ rows: canaryRows });

      const result = await engine.getMetricComparison('canary-1');

      expect(result.overallVerdict).toBe('fail');
    });

    it('should throw when canary not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(engine.getMetricComparison('non-existent')).rejects.toThrow('not found');
    });
  });

  // ==================== Statistical Methods ====================

  describe('statistical helpers', () => {
    it('should calculate correct mean and stdDev through comparisons', async () => {
      const canary = mockCanary();
      // Use identical metrics to get pass verdict
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: metricRows });

      const result = await engine.getMetricComparison('canary-1');

      // With identical metrics, baseline and canary means should be equal
      const errorComp = result.comparisons.find(c => c.metricName === 'error_rate');
      expect(errorComp).toBeDefined();
      expect(errorComp!.baselineMean).toBeCloseTo(errorComp!.canaryMean, 5);
      expect(errorComp!.verdict).toBe('pass');
    });

    it('should handle Mann-Whitney U test with ties', async () => {
      const canary = mockCanary();
      // All same values (ties)
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: metricRows });

      const result = await engine.getMetricComparison('canary-1');

      // With identical samples, p-value should be high (no significant difference)
      const comp = result.comparisons[0];
      expect(comp.pValue).toBeGreaterThan(0.5);
    });

    it('should handle empty samples gracefully', async () => {
      const canary = mockCanary();
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('hold');
    });
  });

  // ==================== Action Determination ====================

  describe('determineAction', () => {
    it('should rollback when 2+ metrics fail', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      // Multiple metrics degraded
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.10', latency_p50: '50', latency_p95: '200', latency_p99: '400',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, baselineRows, canaryRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('rollback');
    });

    it('should rollback when error_rate fails even with 1 failure', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      // Only error rate degraded significantly
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.10', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, baselineRows, canaryRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.action).toBe('rollback');
    });
  });

  // ==================== Confidence Calculation ====================

  describe('confidence', () => {
    it('should return high confidence for all-pass metrics', async () => {
      const canary = mockCanary();
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, metricRows, metricRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==================== Recommendation Generation ====================

  describe('recommendation', () => {
    it('should generate advance recommendation', async () => {
      const canary = mockCanary();
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, metricRows, metricRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.recommendation).toContain('acceptable range');
    });

    it('should generate rollback recommendation with failing metrics', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.10', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, baselineRows, canaryRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.recommendation).toContain('rollback');
    });

    it('should generate complete recommendation', async () => {
      const canary = mockCanary({ current_percent: 100, max_percent: 100 });
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockPool.query
        .mockResolvedValueOnce({ rows: [canary] })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: metricRows })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.recommendation).toContain('full traffic');
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should not exceed max percent on advance', async () => {
      const canary = mockCanary({ current_percent: 95, max_percent: 100, increment_percent: 10 });
      const metricRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, metricRows, metricRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result.nextPercent).toBe(100); // min(95+10, 100) = 100
    });

    it('should handle database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(engine.analyzeAndProgress('canary-1')).rejects.toThrow('Connection refused');
    });

    it('should handle metric comparison with zero baseline mean', async () => {
      const canary = mockCanary();
      const baselineRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0', latency_p50: '0', latency_p95: '0', latency_p99: '0',
        cpu_usage: '0', memory_usage: '0', request_rate: '0',
      }));
      const canaryRows = Array.from({ length: 30 }, () => ({
        timestamp: new Date(),
        error_rate: '0.01', latency_p50: '50', latency_p95: '100', latency_p99: '200',
        cpu_usage: '0.5', memory_usage: '0.6', request_rate: '100',
      }));
      mockAnalyzeFlow(canary, baselineRows, canaryRows);

      const result = await engine.analyzeAndProgress('canary-1');

      expect(result).toBeDefined();
      expect(result.metricComparisons).toHaveLength(6);
    });
  });
});
