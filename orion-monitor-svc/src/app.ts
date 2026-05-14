import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { errorHandler } from './middleware/errorHandler';
import { MonitoringService } from './services/MonitoringService';
import { AlertService } from './services/AlertService';
import { SelfHealingService } from './services/SelfHealingService';
import { OnCallService } from './services/OnCallService';

async function buildApp() {
  const fastify = Fastify({ logger: { level: 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  // Initialize services
  const monitoringService = new MonitoringService();
  const alertService = new AlertService();
  const selfHealingService = new SelfHealingService();
  const oncallService = new OnCallService();

  // ==================== Monitoring Routes ====================

  fastify.post('/api/v1/monitoring/rules', async (request: FastifyRequest, reply: FastifyReply) => {
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

  fastify.get('/api/v1/monitoring/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const rules = await monitoringService.listRules(tenantId, projectId);
    return reply.send(rules);
  });

  fastify.get('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.getRule(tenantId, id);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.put('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const rule = await monitoringService.updateRule(tenantId, id, request.body as any);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.delete('/api/v1/monitoring/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const deleted = await monitoringService.deleteRule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Rule not found' });
    return reply.code(204).send();
  });

  // ==================== Alert Routes ====================

  fastify.get('/api/v1/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const alerts = await alertService.listAlerts(tenantId, {
      projectId: query.projectId,
      severity: query.severity as any,
      status: query.status as any,
    });
    return reply.send(alerts);
  });

  fastify.post('/api/v1/alerts/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.headers['x-user-id'] as string) || 'default';
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const sub = await alertService.subscribe(userId, tenantId, request.body as any);
    return reply.code(201).send(sub);
  });

  fastify.post('/api/v1/alerts/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const alert = await alertService.resolveAlert(tenantId, id);
    if (!alert) return reply.code(404).send({ error: 'Alert not found' });
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

  // ==================== Self-Healing Routes ====================

  fastify.post('/api/v1/self-healing/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const policy = await selfHealingService.createPolicy(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(policy);
  });

  fastify.get('/api/v1/self-healing/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const policies = await selfHealingService.listPolicies(tenantId, projectId);
    return reply.send(policies);
  });

  fastify.get('/api/v1/self-healing/runs', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const runs = await selfHealingService.listRuns(tenantId, {
      projectId: query.projectId,
      policyId: query.policyId,
      status: query.status as any,
    });
    return reply.send(runs);
  });

  fastify.post('/api/v1/self-healing/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
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

  // ==================== On-Call Routes ====================

  fastify.post('/api/v1/oncall/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const schedule = await oncallService.createSchedule(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(schedule);
  });

  fastify.get('/api/v1/oncall/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const schedules = await oncallService.listSchedules(tenantId, projectId);
    return reply.send(schedules);
  });

  fastify.get('/api/v1/oncall/current', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;
    const duties = await oncallService.getCurrentOnCall(tenantId, projectId);
    return reply.send(duties);
  });

  fastify.put('/api/v1/oncall/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const schedule = await oncallService.updateSchedule(tenantId, id, request.body as any);
    if (!schedule) return reply.code(404).send({ error: 'Schedule not found' });
    return reply.send(schedule);
  });

  fastify.delete('/api/v1/oncall/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };
    const deleted = await oncallService.deleteSchedule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Schedule not found' });
    return reply.code(204).send();
  });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  return { fastify };
}
async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3005', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Monitor Service listening on http://0.0.0.0:${port}`);
}
if (process.argv[1] === new URL('', import.meta.url).pathname) { main(); }
export { buildApp };
