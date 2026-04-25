/**
 * TASK-703: Monitoring & Alerting API Routes
 *
 * Provides endpoints for metrics collection, alert management,
 * notification channels, escalation policies, and dashboard data.
 * Registered under /api/v1/monitoring prefix.
 *
 * Supports both database-backed (PostgreSQL) and in-memory modes.
 * When database pool is provided, uses MonitoringRepository for persistence.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MonitoringController } from './controllers/monitoring/MonitoringController';
import { MonitoringService } from '../services/monitoring';
import { MonitoringRepository } from '../services/monitoring/MonitoringRepository';
import { DatabasePool } from '../services/database';

interface MonitoringRoutesOptions {
  database?: DatabasePool;
  monitoringService?: MonitoringService;
}

export default async function monitoringRoutes(
  app: FastifyInstance,
  options: MonitoringRoutesOptions = {}
): Promise<void> {
  // Initialize service with database repository if available
  let service: MonitoringService;
  if (options.monitoringService) {
    service = options.monitoringService;
  } else if (options.database) {
    const repository = new MonitoringRepository(options.database);
    service = new MonitoringService(repository);
  } else {
    service = new MonitoringService();
  }

  const controller = new MonitoringController(service);

  // Error handler helper
  function handleError(error: unknown, reply: FastifyReply, defaultCode = 500) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return reply.status(defaultCode).send({ error: 'INTERNAL_ERROR', message });
  }

  // ==================== Service Control ====================

  // POST /start - Start monitoring service
  app.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startService(request, reply);
  });

  // POST /stop - Stop monitoring service
  app.post('/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopService(request, reply);
  });

  // GET /health - Health check
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // POST /collect - Collect system metrics manually
  app.post('/collect', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.collectSystemMetrics(request, reply);
  });

  // ==================== Metrics ====================

  // GET /metrics - Get registered metrics
  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRegisteredMetrics(request, reply);
  });

  // POST /metrics - Record a metric
  app.post('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordMetric(request, reply);
  });

  // POST /metrics/register - Register a custom metric
  app.post('/metrics/register', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerMetric(request, reply);
  });

  // GET /metrics/:name/series - Get metric time-series data
  app.get('/metrics/:name/series', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetricSeries(request, reply);
  });

  // GET /metrics/:name/summary - Get metric summary
  app.get('/metrics/:name/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetricSummary(request, reply);
  });

  // ==================== Alert Rules ====================

  // POST /rules - Create alert rule
  app.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRule(request, reply);
  });

  // GET /rules - Get all rules
  app.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRules(request, reply);
  });

  // GET /rules/:id - Get a rule
  app.get('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRule(request, reply);
  });

  // PUT /rules/:id - Update a rule
  app.put('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateRule(request, reply);
  });

  // DELETE /rules/:id - Delete a rule
  app.delete('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteRule(request, reply);
  });

  // PATCH /rules/:id/toggle - Toggle rule
  app.patch('/rules/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleRule(request, reply);
  });

  // POST /rules/:id/suppress - Suppress a rule
  app.post('/rules/:id/suppress', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.suppressRule(request, reply);
  });

  // POST /rules/:id/unsuppress - Unsuppress a rule
  app.post('/rules/:id/unsuppress', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.unsuppressRule(request, reply);
  });

  // POST /rules/evaluate - Evaluate rules manually
  app.post('/rules/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateRules(request, reply);
  });

  // ==================== Alerts ====================

  // GET /alerts - Get all alerts
  app.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlerts(request, reply);
  });

  // GET /alerts/active - Get active alerts
  app.get('/alerts/active', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getActiveAlerts(request, reply);
  });

  // GET /alerts/:id - Get an alert
  app.get('/alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlert(request, reply);
  });

  // POST /alerts/:id/acknowledge - Acknowledge an alert
  app.post('/alerts/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.acknowledgeAlert(request, reply);
  });

  // POST /alerts/:id/resolve - Resolve an alert
  app.post('/alerts/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resolveAlert(request, reply);
  });

  // POST /alerts/:id/escalate - Start escalation for an alert
  app.post('/alerts/:id/escalate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.escalateAlert(request, reply);
  });

  // ==================== Notification Channels ====================

  // POST /channels - Create notification channel
  app.post('/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createChannel(request, reply);
  });

  // GET /channels - Get all channels
  app.get('/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getChannels(request, reply);
  });

  // PATCH /channels/:id/toggle - Toggle channel
  app.patch('/channels/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleChannel(request, reply);
  });

  // ==================== Escalation Policies ====================

  // POST /escalation - Create escalation policy
  app.post('/escalation', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createEscalationPolicy(request, reply);
  });

  // GET /escalation - Get all escalation policies
  app.get('/escalation', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEscalationPolicies(request, reply);
  });

  // ==================== Notification History ====================

  // GET /notifications - Get notification history
  app.get('/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNotificationHistory(request, reply);
  });

  // ==================== Dashboard ====================

  // GET /dashboard - Get dashboard data
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboard(request, reply);
  });

  // POST /dashboard/widgets - Add widget configuration
  app.post('/dashboard/widgets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addWidgetConfig(request, reply);
  });

  // GET /dashboard/widgets - Get widget configurations
  app.get('/dashboard/widgets', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWidgetConfigs(request, reply);
  });

  // GET /dashboard/aggregated - Get aggregated metrics
  app.get('/dashboard/aggregated', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAggregatedMetrics(request, reply);
  });

  // ==================== Anomalies ====================

  // GET /anomalies - Detect anomalies for a metric
  app.get('/anomalies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectAnomalies(request, reply);
  });

  // GET /anomalies/summary - Get anomaly summary
  app.get('/anomalies/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAnomalySummary(request, reply);
  });
}
