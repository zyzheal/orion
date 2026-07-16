/**
 * Self-Healing API Routes (TASK-702)
 *
 * Prefix: /self-healing (parent mounts under /api/v1 → /api/v1/self-healing)
 *
 * Endpoints:
 *   POST   /incidents                    - Create incident
 *   GET    /incidents/:id                - Get incident detail
 *   GET    /history                      - Healing history
 *   GET    /effectiveness                - Effectiveness metrics
 *   GET    /strategies                   - List strategies
 *   GET    /strategies/:id               - Strategy detail
 *   POST   /strategies/:id/toggle        - Toggle strategy
 *   POST   /strategies                   - Register custom strategy
 *   GET    /approvals                    - List approvals
 *   GET    /approvals/:id                - Approval detail
 *   POST   /approvals/:id/respond        - Respond to approval
 */

import { FastifyInstance } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { SelfHealingController } from '../api/controllers/SelfHealingController';
import { SelfHealingService } from '../services/self-healing/SelfHealingService';
import { SelfHealingRepository } from '../services/self-healing/SelfHealingRepository';
import { OrionError, ErrorCode } from '../errors';

export default async function selfHealingRoutes(
  app: FastifyInstance,
  opts?: { database?: any }
): Promise<void> {
  if (!opts?.database) {
    throw new OrionError('Self-healing routes require database connection', ErrorCode.SERVICE_UNAVAILABLE);
  }

  const repository = new SelfHealingRepository(opts.database);
  const service = new SelfHealingService(repository, undefined, opts.database);
  const controller = new SelfHealingController(service);

  // Incidents
  app.post('/incidents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'write' })],
  }, controller.createIncident.bind(controller));
  app.get('/incidents/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, controller.getIncident.bind(controller));

  // History
  app.get('/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read' })],
  }, controller.getHistory.bind(controller));

  // Effectiveness
  app.get('/effectiveness', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read' })],
  }, controller.getEffectiveness.bind(controller));

  // Strategies
  app.get('/strategies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read' })],
  }, controller.getStrategies.bind(controller));
  app.get('/strategies/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, controller.getStrategy.bind(controller));
  app.post('/strategies/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, controller.toggleStrategy.bind(controller));
  app.post('/strategies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'write' })],
  }, controller.registerStrategy.bind(controller));

  // Approvals
  app.get('/approvals', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read' })],
  }, controller.getApprovals.bind(controller));
  app.get('/approvals/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, controller.getApproval.bind(controller));
  app.post(
    '/approvals/:id/respond',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'selfhealing', action: 'approve', extractResourceId: (req) => (req.params as { id: string }).id })],
    },
    controller.respondToApproval.bind(controller)
  );
}
