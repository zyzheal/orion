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

interface WebhookRoutesOptions {
  database?: DatabasePool;
}

export default async function webhookRoutes(
  app: FastifyInstance,
  options: WebhookRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[WebhookRoutes] No database pool provided, webhook routes will not be functional');
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
  app.post('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // GET /webhooks - List webhooks
  app.get('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /webhooks/:id - Get webhook by ID
  app.get('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // PUT /webhooks/:id - Update webhook
  app.put('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /webhooks/:id - Delete webhook
  app.delete('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Trigger & Delivery ====================

  // POST /webhooks/:id/trigger - Manually trigger a webhook
  app.post('/webhooks/:id/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trigger(request, reply);
  });

  // GET /webhooks/:id/deliveries - Get delivery logs
  app.get('/webhooks/:id/deliveries', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDeliveries(request, reply);
  });

  // POST /webhooks/trigger-event - Trigger matching webhooks for an event
  app.post('/webhooks/trigger-event', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.triggerEvent(request, reply);
  });
}
