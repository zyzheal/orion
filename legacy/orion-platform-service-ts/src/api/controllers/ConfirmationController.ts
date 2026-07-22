/**
 * Manual Confirmation Controller (P0-6)
 *
 * Handles HTTP requests for confirmation workbench API.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfirmationService, ConfirmationInput, BatchApproveInput } from '../../services/confirmation/ConfirmationService';

export class ConfirmationController {
  private service: ConfirmationService;

  constructor(service: ConfirmationService) {
    this.service = service;
  }

  /**
   * GET /confirmations - List confirmations
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const confirmations = await this.service.list({
        sceneType: query.sceneType as string,
        priority: query.priority as string,
        status: query.status as string,
        offset: query.page ? (parseInt(query.page as string) - 1) * (parseInt(query.perPage as string) || 20) : 0,
        limit: query.perPage ? parseInt(query.perPage as string) : 20,
      });

      return reply.send({
        success: true,
        data: confirmations,
        total: confirmations.length,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list confirmations',
      });
    }
  }

  /**
   * GET /confirmations/:id - Get confirmation detail
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const confirmation = await this.service.getById(id);

      if (!confirmation) {
        return reply.status(404).send({
          success: false,
          error: 'CONFIRMATION_NOT_FOUND',
          message: `Confirmation '${id}' not found`,
        });
      }

      return reply.send({
        success: true,
        data: confirmation,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get confirmation',
      });
    }
  }

  /**
   * POST /confirmations - Create confirmation
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      if (!body.sceneType || !body.priority || !body.aiSuggestion) {
        return reply.status(400).send({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'sceneType, priority, and aiSuggestion are required',
        });
      }

      const confirmation = await this.service.create({
        sceneType: body.sceneType,
        priority: body.priority,
        aiSuggestion: body.aiSuggestion,
        aiConfidence: body.aiConfidence || 0.5,
        context: body.context,
        tenantId: body.tenantId,
      });

      return reply.status(201).send({
        success: true,
        data: confirmation,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create confirmation',
      });
    }
  }

  /**
   * POST /confirmations/:id/approve - Approve confirmation
   */
  async approve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as ConfirmationInput;

      const result = await this.service.approve(id, body);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: 'CONFIRMATION_NOT_FOUND_OR_NOT_PENDING',
          message: `Confirmation '${id}' not found or not pending`,
        });
      }

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve confirmation',
      });
    }
  }

  /**
   * POST /confirmations/:id/reject - Reject confirmation
   */
  async reject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as ConfirmationInput;

      const result = await this.service.reject(id, body);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: 'CONFIRMATION_NOT_FOUND_OR_NOT_PENDING',
          message: `Confirmation '${id}' not found or not pending`,
        });
      }

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject confirmation',
      });
    }
  }

  /**
   * POST /confirmations/batch-approve - Batch approve
   */
  async batchApprove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as BatchApproveInput;

      if (!body.ids || !Array.isArray(body.ids)) {
        return reply.status(400).send({
          success: false,
          error: 'INVALID_INPUT',
          message: 'ids array is required',
        });
      }

      const result = await this.service.batchApprove(body);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch approve',
      });
    }
  }

  /**
   * GET /confirmations/audit - Get audit logs
   */
  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const logs = await this.service.getAuditLogs({
        confirmationId: query.confirmationId as string,
        user: query.user as string,
        startDate: query.startDate as string,
        endDate: query.endDate as string,
        offset: query.page ? (parseInt(query.page as string) - 1) * (parseInt(query.perPage as string) || 20) : 0,
        limit: query.perPage ? parseInt(query.perPage as string) : 20,
      });

      return reply.send({
        success: true,
        data: logs,
        total: logs.length,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit logs',
      });
    }
  }

  /**
   * GET /confirmations/settings - Get notification settings
   */
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const userId = query.userId as string || 'default';
      const settings = await this.service.getNotificationSettings(userId);

      return reply.send({
        success: true,
        data: settings,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings',
      });
    }
  }

  /**
   * PUT /confirmations/settings - Update notification settings
   */
  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const userId = query.userId as string || 'default';
      const body = request.body as any;

      const settings = await this.service.updateNotificationSettings(userId, body);

      return reply.send({
        success: true,
        data: settings,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  }

  /**
   * GET /confirmations/stats - Get statistics
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const stats = await this.service.getStats(query.tenantId as string);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  }
}
