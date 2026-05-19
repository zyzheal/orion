/**
 * Hook Chain API Routes
 *
 * 提供 Hook 链编排和管理的 API
 * Prefix: /api/v1/hook-chains
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HookChainService, HookChainDefinition } from '../services/hook-chain';
import { EventEmitter } from 'events';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

const eventBus = new EventEmitter();
const hookChainService = new HookChainService({ eventBus });

/**
 * 注册 Hook Chain API 路由
 */
export default async function registerHookChainRoutes(app: FastifyInstance): Promise<void> {
  // 事件广播到 Fastify
  hookChainService.on('chain:created', (event) => app.emit('hookchain:created', event));
  hookChainService.on('chain:started', (event) => app.emit('hookchain:started', event));
  hookChainService.on('chain:completed', (event) => app.emit('hookchain:completed', event));
  hookChainService.on('chain:failed', (event) => app.emit('hookchain:failed', event));

  // ==================== Chain Management ====================

  // POST /api/v1/hook-chains - 创建 Hook 链
  app.post('/hook-chains', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'write' })],
  }, async (request: FastifyRequest<{ Body: HookChainDefinition }>, reply: FastifyReply) => {
    try {
      const definition = request.body;
      const created = hookChainService.createChain(definition);
      return reply.status(201).send(created);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Invalid chain definition',
      });
    }
  });

  // GET /api/v1/hook-chains - 列出所有 Hook 链
  app.get('/hook-chains', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const chains = hookChainService.listChains();
    return reply.send({
      data: chains,
      total: chains.length,
    });
  });

  // GET /api/v1/hook-chains/:chainId - 获取 Hook 链详情
  app.get('/hook-chains/:chainId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: { chainId: string } }>, reply: FastifyReply) => {
    const { chainId } = request.params;
    const chain = hookChainService.getChain(chainId);

    if (!chain) {
      return reply.status(404).send({ error: `Hook chain "${chainId}" not found` });
    }

    return reply.send(chain);
  });

  // PUT /api/v1/hook-chains/:chainId - 更新 Hook 链
  app.put('/hook-chains/:chainId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'write' })],
  }, async (request: FastifyRequest<{ Params: { chainId: string }; Body: Partial<HookChainDefinition> }>, reply: FastifyReply) => {
    const { chainId } = request.params;
    const updates = request.body;

    const updated = hookChainService.updateChain(chainId, updates);

    if (!updated) {
      return reply.status(404).send({ error: `Hook chain "${chainId}" not found` });
    }

    return reply.send(updated);
  });

  // DELETE /api/v1/hook-chains/:chainId - 删除 Hook 链
  app.delete('/hook-chains/:chainId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'write' })],
  }, async (request: FastifyRequest<{ Params: { chainId: string } }>, reply: FastifyReply) => {
    const { chainId } = request.params;
    const deleted = hookChainService.deleteChain(chainId);

    if (!deleted) {
      return reply.status(404).send({ error: `Hook chain "${chainId}" not found` });
    }

    return reply.status(204).send();
  });

  // ==================== Chain Execution ====================

  // POST /api/v1/hook-chains/:chainId/execute - 执行 Hook 链
  app.post('/hook-chains/:chainId/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'write' })],
  }, async (request: FastifyRequest<{
    Params: { chainId: string };
    Body: {
      triggerSource: string;
      triggerPayload: Record<string, any>;
      tenantId: string;
    };
  }>, reply: FastifyReply) => {
    const { chainId } = request.params;
    const { triggerSource, triggerPayload, tenantId } = request.body;

    try {
      const result = await hookChainService.executeChain(chainId, triggerSource, triggerPayload, tenantId);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Chain execution failed',
        chainId,
      });
    }
  });

  // GET /api/v1/hook-chains/:chainId/history - 获取执行历史
  app.get('/hook-chains/:chainId/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'read' })],
  }, async (request: FastifyRequest<{ Params: { chainId: string } }>, reply: FastifyReply) => {
    const { chainId } = request.params;
    const history = hookChainService.getExecutionHistory(chainId);

    return reply.send({
      chainId,
      history,
      total: history.length,
    });
  });

  // GET /api/v1/hook-chains/executions/pending - 获取正在执行的链
  app.get('/hook-chains/executions/pending', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const pending = hookChainService.getPendingExecutions();
    return reply.send({
      pending,
      total: pending.length,
    });
  });

  // ==================== SSE Events ====================

  // GET /api/v1/hook-chains/events - SSE 实时事件推送
  app.get('/hook-chains/events', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    reply.raw.write('event: connected\ndata: {"message":"Hook chain events connected"}\n\n');

    const eventHandler = (event: any) => {
      reply.raw.write(`event: ${event.type || 'update'}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    app.on('hookchain:created', eventHandler);
    app.on('hookchain:started', eventHandler);
    app.on('hookchain:completed', eventHandler);
    app.on('hookchain:failed', eventHandler);

    request.raw.on('close', () => {
      app.removeListener('hookchain:created', eventHandler);
      app.removeListener('hookchain:started', eventHandler);
      app.removeListener('hookchain:completed', eventHandler);
      app.removeListener('hookchain:failed', eventHandler);
    });

    return reply;
  });

  // ==================== Custom Executor ====================

  // POST /api/v1/hook-chains/executors - 注册自定义执行器
  app.post('/hook-chains/executors', {
    onRequest: [authenticateUser, requirePermission({ resource: 'hook', action: 'write' })],
  }, async (request: FastifyRequest<{ Body: { type: string; handler: string } }>, reply: FastifyReply) => {
    const { type, handler } = request.body;

    // 注意：这里只是示例，实际需要安全的执行器注册机制
    reply.status(501).send({
      error: 'Custom executor registration requires secure implementation',
      type,
    });
  });
}