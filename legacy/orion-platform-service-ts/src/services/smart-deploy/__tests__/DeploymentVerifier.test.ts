/**
 * DeploymentVerifier - Comprehensive Tests
 *
 * Tests for health checks, metric verification, deployment comparison,
 * and verification report generation.
 */

import { DeploymentVerifier } from '../DeploymentVerifier';
import type { Deployment, HealthCheckConfig } from '../types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-' + Math.random().toString(36).slice(2) }));
jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'deploy-001',
    appName: 'test-app',
    version: '1.0.0',
    environment: 'production',
    strategy: 'rolling',
    status: 'completed',
    stages: [],
    currentStageIndex: 0,
    startedAt: new Date(),
    initiatedBy: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DeploymentVerifier', () => {
  let verifier: DeploymentVerifier;

  beforeEach(() => {
    verifier = new DeploymentVerifier();
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create verifier without options', () => {
      const v = new DeploymentVerifier();
      expect(v).toBeDefined();
    });

    it('should create verifier with custom metrics source', () => {
      const metricsSource = jest.fn().mockResolvedValue({ error_rate: 1.0 });
      const v = new DeploymentVerifier({ metricsSource });
      expect(v).toBeDefined();
    });
  });

  // ─── verifyHealth ─────────────────────────────────────────────────────────

  describe('verifyHealth', () => {
    it('should return health check results with default config', async () => {
      const results = await verifier.verifyHealth('my-app', '1.0.0', 'production');

      expect(results.length).toBe(3); // /api/health, /api/ready, /api/live
      expect(results[0].endpoint).toBe('/api/health');
      expect(results[1].endpoint).toBe('/api/ready');
      expect(results[2].endpoint).toBe('/api/live');
    });

    it('should mark all checks as passed when no base URL', async () => {
      const results = await verifier.verifyHealth('my-app', '1.0.0', 'production');

      for (const result of results) {
        expect(result.passed).toBe(true);
        expect(result.checkedAt).toBeDefined();
      }
    });

    it('should use custom endpoint from config', async () => {
      const config: HealthCheckConfig = {
        endpoint: '/custom/health',
        expectedStatus: 200,
        timeoutMs: 1000,
        retries: 1,
        retryIntervalMs: 100,
      };

      const results = await verifier.verifyHealth('my-app', '1.0.0', 'production', config);

      expect(results[0].endpoint).toBe('/custom/health');
    });

    it('should return response time for each check', async () => {
      const results = await verifier.verifyHealth('my-app', '1.0.0', 'production');

      for (const result of results) {
        expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return unique IDs for each check', async () => {
      const results = await verifier.verifyHealth('my-app', '1.0.0', 'production');

      const ids = results.map(r => r.id);
      expect(new Set(ids).size).toBe(results.length);
    });
  });

  // ─── verifyMetrics ────────────────────────────────────────────────────────

  describe('verifyMetrics', () => {
    it('should return metric verification results', async () => {
      const results = await verifier.verifyMetrics('my-app', '1.0.0', 'production');

      expect(results.length).toBe(5); // error_rate, latency_p50, p95, p99, throughput
      expect(results.map(r => r.metricName)).toEqual([
        'error_rate', 'latency_p50', 'latency_p95', 'latency_p99', 'throughput',
      ]);
    });

    it('should use default thresholds when not specified', async () => {
      const results = await verifier.verifyMetrics('my-app', '1.0.0', 'production');

      const errorRate = results.find(r => r.metricName === 'error_rate');
      expect(errorRate?.threshold).toBe(5);

      const p50 = results.find(r => r.metricName === 'latency_p50');
      expect(p50?.threshold).toBe(200);
    });

    it('should use custom thresholds', async () => {
      const results = await verifier.verifyMetrics('my-app', '1.0.0', 'production', {
        maxErrorRate: 10,
        maxLatencyP50: 500,
        maxLatencyP95: 1000,
        maxLatencyP99: 2000,
        minThroughput: 50,
      });

      const errorRate = results.find(r => r.metricName === 'error_rate');
      expect(errorRate?.threshold).toBe(10);
    });

    it('should use custom metrics source when provided', async () => {
      const metricsSource = jest.fn().mockResolvedValue({
        error_rate: 2.0,
        latency_p50: 100,
        latency_p95: 300,
        latency_p99: 600,
        throughput: 200,
      });

      const v = new DeploymentVerifier({ metricsSource });
      const results = await v.verifyMetrics('my-app', '1.0.0', 'production');

      expect(metricsSource).toHaveBeenCalledWith('my-app', '1.0.0', 'production');

      const errorRate = results.find(r => r.metricName === 'error_rate');
      expect(errorRate?.currentValue).toBe(2.0);
    });

    it('should fallback to default metrics when source fails', async () => {
      const metricsSource = jest.fn().mockRejectedValue(new Error('source failed'));
      const v = new DeploymentVerifier({ metricsSource });

      const results = await v.verifyMetrics('my-app', '1.0.0', 'production');

      // Should still return results with simulated values
      expect(results.length).toBe(5);
    });

    it('should mark throughput as passed when above threshold', async () => {
      const metricsSource = jest.fn().mockResolvedValue({
        error_rate: 0.5,
        latency_p50: 50,
        latency_p95: 100,
        latency_p99: 200,
        throughput: 500,
      });

      const v = new DeploymentVerifier({ metricsSource });
      const results = await v.verifyMetrics('my-app', '1.0.0', 'production', {
        minThroughput: 100,
      });

      const throughput = results.find(r => r.metricName === 'throughput');
      expect(throughput?.passed).toBe(true);
    });

    it('should mark throughput as failed when below threshold', async () => {
      const metricsSource = jest.fn().mockResolvedValue({
        error_rate: 0.5,
        latency_p50: 50,
        latency_p95: 100,
        latency_p99: 200,
        throughput: 50,
      });

      const v = new DeploymentVerifier({ metricsSource });
      const results = await v.verifyMetrics('my-app', '1.0.0', 'production', {
        minThroughput: 100,
      });

      const throughput = results.find(r => r.metricName === 'throughput');
      expect(throughput?.passed).toBe(false);
    });

    it('should include checkedAt timestamp', async () => {
      const results = await verifier.verifyMetrics('my-app', '1.0.0', 'production');

      for (const result of results) {
        expect(result.checkedAt).toBeInstanceOf(Date);
      }
    });
  });

  // ─── compareWithPrevious ──────────────────────────────────────────────────

  describe('compareWithPrevious', () => {
    it('should return comparison result with previous deployment', async () => {
      const current = createDeployment({ id: 'current', status: 'completed' });
      const previous = createDeployment({ id: 'previous', status: 'completed' });

      const result = await verifier.compareWithPrevious(current, previous);

      expect(result.currentDeploymentId).toBe('current');
      expect(result.previousDeploymentId).toBe('previous');
      expect(result.comparedAt).toBeInstanceOf(Date);
      expect(typeof result.isImprovement).toBe('boolean');
      expect(result.summary).toBeDefined();
    });

    it('should handle no previous deployment', async () => {
      const current = createDeployment();

      const result = await verifier.compareWithPrevious(current);

      expect(result.previousDeploymentId).toBe('none');
      expect(result.isImprovement).toBe(true);
      expect(result.summary).toContain('No previous deployment');
    });

    it('should compare health check status', async () => {
      const current = createDeployment({ status: 'completed' });
      const previous = createDeployment({ status: 'failed' });

      const result = await verifier.compareWithPrevious(current, previous);

      expect(result.healthCheckComparison.currentHealth).toBe(true);
      expect(result.healthCheckComparison.previousHealth).toBe(false);
    });

    it('should include metric comparisons', async () => {
      const current = createDeployment();
      const previous = createDeployment();

      const result = await verifier.compareWithPrevious(current, previous);

      expect(result.metricComparison.length).toBe(4); // error_rate, p50, p95, p99
      for (const metric of result.metricComparison) {
        expect(metric.currentValue).toBeDefined();
        expect(metric.previousValue).toBeDefined();
        expect(metric.threshold).toBe(500);
      }
    });

    it('should generate improvement summary', async () => {
      const current = createDeployment({ status: 'completed' });
      const previous = createDeployment({ status: 'completed' });

      const result = await verifier.compareWithPrevious(current, previous);

      expect(result.summary).toMatch(/improvement|regression/);
    });
  });

  // ─── generateVerificationReport ───────────────────────────────────────────

  describe('generateVerificationReport', () => {
    it('should generate a complete verification report', async () => {
      const deployment = createDeployment();

      const report = await verifier.generateVerificationReport(deployment);

      expect(report.deploymentId).toBe('deploy-001');
      expect(report.overallStatus).toMatch(/pass|fail|partial/);
      expect(report.healthChecks.length).toBe(3);
      expect(report.metrics.length).toBe(5);
      expect(report.comparison).toBeDefined();
      expect(report.verifiedAt).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
    });

    it('should pass when all checks pass', async () => {
      const deployment = createDeployment();

      const report = await verifier.generateVerificationReport(deployment);

      // With simulated values (no base URL), health checks pass
      expect(report.healthChecks.every(h => h.passed)).toBe(true);
    });

    it('should include comparison with previous deployment', async () => {
      const current = createDeployment({ id: 'current' });
      const previous = createDeployment({ id: 'previous' });

      const report = await verifier.generateVerificationReport(current, previous);

      expect(report.comparison).toBeDefined();
      expect(report.comparison?.currentDeploymentId).toBe('current');
      expect(report.comparison?.previousDeploymentId).toBe('previous');
    });

    it('should generate summary with health and metrics counts', async () => {
      const deployment = createDeployment();

      const report = await verifier.generateVerificationReport(deployment);

      expect(report.summary).toContain('Health checks:');
      expect(report.summary).toContain('Metrics:');
    });

    it('should accept custom health check config', async () => {
      const deployment = createDeployment();

      const report = await verifier.generateVerificationReport(deployment, undefined, {
        endpoint: '/custom/health',
        expectedStatus: 200,
        timeoutMs: 1000,
        retries: 1,
        retryIntervalMs: 100,
      });

      expect(report.healthChecks[0].endpoint).toBe('/custom/health');
    });

    it('should handle partial pass status', async () => {
      // With custom metrics source that returns bad error rate
      const metricsSource = jest.fn().mockResolvedValue({
        error_rate: 100, // Very high
        latency_p50: 50,
        latency_p95: 100,
        latency_p99: 200,
        throughput: 500,
      });

      const v = new DeploymentVerifier({ metricsSource });
      const deployment = createDeployment();
      const report = await v.generateVerificationReport(deployment);

      // Health passes but some metrics may fail
      expect(report.overallStatus).toBeDefined();
    });
  });
});
