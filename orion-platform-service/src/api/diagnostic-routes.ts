/**
 * 诊断 Agent API 路由
 *
 * 前缀: /api/v1/diagnostic
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  DiagnosticAgentService,
  DiagnosticAgentServiceConfig,
  TriggerDiagnosticRequest,
  AddSymptomRequest,
  AddPatternRequest,
  DiagnosticTriggerType,
  DiagnosticSessionStatus,
  DiagnosticCategory,
} from '../services/diagnostic';

export interface DiagnosticRoutesOptions {
  diagnosticAgentService?: DiagnosticAgentService;
}

export default async function diagnosticRoutes(
  app: FastifyInstance,
  options: DiagnosticRoutesOptions
): Promise<void> {
  const service = options.diagnosticAgentService || new DiagnosticAgentService();

  // ==================== 诊断触发 ====================

  /**
   * POST /api/v1/diagnostic/trigger
   * 触发诊断
   */
  app.post(
    '/trigger',
    async (
      request: FastifyRequest<{ Body: TriggerDiagnosticRequest }>,
      reply: FastifyReply
    ) => {
      const { triggerType, triggerId, symptoms, tenantId } = request.body;

      if (!triggerType || !triggerId || !symptoms || symptoms.length === 0) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'triggerType, triggerId, and at least one symptom are required',
        });
      }

      const result = await service.triggerDiagnostic({
        triggerType,
        triggerId,
        symptoms,
        tenantId,
      });

      return reply.status(201).send({
        data: {
          session: result.session,
          report: result.report,
        },
      });
    }
  );

  // ==================== 诊断会话管理 ====================

  /**
   * GET /api/v1/diagnostic/sessions
   * 获取诊断历史
   */
  app.get(
    '/sessions',
    async (
      request: FastifyRequest<{
        Querystring: {
          triggerType?: DiagnosticTriggerType;
          triggerId?: string;
          tenantId?: string;
          status?: DiagnosticSessionStatus;
          since?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { triggerType, triggerId, tenantId, status, since, limit } = request.query;

      const sessions = service.getDiagnosticHistory({
        triggerType,
        triggerId,
        tenantId,
        status,
        since: since ? new Date(since) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: sessions,
        meta: {
          total: sessions.length,
        },
      });
    }
  );

  /**
   * GET /api/v1/diagnostic/sessions/:id
   * 获取诊断详情
   */
  app.get(
    '/sessions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const session = service.getDiagnosticDetail(id);

      if (!session) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Diagnostic session ${id} not found`,
        });
      }

      // 尝试获取关联报告
      const report = service.getReportBySession(id);

      return reply.send({
        data: session,
        included: report ? { report } : undefined,
      });
    }
  );

  /**
   * POST /api/v1/diagnostic/sessions/:id/symptoms
   * 添加症状到诊断会话
   */
  app.post(
    '/sessions/:id/symptoms',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AddSymptomRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { type, source, description, severity, metadata } = request.body;

      if (!type || !source || !description || !severity) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'type, source, description, and severity are required',
        });
      }

      try {
        const session = await service.addSymptomToSession(id, {
          type,
          source,
          description,
          severity,
          metadata,
        });

        return reply.send({
          data: session,
        });
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/diagnostic/sessions/:id/complete
   * 完成诊断会话
   */
  app.post(
    '/sessions/:id/complete',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const session = service.getDiagnosticDetail(id);

      if (!session) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Diagnostic session ${id} not found`,
        });
      }

      // 重新生成报告
      const { DiagnosticReporter } = await import('../services/diagnostic/DiagnosticReporter');
      const reporter = new DiagnosticReporter();
      const report = reporter.generateReport(session);

      return reply.send({
        data: session,
        included: { report },
      });
    }
  );

  // ==================== 诊断报告 ====================

  /**
   * GET /api/v1/diagnostic/reports
   * 获取报告历史
   */
  app.get(
    '/reports',
    async (
      request: FastifyRequest<{
        Querystring: {
          sessionId?: string;
          tenantId?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { sessionId, tenantId, limit } = request.query;

      const reports = service.getReportHistory({
        sessionId,
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
   * GET /api/v1/diagnostic/reports/:id
   * 获取报告详情
   */
  app.get(
    '/reports/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const report = service.getReport(id);

      if (!report) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Diagnostic report ${id} not found`,
        });
      }

      return reply.send({
        data: report,
      });
    }
  );

  /**
   * GET /api/v1/diagnostic/sessions/:id/complexity
   * 评估修复复杂度
   */
  app.get(
    '/sessions/:id/complexity',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const complexity = service.estimateFixComplexity(id);
        return reply.send({
          data: complexity,
        });
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // ==================== 知识库管理 ====================

  /**
   * POST /api/v1/diagnostic/knowledge/patterns
   * 添加诊断模式
   */
  app.post(
    '/knowledge/patterns',
    async (
      request: FastifyRequest<{ Body: AddPatternRequest }>,
      reply: FastifyReply
    ) => {
      const { name, symptoms, rootCause, solution, category } = request.body;

      if (!name || !symptoms || !rootCause || !solution || !category) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'name, symptoms, rootCause, solution, and category are required',
        });
      }

      const pattern = service.addPattern({
        name,
        symptoms,
        rootCause,
        solution,
        category,
      });

      return reply.status(201).send({
        data: pattern,
      });
    }
  );

  /**
   * GET /api/v1/diagnostic/knowledge/patterns
   * 搜索诊断模式
   */
  app.get(
    '/knowledge/patterns',
    async (
      request: FastifyRequest<{
        Querystring: {
          category?: DiagnosticCategory;
          keyword?: string;
          minFrequency?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { category, keyword, minFrequency, limit } = request.query;

      const patterns = service.searchPatterns({
        category,
        keyword,
        minFrequency: minFrequency ? parseInt(minFrequency, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: patterns,
        meta: {
          total: patterns.length,
        },
      });
    }
  );

  /**
   * GET /api/v1/diagnostic/knowledge/patterns/:id
   * 获取诊断模式详情
   */
  app.get(
    '/knowledge/patterns/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const pattern = service.getPattern(id);

      if (!pattern) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Diagnostic pattern ${id} not found`,
        });
      }

      return reply.send({
        data: pattern,
      });
    }
  );

  /**
   * GET /api/v1/diagnostic/knowledge/stats
   * 获取知识库统计
   */
  app.get(
    '/knowledge/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = service.getKnowledgeBaseStats();
      return reply.send({
        data: stats,
      });
    }
  );

  /**
   * POST /api/v1/diagnostic/knowledge/outcomes
   * 记录诊断结果
   */
  app.post(
    '/knowledge/outcomes',
    async (
      request: FastifyRequest<{
        Body: {
          sessionId: string;
          patternId: string;
          confirmed: boolean;
          actualRootCause?: string;
          fixTimeMs?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { sessionId, patternId, confirmed, actualRootCause, fixTimeMs } = request.body;

      if (!sessionId || !patternId) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'sessionId and patternId are required',
        });
      }

      const outcome = service.recordOutcome({
        sessionId,
        patternId,
        confirmed,
        actualRootCause,
        fixTimeMs,
      });

      return reply.status(201).send({
        data: outcome,
      });
    }
  );

  // ==================== 状态端点 ====================

  /**
   * GET /api/v1/diagnostic/status
   * 获取诊断服务状态
   */
  app.get('/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    const status = service.getStatus();
    return reply.send({
      data: status,
    });
  });
}
