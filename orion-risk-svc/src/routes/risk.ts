/**
 * Orion Risk Assessment Service - Routes
 * 风险评估路由
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { RiskService } from '../services/RiskService';
import { RiskCategory, RiskLevel, RiskStatus, AssessmentStatus } from '../types/risk';

export async function riskRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const riskService = new RiskService();

  // ========== 风险评估 ==========

  /**
   * 创建风险评估
   * POST /api/v1/risk/assessments
   */
  fastify.post('/risk/assessments', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const assessment = await riskService.createAssessment({
      name: String(body.name || ''),
      description: body.description ? String(body.description) : undefined,
      entityType: String(body.entityType || ''),
      entityId: String(body.entityId || ''),
      status: AssessmentStatus.DRAFT,
      assessorId: String(body.assessorId || ''),
      tenantId: String(body.tenantId || ''),
      events: [],
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    reply.code(201).send({ success: true, data: assessment });
  });

  /**
   * 列表风险评估
   * GET /api/v1/risk/assessments
   */
  fastify.get('/risk/assessments', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await riskService.listRisks({
      entityType: query.entityType,
      entityId: query.entityId,
      category: query.category as RiskCategory,
      level: query.level as RiskLevel,
      status: query.status as RiskStatus,
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
    });
    reply.send({ success: true, data: result });
  });

  /**
   * 获取风险评估详情
   * GET /api/v1/risk/assessments/:id
   */
  fastify.get('/risk/assessments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const assessment = await riskService.getRiskDetail(id);
    if (!assessment) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
    }
    reply.send({ success: true, data: assessment });
  });

  /**
   * 更新风险评估
   * PUT /api/v1/risk/assessments/:id
   */
  fastify.put('/risk/assessments/:id', async (request, reply) => {
    // TODO: 实现更新逻辑
    reply.code(501).send({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Update assessment not yet implemented' } });
  });

  // ========== 风险评分 ==========

  /**
   * 获取风险评分
   * GET /api/v1/risk/scores/:entityType/:entityId
   */
  fastify.get('/risk/scores/:entityType/:entityId', async (request, reply) => {
    const params = request.params as { entityType: string; entityId: string };
    const score = await riskService.getRiskScore(params.entityType, params.entityId);
    if (!score) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Risk score not found' } });
    }
    reply.send({ success: true, data: score });
  });

  // ========== 风险事件 ==========

  /**
   * 列表风险事件
   * GET /api/v1/risk/events
   */
  fastify.get('/risk/events', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await riskService.listRisks({
      category: query.category as RiskCategory,
      level: query.level as RiskLevel,
      status: query.status as RiskStatus,
    });
    reply.send({ success: true, data: result });
  });

  /**
   * 获取风险事件详情
   * GET /api/v1/risk/events/:id
   */
  fastify.get('/risk/events/:id', async (request, reply) => {
    // TODO: 实现获取事件详情逻辑
    reply.code(501).send({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Get event detail not yet implemented' } });
  });

  // ========== 风险详情与状态 ==========

  /**
   * 获取风险详情
   * GET /api/v1/risk/:id/detail
   */
  fastify.get('/risk/:id/detail', async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = await riskService.getRiskDetail(id);
    if (!detail) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Risk detail not found' } });
    }
    reply.send({ success: true, data: detail });
  });

  /**
   * 更新风险状态
   * PUT /api/v1/risk/:id/status
   */
  fastify.put('/risk/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: RiskStatus };
    const updated = await riskService.updateRiskStatus(id, body.status);
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Risk event not found' } });
    }
    reply.send({ success: true, data: updated });
  });
}
