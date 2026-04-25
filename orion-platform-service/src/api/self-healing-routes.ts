/**
 * Self-Healing Engine API Routes
 *
 * Provides endpoints for self-healing operations including incident
 * management, strategy configuration, approval workflows,
 * history queries, and effectiveness metrics.
 *
 * TASK-702: Self-Healing Engine (self-healing rules/executions backed by PostgreSQL)
 * Prefix: /api/v1/self-healing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SelfHealingRepository } from '../services/self-healing/SelfHealingRepository';
import { SelfHealingService } from '../services/self-healing/SelfHealingService';
import { SelfHealingController } from './controllers/SelfHealingController';

export interface SelfHealingRoutesOptions {
  database?: DatabasePool;
}

export default async function selfHealingRoutes(
  app: FastifyInstance,
  options: SelfHealingRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new SelfHealingRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[SelfHealingRoutes] No database pool provided, self-healing routes will not be functional');
    return;
  }

  const service = new SelfHealingService(repository);
  const controller = new SelfHealingController(service);

  // ==================== Incident Management ====================

  // POST /self-healing/incidents - Manually trigger a healing incident
  app.post(
    '/incidents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.createIncident(request, reply);
    }
  );

  // GET /self-healing/incidents/:id - Get incident details
  app.get(
    '/incidents/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getIncident(request, reply);
    }
  );

  // ==================== History ====================

  // GET /self-healing/history - Get healing history
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getHistory(request, reply);
  });

  // ==================== Effectiveness ====================

  // GET /self-healing/effectiveness - Get healing effectiveness metrics
  app.get(
    '/effectiveness',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getEffectiveness(request, reply);
    }
  );

  // ==================== Strategies ====================

  // GET /self-healing/strategies - Get all healing strategies
  app.get(
    '/strategies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getStrategies(request, reply);
    }
  );

  // GET /self-healing/strategies/:id - Get strategy details
  app.get(
    '/strategies/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getStrategy(request, reply);
    }
  );

  // POST /self-healing/strategies - Register a custom strategy
  app.post(
    '/strategies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.registerStrategy(request, reply);
    }
  );

  // POST /self-healing/strategies/:id/toggle - Enable/disable a strategy
  app.post(
    '/strategies/:id/toggle',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.toggleStrategy(request, reply);
    }
  );

  // ==================== Approval Workflow ====================

  // GET /self-healing/approvals - Get approval requests
  app.get(
    '/approvals',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getApprovals(request, reply);
    }
  );

  // GET /self-healing/approvals/:id - Get approval request details
  app.get(
    '/approvals/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.getApproval(request, reply);
    }
  );

  // POST /self-healing/approvals/:id/respond - Respond to an approval request
  app.post(
    '/approvals/:id/respond',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return controller.respondToApproval(request, reply);
    }
  );
}
