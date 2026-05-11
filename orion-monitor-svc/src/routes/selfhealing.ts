import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SelfHealingService } from '../services/SelfHealingService.js';
import type { CreatePolicyInput, ExecutionStatus } from '../types/monitor.js';

export async function selfHealingRoutes(
  fastify: FastifyInstance,
  opts: { selfHealingService: SelfHealingService },
): Promise<void> {
  const { selfHealingService } = opts;

  // Create self-healing policy
  fastify.post<{ Body: CreatePolicyInput }>(
    '/api/v1/self-healing/policies',
    async (
      request: FastifyRequest<{ Body: CreatePolicyInput }>,
      reply: FastifyReply,
    ) => {
      const tenantId = request.headers['x-tenant-id'] as string;
      const projectId = request.headers['x-project-id'] as string;
      const userId = request.headers['x-user-id'] as string;

      if (!tenantId || !projectId) {
        return reply.code(400).send({
          error: 'Missing x-tenant-id or x-project-id header',
        });
      }

      const policy = await selfHealingService.createPolicy(
        tenantId,
        projectId,
        userId ?? 'anonymous',
        request.body,
      );

      return reply.code(201).send(policy);
    },
  );

  // List policies
  fastify.get('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const projectId = request.query['projectId'] as string | undefined;

    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing x-tenant-id header' });
    }

    const policies = await selfHealingService.listPolicies(tenantId, projectId);
    return reply.send(policies);
  });

  // List healing runs
  fastify.get('/api/v1/self-healing/runs', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const query = request.query as Record<string, string | undefined>;

    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing x-tenant-id header' });
    }

    const runs = await selfHealingService.listRuns(tenantId, {
      projectId: query.projectId,
      policyId: query.policyId,
      status: query.status as ExecutionStatus | undefined,
    });

    return reply.send(runs);
  });

  // Trigger healing manually
  fastify.post<{ Body: { alertId: string } }>(
    '/api/v1/self-healing/trigger',
    async (request, reply) => {
      const tenantId = request.headers['x-tenant-id'] as string;
      const { alertId } = request.body;
      const policyId = request.query['policyId'] as string;

      if (!tenantId || !alertId || !policyId) {
        return reply.code(400).send({
          error: 'Missing x-tenant-id header, alertId, or policyId',
        });
      }

      const run = await selfHealingService.triggerHealing(
        tenantId,
        policyId,
        alertId,
      );

      if (!run) {
        return reply
          .code(400)
          .send({ error: 'Policy not found or disabled' });
      }

      return reply.code(202).send(run);
    },
  );
}
