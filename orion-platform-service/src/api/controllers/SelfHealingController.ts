/**
 * Self-Healing Controller - Fastify API Controller
 *
 * Handles HTTP requests for self-healing operations including
 * incident management, strategy configuration, approval workflows,
 * history queries, and effectiveness metrics.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 * Prefix: /api/v1/self-healing
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SelfHealingService } from '../../services/self-healing/SelfHealingService';

export class SelfHealingController {
  private selfHealingService: SelfHealingService;

  constructor(selfHealingService: SelfHealingService) {
    this.selfHealingService = selfHealingService;
  }

  // ==================== Incident Management ====================

  /**
   * POST /self-healing/incidents - Manually trigger a healing incident
   */
  async createIncident(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const body = request.body as any;
      const { type, severity, appName, environment, alertId, tags } = body;

      if (!type || !severity || !appName || !environment) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_001',
          message:
            'Missing required fields: type, severity, appName, environment',
        });
        return;
      }

      const validTypes = [
        'high_cpu',
        'high_memory',
        'high_error_rate',
        'high_latency',
        'pod_crash',
        'node_failure',
        'service_down',
        'deployment_failure',
        'disk_full',
        'network_timeout',
        'custom',
      ];
      if (!validTypes.includes(type)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_002',
          message: `Invalid incident type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const validSeverities = ['critical', 'warning', 'info'];
      if (!validSeverities.includes(severity)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_003',
          message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        });
        return;
      }

      const incident = await this.selfHealingService.handleAlert({
        alertId: alertId || `manual-${Date.now()}`,
        metric: type,
        severity,
        value: 0,
        threshold: 0,
        message: `Manual incident trigger: ${type}`,
        tags: tags || { app: appName, env: environment },
        triggeredAt: new Date(),
      });

      await reply.status(201).send({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        appName: incident.appName,
        environment: incident.environment,
        status: incident.status,
        strategy: incident.strategy
          ? { id: incident.strategy.id, name: incident.strategy.name }
          : null,
        approvalStatus: incident.approvalStatus,
        startedAt: incident.startedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to create incident',
      });
    }
  }

  /**
   * GET /self-healing/incidents/:id - Get incident details
   */
  async getIncident(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const incident = this.selfHealingService.getIncident(id);
      if (!incident) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SH_004',
          message: `Incident '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: incident.id,
        alertId: incident.alertId,
        type: incident.type,
        severity: incident.severity,
        appName: incident.appName,
        environment: incident.environment,
        strategy: incident.strategy
          ? { id: incident.strategy.id, name: incident.strategy.name }
          : null,
        status: incident.status,
        attempts: incident.attempts,
        approvalStatus: incident.approvalStatus,
        approvalRequestId: incident.approvalRequestId,
        result: incident.result,
        error: incident.error,
        startedAt: incident.startedAt,
        completedAt: incident.completedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get incident',
      });
    }
  }

  // ==================== History ====================

  /**
   * GET /self-healing/history - Get healing history
   */
  async getHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const {
        appName,
        environment,
        type,
        status,
        strategyId,
        severity,
        startDate,
        endDate,
        limit,
        offset,
      } = query;

      const history = this.selfHealingService.getHistory({
        appName,
        environment,
        type: type as any,
        status: status as any,
        strategyId,
        severity: severity as any,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      await reply.send({
        data: history.data.map((d) => ({
          id: d.id,
          type: d.type,
          severity: d.severity,
          appName: d.appName,
          environment: d.environment,
          status: d.status,
          strategy: d.strategy
            ? { id: d.strategy.id, name: d.strategy.name }
            : null,
          attempts: d.attempts,
          startedAt: d.startedAt,
          completedAt: d.completedAt,
        })),
        total: history.total,
        limit: history.limit,
        offset: history.offset,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get history',
      });
    }
  }

  // ==================== Effectiveness ====================

  /**
   * GET /self-healing/effectiveness - Get healing effectiveness metrics
   */
  async getEffectiveness(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const query = request.query as any;
      const { appName, environment, startDate, endDate } = query;

      const effectiveness = this.selfHealingService.getEffectiveness({
        appName,
        environment,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      await reply.send(effectiveness);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get effectiveness',
      });
    }
  }

  // ==================== Strategies ====================

  /**
   * GET /self-healing/strategies - Get all healing strategies
   */
  async getStrategies(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const strategies = this.selfHealingService.getStrategies();

      await reply.send({
        data: strategies.map((s) => ({
          id: s.id,
          name: s.name,
          triggerType: s.triggerType,
          confidence: s.confidence,
          enabled: s.enabled,
          description: s.description,
          environments: s.environments,
          maxRetries: s.maxRetries,
          actionsCount: s.actions.length,
        })),
        total: strategies.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get strategies',
      });
    }
  }

  /**
   * GET /self-healing/strategies/:id - Get strategy details
   */
  async getStrategy(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const strategy = this.selfHealingService.getStrategy(id);
      if (!strategy) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SH_005',
          message: `Strategy '${id}' not found`,
        });
        return;
      }

      await reply.send(strategy);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get strategy',
      });
    }
  }

  /**
   * POST /self-healing/strategies/:id/toggle - Enable/disable a strategy
   */
  async toggleStrategy(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const { enabled } = body;

      if (enabled === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_006',
          message: 'Missing required field: enabled',
        });
        return;
      }

      const strategy = this.selfHealingService.getStrategy(id);
      if (!strategy) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SH_005',
          message: `Strategy '${id}' not found`,
        });
        return;
      }

      const success = this.selfHealingService.toggleStrategy(id, enabled);
      if (!success) {
        await reply.status(500).send({
          error: 'INTERNAL_ERROR',
          code: 'SH_500',
          message: 'Failed to toggle strategy',
        });
        return;
      }

      await reply.send({
        id,
        enabled: strategy.enabled,
        message: `Strategy ${enabled ? 'enabled' : 'disabled'}: ${strategy.name}`,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to toggle strategy',
      });
    }
  }

  /**
   * POST /self-healing/strategies - Register a custom strategy
   */
  async registerStrategy(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const body = request.body as any;
      const { id, name, triggerType, actions, confidence, enabled, description, conditions, environments, maxRetries } = body;

      if (!id || !name || !triggerType || !actions) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_007',
          message: 'Missing required fields: id, name, triggerType, actions',
        });
        return;
      }

      if (!Array.isArray(actions) || actions.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_008',
          message: 'Actions must be a non-empty array',
        });
        return;
      }

      const strategy = {
        id,
        name,
        triggerType,
        actions,
        confidence: confidence ?? 50,
        enabled: enabled ?? true,
        description,
        conditions,
        environments,
        maxRetries,
      };

      this.selfHealingService.registerCustomStrategy(strategy);

      await reply.status(201).send({
        id: strategy.id,
        name: strategy.name,
        message: 'Custom strategy registered successfully',
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to register strategy',
      });
    }
  }

  // ==================== Approval Workflow ====================

  /**
   * GET /self-healing/approvals - Get approval requests
   */
  async getApprovals(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const query = request.query as any;
      const { status } = query;

      const approvals = this.selfHealingService.getApprovalRequests(
        status as any
      );

      await reply.send({
        data: approvals,
        total: approvals.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get approvals',
      });
    }
  }

  /**
   * GET /self-healing/approvals/:id - Get approval request details
   */
  async getApproval(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const approval = this.selfHealingService.getApprovalRequest(id);
      if (!approval) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SH_009',
          message: `Approval request '${id}' not found`,
        });
        return;
      }

      await reply.send(approval);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to get approval',
      });
    }
  }

  /**
   * POST /self-healing/approvals/:id/respond - Respond to an approval request
   */
  async respondToApproval(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const body = request.body as any;
      const { approved, reason, respondedBy } = body;

      if (approved === undefined || !respondedBy) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'SH_010',
          message: 'Missing required fields: approved, respondedBy',
        });
        return;
      }

      const incident = await this.selfHealingService.respondToApproval(id, {
        approved,
        reason,
        respondedBy,
      });

      await reply.send({
        incidentId: incident.id,
        status: incident.status,
        approvalStatus: incident.approvalStatus,
        message: approved ? 'Healing execution started' : 'Approval rejected',
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'SH_009',
          message: error.message,
        });
        return;
      }
      if (error.message?.includes('expired')) {
        await reply.status(410).send({
          error: 'EXPIRED',
          code: 'SH_011',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'SH_500',
        message: error.message || 'Failed to respond to approval',
      });
    }
  }
}
