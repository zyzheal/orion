/**
 * PerformanceController - 性能分析 API 控制器
 *
 * 处理性能基线、性能评估、瓶颈分析、回归检测
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { PerformanceBaselineService } from '../../services/performance/PerformanceBaselineService';

interface PerformanceBaseline {
  id: string;
  serviceName: string;
  metrics: Record<string, number>;
  createdAt: string;
}

interface PerformanceResult {
  serviceName: string;
  metrics: Record<string, number>;
  score: number;
  issues: string[];
  timestamp: string;
}

export class PerformanceController extends BaseController {
  private baselines = new Map<string, PerformanceBaseline>();
  private results: PerformanceResult[] = [];
  private baselineService: PerformanceBaselineService;

  constructor() {
    super();
    this.baselineService = new PerformanceBaselineService();
  }

  async createBaseline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        serviceName: string;
        metrics: Record<string, number>;
      };
      const id = `baseline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseline: PerformanceBaseline = {
        id,
        serviceName: body.serviceName,
        metrics: body.metrics,
        createdAt: new Date().toISOString(),
      };
      this.baselines.set(id, baseline);
      return baseline;
    }, (baseline) => this.sendCreated(reply, baseline));
  }

  async listBaselines(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const query = request.query as { serviceName?: string };
      let results = Array.from(this.baselines.values());
      if (query.serviceName) {
        results = results.filter((b) => b.serviceName === query.serviceName);
      }
      return results;
    }, (baselines) => this.sendSuccess(reply, baselines));
  }

  async evaluatePerformance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const body = request.body as {
        serviceName: string;
        metrics: Record<string, number>;
      };
      const issues: string[] = [];
      let totalScore = 100;
      if (body.metrics.latency && body.metrics.latency > 500) {
        issues.push('Latency exceeds 500ms threshold');
        totalScore -= 20;
      }
      if (body.metrics.errorRate && body.metrics.errorRate > 0.01) {
        issues.push('Error rate exceeds 1% threshold');
        totalScore -= 30;
      }
      if (body.metrics.cpu && body.metrics.cpu > 80) {
        issues.push('CPU usage exceeds 80%');
        totalScore -= 15;
      }
      const result: PerformanceResult = {
        serviceName: body.serviceName,
        metrics: body.metrics,
        score: Math.max(0, totalScore),
        issues,
        timestamp: new Date().toISOString(),
      };
      this.results.push(result);
      return result;
    }, (result) => this.sendSuccess(reply, result));
  }

  async profileService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { serviceName: string };
      return {
        serviceName: params.serviceName,
        cpu: { usage: Math.floor(Math.random() * 60) + 10, samples: 100 },
        memory: { usage: Math.floor(Math.random() * 70) + 10, total: '512MB' },
        latency: { p50: Math.floor(Math.random() * 100), p95: Math.floor(Math.random() * 300), p99: Math.floor(Math.random() * 500) },
        throughput: { rps: Math.floor(Math.random() * 1000) + 100 },
        timestamp: new Date().toISOString(),
      };
    }, (profile) => this.sendSuccess(reply, profile));
  }

  async getBottlenecks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      return {
        bottlenecks: [
          { service: 'api-gateway', type: 'latency', severity: 'high', detail: 'P99 latency > 500ms' },
          { service: 'db-service', type: 'connection_pool', severity: 'medium', detail: 'Connection pool exhaustion risk' },
          { service: 'cache-service', type: 'memory', severity: 'low', detail: 'Memory usage at 70%' },
        ],
        timestamp: new Date().toISOString(),
      };
    }, (data) => this.sendSuccess(reply, data));
  }

  async getSuggestions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      return {
        suggestions: [
          { id: 's1', category: 'caching', description: 'Add Redis cache for frequently accessed data', impact: 'high', effort: 'medium' },
          { id: 's2', category: 'database', description: 'Optimize slow queries with index tuning', impact: 'high', effort: 'low' },
          { id: 's3', category: 'scaling', description: 'Enable horizontal scaling for API gateway', impact: 'medium', effort: 'medium' },
        ],
      };
    }, (data) => this.sendSuccess(reply, data));
  }

  // ========== Enhanced Performance Methods ==========

  /**
   * POST /v1/performance/regression - Detect performance regression
   */
  async detectRegression(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{ service: string; currentMetrics: Record<string, number> }>(request);
      const result = this.baselineService.detectRegression(tenantId, body.service, body.currentMetrics);
      if (!result) throw new Error(`No baseline found for service: ${body.service}`);
      return result;
    }, (result) => this.sendSuccess(reply, result));
  }

  /**
   * POST /v1/performance/test-results - Record test result
   */
  async recordTestResult(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = this.getBody<{
        service: string;
        baselineId?: string;
        testName: string;
        metrics: Record<string, number>;
        duration: number;
      }>(request);
      return this.baselineService.recordTestResult(tenantId, body.service, {
        baselineId: body.baselineId,
        testName: body.testName,
        metrics: body.metrics,
        duration: body.duration,
      });
    }, (result) => this.sendCreated(reply, result));
  }

  /**
   * GET /v1/performance/test-results/:service - Get test results for a service
   */
  async getTestResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = this.getParams<{ service: string }>(request);
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : undefined;
      return this.baselineService.getTestResults(params.service, limit);
    }, (results) => this.sendSuccess(reply, results));
  }

  /**
   * GET /v1/performance/baselines/:id/evaluations - Get evaluation history
   */
  async getEvaluationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = this.getParams<{ id: string }>(request);
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : undefined;
      return this.baselineService.getEvaluationHistory(params.id, limit);
    }, (history) => this.sendSuccess(reply, history));
  }

  /**
   * GET /v1/performance/baselines/:id - Get baseline by ID
   */
  async getBaselineById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = this.getParams<{ id: string }>(request);
      const baseline = this.baselineService.getBaselineById(params.id);
      if (!baseline) throw new Error(`Baseline '${params.id}' not found`);
      return baseline;
    }, (baseline) => this.sendSuccess(reply, baseline));
  }
}
