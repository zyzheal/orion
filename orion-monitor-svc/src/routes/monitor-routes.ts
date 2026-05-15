/**
 * Monitor Service - API Routes
 *
 * This module provides RESTful API endpoints for monitoring, alerts,
 * self-healing, and on-call scheduling.
 *
 * Usage in app.ts:
 *   import { registerMonitorRoutes } from './routes/monitor-routes.js';
 *   await fastify.register(registerMonitorRoutes);
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { MonitoringService } from '../services/MonitoringService.js';
import { AlertService } from '../services/AlertService.js';
import { SelfHealingService } from '../services/SelfHealingService.js';
import { OnCallService } from '../services/OnCallService.js';
import type { RuleType, MetricType, AggregationType, Severity, Status, ActionType, RotationType, NotificationChannel, ExecutionStatus } from '../types/monitor.js';

// Request/Response type definitions
interface CreateRuleRequest {
  name: string;
  description?: string;
  ruleType: RuleType;
  metricName: string;
  metricType?: MetricType;
  aggregation?: AggregationType;
  threshold: number;
  comparison: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  duration?: number;
  labels?: Record<string, string>;
  alertPolicyId?: string;
}

interface UpdateRuleRequest {
  name?: string;
  description?: string;
  ruleType?: RuleType;
  metricName?: string;
  metricType?: MetricType;
  aggregation?: AggregationType;
  threshold?: number;
  comparison?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  duration?: number;
  labels?: Record<string, string>;
  alertPolicyId?: string;
}

interface RuleQuery {
  projectId?: string;
}

interface ListAlertsQuery {
  projectId?: string;
  severity?: Severity;
  status?: Status;
}

interface SubscribeAlertsRequest {
  channels: NotificationChannel[];
  filters?: {
    severities?: Severity[];
    projectIds?: string[];
  };
  webhookUrl?: string;
}

interface IngestAlertRequest {
  ruleId?: string;
  ruleName?: string;
  severity?: Severity;
  currentValue?: number;
  threshold?: number;
  message?: string;
}

interface CreatePolicyRequest {
  name: string;
  description?: string;
  ruleId: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  cooldownSeconds?: number;
  maxRetries?: number;
  approvalRequired?: boolean;
}

interface ListRunsQuery {
  projectId?: string;
  policyId?: string;
  status?: ExecutionStatus;
}

interface TriggerHealingQuery {
  policyId: string;
}

interface TriggerHealingRequest {
  alertId: string;
}

interface CreateScheduleRequest {
  name: string;
  description?: string;
  rotationType: RotationType;
  rotationStart: string;
  rotationDurationHours?: number;
  layers: Array<{
    id: string;
    name: string;
    escalationLevel: 'L1' | 'L2' | 'L3';
    users: string[];
    restrictions?: Array<{
      startDayOfWeek: number;
      startTime: string;
      endDayOfWeek: number;
      endTime: string;
    }>;
  }>;
  timeZone?: string;
}

interface ListSchedulesQuery {
  projectId?: string;
}

interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  rotationType?: RotationType;
  rotationStart?: string;
  rotationDurationHours?: number;
  layers?: Array<{
    id: string;
    name: string;
    escalationLevel: 'L1' | 'L2' | 'L3';
    users: string[];
    restrictions?: Array<{
      startDayOfWeek: number;
      startTime: string;
      endDayOfWeek: number;
      endTime: string;
    }>;
  }>;
  timeZone?: string;
}

export interface MonitorRoutesOptions {
  monitoringService?: MonitoringService;
  alertService?: AlertService;
  selfHealingService?: SelfHealingService;
  onCallService?: OnCallService;
}

export async function registerMonitorRoutes(
  app: FastifyInstance,
  options: MonitorRoutesOptions = {}
): Promise<void> {
  // Use provided services or create new instances
  const monitoringService = options.monitoringService ?? new MonitoringService();
  const alertService = options.alertService ?? new AlertService();
  const selfHealingService = options.selfHealingService ?? new SelfHealingService();
  const onCallService = options.onCallService ?? new OnCallService();

  // ==================== Health ====================

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'monitor',
  }));

  // ==================== Monitoring Rules ====================

  /**
   * POST /api/v1/monitoring/rules
   * Create a new monitoring rule
   */
  app.post<{ Body: CreateRuleRequest }>('/api/v1/monitoring/rules', async (request: FastifyRequest<{ Body: CreateRuleRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const { name, description, ruleType, metricName, metricType, aggregation, threshold, comparison, duration, labels, alertPolicyId } = request.body;

    const rule = await monitoringService.createRule(tenantId, projectId, userId, {
      name,
      description,
      ruleType,
      metricName,
      metricType,
      aggregation,
      threshold,
      comparison,
      duration,
      labels,
      alertPolicyId,
    });

    return reply.code(201).send({ success: true, data: rule });
  });

  /**
   * GET /api/v1/monitoring/rules
   * List monitoring rules
   */
  app.get<{ Querystring: RuleQuery }>('/api/v1/monitoring/rules', async (request: FastifyRequest<{ Querystring: RuleQuery }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { projectId } = request.query;

    const rules = await monitoringService.listRules(tenantId, projectId);
    return reply.send({ success: true, data: rules });
  });

  /**
   * GET /api/v1/monitoring/rules/:id
   * Get a monitoring rule by ID
   */
  app.get('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };

    const rule = await monitoringService.getRule(tenantId, id);
    if (!rule) {
      return reply.code(404).send({ success: false, error: 'Rule not found' });
    }
    return reply.send({ success: true, data: rule });
  });

  /**
   * PUT /api/v1/monitoring/rules/:id
   * Update a monitoring rule
   */
  app.put<{ Params: { id: string }; Body: UpdateRuleRequest }>('/api/v1/monitoring/rules/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateRuleRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params;
    const { name, description, ruleType, metricName, metricType, aggregation, threshold, comparison, duration, labels, alertPolicyId } = request.body;

    const rule = await monitoringService.updateRule(tenantId, id, {
      name, description, ruleType, metricName, metricType, aggregation, threshold, comparison, duration, labels, alertPolicyId,
    });
    if (!rule) {
      return reply.code(404).send({ success: false, error: 'Rule not found' });
    }
    return reply.send({ success: true, data: rule });
  });

  /**
   * DELETE /api/v1/monitoring/rules/:id
   * Delete a monitoring rule
   */
  app.delete('/api/v1/monitoring/rules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };

    const deleted = await monitoringService.deleteRule(tenantId, id);
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Rule not found' });
    }
    return reply.code(204).send();
  });

  // ==================== Alerts ====================

  /**
   * GET /api/v1/alerts
   * List alerts with filtering
   */
  app.get<{ Querystring: ListAlertsQuery }>('/api/v1/alerts', async (request: FastifyRequest<{ Querystring: ListAlertsQuery }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { projectId, severity, status } = request.query;

    const alerts = await alertService.listAlerts(tenantId, {
      projectId,
      severity,
      status,
    });
    return reply.send({ success: true, data: alerts });
  });

  /**
   * POST /api/v1/alerts/subscribe
   * Subscribe to alerts
   */
  app.post<{ Body: SubscribeAlertsRequest }>('/api/v1/alerts/subscribe', async (request: FastifyRequest<{ Body: SubscribeAlertsRequest }>, reply) => {
    const userId = (request.headers['x-user-id'] as string) || 'default';
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { channels, filters, webhookUrl } = request.body;

    const sub = await alertService.subscribe(userId, tenantId, { channels, filters, webhookUrl });
    return reply.code(201).send({ success: true, data: sub });
  });

  /**
   * POST /api/v1/alerts/:id/resolve
   * Resolve an alert
   */
  app.post('/api/v1/alerts/:id/resolve', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };

    const alert = await alertService.resolveAlert(tenantId, id);
    if (!alert) {
      return reply.code(404).send({ success: false, error: 'Alert not found' });
    }
    return reply.send({ success: true, data: alert });
  });

  /**
   * POST /api/v1/alerts/ingest
   * Ingest alert from monitoring engine
   */
  app.post<{ Body: IngestAlertRequest }>('/api/v1/alerts/ingest', async (request: FastifyRequest<{ Body: IngestAlertRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const { ruleId, ruleName, severity, currentValue, threshold, message } = request.body;

    const alert = await alertService.createAlert(tenantId, projectId, 'system', {
      ruleId: ruleId || 'manual',
      ruleName: ruleName || 'Manual Alert',
      severity: severity || 'error',
      currentValue: currentValue || 0,
      threshold: threshold || 0,
      message: message || 'Alert ingested',
    });

    await alertService.notifySubscribers(alert);
    return reply.code(201).send({ success: true, data: alert });
  });

  // ==================== Self-Healing ====================

  /**
   * POST /api/v1/self-healing/policies
   * Create a self-healing policy
   */
  app.post<{ Body: CreatePolicyRequest }>('/api/v1/self-healing/policies', async (request: FastifyRequest<{ Body: CreatePolicyRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const { name, description, ruleId, actionType, actionConfig, cooldownSeconds, maxRetries, approvalRequired } = request.body;

    const policy = await selfHealingService.createPolicy(
      tenantId,
      projectId,
      userId,
      { name, description, ruleId, actionType, actionConfig, cooldownSeconds, maxRetries, approvalRequired }
    );
    return reply.code(201).send({ success: true, data: policy });
  });

  /**
   * GET /api/v1/self-healing/policies
   * List self-healing policies
   */
  app.get('/api/v1/self-healing/policies', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;

    const policies = await selfHealingService.listPolicies(tenantId, projectId);
    return reply.send({ success: true, data: policies });
  });

  /**
   * GET /api/v1/self-healing/runs
   * List execution runs
   */
  app.get<{ Querystring: ListRunsQuery }>('/api/v1/self-healing/runs', async (request: FastifyRequest<{ Querystring: ListRunsQuery }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { projectId, policyId, status } = request.query;

    const runs = await selfHealingService.listRuns(tenantId, {
      projectId,
      policyId,
      status,
    });
    return reply.send({ success: true, data: runs });
  });

  /**
   * POST /api/v1/self-healing/trigger
   * Trigger self-healing execution
   */
  app.post<{ Querystring: TriggerHealingQuery; Body: TriggerHealingRequest }>('/api/v1/self-healing/trigger', async (request: FastifyRequest<{ Querystring: TriggerHealingQuery; Body: TriggerHealingRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { policyId } = request.query;
    const { alertId } = request.body;

    if (!alertId || !policyId) {
      return reply.code(400).send({ success: false, error: 'Missing alertId or policyId' });
    }

    const run = await selfHealingService.triggerHealing(tenantId, policyId, alertId);
    if (!run) {
      return reply.code(400).send({ success: false, error: 'Policy not found or disabled' });
    }
    return reply.code(202).send({ success: true, data: run });
  });

  // ==================== On-Call ====================

  /**
   * POST /api/v1/oncall/schedules
   * Create an on-call schedule
   */
  app.post<{ Body: CreateScheduleRequest }>('/api/v1/oncall/schedules', async (request: FastifyRequest<{ Body: CreateScheduleRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const projectId = (request.headers['x-project-id'] as string) || 'default';
    const userId = (request.headers['x-user-id'] as string) || 'system';
    const { name, description, rotationType, rotationStart, rotationDurationHours, layers, timeZone } = request.body;

    const schedule = await onCallService.createSchedule(
      tenantId,
      projectId,
      userId,
      { name, description, rotationType, rotationStart, rotationDurationHours, layers, timeZone }
    );
    return reply.code(201).send({ success: true, data: schedule });
  });

  /**
   * GET /api/v1/oncall/schedules
   * List on-call schedules
   */
  app.get<{ Querystring: ListSchedulesQuery }>('/api/v1/oncall/schedules', async (request: FastifyRequest<{ Querystring: ListSchedulesQuery }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { projectId } = request.query;

    const schedules = await onCallService.listSchedules(tenantId, projectId);
    return reply.send({ success: true, data: schedules });
  });

  /**
   * GET /api/v1/oncall/current
   * Get current on-call duty holders
   */
  app.get('/api/v1/oncall/current', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const query = request.query as Record<string, string | undefined>;
    const projectId = query.projectId;

    const duties = await onCallService.getCurrentOnCall(tenantId, projectId);
    return reply.send({ success: true, data: duties });
  });

  /**
   * PUT /api/v1/oncall/schedules/:id
   * Update an on-call schedule
   */
  app.put<{ Params: { id: string }; Body: UpdateScheduleRequest }>('/api/v1/oncall/schedules/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateScheduleRequest }>, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params;
    const { name, description, rotationType, rotationStart, rotationDurationHours, layers, timeZone } = request.body;

    const schedule = await onCallService.updateSchedule(tenantId, id, {
      name, description, rotationType, rotationStart, rotationDurationHours, layers, timeZone,
    });
    if (!schedule) {
      return reply.code(404).send({ success: false, error: 'Schedule not found' });
    }
    return reply.send({ success: true, data: schedule });
  });

  /**
   * DELETE /api/v1/oncall/schedules/:id
   * Delete an on-call schedule
   */
  app.delete('/api/v1/oncall/schedules/:id', async (request, reply) => {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    const { id } = request.params as { id: string };

    const deleted = await onCallService.deleteSchedule(tenantId, id);
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Schedule not found' });
    }
    return reply.code(204).send();
  });
}
