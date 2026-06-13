/**
 * Problem Management API Routes (ITIL Standard)
 *
 * Routes under /api/problems
 * Handles problem CRUD, status lifecycle, incident/change linking,
 * Known Error Database (KEDB), and statistics.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ProblemService } from '../services/problem/ProblemService';

export default async function problemRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db;
  const problemService = new ProblemService(db);
  problemService.init();

  // ==================== Problem CRUD ====================

  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const user = (request as any).user;
      const problem = await problemService.createProblem({
        title: body.title,
        description: body.description,
        severity: body.severity,
        category: body.category,
        assignedTo: body.assignedTo,
        createdBy: user?.id || user?.email,
        metadata: body.metadata,
      }, tenantId);
      return reply.status(201).send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const result = await problemService.listProblems(tenantId, {
        status: query.status,
        severity: query.severity,
        assignedTo: query.assignedTo,
        category: query.category,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ data: result.data, total: result.total });
    } catch (error: any) {
      return reply.status(500).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const stats = await problemService.getStats(tenantId);
      return reply.send({ data: stats });
    } catch (error: any) {
      return reply.status(500).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.get('/known-errors', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const result = await problemService.listKnownErrors(tenantId, {
        status: query.status,
        problemId: query.problemId,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ data: result.data, total: result.total });
    } catch (error: any) {
      return reply.status(500).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.get('/known-errors/search', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      if (!query.q) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Search query (q) is required' });
      }
      const results = await problemService.searchKnownErrors(query.q, tenantId);
      return reply.send({ data: results, total: results.length });
    } catch (error: any) {
      return reply.status(500).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.post('/known-errors', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const user = (request as any).user;
      const knownError = await problemService.createKnownError({
        problemId: body.problemId,
        title: body.title,
        symptoms: body.symptoms,
        rootCause: body.rootCause,
        workaround: body.workaround,
        permanentFix: body.permanentFix,
        affectedServices: body.affectedServices,
        keywords: body.keywords,
        createdBy: user?.id || user?.email,
      }, tenantId);
      return reply.status(201).send({ data: knownError });
    } catch (error: any) {
      const status = error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const problem = await problemService.getProblem(id, tenantId);
      return reply.send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const problem = await problemService.updateProblem(id, body, tenantId);
      return reply.send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      await problemService.deleteProblem(id, tenantId);
      return reply.send({ success: true });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Status Lifecycle ====================

  app.patch('/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      if (!body.status) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Status is required' });
      }
      const problem = await problemService.updateStatus(id, body.status, tenantId);
      return reply.send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : error.code === 'STATE_CONFLICT' ? 409 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Incident / Change Linking ====================

  app.post('/:id/incidents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      if (!body.incidentId) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'incidentId is required' });
      }
      const problem = await problemService.linkIncident(id, body.incidentId, tenantId);
      return reply.send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.post('/:id/changes', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      if (!body.changeId) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'changeId is required' });
      }
      const problem = await problemService.linkChange(id, body.changeId, tenantId);
      return reply.send({ data: problem });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Known Error Update/Delete ====================

  app.put('/known-errors/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      const knownError = await problemService.updateKnownError(id, body, tenantId);
      return reply.send({ data: knownError });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });

  app.delete('/known-errors/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'problem', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const tenantId = (request as any).tenantContext?.getCurrentTenant()?.tenantId || 'default';
      await problemService.deleteKnownError(id, tenantId);
      return reply.send({ success: true });
    } catch (error: any) {
      const status = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return reply.status(status).send({ error: error.code || 'INTERNAL_ERROR', message: error.message });
    }
  });
}
