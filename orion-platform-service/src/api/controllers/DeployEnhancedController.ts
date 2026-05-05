/**
 * DeployEnhancedController - Fastify API Controller for enhanced deploy features
 *
 * Handles HTTP requests for deploy windows, progressive deployments,
 * and emergency deployments.
 *
 * Phase 1: Deploy Release Enhancement (Windows + Progressive + Emergency)
 * Prefix: /api/v1/deploy
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { DeployWindowService } from '../../services/deploy/DeployWindowService';
import { ProgressiveDeployService } from '../../services/deploy/ProgressiveDeployService';
import { EmergencyDeployService } from '../../services/deploy/EmergencyDeployService';

export class DeployEnhancedController {
  private windowService: DeployWindowService;
  private progressiveService: ProgressiveDeployService;
  private emergencyService: EmergencyDeployService;

  constructor(
    windowService: DeployWindowService,
    progressiveService: ProgressiveDeployService,
    emergencyService: EmergencyDeployService
  ) {
    this.windowService = windowService;
    this.progressiveService = progressiveService;
    this.emergencyService = emergencyService;
  }

  // ==================== Deploy Window Handlers ====================

  /**
   * GET /deploy/windows - List deploy windows
   */
  async listWindows(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { page = '1', limit = '20', environmentId, status } = query;

      // Extract tenantId from the tenant context (set by middleware)
      const tenantId = this.extractTenantId(request);

      const result = await this.windowService.listWindows({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        tenantId,
        environmentId,
        status,
      });

      await reply.send(result);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'LIST_WINDOWS_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * POST /deploy/windows - Create a deploy window
   */
  async createWindow(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { name, cron_expression, environment_id, duration_minutes, timezone } = body;

      if (!name || !cron_expression || !environment_id) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, cron_expression, environment_id',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);
      const createdBy = this.extractUserId(request);

      const window = await this.windowService.createWindow({
        tenant_id: tenantId,
        environment_id: environment_id,
        name,
        cron_expression,
        duration_minutes: duration_minutes || 60,
        timezone: timezone || 'Asia/Shanghai',
        created_by: createdBy,
      });

      await reply.status(201).send(window);
    } catch (error: any) {
      if (error.code === 'VALIDATION_ERROR') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'CREATE_WINDOW_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * GET /deploy/windows/:id - Get window details
   */
  async getWindow(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const window = await this.windowService.getWindow(id);
      await reply.send(window);
    } catch (error: any) {
      if (error.code === 'WINDOW_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'GET_WINDOW_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * PUT /deploy/windows/:id - Update a deploy window
   */
  async updateWindow(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const window = await this.windowService.updateWindow(id, {
        name: body.name,
        cron_expression: body.cron_expression,
        duration_minutes: body.duration_minutes,
        timezone: body.timezone,
        status: body.status,
      });

      await reply.send(window);
    } catch (error: any) {
      if (error.code === 'WINDOW_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'UPDATE_WINDOW_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * DELETE /deploy/windows/:id - Delete a deploy window
   */
  async deleteWindow(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const window = await this.windowService.deleteWindow(id);
      await reply.send({ message: 'Deploy window deleted', data: window });
    } catch (error: any) {
      if (error.code === 'WINDOW_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'DELETE_WINDOW_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * GET /deploy/windows/:id/check - Check if current time is within window
   */
  async checkWindow(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const window = await this.windowService.getWindow(id);

      const result = await this.windowService.checkWindowActive(
        window.tenant_id,
        window.environment_id
      );

      await reply.send({
        window,
        ...result,
      });
    } catch (error: any) {
      if (error.code === 'WINDOW_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'CHECK_WINDOW_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Progressive Deploy Handlers ====================

  /**
   * POST /deploy/:deploymentId/progressive - Create a progressive deployment
   */
  async createProgressiveDeploy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { deploymentId } = request.params as { deploymentId: string };
      const body = request.body as any;
      const { stages } = body;

      if (!stages || !Array.isArray(stages) || stages.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Stages array is required and must have at least one stage',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);

      const result = await this.progressiveService.createProgressiveDeploy({
        tenant_id: tenantId,
        deployment_id: deploymentId,
        stages,
      });

      await reply.status(201).send(result);
    } catch (error: any) {
      if (error.code === 'NO_STAGES' || error.code === 'DEPLOY_NOT_FOUND' ||
          error.code === 'TENANT_MISMATCH' || error.code === 'INVALID_TRAFFIC_ORDER') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'CREATE_PROGRESSIVE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * GET /deploy/progressive/:deployId - Get progressive deployment progress
   */
  async getProgress(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { deployId } = request.params as { deployId: string };
      const tenantId = this.extractTenantId(request);

      const progress = await this.progressiveService.getProgress(tenantId, deployId);
      await reply.send(progress);
    } catch (error: any) {
      if (error.code === 'NO_STAGES') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'GET_PROGRESS_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * POST /deploy/progressive/:deployId/advance - Advance to next stage
   */
  async advanceStage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { deployId } = request.params as { deployId: string };
      const body = request.body as any;
      const { stage_id, validation_result } = body;

      if (!stage_id) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'stage_id is required',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);

      const result = await this.progressiveService.advanceStage(
        tenantId,
        deployId,
        stage_id,
        validation_result
      );

      await reply.send(result);
    } catch (error: any) {
      if (error.code === 'STAGE_NOT_FOUND' || error.code === 'STAGE_MISMATCH' ||
          error.code === 'TENANT_MISMATCH' || error.code === 'STAGE_NOT_RUNNING') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'ADVANCE_STAGE_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * POST /deploy/progressive/:deployId/rollback - Rollback a stage
   */
  async rollbackStage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { deployId } = request.params as { deployId: string };
      const body = request.body as any;
      const { stage_id, reason } = body;

      if (!stage_id) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'stage_id is required',
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'reason is required for rollback',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);

      const result = await this.progressiveService.rollback(
        tenantId,
        deployId,
        stage_id,
        reason
      );

      await reply.send(result);
    } catch (error: any) {
      if (error.code === 'STAGE_NOT_FOUND' || error.code === 'STAGE_MISMATCH' ||
          error.code === 'TENANT_MISMATCH') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'ROLLBACK_STAGE_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Emergency Deploy Handlers ====================

  /**
   * POST /deploy/emergencies - Request an emergency deployment
   */
  async requestEmergencyDeploy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const { deployment_id, reason, requested_by } = body;

      if (!deployment_id || !reason || !requested_by) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: deployment_id, reason, requested_by',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);

      const emergency = await this.emergencyService.requestEmergencyDeploy(
        tenantId,
        deployment_id,
        reason,
        requested_by
      );

      await reply.status(201).send(emergency);
    } catch (error: any) {
      if (error.code === 'MISSING_REASON' || error.code === 'MISSING_REQUESTED_BY' ||
          error.code === 'DEPLOY_NOT_FOUND' || error.code === 'TENANT_MISMATCH') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'REQUEST_EMERGENCY_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * POST /deploy/emergencies/:id/approve - Approve an emergency deployment
   */
  async approveEmergencyDeploy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { approved_by } = body;

      if (!approved_by) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'approved_by is required',
        });
        return;
      }

      const tenantId = this.extractTenantId(request);

      const emergency = await this.emergencyService.approveEmergencyDeploy(
        tenantId,
        id,
        approved_by
      );

      await reply.send(emergency);
    } catch (error: any) {
      if (error.code === 'EMERGENCY_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      if (error.code === 'TENANT_MISMATCH' || error.code === 'INVALID_STATUS') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'APPROVE_EMERGENCY_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * POST /deploy/emergencies/:id/complete - Complete an emergency deployment
   */
  async completeEmergencyDeploy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { post_mortem } = body;

      const tenantId = this.extractTenantId(request);

      const emergency = await this.emergencyService.completeEmergencyDeploy(
        tenantId,
        id,
        post_mortem
      );

      await reply.send(emergency);
    } catch (error: any) {
      if (error.code === 'EMERGENCY_NOT_FOUND') {
        await reply.status(404).send({ error: error.code, message: error.message });
        return;
      }
      if (error.code === 'TENANT_MISMATCH' || error.code === 'INVALID_STATUS') {
        await reply.status(400).send({ error: error.code, message: error.message });
        return;
      }
      await reply.status(500).send({
        error: 'COMPLETE_EMERGENCY_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * GET /deploy/emergencies - List emergency deployments
   */
  async listEmergencies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as Record<string, string>;
      const { page = '1', limit = '20', status } = query;

      const tenantId = this.extractTenantId(request);

      const result = await this.emergencyService.getEmergencies({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        tenantId,
        status,
      });

      await reply.send(result);
    } catch (error: any) {
      await reply.status(500).send({
        error: 'LIST_EMERGENCIES_ERROR',
        message: error.message,
      });
    }
  }

  // ==================== Helpers ====================

  private extractTenantId(request: FastifyRequest): string {
    // Extract from tenant context (set by TenantValidatorMiddleware)
    const tenantContext = (request as any).tenantContext;
    if (tenantContext?.tenantId) {
      return tenantContext.tenantId;
    }

    // Fallback: try to get from query params or headers
    const query = request.query as Record<string, string>;
    if (query?.tenantId) {
      return query.tenantId;
    }

    // Return a default for development/testing
    return '00000000-0000-0000-0000-000000000001';
  }

  private extractUserId(request: FastifyRequest): string {
    // Extract from authenticated user context
    const user = (request as any).user;
    if (user?.id) {
      return user.id;
    }

    // Fallback
    const query = request.query as Record<string, string>;
    if (query?.userId) {
      return query.userId;
    }

    return 'system';
  }
}
