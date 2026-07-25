import type { FastifyRequest, FastifyReply } from 'fastify';
import { WebhookService, WebhookServiceError } from '../services/WebhookService';

export class WebhookController {
  private service: WebhookService;

  constructor(service: WebhookService) {
    this.service = service;
  }

  /** POST /webhooks - Create webhook */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenant_id || body.tenantId) as string;
      const name = body.name as string;
      const url = body.url as string;
      const events = (body.events as string[]) || [];
      const secret = body.secret as string | undefined;

      if (!tenantId || !name || !url) {
        await reply.status(400).send({ success: false, error: 'tenant_id, name, and url are required' });
        return;
      }

      const webhook = await this.service.create(tenantId, name, url, events, secret);
      await reply.status(201).send({ success: true, data: webhook });
    } catch (err) {
      if (err instanceof WebhookServiceError) {
        const statusCode = err.code === 'NOT_FOUND' ? 404 : 400;
        await reply.status(statusCode).send({ success: false, error: err.message, code: err.code });
        return;
      }
      await reply.status(500).send({ success: false, error: 'Failed to create webhook' });
    }
  }

  /** GET /webhooks - List webhooks */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const tenantId = query.tenant_id || query.tenantId;
      if (!tenantId) {
        await reply.status(400).send({ success: false, error: 'tenant_id query parameter is required' });
        return;
      }

      const webhooks = await this.service.list(tenantId);
      await reply.send({ success: true, data: webhooks, total: webhooks.length });
    } catch (err) {
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  /** GET /webhooks/:id - Get webhook by ID */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const webhook = await this.service.get(params.id);
      await reply.send({ success: true, data: webhook });
    } catch (err) {
      if (err instanceof WebhookServiceError && err.code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  /** PUT /webhooks/:id - Update webhook */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const input: { name?: string; url?: string; events?: string[]; enabled?: boolean } = {};
      if (body.name !== undefined) input.name = body.name as string;
      if (body.url !== undefined) input.url = body.url as string;
      if (body.events !== undefined) input.events = body.events as string[];
      if (body.enabled !== undefined) input.enabled = body.enabled as boolean;

      const webhook = await this.service.update(params.id, input);
      await reply.send({ success: true, data: webhook });
    } catch (err) {
      if (err instanceof WebhookServiceError && err.code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(400).send({ success: false, error: err instanceof Error ? err.message : 'Failed to update webhook' });
    }
  }

  /** DELETE /webhooks/:id - Delete webhook */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const deleted = await this.service.delete(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Webhook not found' });
        return;
      }
      await reply.send({ success: true, message: 'Webhook deleted' });
    } catch (err) {
      if (err instanceof WebhookServiceError && err.code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  /** POST /webhooks/:id/trigger - Manually trigger webhook */
  async trigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const event = (body.event || body.eventType) as string;
      const payload = (body.payload || body.data || {}) as Record<string, any>;

      if (!event) {
        await reply.status(400).send({ success: false, error: 'event is required' });
        return;
      }

      const delivery = await this.service.trigger(params.id, event, payload);
      await reply.send({ success: true, data: delivery });
    } catch (err) {
      if (err instanceof WebhookServiceError) {
        const statusCode = err.code === 'NOT_FOUND' ? 404 : (err.code === 'DISABLED' ? 400 : 500);
        await reply.status(statusCode).send({ success: false, error: err.message, code: err.code });
        return;
      }
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Failed to trigger webhook' });
    }
  }

  /** GET /webhooks/:id/deliveries - Get delivery logs */
  async getDeliveries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;

      await this.service.get(params.id);
      const deliveries = await this.service.getDeliveries(params.id, limit);
      await reply.send({ success: true, data: deliveries, total: deliveries.length });
    } catch (err) {
      if (err instanceof WebhookServiceError && err.code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  /** POST /webhooks/trigger-event - Trigger matching webhooks for an event */
  async triggerEvent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenant_id || body.tenantId) as string;
      const event = (body.event || body.eventType) as string;
      const payload = (body.payload || body.data || {}) as Record<string, any>;

      if (!tenantId || !event) {
        await reply.status(400).send({ success: false, error: 'tenant_id and event are required' });
        return;
      }

      const count = await this.service.triggerEvent(tenantId, event, payload);
      await reply.send({ success: true, data: { triggered: count } });
    } catch (err) {
      await reply.status(500).send({ success: false, error: err instanceof Error ? err.message : 'Failed to trigger event' });
    }
  }
}
