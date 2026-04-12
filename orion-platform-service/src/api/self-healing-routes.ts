/**
 * Self-Healing Engine API Routes
 *
 * Provides endpoints for self-healing operations including incident
 * management, strategy configuration, approval workflows,
 * history queries, and effectiveness metrics.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 * Prefix: /api/v1/self-healing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SelfHealingService } from '../services/self-healing/SelfHealingService';
import { SelfHealingController } from './controllers/SelfHealingController';

export default async function selfHealingRoutes(
  app: FastifyInstance
): Promise<void> {
  // Initialize service and controller
  const selfHealingService = new SelfHealingService();
  const selfHealingController = new SelfHealingController(selfHealingService);

  // ==================== Incident Management ====================

  // POST /self-healing/incidents - Manually trigger a healing incident
  app.post(
    '/incidents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.createIncident(request, reply);
    }
  );

  // GET /self-healing/incidents/:id - Get incident details
  app.get(
    '/incidents/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getIncident(request, reply);
    }
  );

  // ==================== History ====================

  // GET /self-healing/history - Get healing history
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return selfHealingController.getHistory(request, reply);
  });

  // ==================== Effectiveness ====================

  // GET /self-healing/effectiveness - Get healing effectiveness metrics
  app.get(
    '/effectiveness',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getEffectiveness(request, reply);
    }
  );

  // ==================== Strategies ====================

  // GET /self-healing/strategies - Get all healing strategies
  app.get(
    '/strategies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getStrategies(request, reply);
    }
  );

  // GET /self-healing/strategies/:id - Get strategy details
  app.get(
    '/strategies/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getStrategy(request, reply);
    }
  );

  // POST /self-healing/strategies - Register a custom strategy
  app.post(
    '/strategies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.registerStrategy(request, reply);
    }
  );

  // POST /self-healing/strategies/:id/toggle - Enable/disable a strategy
  app.post(
    '/strategies/:id/toggle',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.toggleStrategy(request, reply);
    }
  );

  // ==================== Approval Workflow ====================

  // GET /self-healing/approvals - Get approval requests
  app.get(
    '/approvals',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getApprovals(request, reply);
    }
  );

  // GET /self-healing/approvals/:id - Get approval request details
  app.get(
    '/approvals/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.getApproval(request, reply);
    }
  );

  // POST /self-healing/approvals/:id/respond - Respond to an approval request
  app.post(
    '/approvals/:id/respond',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return selfHealingController.respondToApproval(request, reply);
    }
  );
}
