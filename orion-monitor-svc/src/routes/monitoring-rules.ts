import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { MonitoringService } from '../services/MonitoringService.js';
import type { CreateRuleInput } from '../types/monitor.js';

export async function monitoringRulesRoutes(
  fastify: FastifyInstance,
  opts: { monitoringService: MonitoringService },
): Promise<void> {
  const { monitoringService } = opts;

  // Create monitoring rule
  fastify.post<{ Body: CreateRuleInput }>(
    '/api/v1/monitoring/rules',
    async (
      request: FastifyRequest<{ Body: CreateRuleInput }>,
      reply: FastifyReply,
    ) => {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const projectId = (request.headers['x-project-id'] as string) || 'default';
      const userId = (request.headers['x-user-id'] as string) || 'system';
      const rule = await monitoringService.createRule(tenantId, projectId, userId, request.body);
      return reply.code(201).send(rule);
    },
  );

  // List monitoring rules
  fastify.get('/api/v1/monitoring/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const rules = await monitoringService.listRules(tenantId, projectId);
    return reply.send(rules);
  });

  // Get a single rule
  fastify.get('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.getRule(tenantId, id);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  // Update a rule
  fastify.put('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.updateRule(tenantId, id, request.body as Partial<CreateRuleInput>);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  // Delete a rule
  fastify.delete('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const deleted = await monitoringService.deleteRule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Rule not found' });
    return reply.code(204).send();
  });
}
