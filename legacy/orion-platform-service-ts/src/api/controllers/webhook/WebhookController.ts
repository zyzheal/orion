/**
 * Webhook Controller - CRUD and delivery handlers for Webhook management
 *
 * POST   /api/v1/webhooks              - Create webhook
 * GET    /api/v1/webhooks              - List webhooks (tenant-scoped)
 * GET    /api/v1/webhooks/:id          - Get webhook by ID
 * PUT    /api/v1/webhooks/:id          - Update webhook
 * DELETE /api/v1/webhooks/:id          - Delete webhook
 * POST   /api/v1/webhooks/:id/trigger  - Manually trigger webhook
 * GET    /api/v1/webhooks/:id/deliveries - Get delivery logs
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { WebhookService } from '../../../services/webhook';

export class WebhookController {
  private service: WebhookService;

  constructor(service: WebhookService) {
    this.service = service;
  }

  // ==================== CRUD ====================

  /** POST /webhooks - Create a new webhook */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenantId || body.tenant_id) as string;
      const name = body.name as string;
      const url = body.url as string;
      const events = (body.events as string[]) || [];
      const secret = body.secret as string | undefined;

      if (!tenantId || !name || !url) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId, name, and url are required',
        });
        return;
      }

      const webhook = await this.service.create(tenantId, name, url, events, secret);
      await reply.status(201).send({ success: true, data: webhook });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create webhook',
      });
    }
  }

  /** GET /webhooks - List webhooks for a tenant */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const tenantId = query.tenantId || query.tenant_id;
      if (!tenantId) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId query parameter is required',
        });
        return;
      }

      const webhooks = await this.service.list(tenantId);
      await reply.send({ success: true, data: webhooks, total: webhooks.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /** GET /webhooks/:id - Get webhook by ID */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const webhook = await this.service.get(params.id);
      await reply.send({ success: true, data: webhook });
    } catch (err) {
      if (err instanceof Error && (err as any).code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
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
      if (err instanceof Error && (err as any).code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update webhook',
      });
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
      if (err instanceof Error && (err as any).code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Trigger & Delivery ====================

  /** POST /webhooks/:id/trigger - Manually trigger a webhook */
  async trigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const event = (body.event || body.eventType) as string;
      const payload = (body.payload || body.data || {}) as Record<string, any>;

      if (!event) {
        await reply.status(400).send({
          success: false,
          error: 'event is required',
        });
        return;
      }

      const delivery = await this.service.trigger(params.id, event, payload);
      await reply.send({ success: true, data: delivery });
    } catch (err) {
      if (err instanceof Error) {
        const code = (err as any).code;
        if (code === 'NOT_FOUND') {
          await reply.status(404).send({ success: false, error: err.message });
          return;
        }
        if (code === 'DISABLED') {
          await reply.status(400).send({ success: false, error: err.message });
          return;
        }
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to trigger webhook',
      });
    }
  }

  /** GET /webhooks/:id/deliveries - Get delivery logs */
  async getDeliveries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const query = request.query as Record<string, string>;
      const limit = query.limit ? parseInt(query.limit) : 50;

      // Verify webhook exists
      await this.service.get(params.id);

      const deliveries = await this.service.getDeliveries(params.id, limit);
      await reply.send({ success: true, data: deliveries, total: deliveries.length });
    } catch (err) {
      if (err instanceof Error && (err as any).code === 'NOT_FOUND') {
        await reply.status(404).send({ success: false, error: err.message });
        return;
      }
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /** POST /webhooks/trigger-event - Trigger matching webhooks for an event */
  async triggerEvent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = (body.tenantId || body.tenant_id) as string;
      const event = (body.event || body.eventType) as string;
      const payload = (body.payload || body.data || {}) as Record<string, any>;

      if (!tenantId || !event) {
        await reply.status(400).send({
          success: false,
          error: 'tenantId and event are required',
        });
        return;
      }

      const count = await this.service.triggerEvent(tenantId, event, payload);
      await reply.send({ success: true, data: { triggered: count } });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to trigger event',
      });
    }
  }
}
