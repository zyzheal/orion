/**
 * ChatOps API Routes
 *
 * Routes under /api/v1/chatops
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CommandService } from '../services/chatops/CommandService';
import { ExecutionService } from '../services/chatops/ExecutionService';
import { ChatOpsController } from './controllers/ChatOpsController';
import { EventBusService } from '../services/event-bus-service';

export default async function chatopsRoutes(
  app: FastifyInstance,
  options?: { eventBus?: EventBusService }
): Promise<void> {
  const commandService = new CommandService({ eventBus: options?.eventBus });
  const executionService = new ExecutionService({ commandService, eventBus: options?.eventBus });
  const controller = new ChatOpsController({ commandService, executionService });

  // ==================== Commands ====================

  app.get('/commands', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listCommands(request, reply);
  });

  app.get('/commands/:name/help', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCommandHelp(request, reply);
  });

  // ==================== Execution ====================

  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeCommand(request, reply);
  });

  app.get('/status/:commandId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkExecutionStatus(request, reply);
  });

  // ==================== Webhook ====================

  app.post('/message', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.receiveMessage(request, reply);
  });

  // ==================== Audit ====================

  app.get('/audit/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLogs(request, reply);
  });

  app.get('/audit/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditStats(request, reply);
  });

  app.post('/audit/export', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.exportAuditLogs(request, reply);
  });
}
