/**
 * IaC Management API Routes
 *
 * Routes under /api/v1/iac
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceService } from '../services/iac/WorkspaceService';
import { PlanService } from '../services/iac/PlanService';
import { IacController } from './controllers/IacController';
import { EventBusService } from '../services/event-bus-service';

export default async function iacRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService }
): Promise<void> {
  const workspaceService = new WorkspaceService({ eventBus: options?.eventBus });
  const planService = new PlanService({ workspaceService, eventBus: options?.eventBus });
  const controller = new IacController({ workspaceService, planService });

  // ==================== Workspaces ====================

  app.get('/workspaces', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listWorkspaces(request, reply);
  });

  app.post('/workspaces', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createWorkspace(request, reply);
  });

  app.get('/workspaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWorkspace(request, reply);
  });

  app.put('/workspaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateWorkspace(request, reply);
  });

  // ==================== Plan & Apply ====================

  app.post('/workspaces/:id/plan', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.generatePlan(request, reply);
  });

  app.post('/workspaces/:id/apply', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.applyPlan(request, reply);
  });

  // ==================== State & Resources ====================

  app.get('/workspaces/:id/state', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCurrentState(request, reply);
  });

  app.get('/workspaces/:id/resources', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listResources(request, reply);
  });

  app.post('/workspaces/:id/import', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.importResource(request, reply);
  });

  // ==================== Modules ====================

  app.get('/modules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listModules(request, reply);
  });

  app.post('/modules', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createModule(request, reply);
  });
}
