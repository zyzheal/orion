/**
 * Agent Orchestration API Routes (Fastify 版本)
 *
 * Agent Profile 和 Agent Run 相关的 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentProfileService } from './services/agent-profile-service';
import { AgentRunService } from './services/agent-run-service';
import { AgentProfileController } from './api/controllers/AgentProfileController';
import { AgentRunController } from './api/controllers/AgentRunController';
import { EventBusService } from './services/event-bus-service';

export interface AgentRoutesOptions {
  eventBus?: EventBusService;
}

/**
 * 注册 Agent 路由
 */
export default async function registerAgentRoutes(
  app: FastifyInstance,
  options: AgentRoutesOptions
): Promise<void> {
  // 初始化服务
  const agentProfileService = new AgentProfileService();
  const agentRunService = new AgentRunService({
    agentProfileService,
    eventBus: options.eventBus,
  });

  // 初始化控制器
  const agentProfileController = new AgentProfileController(agentProfileService);
  const agentRunController = new AgentRunController(agentRunService);

  // ==================== Agent Profile 路由 ====================

  // POST /api/v1/agents - 创建 Agent Profile
  app.post('/agents', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.create(request, reply)
  );

  // GET /api/v1/agents - Agent Profile 列表
  app.get('/agents', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.list(request, reply)
  );

  // GET /api/v1/agents/:id - Agent Profile 详情
  app.get('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.getById(request, reply)
  );

  // PUT /api/v1/agents/:id - 更新 Agent Profile
  app.put('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.update(request, reply)
  );

  // DELETE /api/v1/agents/:id - 删除 Agent Profile
  app.delete('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.delete(request, reply)
  );

  // PATCH /api/v1/agents/:id/toggle - 启用/禁用 Agent
  app.patch('/agents/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.toggle(request, reply)
  );

  // ==================== Agent Run 路由 ====================

  // POST /api/v1/agent-runs - 手动触发 Agent 运行
  app.post('/agent-runs', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.triggerRun(request, reply)
  );

  // GET /api/v1/agent-runs - Agent 运行列表
  app.get('/agent-runs', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.list(request, reply)
  );

  // GET /api/v1/agent-runs/:id - Agent 运行详情
  app.get('/agent-runs/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.getById(request, reply)
  );

  // POST /api/v1/agent-runs/:id/step - 执行 Agent 步骤
  app.post('/agent-runs/:id/step', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.executeStep(request, reply)
  );

  // POST /api/v1/agent-runs/:id/cancel - 取消运行
  app.post('/agent-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.cancel(request, reply)
  );

  // POST /api/v1/agent-runs/:id/retry - 重试
  app.post('/agent-runs/:id/retry', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.retry(request, reply)
  );

  // GET /api/v1/agent-runs/:id/decisions - 决策日志
  app.get('/agent-runs/:id/decisions', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.getDecisions(request, reply)
  );
}
