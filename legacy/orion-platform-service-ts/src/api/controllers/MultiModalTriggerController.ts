/**
 * MultiModalTriggerController - API controller for multi-modal trigger endpoints
 *
 * Handles trigger registration, evaluation, webhook processing, and chat commands.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { DatabasePool } from '../../services/database';
import {
  UnifiedTriggerService,
  TriggerInput,
} from '../../services/multi-modal-trigger/UnifiedTriggerService';
import {
  WebhookTriggerHandler,
  WebhookConfig,
  WebhookPayload,
} from '../../services/multi-modal-trigger/WebhookTriggerHandler';
import {
  ChatTriggerHandler,
  ChatMessage,
} from '../../services/multi-modal-trigger/ChatTriggerHandler';

export class MultiModalTriggerController extends BaseController {
  private triggerService: UnifiedTriggerService;
  private webhookHandler: WebhookTriggerHandler;
  private chatHandler: ChatTriggerHandler;

  constructor(db?: DatabasePool) {
    super();
    this.triggerService = new UnifiedTriggerService(db);
    this.webhookHandler = new WebhookTriggerHandler(db, this.triggerService);
    this.chatHandler = new ChatTriggerHandler(db, this.triggerService);
  }

  // ==================== Triggers ====================

  /**
   * POST /api/v1/triggers
   * Register a new trigger
   */
  async registerTrigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as any || {};

      const { name, type, config, conditionExpression, pipelineId, createdBy } = body;

      if (!name || !type) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, type',
        });
        return;
      }

      const input: TriggerInput = {
        name,
        type,
        config,
        conditionExpression,
        pipelineId,
        createdBy,
      };

      const trigger = await this.triggerService.registerTrigger(tenantId, type, input);

      await reply.status(201).send({
        id: trigger.id,
        name: trigger.name,
        type: trigger.type,
        enabled: trigger.enabled,
        pipelineId: trigger.pipeline_id,
        triggerCount: trigger.trigger_count,
        createdAt: trigger.created_at,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register trigger';
      const statusCode = message.includes('Invalid trigger type') ? 400 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  /**
   * GET /api/v1/triggers
   * List triggers
   */
  async listTriggers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const query = request.query as any;
      const type = query?.type;

      const triggers = await this.triggerService.listTriggers(tenantId, type);

      await reply.send({
        data: triggers.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          enabled: t.enabled,
          pipelineId: t.pipeline_id,
          triggerCount: t.trigger_count,
          lastTriggeredAt: t.last_triggered_at,
          createdAt: t.created_at,
        })),
        total: triggers.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list triggers',
      });
    }
  }

  // ==================== Trigger Evaluation ====================

  /**
   * POST /api/v1/triggers/:id/evaluate
   * Evaluate a trigger against an event
   */
  async evaluateTrigger(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any || {};

      const result = await this.triggerService.evaluateTrigger(tenantId, id, body);

      await reply.status(result.matched ? 200 : 200).send({
        matched: result.matched,
        trigger: {
          id: result.trigger.id,
          name: result.trigger.name,
          type: result.trigger.type,
        },
        event: {
          id: result.event.id,
          eventType: result.event.event_type,
          evaluationResult: result.event.evaluation_result,
        },
        reason: result.reason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to evaluate trigger';
      const statusCode = message.includes('not found') ? 404 :
                         message.includes('disabled') ? 400 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' :
               statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Pipeline Execution ====================

  /**
   * POST /api/v1/triggers/:id/execute
   * Execute pipeline from trigger
   */
  async executePipeline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const params = request.params as any;
      const { id } = params;

      const result = await this.triggerService.executePipelineFromTrigger(tenantId, id);

      await reply.status(200).send({
        success: result.success,
        pipelineRunId: result.pipelineRunId,
        error: result.error,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute pipeline';
      const statusCode = message.includes('not found') ? 404 :
                         message.includes('disabled') || message.includes('no associated') ? 400 : 500;
      await reply.status(statusCode).send({
        error: statusCode === 404 ? 'NOT_FOUND' :
               statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
        message,
      });
    }
  }

  // ==================== Webhook ====================

  /**
   * POST /api/v1/triggers/webhook
   * Register a webhook endpoint
   */
  async registerWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as any || {};

      const { triggerId, path, secret, allowedIps, method } = body;

      const config: WebhookConfig = {
        triggerId,
        path,
        secret,
        allowedIps,
        method,
      };

      const endpoint = await this.webhookHandler.registerWebhook(tenantId, config);

      await reply.status(201).send({
        id: endpoint.id,
        path: endpoint.path,
        triggerId: endpoint.trigger_id,
        method: endpoint.method,
        hasSecret: !!endpoint.secret,
        allowedIps: endpoint.allowed_ips,
        createdAt: endpoint.created_at,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to register webhook',
      });
    }
  }

  /**
   * POST /api/v1/triggers/webhook/process
   * Process a webhook event
   */
  async processWebhookEvent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const headers: Record<string, string> = {};

      // Extract headers from request
      const rawHeaders = request.headers;
      for (const [key, value] of Object.entries(rawHeaders)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        }
      }

      const payload: WebhookPayload = {
        headers,
        body,
        ip: request.ip,
        timestamp: new Date().toISOString(),
      };

      const result = await this.webhookHandler.processWebhookEvent(payload);

      if (!result.success) {
        await reply.status(400).send({
          error: 'WEBHOOK_ERROR',
          message: result.error,
        });
        return;
      }

      await reply.status(200).send({
        success: true,
        endpointId: result.endpointId,
        triggerId: result.triggerId,
        eventId: result.eventId,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process webhook',
      });
    }
  }

  /**
   * GET /api/v1/triggers/webhook/history
   * Get webhook history
   */
  async getWebhookHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);

      const history = await this.webhookHandler.getWebhookHistory(tenantId);

      await reply.send({
        data: history.map(h => ({
          endpoint: {
            id: h.endpoint.id,
            path: h.endpoint.path,
            triggerId: h.endpoint.trigger_id,
            requestCount: h.endpoint.request_count,
            lastRequestAt: h.endpoint.last_request_at,
          },
          recentEvents: h.events.map(e => ({
            id: e.id,
            eventType: e.event_type,
            evaluationResult: e.evaluation_result,
            createdAt: e.created_at,
          })),
        })),
        total: history.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get webhook history',
      });
    }
  }

  // ==================== Chat ====================

  /**
   * POST /api/v1/triggers/chat
   * Execute a command from chat
   */
  async executeFromChat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};

      const { content, channel, userId, platform, threadId } = body;

      if (!content) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: content',
        });
        return;
      }

      const message: ChatMessage = {
        userId: userId || 'anonymous',
        channel: channel || 'default',
        content,
        timestamp: new Date().toISOString(),
        platform,
        threadId,
      };

      const result = await this.chatHandler.executeFromChat(message, channel);

      const statusCode = result.success ? 200 : (result.response?.includes('Unknown command') ? 400 : 200);

      await reply.status(statusCode).send({
        success: result.success,
        command: result.command,
        response: result.response,
        triggerId: result.triggerId,
        pipelineRunId: result.pipelineRunId,
        error: result.error,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to execute chat command',
      });
    }
  }

  // ==================== Stats ====================

  /**
   * GET /api/v1/triggers/stats
   * Get trigger statistics
   */
  async getTriggerStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = this.getTenantId(request);

      const stats = await this.triggerService.getTriggerStats(tenantId);

      await reply.send({
        totalTriggers: stats.totalTriggers,
        triggersByType: stats.triggersByType,
        totalEvents: stats.totalEvents,
        matchedEvents: stats.matchedEvents,
        pipelineRuns: stats.pipelineRuns,
        topTriggers: stats.topTriggers,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get trigger stats',
      });
    }
  }
}
