/**
 * ConfigManagementController - Fastify API Controller
 *
 * Handles HTTP requests for enhanced config management
 * (change requests, drift detection, remediation).
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigChangeService } from '../../services/config-mgmt/ConfigChangeService';
import { ConfigDriftDetector } from '../../services/config-mgmt/ConfigDriftDetector';

export class ConfigManagementController {
  private changeService: ConfigChangeService;
  private driftDetector: ConfigDriftDetector;

  constructor(changeService: ConfigChangeService, driftDetector: ConfigDriftDetector) {
    this.changeService = changeService;
    this.driftDetector = driftDetector;
  }

  // ==================== Change Requests ====================

  async createChangeRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const requester = (request.headers['x-user-id'] as string) || body.requester || 'system';

      const {
        configKey,
        configGroup,
        environment,
        changeType,
        oldValue,
        newValue,
        reason,
        riskLevel,
        executionPlan,
        rollbackPlan,
        requiredApprovals,
      } = body;

      if (!configKey || !reason) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_CHG_001',
          message: 'Missing required fields: configKey, reason',
        });
        return;
      }

      const changeRequest = await this.changeService.submitChangeRequest(
        tenantId,
        {
          configKey,
          configGroup,
          environment,
          changeType,
          oldValue,
          newValue,
          reason,
          riskLevel,
          executionPlan,
          rollbackPlan,
          requiredApprovals,
        },
        requester
      );

      await reply.status(201).send({
        id: changeRequest.id,
        configKey: changeRequest.configKey,
        environment: changeRequest.environment,
        changeType: changeRequest.changeType,
        status: changeRequest.status,
        riskLevel: changeRequest.riskLevel,
        requiredApprovals: changeRequest.requiredApprovals,
        createdAt: changeRequest.createdAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_CHG_500',
        message: error.message || 'Failed to create change request',
      });
    }
  }

  async listChangeRequests(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const query = request.query as any;

      const filter = {
        status: query.status,
        configKey: query.configKey,
        configGroup: query.configGroup,
        environment: query.environment,
        requester: query.requester,
        riskLevel: query.riskLevel,
        limit: query.limit ? parseInt(query.limit as string) : undefined,
        offset: query.offset ? parseInt(query.offset as string) : undefined,
      };

      const changeRequests = await this.changeService.listChangeRequests(tenantId, filter);

      await reply.send({
        data: changeRequests.map((cr) => ({
          id: cr.id,
          configKey: cr.configKey,
          configGroup: cr.configGroup,
          environment: cr.environment,
          changeType: cr.changeType,
          status: cr.status,
          riskLevel: cr.riskLevel,
          requester: cr.requester,
          approvals: cr.approvals.length,
          requiredApprovals: cr.requiredApprovals,
          createdAt: cr.createdAt,
        })),
        total: changeRequests.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_CHG_500',
        message: error.message || 'Failed to list change requests',
      });
    }
  }

  async getChangeRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const changeRequest = await this.changeService.getChangeRequestById(id);
      if (!changeRequest) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_CHG_004',
          message: `Change request '${id}' not found`,
        });
        return;
      }

      await reply.send(changeRequest);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_CHG_500',
        message: error.message || 'Failed to get change request',
      });
    }
  }

  async approveChangeRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const { id } = params;
      const reviewerId = body.reviewerId || (request.headers['x-user-id'] as string);
      const { action, comment } = body;

      if (!reviewerId) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_CHG_001',
          message: 'Missing required field: reviewerId',
        });
        return;
      }

      if (!action || !['approve', 'reject'].includes(action)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: 'CONFIG_CHG_002',
          message: 'Invalid action. Must be "approve" or "reject"',
        });
        return;
      }

      const changeRequest = await this.changeService.approveChangeRequest(
        id,
        reviewerId,
        action as 'approve' | 'reject',
        comment
      );

      await reply.send({
        id: changeRequest.id,
        status: changeRequest.status,
        approvals: changeRequest.approvals,
        requiredApprovals: changeRequest.requiredApprovals,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_CHG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'CONFIG_CHG_005',
        message: error.message || 'Failed to approve/reject change request',
      });
    }
  }

  async executeChangeRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const executorId = (request.headers['x-user-id'] as string) || 'system';

      const changeRequest = await this.changeService.executeChangeRequest(id, executorId);

      await reply.send({
        id: changeRequest.id,
        status: changeRequest.status,
        executedAt: changeRequest.executedAt,
        executedBy: changeRequest.executedBy,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_CHG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'CONFIG_CHG_005',
        message: error.message || 'Failed to execute change request',
      });
    }
  }

  async rollbackChangeRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const rolledBackBy = (request.headers['x-user-id'] as string) || 'system';

      const changeRequest = await this.changeService.rollbackChangeRequest(id, rolledBackBy);

      await reply.send({
        id: changeRequest.id,
        status: changeRequest.status,
        rolledBackAt: changeRequest.rolledBackAt,
        rolledBackBy: changeRequest.rolledBackBy,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_CHG_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'CONFIG_CHG_005',
        message: error.message || 'Failed to rollback change request',
      });
    }
  }

  async getChangeHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const query = request.query as any;

      const filter = {
        configKey: query.configKey,
        configGroup: query.configGroup,
        limit: query.limit ? parseInt(query.limit as string) : undefined,
        offset: query.offset ? parseInt(query.offset as string) : undefined,
      };

      const { changeRequests, history } = await this.changeService.getChangeHistory(tenantId, filter);

      await reply.send({
        changeRequest: changeRequests.find((cr) => cr.id === id),
        history: history.map((h) => ({
          id: h.id,
          action: h.action,
          actor: h.actor,
          configKey: h.configKey,
          environment: h.environment,
          notes: h.notes,
          createdAt: h.createdAt,
        })),
        total: history.length,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_CHG_500',
        message: error.message || 'Failed to get change history',
      });
    }
  }

  // ==================== Drift Detection ====================

  async detectDrift(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as any;
      const configGroup = body?.configGroup;

      const report = await this.driftDetector.detectDrift(tenantId, configGroup);

      await reply.send({
        id: report.id,
        driftStatus: report.driftStatus,
        totalDrifts: report.totalDrifts,
        criticalDrifts: report.criticalDrifts,
        driftItems: report.driftItems,
        detectedAt: report.detectedAt,
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_DRIFT_500',
        message: error.message || 'Failed to detect drift',
      });
    }
  }

  async remediateDrift(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const report = await this.driftDetector.autoRemediateDrift(id);

      await reply.send({
        id: report.id,
        driftStatus: report.driftStatus,
        totalDrifts: report.totalDrifts,
        remediationLog: report.remediationLog,
        lastCheckedAt: report.lastCheckedAt,
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_DRIFT_004',
          message: error.message,
        });
        return;
      }
      await reply.status(400).send({
        error: 'BAD_REQUEST',
        code: 'CONFIG_DRIFT_005',
        message: error.message || 'Failed to remediate drift',
      });
    }
  }

  async getDriftReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const query = request.query as any;
      const configGroup = query?.configGroup;

      const report = await this.driftDetector.getDriftReport(tenantId, configGroup);
      if (!report) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: 'CONFIG_DRIFT_004',
          message: 'No drift report found for this tenant',
        });
        return;
      }

      await reply.send(report);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: 'CONFIG_DRIFT_500',
        message: error.message || 'Failed to get drift report',
      });
    }
  }
}
