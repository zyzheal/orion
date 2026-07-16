/**
 * Webhook Management API Routes
 *
 * Routes under /api/v1/webhooks for managing webhook configurations,
 * triggering webhooks, and viewing delivery logs.
 *
 * Migrated to PostgreSQL Repository pattern (M1).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { WebhookRepository } from '../services/webhook/WebhookRepository';
import { WebhookService } from '../services/webhook/WebhookService';
import { WebhookController } from './controllers/webhook/WebhookController';
import { WebhookSecretRepository } from '../repositories/WebhookSecretRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode, handleError } from '../errors';
import { tenantContextStorage } from '../db/tenant-context-storage';

const logger = createLogger('webhook-routes');

interface WebhookRoutesOptions {
  database?: DatabasePool;
}

export default async function webhookRoutes(
  app: FastifyInstance,
  options: WebhookRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[WebhookRoutes] No database pool provided, webhook routes will not be functional');
    return;
  }

  // Initialize repositories
  const webhookRepo = new WebhookRepository(options.database);

  // Initialize services
  const webhookService = new WebhookService(webhookRepo);

  // Initialize controller
  const controller = new WebhookController(webhookService);

  // ==================== CRUD ====================

  // POST /webhooks - Create webhook
  app.post('/webhooks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /webhooks - List webhooks
  app.get('/webhooks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /webhooks/:id - Get webhook by ID
  app.get('/webhooks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // PUT /webhooks/:id - Update webhook
  app.put('/webhooks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /webhooks/:id - Delete webhook
  app.delete('/webhooks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Trigger & Delivery ====================

  // POST /webhooks/:id/trigger - Manually trigger a webhook
  app.post('/webhooks/:id/trigger', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trigger(request, reply);
  });

  // GET /webhooks/:id/deliveries - Get delivery logs
  app.get('/webhooks/:id/deliveries', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDeliveries(request, reply);
  });

  // POST /webhooks/trigger-event - Trigger matching webhooks for an event
  app.post('/webhooks/trigger-event', {
    onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.triggerEvent(request, reply);
  });

  // ==================== 4.22 Webhook 密钥管理 ====================

  /**
   * 辅助函数：从请求上下文中获取数据库查询接口
   */
  function getWebhookDbQuery() {
    const store = tenantContextStorage.getStore();
    if (!store?.dbClient) {
      throw new OrionError('Database client not available in request context', ErrorCode.OPERATION_FAILED);
    }
    return {
      query: (text: string, params?: unknown[]) => store.dbClient.query(text, params),
    };
  }

  /**
   * 辅助函数：对密钥进行脱敏处理
   */
  function maskWebhookSecret(secret: string): string {
    if (!secret) return '';
    if (secret.length >= 8) {
      return secret.slice(0, 4) + '****' + secret.slice(-4);
    }
    return secret.slice(0, 2) + '****';
  }

  // POST /webhooks/:id/rotate-secret — 轮换 webhook 密钥
  app.post('/webhooks/:id/rotate-secret', { onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: webhookId } = request.params as { id: string };
      const body = request.body as { secret?: string };

      // 如果未提供新密钥，自动生成一个强随机密钥
      const newSecret = body?.secret || `whsec_${Date.now()}_${Math.random().toString(36).substring(2, 18)}`;

      const repo = new WebhookSecretRepository(getWebhookDbQuery());
      const result = await repo.upsertByRepoId(webhookId, newSecret);

      if (!result) {
        return reply.status(500).send({ success: false, error: 'Failed to rotate webhook secret' });
      }

      logger.info({ webhookId }, 'Webhook secret rotated successfully');
      return reply.send({
        success: true,
        data: {
          id: result.id,
          repoId: result.repo_id,
          secret: maskWebhookSecret(result.secret),
          rotatedAt: result.updated_at,
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to rotate webhook secret');
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /webhooks/:id/secret-status — 检查密钥配置状态（不返回实际密钥）
  app.get('/webhooks/:id/secret-status', { onRequest: [authenticateUser, requirePermission({ resource: 'webhook', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id: webhookId } = request.params as { id: string };

      const repo = new WebhookSecretRepository(getWebhookDbQuery());
      const result = await repo.findByRepoId(webhookId);

      return reply.send({
        success: true,
        data: {
          webhookId,
          hasSecret: !!result,
          createdAt: result?.created_at,
          updatedAt: result?.updated_at,
        },
      });
    } catch (e) {
      logger.error({ err: e }, 'Failed to get webhook secret status');
      return handleError(reply, e instanceof Error ? new OrionError(e.message, ErrorCode.INTERNAL_ERROR) : new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
