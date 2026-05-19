/**
 * AI Agent API 路由注册
 *
 * 提供 Agent 管理、执行、审计日志等 API
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { BaseAgent } from '../services/ai-agents/base/BaseAgent';
import pino from 'pino';

const logger = pino({ name: 'ai-agent-routes' });

/**
 * Agent 注册表（全局单例）
 * 实际生产中应由 AgentRegistry 管理
 */
const agentRegistry = new Map<string, BaseAgent>();

/**
 * 注册 Agent 实例
 */
export function registerAgent(id: string, agent: BaseAgent): void {
  agentRegistry.set(id, agent);
  logger.info({ agentId: id }, 'Agent registered');
}

/**
 * 注册所有 AI Agent 路由
 */
export function registerAIAgentRoutes(app: FastifyInstance): void {
  const prefix = '/api/v1/ai-agents';

  // 获取所有 Agent 列表
  app.get(`${prefix}/list`, async (request, reply) => {
    const agents = Array.from(agentRegistry.entries()).map(([id, agent]) => ({
      id,
      config: agent.getConfig(),
      status: (agent as any).status,
    }));

    return { success: true, data: agents };
  });

  // 获取单个 Agent 详情
  app.get(`${prefix}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentRegistry.get(id);
    if (!agent) {
      return reply.code(404).send({ success: false, error: 'Agent not found' });
    }

    return {
      success: true,
      data: {
        id,
        config: agent.getConfig(),
        status: (agent as any).status,
      },
    };
  });

  // 获取 Agent 审计日志
  app.get(`${prefix}/:id/audit-logs`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentRegistry.get(id);
    if (!agent) {
      return reply.code(404).send({ success: false, error: 'Agent not found' });
    }

    const limit = parseInt((request.query as any)?.limit || '100', 10);
    const logs = agent.getAuditLog(limit);

    return { success: true, data: logs };
  });

  // 执行 Agent
  app.post(`${prefix}/:id/execute`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = agentRegistry.get(id);
    if (!agent) {
      return reply.code(404).send({ success: false, error: 'Agent not found' });
    }

    const input = request.body as Record<string, any>;
    try {
      const result = await agent.execute(input);
      return { success: true, data: result };
    } catch (error) {
      logger.error({ agentId: id, error }, 'Agent execution failed');
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('AI Agent routes registered');
}
