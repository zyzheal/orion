import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../utils/database';
import { WebhookService } from '../services/WebhookService';
import { WebhookRepository } from '../services/WebhookRepository';
import { WebhookController } from '../controllers/WebhookController';

export async function webhookRoutes(app: FastifyInstance) {
  const pool = getPool();
  const repo = new WebhookRepository(pool);
  const service = new WebhookService(repo);
  const controller = new WebhookController(service);

  app.post('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => controller.create(request, reply));
  app.get('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => controller.list(request, reply));
  app.get('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.getById(request, reply));
  app.put('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.update(request, reply));
  app.delete('/webhooks/:id', async (request: FastifyRequest, reply: FastifyReply) => controller.delete(request, reply));
  app.post('/webhooks/:id/trigger', async (request: FastifyRequest, reply: FastifyReply) => controller.trigger(request, reply));
  app.get('/webhooks/:id/deliveries', async (request: FastifyRequest, reply: FastifyReply) => controller.getDeliveries(request, reply));
  app.post('/webhooks/trigger-event', async (request: FastifyRequest, reply: FastifyReply) => controller.triggerEvent(request, reply));
}
