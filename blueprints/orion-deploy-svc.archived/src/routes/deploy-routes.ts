import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyPluginOptions } from 'fastify';
import { Pool } from 'pg';
import { EnvironmentType } from '../types/deploy';
import { DeploymentWorkflow } from '../services/DeploymentWorkflow';
import { EnvironmentService } from '../services/EnvironmentService';
import { RollbackService } from '../services/RollbackService';
import { DeploymentHistoryService } from '../services/DeploymentHistoryService';
import { ReleaseNotesService } from '../services/ReleaseNotesService';
import { WindowsDeploymentService } from '../services/WindowsDeploymentService';
import { DeployWindowService } from '../services/DeployWindowService';

interface DeployRoutesOptions extends FastifyPluginOptions {
  dbPool: Pool;
}

/**
 * Deploy Routes
 * All deployment-related API endpoints
 */
export async function deployRoutes(fastify: FastifyInstance, opts: DeployRoutesOptions): Promise<void> {
  const dbPool = opts.dbPool;
  const workflow = new DeploymentWorkflow();
  const envService = new EnvironmentService();
  const rollbackService = new RollbackService({ db: dbPool });
  const historyService = new DeploymentHistoryService(dbPool);
  const releaseNotesService = new ReleaseNotesService();
  const windowsDeploymentService = new WindowsDeploymentService();
  const deployWindowService = new DeployWindowService();

  // ==================== Environment Routes ====================

  /**
   * GET /api/v1/deploy/environments
   * List all environments (optionally filtered by tenant)
   */
  fastify.get<{ Querystring: { tenantId?: string } }>(
    '/deploy/environments',
    async (
      request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.query;
      const result = await envService.listEnvironments(tenantId);
      return reply.send(result);
    },
  );

  /**
   * GET /api/v1/deploy/environments/:id
   * Get a single environment by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy/environments/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const env = await envService.getEnvironment(id);
      if (!env) {
        return reply.code(404).send({ error: 'Environment not found' });
      }
      return reply.send(env);
    },
  );

  /**
   * POST /api/v1/deploy/environments
   * Create a new environment
   */
  fastify.post<{ Body: {
    name: string;
    type: EnvironmentType;
    tenantId: string;
    clusterUrl: string;
    namespace: string;
    isActive?: boolean;
    config?: Record<string, unknown>;
  } }>(
    '/deploy/environments',
    async (
      request: FastifyRequest<{ Body: {
        name: string;
        type: EnvironmentType;
        tenantId: string;
        clusterUrl: string;
        namespace: string;
        isActive?: boolean;
        config?: Record<string, unknown>;
      } }>,
      reply: FastifyReply,
    ) => {
      try {
        const env = await envService.createEnvironment({
          name: request.body.name,
          type: request.body.type,
          tenantId: request.body.tenantId,
          clusterUrl: request.body.clusterUrl,
          namespace: request.body.namespace,
          isActive: request.body.isActive ?? true,
          config: request.body.config || {},
        });
        return reply.code(201).send(env);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  /**
   * POST /api/v1/deploy/environments/:id/config
   * Update environment configuration
   */
  fastify.post<{ Params: { id: string }; Body: {
    config?: Record<string, unknown>;
    clusterUrl?: string;
    namespace?: string;
  } }>(
    '/deploy/environments/:id/config',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { config?: Record<string, unknown>; clusterUrl?: string; namespace?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      try {
        const updated = await envService.updateConfig(id, {
          config: request.body.config,
          clusterUrl: request.body.clusterUrl,
          namespace: request.body.namespace,
        });
        return reply.send(updated);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(404).send({ error: message });
      }
    },
  );

  /**
   * POST /api/v1/deploy/environments/:id/deactivate
   * Deactivate an environment
   */
  fastify.post<{ Params: { id: string } }>(
    '/deploy/environments/:id/deactivate',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      try {
        await envService.deactivateEnvironment(id);
        return reply.send({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(404).send({ error: message });
      }
    },
  );

  // ==================== Deployment Routes ====================

  /**
   * GET /api/v1/deploy
   * List deployments with optional filters
   */
  fastify.get<{ Querystring: { pipelineId?: string; status?: string; limit?: string; environment?: string } }>(
    '/deploy',
    async (
      request: FastifyRequest<{
        Querystring: { pipelineId?: string; status?: string; limit?: string; environment?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { pipelineId, status, limit, environment } = request.query;
      const parsedLimit = limit ? parseInt(limit, 10) : 20;
      const deployments = await workflow.listDeployments({
        pipelineId,
        status: status as 'pending' | 'running' | 'success' | 'failed' | 'rolled_back' | undefined,
        environment: environment as string | undefined,
        limit: parsedLimit,
      });
      return reply.send(deployments);
    },
  );

  /**
   * POST /api/v1/deploy
   * Execute a new deployment
   */
  fastify.post<{ Body: {
    pipelineId?: string;
    runId?: string;
    environment: string;
    strategy?: string;
    triggeredBy?: string;
    tenantId: string;
    envOverrides?: Record<string, string>;
  } }>(
    '/deploy',
    async (
      request: FastifyRequest<{
        Body: {
          pipelineId?: string;
          runId?: string;
          environment: string;
          strategy?: string;
          triggeredBy?: string;
          tenantId: string;
          envOverrides?: Record<string, string>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const deployment = await workflow.executeDeploy({
          pipelineId: request.body.pipelineId,
          runId: request.body.runId,
          environment: request.body.environment,
          strategy: request.body.strategy || 'direct',
          triggeredBy: request.body.triggeredBy || 'api',
          tenantId: request.body.tenantId,
          envOverrides: request.body.envOverrides,
        });
        return reply.code(201).send(deployment);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Deploy failed');
        return reply.code(400).send({ error: message });
      }
    },
  );

  /**
   * GET /api/v1/deploy/:id
   * Get deployment details by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const deployment = await workflow.getDeployment(id);
      if (!deployment) {
        return reply.code(404).send({ error: 'Deployment not found' });
      }
      return reply.send(deployment);
    },
  );

  /**
   * POST /api/v1/deploy/:id/rollback
   * Rollback a deployment
   */
  fastify.post<{ Params: { id: string }; Body: { reason?: string; triggeredBy?: string } }>(
    '/deploy/:id/rollback',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { reason?: string; triggeredBy?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      try {
        const result = await workflow.rollbackDeployment(id, {
          reason: request.body.reason,
          triggeredBy: request.body.triggeredBy,
        });
        return reply.send(result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  /**
   * GET /api/v1/deploy/:id/history
   * Get deployment history
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy/:id/history',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const deployment = await historyService.getDeployment(id);
      if (!deployment) {
        return reply.code(404).send({ error: 'Deployment not found' });
      }
      return reply.send(deployment);
    },
  );

  // ==================== Rollback Routes ====================

  /**
   * GET /api/v1/deploy/rollback
   * List rollback records
   */
  fastify.get<{ Querystring: { deploymentId?: string; limit?: string } }>(
    '/deploy/rollback',
    async (
      request: FastifyRequest<{
        Querystring: { deploymentId?: string; limit?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { deploymentId, limit } = request.query;
      const parsedLimit = limit ? parseInt(limit, 10) : 20;
      let rollbacks;
      if (deploymentId) {
        rollbacks = await rollbackService.getRollbackHistory(deploymentId);
      } else {
        rollbacks = await rollbackService.getAllRollbacks();
      }
      return reply.send({ data: rollbacks.slice(0, parsedLimit), total: rollbacks.length });
    },
  );

  /**
   * GET /api/v1/deploy/rollback/:id
   * Get rollback details
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy/rollback/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const rollback = await rollbackService.getRollbackById(id);
      if (!rollback) {
        return reply.code(404).send({ error: 'Rollback not found' });
      }
      return reply.send(rollback);
    },
  );

  // ==================== Release Notes Routes ====================

  /**
   * POST /api/v1/deploy/release-notes
   * Generate release notes from git commit history
   */
  fastify.post<{ Body: { fromRef: string; toRef?: string; repository?: string } }>(
    '/deploy/release-notes',
    async (
      request: FastifyRequest<{ Body: { fromRef: string; toRef?: string; repository?: string } }>,
      reply: FastifyReply,
    ) => {
      const { fromRef, toRef, repository } = request.body;
      if (!fromRef) {
        return reply.code(400).send({ error: 'fromRef is required' });
      }
      try {
        const notes = await releaseNotesService.generate({ fromRef, toRef, repository });
        return reply.send(notes);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Release notes generation failed');
        return reply.code(400).send({ error: message });
      }
    },
  );

  // ==================== Windows Deployment Routes ====================

  /**
   * POST /api/v1/deploy/windows/generate
   * Generate Windows deployment PowerShell script
   */
  fastify.post<{ Body: { serviceName: string; image: string; port: number; envVars?: Record<string, string>; replicas?: number; healthCheckPath?: string } }>(
    '/deploy/windows/generate',
    async (request, reply) => {
      const config = request.body;
      const validation = await windowsDeploymentService.validateConfig(config as any);
      if (!validation.valid) {
        return reply.code(400).send({ error: 'Invalid config', details: validation.errors });
      }
      const script = await windowsDeploymentService.generateDeploymentScript(config as any);
      return reply.send({ script });
    },
  );

  /**
   * POST /api/v1/deploy/windows/execute
   * Execute Windows deployment
   */
  fastify.post<{ Body: { serviceName: string; image: string; port: number; envVars?: Record<string, string>; replicas?: number; healthCheckPath?: string } }>(
    '/deploy/windows/execute',
    async (request, reply) => {
      const config = request.body;
      const validation = await windowsDeploymentService.validateConfig(config as any);
      if (!validation.valid) {
        return reply.code(400).send({ error: 'Invalid config', details: validation.errors });
      }
      const result = await windowsDeploymentService.deploy(config as any);
      return reply.send(result);
    },
  );

  /**
   * POST /api/v1/deploy/windows/validate
   * Validate Windows deployment config
   */
  fastify.post<{ Body: { serviceName?: string; image?: string; port?: number; envVars?: Record<string, string>; replicas?: number } }>(
    '/deploy/windows/validate',
    async (request, reply) => {
      const config = request.body;
      const result = await windowsDeploymentService.validateConfig(config as any);
      return reply.send(result);
    },
  );

  // ==================== Deploy Window Routes ====================

  /**
   * POST /api/v1/deploy/windows
   * Create a deploy window (maintenance or blackout)
   */
  fastify.post<{ Body: {
    tenantId: string;
    name: string;
    type: 'maintenance' | 'blackout';
    schedule: string;
    durationMinutes: number;
    environments: string[];
    description?: string;
  } }>(
    '/deploy/windows',
    async (request, reply) => {
      try {
        const window = await deployWindowService.createWindow({
          tenantId: request.body.tenantId,
          name: request.body.name,
          type: request.body.type,
          schedule: request.body.schedule,
          durationMinutes: request.body.durationMinutes,
          environments: request.body.environments,
          description: request.body.description,
        });
        return reply.code(201).send(window);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  /**
   * GET /api/v1/deploy/windows
   * List deploy windows for a tenant
   */
  fastify.get<{ Querystring: { tenantId: string; type?: 'maintenance' | 'blackout' } }>(
    '/deploy/windows',
    async (request, reply) => {
      const { tenantId, type } = request.query;
      const windows = await deployWindowService.listWindows(tenantId, type);
      return reply.send(windows);
    },
  );

  /**
   * GET /api/v1/deploy/windows/:id
   * Get a single deploy window
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy/windows/:id',
    async (request, reply) => {
      const { id } = request.params;
      const window = await deployWindowService.getWindow(id);
      if (!window) {
        return reply.code(404).send({ error: 'Window not found' });
      }
      return reply.send(window);
    },
  );

  /**
   * PUT /api/v1/deploy/windows/:id
   * Update a deploy window
   */
  fastify.put<{ Params: { id: string }; Body: {
    name?: string;
    type?: 'maintenance' | 'blackout';
    schedule?: string;
    durationMinutes?: number;
    environments?: string[];
    description?: string;
  } }>(
    '/deploy/windows/:id',
    async (request, reply) => {
      const { id } = request.params;
      const window = await deployWindowService.updateWindow(id, request.body);
      if (!window) {
        return reply.code(404).send({ error: 'Window not found' });
      }
      return reply.send(window);
    },
  );

  /**
   * DELETE /api/v1/deploy/windows/:id
   * Delete a deploy window
   */
  fastify.delete<{ Params: { id: string } }>(
    '/deploy/windows/:id',
    async (request, reply) => {
      const { id } = request.params;
      const deleted = await deployWindowService.deleteWindow(id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Window not found' });
      }
      return reply.send({ success: true });
    },
  );

  /**
   * GET /api/v1/deploy-windows/check
   * Check if deployment is allowed for a tenant/environment
   */
  fastify.get<{ Querystring: { tenantId: string; environment: string } }>(
    '/deploy-windows/check',
    async (request, reply) => {
      const { tenantId, environment } = request.query;
      const result = await deployWindowService.checkDeployAllowed(tenantId, environment);
      return reply.send(result);
    },
  );

  /**
   * GET /api/v1/deploy-windows/calendar
   * Get calendar view of deploy windows
   */
  fastify.get<{ Querystring: { tenantId: string; start: string; end: string } }>(
    '/deploy-windows/calendar',
    async (request, reply) => {
      const { tenantId, start, end } = request.query;
      try {
        const events = await deployWindowService.getCalendar(
          tenantId,
          new Date(start),
          new Date(end),
        );
        return reply.send(events);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: `Invalid date format: ${message}` });
      }
    },
  );

  // ==================== Emergency Deployment Routes ====================

  /**
   * POST /api/v1/deploy-emergencies
   * Request an emergency deployment
   */
  fastify.post<{ Body: {
    tenantId: string;
    deploymentId: string;
    reason: string;
    requestedBy: string;
  } }>(
    '/deploy-emergencies',
    async (request, reply) => {
      try {
        const emergency = await deployWindowService.requestEmergency({
          tenantId: request.body.tenantId,
          deploymentId: request.body.deploymentId,
          reason: request.body.reason,
          requestedBy: request.body.requestedBy,
        });
        return reply.code(201).send(emergency);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.code(400).send({ error: message });
      }
    },
  );

  /**
   * GET /api/v1/deploy-emergencies
   * List emergency requests for a tenant
   */
  fastify.get<{ Querystring: { tenantId: string; status?: 'pending' | 'approved' | 'rejected' } }>(
    '/deploy-emergencies',
    async (request, reply) => {
      const { tenantId, status } = request.query;
      const emergencies = await deployWindowService.listEmergencies(tenantId, status);
      return reply.send(emergencies);
    },
  );

  /**
   * GET /api/v1/deploy-emergencies/:id
   * Get a single emergency request
   */
  fastify.get<{ Params: { id: string } }>(
    '/deploy-emergencies/:id',
    async (request, reply) => {
      const { id } = request.params;
      const emergency = await deployWindowService.getEmergency(id);
      if (!emergency) {
        return reply.code(404).send({ error: 'Emergency request not found' });
      }
      return reply.send(emergency);
    },
  );

  /**
   * POST /api/v1/deploy-emergencies/:id/approve
   * Approve an emergency deployment
   */
  fastify.post<{ Params: { id: string }; Body: { approvedBy: string; note?: string } }>(
    '/deploy-emergencies/:id/approve',
    async (request, reply) => {
      const { id } = request.params;
      const result = await deployWindowService.approveEmergency(id, request.body.approvedBy, request.body.note);
      if (!result) {
        return reply.code(404).send({ error: 'Emergency request not found or already resolved' });
      }
      return reply.send(result);
    },
  );

  /**
   * POST /api/v1/deploy-emergencies/:id/reject
   * Reject an emergency deployment
   */
  fastify.post<{ Params: { id: string }; Body: { rejectedBy: string; note?: string } }>(
    '/deploy-emergencies/:id/reject',
    async (request, reply) => {
      const { id } = request.params;
      const result = await deployWindowService.rejectEmergency(id, request.body.rejectedBy, request.body.note);
      if (!result) {
        return reply.code(404).send({ error: 'Emergency request not found or already resolved' });
      }
      return reply.send(result);
    },
  );
}