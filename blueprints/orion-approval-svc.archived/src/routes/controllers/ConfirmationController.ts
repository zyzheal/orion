/**
 * ConfirmationController - Handles request/response logic for confirmation endpoints.
 *
 * D7 Fix: Migrated to PostgreSQL Repository pattern.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfirmationService } from '../../services/ConfirmationService';

export class ConfirmationController {
  constructor(private service: ConfirmationService) {}

  /**
   * GET /confirmations - List confirmations
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const confirmations = await this.service.list(query);
    return reply.send({ confirmations });
  }

  /**
   * GET /confirmations/stats - Get statistics
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const stats = await this.service.getStats(query.tenantId);
    return reply.send(stats);
  }

  /**
   * GET /confirmations/audit - Get audit logs
   */
  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const logs = await this.service.getAuditLogs(query);
    return reply.send({ auditLogs: logs });
  }

  /**
   * GET /confirmations/settings - Get notification settings
   */
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const userId = query.userId ?? (request.headers as any)['x-user-id'];
    if (!userId) {
      return reply.status(400).send({ error: 'userId query parameter or x-user-id header is required' });
    }
    const settings = await this.service.getNotificationSettings(userId);
    return reply.send(settings);
  }

  /**
   * PUT /confirmations/settings - Update notification settings
   */
  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const userId = body.userId ?? (request.headers as any)['x-user-id'];
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }
    const settings = await this.service.updateNotificationSettings(userId, body);
    return reply.send(settings);
  }

  /**
   * POST /confirmations - Create confirmation
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const confirmation = await this.service.create(body);
    return reply.send(confirmation);
  }

  /**
   * POST /confirmations/batch-approve - Batch approve
   */
  async batchApprove(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const result = await this.service.batchApprove(body);
    return reply.send(result);
  }

  /**
   * GET /confirmations/:id - Get confirmation detail
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const confirmation = await this.service.getById(id);
    if (!confirmation) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    return reply.send(confirmation);
  }

  /**
   * POST /confirmations/:id/approve - Approve confirmation
   */
  async approve(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = await this.service.approve(id, body);
    if (!result) {
      return reply.status(400).send({ error: 'Cannot approve this confirmation' });
    }
    return reply.send(result);
  }

  /**
   * POST /confirmations/:id/reject - Reject confirmation
   */
  async reject(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = await this.service.reject(id, body);
    if (!result) {
      return reply.status(400).send({ error: 'Cannot reject this confirmation' });
    }
    return reply.send(result);
  }
}
