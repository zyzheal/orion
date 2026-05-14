import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { DeploymentWorkflow } from '../services/DeploymentWorkflow';
import { EnvironmentService } from '../services/EnvironmentService';

export async function deployRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  const workflow = new DeploymentWorkflow();
  const envService = new EnvironmentService();

  // ==================== Environment Routes ====================

  fastify.get('/environments', async (request, reply) => {
    const query = request.query as { tenantId?: string };
    const result = await envService.listEnvironments(query.tenantId);
    return reply.send(result);
  });

  fastify.get('/environments/:id', async (request, reply) => {
    const id = (request.params as any).id;
    const env = await envService.getEnvironment(id);
    if (!env) {
      return reply.code(404).send({ error: 'Environment not found' });
    }
    return reply.send(env);
  });

  fastify.post('/environments', async (request, reply) => {
    const body = request.body as any;
    try {
      const env = await envService.createEnvironment({
        name: body.name,
        type: body.type,
        tenantId: body.tenantId,
        clusterUrl: body.clusterUrl,
        namespace: body.namespace,
        isActive: body.isActive ?? true,
        config: body.config || {},
      });
      return reply.code(201).send(env);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.post('/environments/:id/config', async (request, reply) => {
    const id = (request.params as any).id;
    const body = request.body as any;
    try {
      const updated = await envService.updateConfig(id, {
        config: body.config,
        clusterUrl: body.clusterUrl,
        namespace: body.namespace,
      });
      return reply.send(updated);
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  fastify.post('/environments/:id/deactivate', async (request, reply) => {
    const id = (request.params as any).id;
    try {
      await envService.deactivateEnvironment(id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  // ==================== Deploy Routes ====================

  fastify.get('/deploy', async (request, reply) => {
    const query = request.query as { pipelineId?: string; status?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const deployments = await workflow.listDeployments({
      pipelineId: query.pipelineId,
      status: query.status as any,
      limit,
    });
    return reply.send(deployments);
  });

  fastify.post('/deploy', async (request, reply) => {
    const body = request.body as any;
    try {
      const deployment = await workflow.executeDeploy({
        pipelineId: body.pipelineId,
        runId: body.runId,
        environment: body.environment,
        strategy: body.strategy || 'direct',
        triggeredBy: body.triggeredBy || 'api',
        tenantId: body.tenantId,
        envOverrides: body.envOverrides,
      });
      return reply.code(201).send(deployment);
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Deploy failed');
      return reply.code(400).send({ error: error.message });
    }
  });

  fastify.get('/deploy/:id', async (request, reply) => {
    const id = (request.params as any).id;
    const deployment = await workflow.getDeployment(id);
    if (!deployment) {
      return reply.code(404).send({ error: 'Deployment not found' });
    }
    return reply.send(deployment);
  });

  fastify.post('/deploy/:id/rollback', async (request, reply) => {
    const id = (request.params as any).id;
    const body = request.body as any;
    try {
      const result = await workflow.rollbackDeployment(id, {
        reason: body.reason,
        triggeredBy: body.triggeredBy,
      });
      return reply.send(result);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });
}
