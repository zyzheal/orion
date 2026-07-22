/**
 * 诊断 Agent API 路由
 *
 * 前缀: /api/v1/diagnostic
 *
 * Migration: Now uses PostgreSQL Repository pattern when database pool is provided.
 * Falls back to in-memory storage for backward compatibility.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {  ValidationError, NotFoundError, handleError } from '../errors';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DiagnosticRepository } from '../services/diagnostic/DiagnosticRepository';
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
  database?: DatabasePool;
}

export default async function diagnosticRoutes(
  app: FastifyInstance,
  options: DiagnosticRoutesOptions
): Promise<void> {
  // Initialize service: prefer PostgreSQL-backed service if database is available
  let service: DiagnosticAgentService;
  if (options.database) {
    const repository = new DiagnosticRepository(options.database);
    const config: DiagnosticAgentServiceConfig = {
      repository,
      db: options.database,
    };
    service = new DiagnosticAgentService(config);
  } else if (options.diagnosticAgentService) {
    service = options.diagnosticAgentService;
  } else {
    // Fallback: in-memory only (for tests / no DB)
    service = new DiagnosticAgentService();
  }

  // ==================== 诊断触发 ====================

  /**
   * POST /api/v1/diagnostic/trigger
   * 触发诊断
   */
  app.post(
    '/trigger',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'execute' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const body = request.body as TriggerDiagnosticRequest;
      const { triggerType, triggerId, symptoms, tenantId } = body;

      if (!triggerType || !triggerId || !symptoms || symptoms.length === 0) {
        return handleError(reply, new ValidationError('BAD_REQUEST'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const query = request.query as {
        triggerType?: DiagnosticTriggerType;
        triggerId?: string;
        tenantId?: string;
        status?: DiagnosticSessionStatus;
        since?: string;
        limit?: string;
      };
      const { triggerType, triggerId, tenantId, status, since, limit } = query;

      const sessions = await service.getDiagnosticHistory({
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const session = await service.getDiagnosticDetail(id);

      if (!session) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
      }

      // 尝试获取关联报告
      const report = await service.getReportBySession(id);

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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const body = request.body as AddSymptomRequest;
      const { type, source, description, severity, metadata } = body;

      if (!type || !source || !description || !severity) {
        return handleError(reply, new ValidationError('BAD_REQUEST'))
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
          return handleError(reply, new NotFoundError('NOT_FOUND'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const session = await service.getDiagnosticDetail(id);

      if (!session) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const query = request.query as {
        sessionId?: string;
        tenantId?: string;
        limit?: string;
      };
      const { sessionId, tenantId, limit } = query;

      const reports = await service.getReportHistory({
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const report = await service.getReport(id);

      if (!report) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };

      try {
        const complexity = await service.estimateFixComplexity(id);
        return reply.send({
          data: complexity,
        });
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return handleError(reply, new NotFoundError('NOT_FOUND'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const body = request.body as AddPatternRequest;
      const { name, symptoms, rootCause, solution, category } = body;

      if (!name || !symptoms || !rootCause || !solution || !category) {
        return handleError(reply, new ValidationError('BAD_REQUEST'))
      }

      const pattern = await service.addPattern({
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const query = request.query as {
        category?: DiagnosticCategory;
        keyword?: string;
        minFrequency?: string;
        limit?: string;
      };
      const { category, keyword, minFrequency, limit } = query;

      const patterns = await service.searchPatterns({
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { id } = request.params as { id: string };
      const pattern = await service.getPattern(id);

      if (!pattern) {
        return handleError(reply, new NotFoundError('NOT_FOUND'))
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read' })],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = await service.getKnowledgeBaseStats();
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
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const body = request.body as {
        sessionId: string;
        patternId: string;
        confirmed: boolean;
        actualRootCause?: string;
        fixTimeMs?: number;
      };
      const { sessionId, patternId, confirmed, actualRootCause, fixTimeMs } = body;

      if (!sessionId || !patternId) {
        return handleError(reply, new ValidationError('BAD_REQUEST'))
      }

      const outcome = await service.recordOutcome({
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
  app.get('/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'diagnostic', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const status = await service.getStatus();
    return reply.send({
      data: status,
    });
  });
}
