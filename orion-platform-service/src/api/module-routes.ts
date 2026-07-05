import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ModuleManager } from '../services/module-lifecycle/ModuleManager';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

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
      return handleError(reply, new NotFoundError('MODULE_NOT_FOUND'));
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
      return handleError(reply, new NotFoundError('MODULE_NOT_FOUND'));
    }

    try {
      await moduleManager.toggleModule(id, enabled);
    } catch (error: any) {
      if (error.message.includes('cannot be disabled')) {
        return handleError(reply, new ValidationError('CORE_MODULE_CANNOT_BE_DISABLED'))
      }
      if (error.message.includes('not found')) {
        return handleError(reply, new NotFoundError('MODULE_NOT_FOUND'));
      }
      return handleError(reply, new OrionError('MODULE_TOGGLE_FAILED', ErrorCode.INTERNAL_ERROR))
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
