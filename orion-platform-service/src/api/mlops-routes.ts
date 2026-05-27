/**
 * MLOps API Routes (Phase 4 P0)
 *
 * Routes under /api/v1/mlops
 * Experiment tracking, model registry, training jobs, model deployment, metrics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { MLOpsService } from '../services/mlops/MLOpsService';

const mlopsService = new MLOpsService();

export default async function mlopsRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Experiments ====================

  app.post('/mlops/experiments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const exp = await mlopsService.createExperiment(body, tenantId);
    return reply.status(201).send({ success: true, data: exp });
  });

  app.get('/mlops/experiments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const exps = await mlopsService.listExperiments(tenantId, { status: query.status, project: query.project });
    return reply.send({ success: true, data: exps });
  });

  app.get('/mlops/experiments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const exp = await mlopsService.getExperiment(params.id);
    if (!exp) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Experiment not found' });
    return reply.send({ success: true, data: exp });
  });

  app.put('/mlops/experiments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const exp = await mlopsService.updateExperiment(params.id, body, tenantId);
    if (!exp) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Experiment not found' });
    return reply.send({ success: true, data: exp });
  });

  app.delete('/mlops/experiments/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const deleted = await mlopsService.deleteExperiment(params.id, tenantId);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Experiment not found' });
    return reply.send({ success: true, data: null });
  });

  app.get('/mlops/experiments/:id/runs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const runs = await mlopsService.getExperimentRuns(params.id, tenantId);
    return reply.send({ success: true, data: runs });
  });

  app.post('/mlops/experiments/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const exp = await mlopsService.updateExperimentStatus(params.id, body.status);
    if (!exp) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Experiment not found' });
    return reply.send({ success: true, data: exp });
  });

  // ==================== Model Registry ====================

  app.post('/mlops/models', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const model = await mlopsService.registerModel(body, tenantId);
    return reply.status(201).send({ success: true, data: model });
  });

  app.get('/mlops/models', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const models = await mlopsService.listModels(tenantId, { status: query.status });
    return reply.send({ success: true, data: models });
  });

  app.get('/mlops/models/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const model = await mlopsService.getModel(params.id);
    if (!model) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Model not found' });
    return reply.send({ success: true, data: model });
  });

  app.post('/mlops/models/:id/deploy', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const model = await mlopsService.deployModel(params.id, tenantId, { endpoint: body?.endpoint });
    if (!model) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Model not found' });
    return reply.send({ success: true, data: model });
  });

  app.post('/mlops/models/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const model = await mlopsService.updateModelStatus(params.id, body.status);
    if (!model) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Model not found' });
    return reply.send({ success: true, data: model });
  });

  // ==================== Training Jobs ====================

  app.post('/mlops/training-jobs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const job = await mlopsService.createTrainingJob(body, tenantId);
    return reply.status(201).send({ success: true, data: job });
  });

  app.get('/mlops/training-jobs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const jobs = await mlopsService.listTrainingJobs(tenantId, { status: query.status });
    return reply.send({ success: true, data: jobs });
  });

  app.post('/mlops/training-jobs/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const job = await mlopsService.updateJobStatus(params.id, body.status);
    if (!job) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Training job not found' });
    return reply.send({ success: true, data: job });
  });

  // ==================== Metrics ====================

  app.get('/mlops/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'mlops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const metrics = await mlopsService.getMetrics(tenantId);
    return reply.send({ success: true, data: metrics });
  });
}
