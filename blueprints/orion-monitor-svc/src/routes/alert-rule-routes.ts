/**
 * Alert Rule Routes — REST API for custom alert rule management.
 *
 * Endpoints:
 *   POST   /api/v1/alerts/rules          Create a rule
 *   GET    /api/v1/alerts/rules           List rules (?tenantId=xxx&enabled=true)
 *   GET    /api/v1/alerts/rules/:id       Get a rule
 *   PATCH  /api/v1/alerts/rules/:id       Update a rule
 *   DELETE /api/v1/alerts/rules/:id       Delete a rule
 *   POST   /api/v1/alerts/rules/evaluate  Evaluate metric samples against rules
 */

import { type FastifyInstance } from 'fastify';
import { AlertRuleService, type MetricSample } from '../services/AlertRuleService.js';

export function registerAlertRuleRoutes(
  fastify: FastifyInstance,
  service: AlertRuleService,
): void {
  // POST /api/v1/alerts/rules — Create a new alert rule
  fastify.post('/api/v1/alerts/rules', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const tenantId = (body.tenantId as string) ?? (request.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return reply.code(400).send({ error: 'tenantId is required' });
    }

    const metric = body.metric as string;
    if (!metric) {
      return reply.code(400).send({ error: 'metric is required' });
    }

    const condition = body.condition as AlertRuleService extends { createRule: (input: { condition: infer C }) => unknown } ? C : string;
    if (!['gt', 'lt', 'eq', 'gte', 'lte', 'between', 'anomaly'].includes(condition as string)) {
      return reply.code(400).send({ error: 'Invalid condition. Must be one of: gt, lt, eq, gte, lte, between, anomaly' });
    }

    const threshold = body.threshold as number;
    if (threshold === undefined || threshold === null) {
      return reply.code(400).send({ error: 'threshold is required' });
    }

    const rule = await service.createRule({
      tenantId,
      name: (body.name as string) ?? 'Untitled Rule',
      description: (body.description as string) ?? '',
      metric,
      condition: condition as 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between' | 'anomaly',
      threshold,
      thresholdMax: body.thresholdMax as number | undefined,
      duration: (body.duration as number) ?? 60,
      severity: (body.severity as 'critical' | 'warning' | 'info') ?? 'warning',
      enabled: (body.enabled as boolean) ?? true,
      labels: (body.labels as Record<string, string>) ?? {},
      annotations: (body.annotations as Record<string, string>) ?? {},
    });

    return reply.code(201).send(rule);
  });

  // GET /api/v1/alerts/rules — List rules
  fastify.get('/api/v1/alerts/rules', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const tenantId = query.tenantId ?? (request.headers['x-tenant-id'] as string);

    if (!tenantId) {
      return reply.code(400).send({ error: 'tenantId query parameter is required' });
    }

    const enabledOnly = query.enabled === 'true';
    const rules = await service.listRules(tenantId, enabledOnly);
    return reply.send(rules);
  });

  // GET /api/v1/alerts/rules/:id — Get a rule
  fastify.get('/api/v1/alerts/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await service.getRule(id);
    if (!rule) {
      return reply.code(404).send({ error: 'Rule not found' });
    }
    return reply.send(rule);
  });

  // PATCH /api/v1/alerts/rules/:id — Update a rule
  fastify.patch('/api/v1/alerts/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    const allowedFields = ['name', 'description', 'metric', 'condition', 'threshold', 'thresholdMax', 'duration', 'severity', 'enabled', 'labels', 'annotations'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }

    const rule = await service.updateRule(id, updates);
    if (!rule) {
      return reply.code(404).send({ error: 'Rule not found' });
    }
    return reply.send(rule);
  });

  // DELETE /api/v1/alerts/rules/:id — Delete a rule
  fastify.delete('/api/v1/alerts/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await service.deleteRule(id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Rule not found' });
    }
    return reply.code(204).send();
  });

  // POST /api/v1/alerts/rules/evaluate — Evaluate metric samples
  fastify.post('/api/v1/alerts/rules/evaluate', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const tenantId = (body.tenantId as string) ?? (request.headers['x-tenant-id'] as string);

    if (!tenantId) {
      return reply.code(400).send({ error: 'tenantId is required' });
    }

    const samples = (body.samples as Array<Record<string, unknown>>);
    if (!samples || samples.length === 0) {
      return reply.code(400).send({ error: 'samples array is required' });
    }

    const metricSamples: MetricSample[] = samples.map((s) => ({
      metric: s.metric as string,
      value: s.value as number,
      timestamp: s.timestamp ? new Date(s.timestamp as string) : new Date(),
      labels: (s.labels as Record<string, string>) ?? {},
    }));

    const results = await service.evaluateAll(tenantId, metricSamples);
    return reply.send({ tenantId, sampleCount: samples.length, evaluations: results });
  });
}
