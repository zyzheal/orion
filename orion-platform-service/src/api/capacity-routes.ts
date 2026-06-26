/**
 * Capacity Planning API Routes (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CapacityService } from '../services/capacity/CapacityService';
import { DatabasePool } from '../services/database';

interface CapacityRoutesOptions {
  database?: DatabasePool;
}

export default async function capacityRoutes(
  app: FastifyInstance,
  options: CapacityRoutesOptions = {}
): Promise<void> {
  const capacityService = new CapacityService(options.database!);
  // Metrics
  app.post('/capacity/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const metric = await capacityService.recordMetric(body, tenantId);
    return reply.status(201).send({ success: true, data: metric });
  });

  app.get('/capacity/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const metricList = await capacityService.listMetrics(tenantId, { resourceType: query.resourceType, metricName: query.metricName });
    return reply.send({ success: true, data: metricList });
  });

  // Forecast
  app.post('/capacity/forecast', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const forecastList = await capacityService.generateForecast(tenantId);
    return reply.send({ success: true, data: forecastList });
  });

  app.get('/capacity/forecast', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const forecastList = await capacityService.listForecasts(tenantId, { resourceType: query.resourceType });
    return reply.send({ success: true, data: forecastList });
  });

  // Alerts
  app.get('/capacity/alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const alertList = await capacityService.listAlerts(tenantId, { severity: query.severity });
    return reply.send({ success: true, data: alertList });
  });

  app.delete('/capacity/alerts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await capacityService.deleteAlert(params.id);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Alert not found' });
    return reply.send({ success: true, message: 'Alert deleted' });
  });

  // Reports
  app.post('/capacity/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const report = await capacityService.generateReport(body.title || '容量规划报告', tenantId);
    return reply.status(201).send({ success: true, data: report });
  });

  app.get('/capacity/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const reportList = await capacityService.listReports(tenantId);
    return reply.send({ success: true, data: reportList });
  });

  app.get('/capacity/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const report = await capacityService.getReport(params.id);
    if (!report) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Report not found' });
    return reply.send({ success: true, data: report });
  });

  // Bottleneck Analysis
  app.get('/capacity/bottlenecks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'capacity', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const bottlenecks = await capacityService.analyzeBottlenecks(tenantId);
    return reply.send({ success: true, data: bottlenecks });
  });
}
