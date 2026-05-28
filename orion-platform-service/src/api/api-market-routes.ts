/**
 * API Marketplace Management Routes
 *
 * Routes under /api/v1/market for managing API products, developer apps,
 * API keys, and subscriptions.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ApiMarketRepository } from '../services/api-market/ApiMarketRepository';
import { ApiMarketService } from '../services/api-market/ApiMarketService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'api-market-routes' });

type AuthenticatedRequest = FastifyRequest & {
  user: { id: string; [key: string]: unknown };
}

interface ApiMarketRoutesOptions {
  database?: DatabasePool;
}

export default async function apiMarketRoutes(
  app: FastifyInstance,
  options: ApiMarketRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[ApiMarketRoutes] No database pool provided, api-market routes will not be functional');
    return;
  }

  // Initialize repository and service
  const repository = new ApiMarketRepository(options.database);
  const service = new ApiMarketService(repository);

  // ==================== Products ====================

  // POST /market/products - Create product
  app.post('/market/products', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, description, version } = request.body as { name: string; description?: string; version?: string };
      const user = (request as any).user;

      const product = await service.createProduct({
        name,
        description,
        ownerId: user?.id,
        version,
      });

      return reply.code(201).send(product);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /market/products - List products
  app.get('/market/products', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const products = await service.listProducts();
    return reply.send(products);
  });

  // GET /market/products/:id - Get product
  app.get('/market/products/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const product = await service.getProduct(id);
    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    return reply.send(product);
  });

  // POST /market/products/:id/publish - Publish product
  app.post('/market/products/:id/publish', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await service.publishProduct(id);
      return reply.send(product);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // DELETE /market/products/:id - Delete product
  app.delete('/market/products/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.deleteProduct(id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    return reply.code(204).send();
  });

  // ==================== Developer Apps ====================

  // POST /market/apps - Create app
  app.post('/market/apps', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, description, redirectUris } = request.body as { name: string; description?: string; redirectUris?: string[] };
      const user = (request as any).user;

      const app = await service.createDeveloperApp({
        developerId: user?.id,
        name,
        description,
        redirectUris,
      });

      return reply.code(201).send(app);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /market/apps - List my apps
  app.get('/market/apps', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const apps = await service.listAppsByDeveloper(user?.id);
    return reply.send(apps);
  });

  // GET /market/apps/:id - Get app
  app.get('/market/apps/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const app = await service.getApp(id);
    if (!app) {
      return reply.code(404).send({ error: 'App not found' });
    }
    return reply.send(app);
  });

  // ==================== API Keys ====================

  // POST /market/apps/:appId/keys - Generate API key
  app.post('/market/apps/:appId/keys', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { appId } = request.params as { appId: string };
      const { scopes } = request.body as { scopes?: string[] };
      const result = await service.generateApiKey(appId, scopes);
      return reply.code(201).send(result);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /market/apps/:appId/keys - List API keys
  app.get('/market/apps/:appId/keys', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { appId } = request.params as { appId: string };
    const keys = await service.listApiKeys(appId);
    // Don't expose client secrets
    const safeKeys = keys.map(k => ({
      id: k.id,
      clientId: k.client_id,
      scopes: k.scopes,
      rateLimitPerMin: k.rate_limit_per_min,
      expiresAt: k.expires_at,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
    }));
    return reply.send(safeKeys);
  });

  // ==================== Auth ====================

  // POST /market/auth/token - Validate API key (public endpoint, rate limited)
  app.post('/market/auth/token', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => {
          return (request.ip || '127.0.0.1');
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { clientId, clientSecret } = request.body as { clientId: string; clientSecret: string };

      if (!clientId || !clientSecret) {
        return reply.code(400).send({ error: 'clientId and clientSecret required' });
      }

      const result = await service.validateApiKey(clientId, clientSecret);
      if (!result) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      return reply.send({
        valid: true,
        credentialId: result.credentialId,
        appId: result.appId,
        scopes: result.scopes,
        rateLimitPerMin: result.rateLimitPerMin,
      });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ==================== Subscriptions ====================

  // GET /market/subscriptions/check - Check if app has access to product
  app.get('/market/subscriptions/check', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { appId, productId } = request.query as { appId: string; productId: string };

    if (!appId || !productId) {
      return reply.code(400).send({ error: 'appId and productId are required' });
    }

    const hasAccess = await service.checkSubscription(appId, productId);
    return reply.send({ appId, productId, hasAccess });
  });

  // POST /market/subscriptions - Subscribe to product
  app.post('/market/subscriptions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { appId, productId, plan, quotaPerDay } = request.body as { appId: string; productId: string; plan: string; quotaPerDay?: number };
      await service.subscribe(appId, productId, plan, quotaPerDay);
      return reply.code(201).send({ message: 'Subscribed successfully' });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /market/subscriptions/:appId - List subscriptions (only for app owner)
  app.get('/market/subscriptions/:appId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { appId } = request.params as { appId: string };
    const user = (request as any).user;

    // Verify user owns this app before showing subscriptions
    const app = await service.getApp(appId);
    if (!app) {
      return reply.code(404).send({ error: 'App not found' });
    }
    if (app.developer_id && user?.id && app.developer_id !== user.id) {
      return reply.code(403).send({ error: 'Not authorized to view subscriptions for this app' });
    }

    const subscriptions = await service.listSubscriptions(appId);
    return reply.send(subscriptions);
  });
}