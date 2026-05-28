/**
 * Secret API 路由
 *
 * 路径约定：/v1/tenants/:tenantId/secrets
 * POST   /v1/tenants/:tenantId/secrets          - 创建 secret
 * GET    /v1/tenants/:tenantId/secrets          - 列出 secret（值被遮蔽）
 * GET    /v1/tenants/:tenantId/secrets/:id      - 获取 secret 详情
 * PUT    /v1/tenants/:tenantId/secrets/:id      - 更新 secret
 * DELETE /v1/tenants/:tenantId/secrets/:id      - 删除 secret
 * POST   /v1/tenants/:tenantId/secrets/resolve  - 解析 secret 引用
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { SecretsController } from './controllers/SecretsController';
import { SecretsService } from '../services/pipeline/SecretsService';
import { SecretRepository } from '../repositories/SecretRepository';
import pino from 'pino';

const logger = pino({ name: 'secret-routes' });

// Global secrets service instance shared across the application
let globalSecretsService: SecretsService | null = null;

export interface SecretRouteDeps {
  database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  masterKey?: string;
}

export async function registerSecretRoutes(app: FastifyInstance, deps: SecretRouteDeps): Promise<void> {
  if (!deps.database) {
    logger.warn('[SecretRoutes] Database not available, secret routes will not be registered');
    return;
  }

  const repository = new SecretRepository(deps.database);
  const config = deps.masterKey ? { encryptionKey: deps.masterKey } : undefined;
  const secretsService = new SecretsService(repository, config);
  globalSecretsService = secretsService;

  const controller = new SecretsController(secretsService);

  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // POST /v1/tenants/:tenantId/secrets - 创建 secret
    instance.post('/v1/tenants/:tenantId/secrets', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'write' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.create(request, reply);
    });

    // GET /v1/tenants/:tenantId/secrets - 列出 secret
    instance.get('/v1/tenants/:tenantId/secrets', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.list(request, reply);
    });

    // GET /v1/tenants/:tenantId/secrets/resolve - 解析 secret 引用
    instance.post('/v1/tenants/:tenantId/secrets/resolve', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.resolve(request, reply);
    });

    // GET /v1/tenants/:tenantId/secrets/:id - 获取 secret 详情
    instance.get('/v1/tenants/:tenantId/secrets/:id', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getById(request, reply);
    });

    // PUT /v1/tenants/:tenantId/secrets/:id - 更新 secret
    instance.put('/v1/tenants/:tenantId/secrets/:id', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.update(request, reply);
    });

    // DELETE /v1/tenants/:tenantId/secrets/:id - 删除 secret
    instance.delete('/v1/tenants/:tenantId/secrets/:id', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'delete', extractResourceId: (req) => (req.params as { id: string }).id, requiredImpact: 'high' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.delete(request, reply);
    });

    // GET /v1/tenants/:tenantId/secrets/:id/references - 查看 Secret 引用
    instance.get('/v1/tenants/:tenantId/secrets/:id/references', {
      onRequest: [authenticateUser, requirePermission({ resource: 'secret', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getReferences(request, reply);
    });
  });
}

/**
 * Wire SecretsService into a PipelineEngine instance.
 * Call this after registerSecretRoutes to enable secret resolution in pipeline execution.
 */
export function wireSecretsToPipeline(engine: any): void {
  if (globalSecretsService && engine && typeof engine.initializeSecrets === 'function') {
    // PipelineEngine will use globalSecretsService for ${secrets.XXX} resolution
  }
}
export function getGlobalSecretsService(): SecretsService | null {
  return globalSecretsService;
}

export { SecretsService, SecretsController };
