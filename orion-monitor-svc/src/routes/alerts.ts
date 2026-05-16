import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AlertService } from '../services/AlertService.js';
import type { SubscribeAlertInput, Severity, Status } from '../types/monitor.js';

export async function alertsRoutes(
  fastify: FastifyInstance,
  opts: { alertService: AlertService },
): Promise<void> {
  const { alertService } = opts;

  // Subscribe to alerts
  fastify.post<{ Body: SubscribeAlertInput }>(
    '/api/v1/alerts/subscribe',
    async (
      request: FastifyRequest<{ Body: SubscribeAlertInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.headers['x-user-id'] as string;
      const tenantId = request.headers['x-tenant-id'] as string;

      if (!userId || !tenantId) {
        return reply.code(400).send({
          error: 'Missing x-user-id or x-tenant-id header',
        });
      }

      const sub = await alertService.subscribe(tenantId, userId, request.body);
      return reply.code(201).send(sub);
    },
  );

  // List alerts
  fastify.get('/api/v1/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const query = request.query as Record<string, string | undefined>;

    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing x-tenant-id header' });
    }

    const alerts = await alertService.listAlerts(tenantId, {
      projectId: query.projectId,
      severity: query.severity as Severity | undefined,
      status: query.status as Status | undefined,
    });

    return reply.send(alerts);
  });

  // Resolve alert
  fastify.post('/api/v1/alerts/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const { id } = request.params as { id: string };

    const alert = await alertService.resolveAlert(tenantId, id);
    if (!alert) {
      return reply.code(404).send({ error: 'Alert not found' });
    }
    return reply.send(alert);
  });

  // Ingest alert from monitoring engine
  fastify.post('/api/v1/alerts/ingest', async (request: FastifyRequest, reply: FastifyReply) => {
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
