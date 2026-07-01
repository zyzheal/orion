/**
 * Canary Traffic Controller - Phase 3
 *
 * HTTP handlers for canary traffic management endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CanaryTrafficService,
  CreateCanaryInput,
} from '../../services/canary-traffic/CanaryTrafficService';
import { TrafficSplitter } from '../../services/canary-traffic/TrafficSplitter';

export class CanaryTrafficController {
  private service: CanaryTrafficService;
  private splitter: TrafficSplitter;

  constructor(service: CanaryTrafficService, splitter: TrafficSplitter) {
    this.service = service;
    this.splitter = splitter;
  }

  /**
   * POST /api/v1/canary/deployments - Create a canary deployment
   */
  async createCanaryDeployment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request as any).user?.tenantId || body.tenant_id;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }
      if (!body.deployment_id || !body.service_name || !body.canary_version || !body.baseline_version) {
        reply.status(400).send({
          success: false,
          error: 'Missing required fields: deployment_id, service_name, canary_version, baseline_version',
        });
        return;
      }

      const input: CreateCanaryInput = {
        tenant_id: tenantId,
        deployment_id: body.deployment_id,
        service_name: body.service_name,
        canary_version: body.canary_version,
        baseline_version: body.baseline_version,
        initial_percent: body.initial_percent,
        max_percent: body.max_percent,
      };

      const deployment = await this.service.createCanaryDeployment(tenantId, input);

      reply.status(201).send({
        success: true,
        data: deployment,
        message: 'Canary deployment created successfully',
      });
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to create canary deployment',
      });
    }
  }

  /**
   * GET /api/v1/canary/deployments - List canary deployments
   */
  async listCanaryDeployments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request as any).user?.tenantId;
      const query = request.query as any;
      const status = query.status;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }

      const deployments = await this.service.listCanaryDeployments(tenantId, status);

      reply.send({
        success: true,
        data: deployments,
        total: deployments.length,
      });
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to list canary deployments',
      });
    }
  }

  /**
   * GET /api/v1/canary/deployments/:id - Get canary deployment details
   */
  async getCanaryDeployment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const canaryId = params.id;
      const tenantId = (request as any).user?.tenantId;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }

      const deployment = await this.service.getCanaryDeployment(canaryId, tenantId);
      if (!deployment) {
        reply.status(404).send({
          success: false,
          error: 'Canary deployment not found',
        });
        return;
      }

      reply.send({
        success: true,
        data: deployment,
      });
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to get canary deployment',
      });
    }
  }

  /**
   * PUT /api/v1/canary/deployments/:id/traffic - Configure traffic split
   */
  async configureTrafficSplit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const canaryId = params.id;
      const tenantId = (request as any).user?.tenantId;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }

      if (body.percent === undefined || body.percent === null) {
        reply.status(400).send({
          success: false,
          error: 'percent is required',
        });
        return;
      }

      const percent = parseInt(body.percent, 10);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        reply.status(400).send({
          success: false,
          error: 'percent must be a number between 0 and 100',
        });
        return;
      }

      // Validate traffic health before applying
      const healthStatus = await this.splitter.validateTrafficHealth(canaryId, tenantId);
      if (!healthStatus.healthy && percent > 0) {
        reply.status(400).send({
          success: false,
          error: 'Traffic health check failed',
          healthChecks: healthStatus.checks,
          healthStatus,
        });
        return;
      }

      const split = await this.splitter.splitTraffic(canaryId, tenantId, percent);

      reply.send({
        success: true,
        data: split,
        message: 'Traffic split updated successfully',
      });
    } catch (error: any) {
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to configure traffic split',
      });
    }
  }

  /**
   * POST /api/v1/canary/deployments/:id/promote - Promote canary to production
   */
  async promoteCanary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const canaryId = params.id;
      const tenantId = (request as any).user?.tenantId;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }

      // Validate traffic health before promoting
      const healthStatus = await this.splitter.validateTrafficHealth(canaryId, tenantId);

      const deployment = await this.service.promoteCanary(canaryId, tenantId);

      reply.send({
        success: true,
        data: deployment,
        healthStatus,
        message: 'Canary promoted to production',
      });
    } catch (error: any) {
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to promote canary',
      });
    }
  }

  /**
   * POST /api/v1/canary/deployments/:id/rollback - Rollback canary deployment
   */
  async rollbackCanary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const canaryId = params.id;
      const tenantId = (request as any).user?.tenantId;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenant_id is required' });
        return;
      }

      const deployment = await this.service.rollbackCanary(canaryId, tenantId);

      reply.send({
        success: true,
        data: deployment,
        message: 'Canary rolled back successfully',
      });
    } catch (error: any) {
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to rollback canary',
      });
    }
  }
}
