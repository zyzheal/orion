/**
 * 风险评估 API 路由
 *
 * 前缀: /api/v1/risk
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  RiskAssessmentService,
  RiskEventSubscriber,
  RiskAssessmentServiceConfig,
} from '../services/risk-assessment';
import { RiskTargetType, RiskLevel, DeploymentRisk } from '../services/risk-assessment/types';

export interface RiskRoutesOptions {
  riskAssessmentService?: RiskAssessmentService;
  riskEventSubscriber?: RiskEventSubscriber;
}

export default async function riskRoutes(
  app: FastifyInstance,
  options: RiskRoutesOptions
): Promise<void> {
  const service = options.riskAssessmentService || new RiskAssessmentService();

  // In-memory stores for risk events and health check history (MVP)
  const riskEventsStore: Array<{
    id: string;
    eventType: 'risk_detected' | 'risk_escalated' | 'risk_mitigated';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    targetType: string;
    targetId: string;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
    createdAt: Date;
  }> = [];

  const healthCheckHistory: Array<{
    id: string;
    checkType: 'pre-deployment' | 'basic' | 'comprehensive';
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: string; message?: string }>;
    executedAt: Date;
    duration: number;
  }> = [];

  // ==================== 风险评估 ====================

  /**
   * POST /api/v1/risk/assess/deployment
   * 评估部署风险
   */
  app.post(
    '/assess/deployment',
    async (
      request: FastifyRequest<{
        Body: {
          deploymentId: string;
          deploymentRisk: DeploymentRisk;
          tenantId?: string;
          runHealthChecks?: boolean;
          healthCheckParams?: {
            pipelineStatus?: string;
            testResults?: { total: number; passed: number; failed: number };
            codeReviewStatus?: 'approved' | 'pending' | 'rejected' | 'none';
            dependencies?: string[];
          };
        };
      }>,
      reply: FastifyReply
    ) => {
      const { deploymentId, deploymentRisk, tenantId, runHealthChecks, healthCheckParams } =
        request.body;

      if (!deploymentId || !deploymentRisk) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'deploymentId and deploymentRisk are required',
        });
      }

      const assessment = await service.assessDeploymentRisk({
        deploymentId,
        deploymentRisk,
        tenantId,
        runHealthChecks,
        healthCheckParams,
      });

      return reply.status(201).send({
        data: assessment,
        meta: {
          canDeploy:
            assessment.riskLevel !== 'Critical' &&
            assessment.recommendations.filter((r) => r.type === 'block').length === 0,
        },
      });
    }
  );

  /**
   * POST /api/v1/risk/assess/change
   * 评估变更风险
   */
  app.post(
    '/assess/change',
    async (
      request: FastifyRequest<{
        Body: {
          changeId: string;
          deploymentRisk: DeploymentRisk;
          tenantId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { changeId, deploymentRisk, tenantId } = request.body;

      if (!changeId || !deploymentRisk) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'changeId and deploymentRisk are required',
        });
      }

      const assessment = await service.assessChangeRisk({
        changeId,
        deploymentRisk,
        tenantId,
      });

      return reply.status(201).send({
        data: assessment,
      });
    }
  );

  // ==================== 评估历史 ====================

  /**
   * GET /api/v1/risk/assessments
   * 获取评估历史
   */
  app.get(
    '/assessments',
    async (
      request: FastifyRequest<{
        Querystring: {
          targetType?: RiskTargetType;
          targetId?: string;
          tenantId?: string;
          riskLevel?: RiskLevel;
          since?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { targetType, targetId, tenantId, riskLevel, since, limit } = request.query;

      const assessments = await service.getAssessmentHistory({
        targetType,
        targetId,
        tenantId,
        riskLevel,
        since: since ? new Date(since) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: assessments,
        meta: {
          total: assessments.length,
        },
      });
    }
  );

  /**
   * GET /api/v1/risk/assessments/:id
   * 获取评估详情
   */
  app.get(
    '/assessments/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const assessment = await service.getAssessmentById(id);

      if (!assessment) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Assessment ${id} not found`,
        });
      }

      return reply.send({
        data: assessment,
      });
    }
  );

  // ==================== 风险评估报告 ====================

  /**
   * POST /api/v1/risk/reports/generate/:assessmentId
   * 生成评估报告
   */
  app.post(
    '/reports/generate/:assessmentId',
    async (
      request: FastifyRequest<{ Params: { assessmentId: string } }>,
      reply: FastifyReply
    ) => {
      const { assessmentId } = request.params;
      const report = await service.generateReport(assessmentId);

      if (!report) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Assessment ${assessmentId} not found`,
        });
      }

      return reply.status(201).send({
        data: report,
      });
    }
  );

  /**
   * GET /api/v1/risk/reports
   * 获取报告历史
   */
  app.get(
    '/reports',
    async (
      request: FastifyRequest<{
        Querystring: {
          assessmentId?: string;
          tenantId?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { assessmentId, tenantId, limit } = request.query;

      const reports = service.getReportHistory({
        assessmentId,
        tenantId,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: reports,
        meta: {
          total: reports.length,
        },
      });
    }
  );

  /**
   * GET /api/v1/risk/reports/:id
   * 获取报告详情
   */
  app.get(
    '/reports/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const report = service.getReportById(id);

      if (!report) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Report ${id} not found`,
        });
      }

      return reply.send({
        data: report,
      });
    }
  );

  // ==================== 健康检查 ====================

  /**
   * POST /api/v1/risk/health-check
   * 运行发布前健康检查
   */
  app.post(
    '/health-check',
    async (
      request: FastifyRequest<{
        Body: {
          targetId: string;
          pipelineStatus?: string;
          testResults?: { total: number; passed: number; failed: number };
          codeReviewStatus?: 'approved' | 'pending' | 'rejected' | 'none';
          dependencies?: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      const { targetId, pipelineStatus, testResults, codeReviewStatus, dependencies } =
        request.body;

      if (!targetId) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'targetId is required',
        });
      }

      const healthCheckService = service.getHealthCheckService();
      const result = await healthCheckService.runPreDeploymentChecks({
        targetId,
        pipelineStatus,
        testResults,
        codeReviewStatus,
        dependencies,
      });

      // Also store in health check history
      healthCheckHistory.push({
        id: `hc-${Date.now()}`,
        checkType: 'pre-deployment',
        status: (result as any).overallStatus || 'healthy',
        checks: (result as any).checks || [],
        executedAt: new Date(),
        duration: (result as any).duration || 0,
      });

      return reply.send({
        data: result,
        meta: {
          canProceed: result.canProceed,
        },
      });
    }
  );

  /**
   * POST /api/v1/risk/health-check/basic
   * 运行基础健康检查
   */
  app.post(
    '/health-check/basic',
    async (
      request: FastifyRequest<{
        Body: {
          dependencies?: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      const { dependencies } = request.body;

      const healthCheckService = service.getHealthCheckService();
      const result = await healthCheckService.runHealthChecks({
        dependencies,
      });

      return reply.send({
        data: result,
      });
    }
  );

  // ==================== 状态端点 ====================

  /**
   * GET /api/v1/risk/status
   * 获取风险评估服务状态
   */
  app.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const assessments = await service.getAssessmentHistory();
    return reply.send({
      service: 'risk-assessment',
      status: 'running',
      assessmentsCount: assessments.length,
      reportsCount: service.getReportHistory().length,
    });
  });

  // ==================== Risk Events ====================

  // GET /events - List risk events
  app.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string };
    try {
      let events = [...riskEventsStore];
      if (query.status === 'acknowledged') {
        events = events.filter((e) => e.acknowledged);
      } else if (query.status === 'unacknowledged') {
        events = events.filter((e) => !e.acknowledged);
      }
      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          events: events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          total: events.length,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // POST /events/:id/acknowledge - Acknowledge a risk event
  app.post('/events/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const event = riskEventsStore.find((e) => e.id === params.id);
      if (!event) {
        return reply.status(404).send({ code: 404, message: 'Risk event not found' });
      }
      event.acknowledged = true;
      event.acknowledgedAt = new Date().toISOString();
      return reply.send({ code: 200, message: 'OK', data: { acknowledged: true, acknowledgedAt: event.acknowledgedAt } });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Health Check History ====================

  // GET /health-check/history - Get health check history
  app.get('/health-check/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        code: 200,
        message: 'OK',
        data: {
          checks: healthCheckHistory.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime()),
          total: healthCheckHistory.length,
        },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
