/**
 * Ephemeral Development Environments API Routes (Fastify 版本)
 *
 * 临时开发环境相关的 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { K8sProvisionerService } from './services/k8s-provisioner-service';
import { EphemeralEnvService } from './services/ephemeral-env-service';
import { EphemeralEnvController } from './api/controllers/EphemeralEnvController';
import { EventBusService } from './services/event-bus-service';

export interface EphemeralEnvRoutesOptions {
  eventBus?: EventBusService;
  database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

/**
 * 注册 Ephemeral Environment 路由
 */
export default async function registerEphemeralEnvRoutes(
  app: FastifyInstance,
  options: EphemeralEnvRoutesOptions
): Promise<void> {
  // 初始化服务
  const k8sProvisioner = new K8sProvisionerService(options?.database || { query: async () => { throw new Error('Database not configured'); } });
  const ephemeralEnvService = new EphemeralEnvService({
    k8sProvisioner,
    eventBus: options.eventBus,
  });

  // 初始化控制器
  const controller = new EphemeralEnvController(ephemeralEnvService);

  // ==================== Ephemeral Environment 路由 ====================

  // POST /api/v1/ephemeral-envs - 创建环境
  app.post('/ephemeral-envs', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.create(request, reply)
  );

  // GET /api/v1/ephemeral-envs - 环境列表
  app.get('/ephemeral-envs', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.list(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id - 环境详情
  app.get('/ephemeral-envs/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getById(request, reply)
  );

  // POST /api/v1/ephemeral-envs/:id/wake - 唤醒空闲环境
  app.post('/ephemeral-envs/:id/wake', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.wake(request, reply)
  );

  // POST /api/v1/ephemeral-envs/:id/teardown - 销毁环境
  app.post('/ephemeral-envs/:id/teardown', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.teardown(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id/preview - 获取 Preview URL
  app.get('/ephemeral-envs/:id/preview', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getPreviewUrl(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id/status - 健康检查
  app.get('/ephemeral-envs/:id/status', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.checkHealth(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id/cost - 获取成本
  app.get('/ephemeral-envs/:id/cost', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getCost(request, reply)
  );
}
