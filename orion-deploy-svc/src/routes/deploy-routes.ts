import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyPluginOptions } from 'fastify';
import { EnvironmentType } from '../types/deploy';
import { DeploymentWorkflow } from '../services/DeploymentWorkflow';
import { EnvironmentService } from '../services/EnvironmentService';
import { RollbackService } from '../services/RollbackService';
import { DeploymentHistoryService } from '../services/DeploymentHistoryService';
import { ReleaseNotesService } from '../services/ReleaseNotesService';

/**
 * Deploy Routes
 * All deployment-related API endpoints
 */
export async function deployRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const workflow = new DeploymentWorkflow();
  const envService = new EnvironmentService();
  const rollbackService = new RollbackService();
  const historyService = new DeploymentHistoryService();
  const releaseNotesService = new ReleaseNotesService();

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
}