import { type FastifyInstance } from 'fastify';
import { SelfHealingService } from '../services/SelfHealingService';

export function registerSelfHealingRoutes(fastify: FastifyInstance, selfHealingService: SelfHealingService): void {
  fastify.post('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const policy = await selfHealingService.createPolicy(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(policy);
  });

  fastify.get('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const policies = await selfHealingService.listPolicies(tenantId, projectId);
    return reply.send(policies);
  });

  fastify.get('/api/v1/self-healing/runs', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const runs = await selfHealingService.listRuns(tenantId, {
      projectId: query.projectId,
      policyId: query.policyId,
      status: query.status as any,
    });
    return reply.send(runs);
  });

  fastify.post('/api/v1/self-healing/trigger', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const body = request.body as Record<string, unknown>;
    const query = request.query as Record<string, string | undefined>;
    const policyId = query.policyId;
    const alertId = body.alertId as string;
    if (!alertId || !policyId) return reply.code(400).send({ error: 'Missing alertId or policyId' });
    const run = await selfHealingService.triggerHealing(tenantId, policyId, alertId);
    if (!run) return reply.code(400).send({ error: 'Policy not found or disabled' });
    return reply.code(202).send(run);
  });
}
