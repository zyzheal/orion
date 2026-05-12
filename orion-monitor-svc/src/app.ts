import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
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

  fastify.post('/api/v1/monitoring/rules', async (request, reply) => {
    const body = request.body as any;
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.headers as any)['x-project-id'] || 'default';
    const userId = (request.headers as any)['x-user-id'] || 'system';
    const rule = await monitoringService.createRule(tenantId, projectId, userId, {
      name: body.name,
      description: body.description,
      ruleType: body.ruleType,
      metricName: body.metricName,
      metricType: body.metricType,
      aggregation: body.aggregation,
      threshold: body.threshold,
      comparison: body.comparison,
      duration: body.duration,
      labels: body.labels,
      alertPolicyId: body.alertPolicyId,
    });
    return reply.code(201).send(rule);
  });

  fastify.get('/api/v1/monitoring/rules', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.query as any)?.projectId;
    const rules = await monitoringService.listRules(tenantId, projectId);
    return reply.send(rules);
  });

  fastify.get('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
    const rule = await monitoringService.getRule(tenantId, id);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.put('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
    const rule = await monitoringService.updateRule(tenantId, id, request.body as any);
    if (!rule) return reply.code(404).send({ error: 'Rule not found' });
    return reply.send(rule);
  });

  fastify.delete('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
    const deleted = await monitoringService.deleteRule(tenantId, id);
    if (!deleted) return reply.code(404).send({ error: 'Rule not found' });
    return reply.code(204).send();
  });

  // ==================== Alert Routes ====================

  fastify.get('/api/v1/alerts', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const query = request.query as any;
    const alerts = await alertService.listAlerts(tenantId, {
      projectId: query.projectId,
      severity: query.severity,
      status: query.status,
    });
    return reply.send(alerts);
  });

  fastify.post('/api/v1/alerts/subscribe', async (request, reply) => {
    const userId = (request.headers as any)['x-user-id'] || 'default';
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const sub = await alertService.subscribe(userId, tenantId, request.body as any);
    return reply.code(201).send(sub);
  });

  fastify.post('/api/v1/alerts/:id/resolve', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
    const alert = await alertService.resolveAlert(tenantId, id);
    if (!alert) return reply.code(404).send({ error: 'Alert not found' });
    return reply.send(alert);
  });

  // Ingest alert from monitoring engine
  fastify.post('/api/v1/alerts/ingest', async (request, reply) => {
    const body = request.body as any;
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.headers as any)['x-project-id'] || 'default';
    const alert = await alertService.createAlert(tenantId, projectId, 'system', {
      ruleId: body.ruleId || 'manual',
      ruleName: body.ruleName || 'Manual Alert',
      severity: body.severity || 'high',
      currentValue: body.currentValue || 0,
      threshold: body.threshold || 0,
      message: body.message || 'Alert ingested',
    });
    await alertService.notifySubscribers(alert);
    return reply.code(201).send(alert);
  });

  // ==================== Self-Healing Routes ====================

  fastify.post('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.headers as any)['x-project-id'] || 'default';
    const userId = (request.headers as any)['x-user-id'] || 'system';
    const policy = await selfHealingService.createPolicy(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(policy);
  });

  fastify.get('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.query as any)?.projectId;
    const policies = await selfHealingService.listPolicies(tenantId, projectId);
    return reply.send(policies);
  });

  fastify.get('/api/v1/self-healing/runs', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const query = request.query as any;
    const runs = await selfHealingService.listRuns(tenantId, {
      projectId: query.projectId,
      policyId: query.policyId,
      status: query.status,
    });
    return reply.send(runs);
  });

  fastify.post('/api/v1/self-healing/trigger', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const body = request.body as any;
    const policyId = (request.query as any)?.policyId;
    if (!body.alertId || !policyId) return reply.code(400).send({ error: 'Missing alertId or policyId' });
    const run = await selfHealingService.triggerHealing(tenantId, policyId, body.alertId);
    if (!run) return reply.code(400).send({ error: 'Policy not found or disabled' });
    return reply.code(202).send(run);
  });

  // ==================== On-Call Routes ====================

  fastify.post('/api/v1/oncall/schedules', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.headers as any)['x-project-id'] || 'default';
    const userId = (request.headers as any)['x-user-id'] || 'system';
    const schedule = await oncallService.createSchedule(tenantId, projectId, userId, request.body as any);
    return reply.code(201).send(schedule);
  });

  fastify.get('/api/v1/oncall/schedules', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.query as any)?.projectId;
    const schedules = await oncallService.listSchedules(tenantId, projectId);
    return reply.send(schedules);
  });

  fastify.get('/api/v1/oncall/current', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const projectId = (request.query as any)?.projectId;
    const duties = await oncallService.getCurrentOnCall(tenantId, projectId);
    return reply.send(duties);
  });

  fastify.put('/api/v1/oncall/schedules/:id', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
    const schedule = await oncallService.updateSchedule(tenantId, id, request.body as any);
    if (!schedule) return reply.code(404).send({ error: 'Schedule not found' });
    return reply.send(schedule);
  });

  fastify.delete('/api/v1/oncall/schedules/:id', async (request, reply) => {
    const tenantId = (request.headers as any)['x-tenant-id'] || 'default';
    const id = (request.params as any).id;
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
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
