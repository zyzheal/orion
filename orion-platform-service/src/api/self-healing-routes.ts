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
import { SelfHealingController } from '../api/controllers/SelfHealingController';
import { SelfHealingService } from '../services/self-healing/SelfHealingService';
import { SelfHealingRepository } from '../services/self-healing/SelfHealingRepository';

export default async function selfHealingRoutes(
  app: FastifyInstance,
  opts?: { database?: any }
): Promise<void> {
  if (!opts?.database) {
    throw new Error('Self-healing routes require database connection');
  }

  const repository = new SelfHealingRepository(opts.database);
  const service = new SelfHealingService(repository);
  const controller = new SelfHealingController(service);

  // Incidents
  app.post('/incidents', controller.createIncident.bind(controller));
  app.get('/incidents/:id', controller.getIncident.bind(controller));

  // History
  app.get('/history', controller.getHistory.bind(controller));

  // Effectiveness
  app.get('/effectiveness', controller.getEffectiveness.bind(controller));

  // Strategies
  app.get('/strategies', controller.getStrategies.bind(controller));
  app.get('/strategies/:id', controller.getStrategy.bind(controller));
  app.post('/strategies/:id/toggle', controller.toggleStrategy.bind(controller));
  app.post('/strategies', controller.registerStrategy.bind(controller));

  // Approvals
  app.get('/approvals', controller.getApprovals.bind(controller));
  app.get('/approvals/:id', controller.getApproval.bind(controller));
  app.post(
    '/approvals/:id/respond',
    controller.respondToApproval.bind(controller)
  );
}
