/**
 * Orion Self-Healing Service - Routes
 * 自愈路由
 *
 * Uses dependency injection for SelfHealingService.
 * Error response format: { success: boolean; data?: any; error?: any }
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply, type FastifyPluginOptions } from 'fastify';
import { SelfHealingService } from '../services/SelfHealingService';
import { IncidentSeverity, IncidentStatus, type HealingStrategy, StrategyType } from '../types/selfhealing';

export interface SelfHealingRoutesOptions {
  selfHealingService?: SelfHealingService;
}

export async function selfhealingRoutes(
  fastify: FastifyInstance,
  options: SelfHealingRoutesOptions = {}
): Promise<void> {
  // Dependency injection: use provided service or create new instance
  const selfhealingService = options.selfHealingService ?? new SelfHealingService();

  // Type definitions for request bodies
  interface CreateIncidentRequest {
    title: string;
    description: string;
    severity?: IncidentSeverity;
    alertId?: string;
    affectedResources?: string[];
    triggerSource: string;
    tenantId?: string;
  }

  interface ListIncidentsQuery {
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    tenantId?: string;
  }

  interface EvaluateStrategyRequest {
    incidentId: string;
    title?: string;
    description?: string;
    severity?: IncidentSeverity;
    affectedResources?: string[];
    triggerSource?: string;
    tenantId?: string;
  }

  interface MakeDecisionRequest {
    incidentId: string;
    strategies: HealingStrategy[];
  }

  interface ExecuteActionRequest {
    name: string;
    description?: string;
    type?: StrategyType;
    parameters?: Record<string, unknown>;
    incidentId: string;
    decisionId?: string;
    executor?: string;
  }

  interface KnowledgeQuery {
    tags?: string;
    problemPattern?: string;
  }

  interface UpdateKnowledgeRequest {
    title?: string;
    description?: string;
    problemPattern?: string;
    solution?: string;
    relatedStrategyTypes?: StrategyType[];
    tags?: string[];
    usageCount?: number;
    successRate?: number;
  }

  // ========== 事件管理 ==========

  /**
   * 创建自愈事件
   * POST /api/v1/selfhealing/incidents
   */
  fastify.post<{ Body: CreateIncidentRequest }>('/selfhealing/incidents', async (request: FastifyRequest<{ Body: CreateIncidentRequest }>, reply) => {
    const { title, description, severity, alertId, affectedResources, triggerSource, tenantId } = request.body;
    const incident = await selfhealingService.createIncident({
      title: title || '',
      description: description || '',
      severity: severity || IncidentSeverity.MEDIUM,
      alertId,
      affectedResources: affectedResources || [],
      triggerSource: triggerSource || '',
      triggeredAt: new Date(),
      tenantId: tenantId || '',
      actionIds: [],
    });
    return reply.code(201).send({ success: true, data: incident });
  });

  /**
   * 列表自愈事件
   * GET /api/v1/selfhealing/incidents
   */
  fastify.get<{ Querystring: ListIncidentsQuery }>('/selfhealing/incidents', async (request: FastifyRequest<{ Querystring: ListIncidentsQuery }>, reply) => {
    const { severity, status, tenantId } = request.query;
    const result = await selfhealingService.listIncidents({ severity, status, tenantId });
    return reply.send({ success: true, data: result });
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
    return reply.send({ success: true, data: incident });
  });

  /**
   * 更新事件
   * PUT /api/v1/selfhealing/incidents/:id
   */
  fastify.put('/selfhealing/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const updated = await selfhealingService.updateIncident(id, body as Partial<any>);
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Incident not found' } });
    }
    return reply.send({ success: true, data: updated });
  });

  // ========== 策略评估 ==========

  /**
   * 评估策略
   * POST /api/v1/selfhealing/strategy/evaluate
   */
  fastify.post<{ Body: EvaluateStrategyRequest }>('/selfhealing/strategy/evaluate', async (request: FastifyRequest<{ Body: EvaluateStrategyRequest }>, reply) => {
    const { incidentId, title, description, severity, affectedResources, triggerSource, tenantId } = request.body;
    const incident = {
      id: incidentId || '',
      title: title || '',
      description: description || '',
      severity: severity || IncidentSeverity.MEDIUM,
      status: IncidentStatus.EVALUATING,
      affectedResources: affectedResources || [],
      triggerSource: triggerSource || '',
      triggeredAt: new Date(),
      tenantId: tenantId || '',
      actionIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const strategies = await selfhealingService.evaluateStrategy(incident);
    return reply.send({ success: true, data: strategies });
  });

  // ========== 修复决策 ==========

  /**
   * 做出修复决策
   * POST /api/v1/selfhealing/decision
   */
  fastify.post<{ Body: MakeDecisionRequest }>('/selfhealing/decision', async (request: FastifyRequest<{ Body: MakeDecisionRequest }>, reply) => {
    const { incidentId, strategies } = request.body;
    const decision = await selfhealingService.makeDecision(incidentId, strategies || []);
    if (!decision) {
      return reply.code(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'No suitable strategy found' } });
    }
    return reply.code(201).send({ success: true, data: decision });
  });

  // ========== 修复动作 ==========

  /**
   * 执行修复动作
   * POST /api/v1/selfhealing/actions/execute
   */
  fastify.post<{ Body: ExecuteActionRequest }>('/selfhealing/actions/execute', async (request: FastifyRequest<{ Body: ExecuteActionRequest }>, reply) => {
    const { name, description, type, parameters, incidentId, decisionId, executor } = request.body;
    const action = await selfhealingService.executeAction({
      name: name || '',
      description,
      type: type || StrategyType.RESTART,
      parameters: parameters || {},
      incidentId: incidentId || '',
      decisionId,
      executor: executor || 'system',
    });
    return reply.code(201).send({ success: true, data: action });
  });

  // ========== 知识库 ==========

  /**
   * 获取知识库
   * GET /api/v1/selfhealing/knowledge
   */
  fastify.get<{ Querystring: KnowledgeQuery }>('/selfhealing/knowledge', async (request: FastifyRequest<{ Querystring: KnowledgeQuery }>, reply) => {
    const { tags, problemPattern } = request.query;
    const knowledge = await selfhealingService.getKnowledge({
      tags: tags ? tags.split(',') : undefined,
      problemPattern,
    });
    return reply.send({ success: true, data: knowledge });
  });

  /**
   * 获取知识详情
   * GET /api/v1/selfhealing/knowledge/:id
   */
  fastify.get('/selfhealing/knowledge/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Search by ID through getKnowledge with problemPattern filter
    const knowledge = await selfhealingService.getKnowledge({});
    const entry = knowledge.find(k => k.id === id);
    if (!entry) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Knowledge not found' } });
    }
    return reply.send({ success: true, data: entry });
  });

  /**
   * 更新知识库
   * PUT /api/v1/selfhealing/knowledge/:id
   */
  fastify.put<{ Params: { id: string }; Body: UpdateKnowledgeRequest }>('/selfhealing/knowledge/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateKnowledgeRequest }>, reply) => {
    const { id } = request.params;
    const { title, description, problemPattern, solution, relatedStrategyTypes, tags, usageCount, successRate } = request.body;
    const updated = await selfhealingService.updateKnowledge(id, {
      title, description, problemPattern, solution, relatedStrategyTypes, tags, usageCount, successRate,
    });
    if (!updated) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Knowledge not found' } });
    }
    return reply.send({ success: true, data: updated });
  });
}
