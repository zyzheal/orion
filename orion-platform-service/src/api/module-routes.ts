import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';

interface ModuleRoutesOptions {
  moduleManager: ModuleManager;
}

interface ToggleModuleBody {
  enabled: boolean;
}

export default async function moduleRoutes(
  app: FastifyInstance,
  options: ModuleRoutesOptions
): Promise<void> {
  const { moduleManager } = options;

  // GET /v1/system/modules - 获取所有模块状态
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'module', action: 'read' })],
  }, async (_request, reply) => {
    const status = moduleManager.getModuleStatus();
    return reply.send(status);
  });

  // GET /v1/system/modules/:id - 获取单个模块状态
  app.get<{ Params: { id: string } }>('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'module', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request, reply) => {
    const mod = moduleManager.getRegistry().get(request.params.id);
    if (!mod) {
      return reply.status(404).send({ error: 'MODULE_NOT_FOUND', id: request.params.id });
    }
    return reply.send({ module: mod });
  });

  // PUT /v1/system/modules/:id/toggle - 启用/禁用模块
  app.put<{ Params: { id: string }; Body: ToggleModuleBody }>('/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'module', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id, requiredImpact: 'high' })],
  }, async (request, reply) => {
    const { id } = request.params;
    const { enabled } = request.body;

    const mod = moduleManager.getRegistry().get(id);
    if (!mod) {
      return reply.status(404).send({ error: 'MODULE_NOT_FOUND', id });
    }

    try {
      await moduleManager.toggleModule(id, enabled);
    } catch (error: any) {
      if (error.message.includes('cannot be disabled')) {
        return reply.status(400).send({
          error: 'CORE_MODULE_CANNOT_BE_DISABLED',
          message: error.message,
        });
      }
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: 'MODULE_NOT_FOUND', id });
      }
      return reply.status(500).send({
        error: 'MODULE_TOGGLE_FAILED',
        message: error.message,
      });
    }
    return reply.send({ module: moduleManager.getRegistry().get(id) });
  });

  // GET /v1/system/modules/validate - 校验依赖
  app.get('/validate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'module', action: 'read' })],
  }, async (_request, reply) => {
    const validation = moduleManager.getRegistry().validateDependencies();
    return reply.send({ validation });
  });

  // GET /v1/system/modules/startup-order - 获取启动顺序
  app.get('/startup-order', {
    onRequest: [authenticateUser, requirePermission({ resource: 'module', action: 'read' })],
  }, async (_request, reply) => {
    const order = moduleManager.getRegistry().getStartupOrder();
    return reply.send({ order });
  });
}
