/**
 * Orion Self-Healing Service - Routes
 * 自愈路由
 */

import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { SelfHealingService } from '../services/SelfHealingService';
import { IncidentSeverity, IncidentStatus, type HealingStrategy, StrategyType } from '../types/selfhealing';

export async function selfhealingRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const selfhealingService = new SelfHealingService();

  // ========== 事件管理 ==========

  /**
   * 创建自愈事件
   * POST /api/v1/selfhealing/incidents
   */
  fastify.post('/selfhealing/incidents', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const incident = await selfhealingService.createIncident({
      title: String(body.title || ''),
      description: String(body.description || ''),
      severity: (body.severity as IncidentSeverity) || 'medium',
      alertId: body.alertId ? String(body.alertId) : undefined,
      affectedResources: (body.affectedResources as string[]) || [],
      triggerSource: String(body.triggerSource || ''),
      triggeredAt: new Date(),
      tenantId: String(body.tenantId || ''),
      actionIds: [],
    });
    reply.code(201).send({ success: true, data: incident });
  });

  /**
   * 列表自愈事件
   * GET /api/v1/selfhealing/incidents
   */
  fastify.get('/selfhealing/incidents', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const result = await selfhealingService.listIncidents({
      severity: query.severity as IncidentSeverity,
      status: query.status as IncidentStatus,
      tenantId: query.tenantId,
    });
    reply.send({ success: true, data: result });
  });

  /**
   * 获取事件详情
   * GET /api/v1/selfhealing/incidents/:id
   */
  fastify.get('/selfhealing/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = await selfhealingService.getIncident(id);
    if (!incident) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    }
    reply.send({ success: true, data: incident });
  });

  /**
   * 更新事件
   * PUT /api/v1/selfhealing/incidents/:id
   */
  fastify.put('/selfhealing/incidents/:id', async (request, reply) => {
    // TODO: 实现更新逻辑
    reply.code(501).send({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Update incident not yet implemented' } });
  });

  // ========== 策略评估 ==========

  /**
   * 评估策略
   * POST /api/v1/selfhealing/strategy/evaluate
   */
  fastify.post('/selfhealing/strategy/evaluate', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const incident = {
      id: String(body.incidentId || ''),
      title: String(body.title || ''),
      description: String(body.description || ''),
      severity: (body.severity as IncidentSeverity) || 'medium',
      status: IncidentStatus.EVALUATING,
      affectedResources: (body.affectedResources as string[]) || [],
      triggerSource: String(body.triggerSource || ''),
      triggeredAt: new Date(),
      tenantId: String(body.tenantId || ''),
      actionIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const strategies = await selfhealingService.evaluateStrategy(incident);
    reply.send({ success: true, data: strategies });
  });

  // ========== 修复决策 ==========

  /**
   * 做出修复决策
   * POST /api/v1/selfhealing/decision
   */
  fastify.post('/selfhealing/decision', async (request, reply) => {
    const body = request.body as { incidentId: string; strategies: Array<Record<string, unknown>> };
    const decision = await selfhealingService.makeDecision(
      body.incidentId,
      (body.strategies || []) as unknown as HealingStrategy[]
    );
    if (!decision) {
      return reply.code(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'No suitable strategy found' } });
    }
    reply.code(201).send({ success: true, data: decision });
  });

  // ========== 修复动作 ==========

  /**
   * 执行修复动作
   * POST /api/v1/selfhealing/actions/execute
   */
  fastify.post('/selfhealing/actions/execute', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const action = await selfhealingService.executeAction({
      name: String(body.name || ''),
      description: body.description ? String(body.description) : undefined,
      type: (body.type as StrategyType) || 'restart',
      parameters: (body.parameters as Record<string, unknown>) || {},
      incidentId: String(body.incidentId || ''),
      decisionId: body.decisionId ? String(body.decisionId) : undefined,
      executor: String(body.executor || 'system'),
    });
    reply.code(201).send({ success: true, data: action });
  });

  // ========== 知识库 ==========

  /**
   * 获取知识库
   * GET /api/v1/selfhealing/knowledge
   */
  fastify.get('/selfhealing/knowledge', async (request, reply) => {
    const query = request.query as { tags?: string; problemPattern?: string };
    const knowledge = await selfhealingService.getKnowledge({
      tags: query.tags ? query.tags.split(',') : undefined,
      problemPattern: query.problemPattern,
    });
    reply.send({ success: true, data: knowledge });
  });

  /**
   * 获取知识详情
   * GET /api/v1/selfhealing/knowledge/:id
   */
  fastify.get('/selfhealing/knowledge/:id', async (request, reply) => {
    // TODO: 实现获取知识详情
    reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Knowledge not found' } });
  });

  /**
   * 更新知识库
   * PUT /api/v1/selfhealing/knowledge/:id
   */
  fastify.put('/selfhealing/knowledge/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const updated = await selfhealingService.updateKnowledge(id, body as Record<string, unknown>);
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Knowledge not found' } });
    }
    reply.send({ success: true, data: updated });
  });
}
