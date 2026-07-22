import { type FastifyInstance } from 'fastify';
import { MonitoringService } from '../services/MonitoringService';

export function registerMonitoringRoutes(fastify: FastifyInstance, monitoringService: MonitoringService): void {
  fastify.post('/api/v1/monitoring/rules', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const rule = await monitoringService.createRule(tenantId, projectId, userId, {
      name: body.name as string,
      description: body.description as string | undefined,
      ruleType: body.ruleType as any,
      metricName: body.metricName as string,
      metricType: body.metricType as any,
      aggregation: body.aggregation as any,
      threshold: body.threshold as number,
      comparison: body.comparison as any,
      duration: body.duration as number | undefined,
      labels: body.labels as Record<string, string> | undefined,
      alertPolicyId: body.alertPolicyId as string | undefined,
    });
    return reply.code(201).send(rule);
  });

  fastify.get('/api/v1/monitoring/rules', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const rules = await monitoringService.listRules(tenantId, projectId);
    return reply.send(rules);
  });

  fastify.get('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.getRule(tenantId, id);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.put('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.updateRule(tenantId, id, request.body as any);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.delete('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const deleted = await monitoringService.deleteRule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Rule not found' });
    return reply.code(204).send();
  });
}
