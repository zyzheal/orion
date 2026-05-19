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

interface ApiMarketRoutesOptions {
  database?: DatabasePool;
}

export default async function apiMarketRoutes(
  app: FastifyInstance,
  options: ApiMarketRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[ApiMarketRoutes] No database pool provided, api-market routes will not be functional');
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
      const user = (request as any).user;
      const { name, description, version } = request.body as any;

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
    const id = (request.params as any).id;
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
      const id = (request.params as any).id;
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
    const id = (request.params as any).id;
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
      const user = (request as any).user;
      const { name, description, redirectUris } = request.body as any;

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
    const id = (request.params as any).id;
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
      const appId = (request.params as any).appId;
      const { scopes } = request.body as any;
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
    const appId = (request.params as any).appId;
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

  // POST /market/auth/token - Validate API key (public endpoint)
  app.post('/market/auth/token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { clientId, clientSecret } = request.body as any;

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

  // POST /market/subscriptions - Subscribe to product
  app.post('/market/subscriptions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api-market', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { appId, productId, plan, quotaPerDay } = request.body as any;
      await service.subscribe(appId, productId, plan, quotaPerDay);
      return reply.code(201).send({ message: 'Subscribed successfully' });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /market/subscriptions/:appId - List subscriptions
  app.get('/market/subscriptions/:appId', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // In a real implementation, we'd have a method to list subscriptions
    return reply.send([]);
  });
}