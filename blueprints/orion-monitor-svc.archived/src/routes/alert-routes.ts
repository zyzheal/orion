import { type FastifyInstance } from 'fastify';
import { AlertService } from '../services/AlertService';

export function registerAlertRoutes(fastify: FastifyInstance, alertService: AlertService): void {
  fastify.get('/api/v1/alerts', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const alerts = await alertService.listAlerts(tenantId, {
      projectId: query.projectId,
      severity: query.severity as any,
      status: query.status as any,
    });
    return reply.send(alerts);
  });

  fastify.post('/api/v1/alerts/subscribe', async (request, reply) => {
    const userId = (request.headers['x-user-id'] as string) || 'default';
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const sub = await alertService.subscribe(userId, tenantId, request.body as any);
    return reply.code(201).send(sub);
  });

  fastify.post('/api/v1/alerts/:id/resolve', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const alert = await alertService.resolveAlert(tenantId, id);
    if (!alert) return reply.code(404).send({ error: 'Alert not found' });
    return reply.send(alert);
  });

  // Ingest alert from monitoring engine
  fastify.post('/api/v1/alerts/ingest', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const alert = await alertService.createAlert(tenantId, projectId, 'system', {
      ruleId: (body.ruleId as string) || 'manual',
      ruleName: (body.ruleName as string) || 'Manual Alert',
      severity: (body.severity as any) || 'high',
      currentValue: (body.currentValue as number) || 0,
      threshold: (body.threshold as number) || 0,
      message: (body.message as string) || 'Alert ingested',
    });
    await alertService.notifySubscribers(alert);
    return reply.code(201).send(alert);
  });
}
