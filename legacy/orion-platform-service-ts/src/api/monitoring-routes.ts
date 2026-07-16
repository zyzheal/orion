/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/monitoring/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * TASK-703: Monitoring & Alerting API Routes
 *
 * Routes under /api/v1/monitoring
 * Handles metrics, alert rules, alerts, notification channels, escalation policies, and dashboard
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { MonitoringController } from './controllers/monitoring/MonitoringController';
import { MonitoringService } from '../services/monitoring';

export default async function monitoringRoutes(app: FastifyInstance): Promise<void> {
  // Initialize service and controller
  const monitoringService = new MonitoringService();
  const controller = new MonitoringController(monitoringService);

  // ==================== Service Control ====================

  app.post('/monitoring/start', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startService(request, reply);
  });

  app.post('/monitoring/stop', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopService(request, reply);
  });

  app.get('/monitoring/health', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // ==================== Metrics ====================

  app.post('/monitoring/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.recordMetric(request, reply);
  });

  app.post('/monitoring/metrics/register', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerMetric(request, reply);
  });

  app.get('/monitoring/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRegisteredMetrics(request, reply);
  });

  app.get('/monitoring/metrics/:name/series', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetricSeries(request, reply);
  });

  app.get('/monitoring/metrics/:name/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetricSummary(request, reply);
  });

  // ==================== Alert Rules ====================

  app.post('/monitoring/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRule(request, reply);
  });

  app.get('/monitoring/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRules(request, reply);
  });

  app.get('/monitoring/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRule(request, reply);
  });

  app.put('/monitoring/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateRule(request, reply);
  });

  app.delete('/monitoring/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteRule(request, reply);
  });

  app.patch('/monitoring/rules/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleRule(request, reply);
  });

  app.post('/monitoring/rules/:id/suppress', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.suppressRule(request, reply);
  });

  app.post('/monitoring/rules/:id/unsuppress', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.unsuppressRule(request, reply);
  });

  app.post('/monitoring/rules/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.evaluateRules(request, reply);
  });

  // ==================== Alerts ====================

  app.get('/monitoring/alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlerts(request, reply);
  });

  app.get('/monitoring/alerts/active', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getActiveAlerts(request, reply);
  });

  app.get('/monitoring/alerts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlert(request, reply);
  });

  app.post('/monitoring/alerts/:id/acknowledge', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.acknowledgeAlert(request, reply);
  });

  app.post('/monitoring/alerts/:id/resolve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.resolveAlert(request, reply);
  });

  app.post('/monitoring/alerts/:id/escalate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.escalateAlert(request, reply);
  });

  // ==================== Notification Channels ====================

  app.post('/monitoring/channels', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createChannel(request, reply);
  });

  app.get('/monitoring/channels', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getChannels(request, reply);
  });

  app.patch('/monitoring/channels/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.toggleChannel(request, reply);
  });

  // ==================== Escalation Policies ====================

  app.post('/monitoring/escalation', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createEscalationPolicy(request, reply);
  });

  app.get('/monitoring/escalation', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEscalationPolicies(request, reply);
  });

  // ==================== Notification History ====================

  app.get('/monitoring/notifications', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getNotificationHistory(request, reply);
  });

  // ==================== Dashboard ====================

  app.get('/monitoring/dashboard', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDashboard(request, reply);
  });

  app.post('/monitoring/dashboard/widgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addWidgetConfig(request, reply);
  });

  app.get('/monitoring/dashboard/widgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWidgetConfigs(request, reply);
  });

  app.get('/monitoring/dashboard/aggregated', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAggregatedMetrics(request, reply);
  });

  // ==================== Anomalies ====================

  app.get('/monitoring/anomalies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectAnomalies(request, reply);
  });

  app.get('/monitoring/anomalies/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAnomalySummary(request, reply);
  });

  app.post('/monitoring/collect', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.collectSystemMetrics(request, reply);
  });
}