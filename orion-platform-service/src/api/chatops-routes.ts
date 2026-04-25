/**
 * ChatOps API Routes
 *
 * Routes under /api/v1/chatops
 * Migrated to PostgreSQL Repository pattern (M35)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { EventBusService } from '../services/event-bus-service';
import {
  ChatOpsCommandRepository,
  ChatOpsExecutionRepository,
  ChatOpsSessionRepository,
  ChatOpsAuditLogRepository,
} from '../repositories/ChatOpsRepository';
import { CommandService } from '../services/chatops/CommandService';
import { ExecutionService } from '../services/chatops/ExecutionService';
import { ChatOpsController } from './controllers/ChatOpsController';

interface ChatOpsRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

export default async function chatopsRoutes(
  app: FastifyInstance,
  options: ChatOpsRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[ChatOpsRoutes] No database pool provided, chatops routes will not be functional');
    return;
  }

  // Initialize repositories
  const commandRepo = new ChatOpsCommandRepository(options.database);
  const executionRepo = new ChatOpsExecutionRepository(options.database);
  const sessionRepo = new ChatOpsSessionRepository(options.database);
  const auditRepo = new ChatOpsAuditLogRepository(options.database);

  // Initialize services
  const commandService = new CommandService({
    eventBus: options.eventBus,
    repository: commandRepo,
  });
  const executionService = new ExecutionService({
    commandService,
    eventBus: options.eventBus,
    executionRepo,
    sessionRepo,
    auditRepo,
  });

  // Seed default commands on startup (idempotent)
  await commandService.seedDefaults();

  // Initialize controller
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
