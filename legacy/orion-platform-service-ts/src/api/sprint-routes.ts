/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/sprint/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

/**
 * Sprint Board Routes
 * API endpoints for sprint management and board view
 */
import { FastifyInstance } from 'fastify';
import { SprintRepository } from '../services/rdm/SprintRepository';
import { SprintTicketRepository } from '../services/rdm/SprintTicketRepository';
import { TicketRelationRepository } from '../services/rdm/TicketRelationRepository';
import { SprintBoardService } from '../services/rdm/SprintBoardService';
import { TicketingRepository } from '../services/ticketing/TicketingRepository';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ErrorCodes } from '../types/error-codes';

export default async function sprintRoutes(app: FastifyInstance, options: { database: any }) {
  const sprintRepo = new SprintRepository(options.database);
  const sprintTicketRepo = new SprintTicketRepository(options.database);
  const relationRepo = new TicketRelationRepository(options.database);
  const ticketRepo = new TicketingRepository(options.database);
  const service = new SprintBoardService(sprintRepo, sprintTicketRepo, relationRepo, ticketRepo);

  // List sprints
  app.get('/', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'read' })] }, async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const sprints = await service.listSprints(status ? { status } : undefined);
      return success(reply, request, sprints);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Create sprint
  app.post('/', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'create' })] }, async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.startDate || !body.endDate) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name, startDate, endDate are required');
      }
      const sprint = await service.createSprint({
        name: body.name,
        goal: body.goal,
        start_date: body.startDate,
        end_date: body.endDate,
        capacity: body.capacity,
      });
      return created(reply, request, sprint);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Get sprint detail
  app.get('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'read' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const sprint = await service.getSprint(id);
      if (!sprint) return notFound(reply, request, undefined, 'Sprint not found');
      return success(reply, request, sprint);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Update sprint
  app.put('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'update' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const sprint = await service.updateSprint(id, {
        name: body.name,
        goal: body.goal,
        start_date: body.startDate,
        end_date: body.endDate,
        status: body.status,
        capacity: body.capacity,
      });
      if (!sprint) return notFound(reply, request, undefined, 'Sprint not found');
      return success(reply, request, sprint);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Delete sprint
  app.delete('/:id', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'delete' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await service.deleteSprint(id);
      if (!deleted) return notFound(reply, request, undefined, 'Sprint not found');
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Get sprint board
  app.get('/:id/board', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'read' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const board = await service.getSprintBoard(id);
      if (!board) return notFound(reply, request, undefined, 'Sprint not found');
      return success(reply, request, board);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Add ticket to sprint
  app.post('/:id/tickets', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'update' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { ticketId, sortOrder } = request.body as { ticketId: string; sortOrder?: number };
      if (!ticketId) return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'ticketId is required');
      const result = await service.moveTicketToSprint(id, ticketId, sortOrder);
      return created(reply, request, result);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Remove ticket from sprint
  app.delete('/:id/tickets/:ticketId', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'update' })] }, async (request, reply) => {
    try {
      const { id, ticketId } = request.params as { id: string; ticketId: string };
      const removed = await service.removeTicketFromSprint(id, ticketId);
      if (!removed) return notFound(reply, request, undefined, 'Ticket not found in sprint');
      return success(reply, request, { removed: true });
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Reorder tickets
  app.put('/:id/tickets/reorder', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'update' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { orders } = request.body as { orders: { ticketId: string; sortOrder: number }[] };
      await service.reorderTickets(id, orders);
      return success(reply, request, { updated: true });
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });

  // Get burndown data
  app.get('/:id/burndown', { onRequest: [authenticateUser, requirePermission({ resource: 'sprint', action: 'read' })] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await service.getBurndownData(id);
      return success(reply, request, data);
    } catch (err: any) {
      return internalError(reply, request, err.message);
    }
  });
}