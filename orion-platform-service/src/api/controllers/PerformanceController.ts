/**
 * PerformanceController - 性能分析 API 控制器
 *
 * 处理性能基线、性能评估、瓶颈分析、回归检测
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { PerformanceBaselineService } from '../../services/performance/PerformanceBaselineService';
import { PerformanceProfileService } from '../../services/performance/PerformanceProfileService';
import { OrionError, ErrorCode } from '../../errors';

export class PerformanceController extends BaseController {
  private baselineService: PerformanceBaselineService;
  private profileSvc: PerformanceProfileService;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super();
    this.baselineService = new PerformanceBaselineService(db);
    this.profileSvc = new PerformanceProfileService(db);
  }

  async createBaseline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        service: string;
        metrics: Record<string, number>;
        thresholds?: Record<string, { min: number; max: number }>;
      };
      return this.baselineService.createBaseline(tenantId, body.service, body.metrics, body.thresholds);
    }, (baseline) => this.sendCreated(reply, baseline));
  }

  async listBaselines(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      return this.baselineService.listBaselines(tenantId);
    }, (baselines) => this.sendSuccess(reply, baselines));
  }

  async evaluatePerformance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const tenantId = this.getTenantId(request);
      const body = request.body as {
        service: string;
        metrics: Record<string, number>;
      };
      const result = await this.baselineService.evaluatePerformance(tenantId, body.service, body.metrics);
      if (!result) throw new OrionError(`No baseline found for service: ${body.service}`, ErrorCode.NOT_FOUND);
      return result;
    }, (result) => this.sendSuccess(reply, result));
  }

  async profileService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { serviceName: string };
      return this.profileSvc.profileService(params.serviceName, {
        durationSeconds: 60,
        concurrency: 10,
      });
    }, (profile) => this.sendSuccess(reply, profile));
  }

  async getBottlenecks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { profileId: string };
      const result = await this.profileSvc.analyzeBottlenecks(params.profileId);
      if (!result) throw new OrionError(`Profile not found or not completed: ${params.profileId}`, 'NOT_FOUND');
      return result;
    }, (data) => this.sendSuccess(reply, data));
  }

  async getSuggestions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.tryExecute(reply, async () => {
      const params = request.params as { serviceName: string };
      return this.profileSvc.getOptimizationSuggestions(params.serviceName);
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
      const result = await this.baselineService.detectRegression(tenantId, body.service, body.currentMetrics);
      if (!result) throw new OrionError(`No baseline found for service: ${body.service}`, ErrorCode.NOT_FOUND);
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
      const baseline = await this.baselineService.getBaselineById(params.id);
      if (!baseline) throw new OrionError(`Baseline '${params.id}' not found`, 'NOT_FOUND');
      return baseline;
    }, (baseline) => this.sendSuccess(reply, baseline));
  }
}
