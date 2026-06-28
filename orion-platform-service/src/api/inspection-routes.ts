/**
 * Intelligent Inspection API Routes (Phase 4 - Intelligent Inspection)
 * Automated health checks, inspection rules, reports
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { InspectionService } from '../services/inspection/InspectionService';
import { DatabasePool } from '../services/database';

interface InspectionRoutesOptions {
  database?: DatabasePool;
}

export default async function inspectionRoutes(
  app: FastifyInstance,
  options: InspectionRoutesOptions = {}
): Promise<void> {
  const inspectionService = options.database ? new InspectionService(options.database) : new InspectionService();
  // Rules
  app.post('/inspection/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const rule = await inspectionService.createRule(body, tenantId);
    return reply.status(201).send({ success: true, data: rule });
  });

  app.get('/inspection/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const rulesList = await inspectionService.listRules(tenantId, { target: query.target, enabled: query.enabled });
    return reply.send({ success: true, data: rulesList });
  });

  app.get('/inspection/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const rule = await inspectionService.getRule(params.id);
    if (!rule) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Rule not found' });
    return reply.send({ success: true, data: rule });
  });

  app.put('/inspection/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    const rule = await inspectionService.updateRule(params.id, body);
    if (!rule) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Rule not found' });
    return reply.send({ success: true, data: rule });
  });

  app.delete('/inspection/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await inspectionService.deleteRule(params.id);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Rule not found' });
    return reply.send({ success: true, message: 'Rule deleted' });
  });

  // Tasks
  app.post('/inspection/tasks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const task = await inspectionService.createTask(body.ruleId, tenantId);
    return reply.status(201).send({ success: true, data: task });
  });

  app.get('/inspection/tasks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const taskList = await inspectionService.listTasks(tenantId, { ruleId: query.ruleId, status: query.status });
    return reply.send({ success: true, data: taskList });
  });

  app.get('/inspection/tasks/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const task = await inspectionService.getTask(params.id);
    if (!task) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Task not found' });
    return reply.send({ success: true, data: task });
  });

  // Reports
  app.post('/inspection/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const report = await inspectionService.generateReport(body.title || '自动巡检报告', tenantId, body.ruleIds);
    return reply.status(201).send({ success: true, data: report });
  });

  app.get('/inspection/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const reportList = await inspectionService.listReports(tenantId);
    return reply.send({ success: true, data: reportList });
  });

  app.get('/inspection/reports/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const report = await inspectionService.getReport(params.id);
    if (!report) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Report not found' });
    return reply.send({ success: true, data: report });
  });

  // Health Score
  app.get('/inspection/health-score', {
    onRequest: [authenticateUser, requirePermission({ resource: 'inspection', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const score = await inspectionService.getHealthScore(tenantId);
    return reply.send({ success: true, data: score });
  });
}
