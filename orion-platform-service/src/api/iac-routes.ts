/**
 * IaC Management API Routes
 *
 * Routes under /api/v1/iac
 *
 * M20: IaC Workspace management with PostgreSQL persistence.
 * Accepts database pool via options to create repositories.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceService } from '../services/iac/WorkspaceService';
import { PlanService } from '../services/iac/PlanService';
import { IacController } from './controllers/IacController';
import { EventBusService } from '../services/event-bus-service';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

export default async function iacRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService; database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }
): Promise<void> {
  const workspaceService = new WorkspaceService({
    eventBus: options?.eventBus,
    db: options?.database,
  });
  const planService = new PlanService({
    workspaceService,
    eventBus: options?.eventBus,
    db: options?.database,
  });
  const controller = new IacController({ workspaceService, planService });

  // ==================== Workspaces ====================

  app.get('/workspaces', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listWorkspaces(request, reply);
  });

  app.post('/workspaces', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createWorkspace(request, reply);
  });

  app.get('/workspaces/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWorkspace(request, reply);
  });

  app.put('/workspaces/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateWorkspace(request, reply);
  });

  // ==================== Plan & Apply ====================

  app.post('/workspaces/:id/plan', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.generatePlan(request, reply);
  });

  app.post('/workspaces/:id/apply', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'execute' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.applyPlan(request, reply);
  });

  // ==================== State & Resources ====================

  app.get('/workspaces/:id/state', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCurrentState(request, reply);
  });

  app.get('/workspaces/:id/resources', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listResources(request, reply);
  });

  app.post('/workspaces/:id/import', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.importResource(request, reply);
  });

  // ==================== Modules ====================

  app.get('/modules', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listModules(request, reply);
  });

  app.post('/modules', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'write' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createModule(request, reply);
  });

  // ==================== Plan Details ====================

  app.get('/workspaces/:id/plans', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const plans = await planService.listByWorkspace(params.id);
      return reply.send({ code: 200, message: 'OK', data: plans });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/workspaces/:workspaceId/plans/:planId', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { workspaceId: string; planId: string };
    try {
      const plan = await planService.getById(params.planId);
      if (!plan || plan.workspaceId !== params.workspaceId) {
        return reply.status(404).send({ code: 404, message: 'Plan not found' });
      }
      return reply.send({ code: 200, message: 'OK', data: plan });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== State Versions ====================

  app.get('/workspaces/:id/state/versions', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const versions = await workspaceService.listStateVersions(params.id);
      return reply.send({ code: 200, message: 'OK', data: versions });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/workspaces/:id/state/diff', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const query = request.query as { versionA: string; versionB: string };
    if (!query.versionA || !query.versionB) {
      return reply.status(400).send({ code: 400, message: 'versionA and versionB query parameters are required' });
    }
    try {
      const diff = await workspaceService.getStateDiff(params.id, query.versionA, query.versionB);
      return reply.send({ code: 200, message: 'OK', data: diff });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Module Details ====================

  app.get('/modules/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const module = await workspaceService.getModuleById(params.id);
      if (!module) {
        return reply.status(404).send({ code: 404, message: 'Module not found' });
      }
      return reply.send({ code: 200, message: 'OK', data: module });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.delete('/modules/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'iac', action: 'delete' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      await workspaceService.deleteModule(params.id);
      return reply.send({ code: 200, message: 'OK', data: { deleted: true } });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
