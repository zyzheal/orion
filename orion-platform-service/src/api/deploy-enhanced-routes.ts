/**
 * [ARCHIVED] Deploy Enhanced API Routes
 *
 * This module has been migrated to Go:
 *   orion-platform-svc-go/internal/deploy-enhanced/
 *
 * See cmd/server/main.go for route registration and
 * migrations/001_create_deploy_enhanced_tables.sql for schema.
 */
 *
 * Provides REST API for:
 * - Deploy Windows (environment lock) management: CRUD + check
 * - Progressive Deploy (stage-based): create, advance, rollback, progress
 * - Emergency Deploy: request, approve, complete, reject, list
 *
 * Routes:
 *   Deploy Windows:
 *     GET    /deploy/windows                 - List windows
 *     POST   /deploy/windows                 - Create window
 *     GET    /deploy/windows/:id             - Get window detail
 *     PUT    /deploy/windows/:id             - Update window
 *     DELETE /deploy/windows/:id             - Delete window
 *     GET    /deploy/windows/:id/check       - Check if within window
 *
 *   Progressive Deploy (stage-based):
 *     POST   /deploy/:deploymentId/progressive           - Create progressive deploy
 *     GET    /deploy/progressive/:deployId               - Get progress
 *     POST   /deploy/progressive/:deployId/advance       - Advance to next stage
 *     POST   /deploy/progressive/:deployId/rollback      - Rollback a stage
 *
 *
 *   Emergency Deploy:
 *     POST   /deploy/emergencies                         - Request emergency deploy
 *     GET    /deploy/emergencies                         - List emergencies
 *     POST   /deploy/emergencies/:id/approve             - Approve emergency
 *     POST   /deploy/emergencies/:id/complete            - Complete emergency
 *     POST   /deploy/emergencies/:id/reject              - Reject emergency
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { DeployWindowRepository, DeployWindowService } from '../services/deploy';
import { ProgressiveDeployRepository, ProgressiveDeployService } from '../services/deploy';
import { EmergencyDeployRepository, EmergencyDeployService } from '../services/deploy';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { DeployEnhancedController } from './controllers/DeployEnhancedController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('deploy-enhanced-routes');

interface DeployEnhancedRoutesOptions {
  database?: DatabasePool;
}

export default async function deployEnhancedRoutes(
  app: FastifyInstance,
  options: DeployEnhancedRoutesOptions
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[DeployEnhancedRoutes] No database pool provided, routes will not be functional');
    return;
  }

  // Initialize services
  const windowRepo = new DeployWindowRepository(db);
  const windowService = new DeployWindowService(windowRepo);
  const progressiveRepo = new ProgressiveDeployRepository(db);
  const deployRepo = new DeployRepository(db);
  const progressiveService = new ProgressiveDeployService(progressiveRepo, deployRepo);
  const emergencyRepo = new EmergencyDeployRepository(db);
  const emergencyService = new EmergencyDeployService(emergencyRepo, deployRepo);

  // Initialize controller
  const controller = new DeployEnhancedController(
    windowService,
    progressiveService,
    emergencyService,
  );

  // ==================== Deploy Windows CRUD ====================

  /**
   * GET /deploy/windows - List deploy windows
   */
  app.get('/deploy/windows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listWindows(request, reply);
  });

  /**
   * POST /deploy/windows - Create a deploy window
   */
  app.post('/deploy/windows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createWindow(request, reply);
  });

  /**
   * GET /deploy/windows/:id - Get window detail
   */
  app.get('/deploy/windows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getWindow(request, reply);
  });

  /**
   * PUT /deploy/windows/:id - Update a deploy window
   */
  app.put('/deploy/windows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateWindow(request, reply);
  });

  /**
   * DELETE /deploy/windows/:id - Delete a deploy window
   */
  app.delete('/deploy/windows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteWindow(request, reply);
  });

  /**
   * GET /deploy/windows/:id/check - Check if current time is within window
   */
  app.get('/deploy/windows/:id/check', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkWindow(request, reply);
  });

  // ==================== Progressive Deploy (Stage-based) ====================

  /**
   * POST /deploy/:deploymentId/progressive - Create a progressive deployment
   */
  app.post('/deploy/:deploymentId/progressive', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createProgressiveDeploy(request, reply);
  });

  /**
   * GET /deploy/progressive/:deployId - Get progressive deployment progress
   */
  app.get('/deploy/progressive/:deployId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getProgress(request, reply);
  });

  /**
   * POST /deploy/progressive/:deployId/advance - Advance to next stage
   */
  app.post('/deploy/progressive/:deployId/advance', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.advanceStage(request, reply);
  });

  /**
   * POST /deploy/progressive/:deployId/rollback - Rollback a stage
   */
  app.post('/deploy/progressive/:deployId/rollback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rollbackStage(request, reply);
  });

  // ==================== Emergency Deploy ====================

  /**
   * POST /deploy/emergencies - Request an emergency deployment
   */
  app.post('/deploy/emergencies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.requestEmergencyDeploy(request, reply);
  });

  /**
   * GET /deploy/emergencies - List emergency deployments
   */
  app.get('/deploy/emergencies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listEmergencies(request, reply);
  });

  /**
   * POST /deploy/emergencies/:id/approve - Approve an emergency deployment
   */
  app.post('/deploy/emergencies/:id/approve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.approveEmergencyDeploy(request, reply);
  });

  /**
   * POST /deploy/emergencies/:id/complete - Complete an emergency deployment
   */
  app.post('/deploy/emergencies/:id/complete', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.completeEmergencyDeploy(request, reply);
  });

  /**
   * POST /deploy/emergencies/:id/reject - Reject an emergency deployment
   */
  app.post('/deploy/emergencies/:id/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.requestEmergencyDeploy(request, reply);
  });

  logger.info('[DeployEnhancedRoutes] Registered deploy enhanced routes');
}
