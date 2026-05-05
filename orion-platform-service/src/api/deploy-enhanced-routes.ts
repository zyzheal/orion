/**
 * Deploy Enhanced API Routes
 *
 * Provides endpoints for deploy windows, progressive deployments,
 * and emergency deployments.
 *
 * Phase 1: Deploy Release Enhancement
 * Prefix: /api/v1/deploy
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { DeployWindowRepository } from '../services/deploy/DeployWindowRepository';
import { DeployWindowService } from '../services/deploy/DeployWindowService';
import { ProgressiveDeployRepository } from '../services/deploy/ProgressiveDeployRepository';
import { ProgressiveDeployService } from '../services/deploy/ProgressiveDeployService';
import { EmergencyDeployRepository } from '../services/deploy/EmergencyDeployRepository';
import { EmergencyDeployService } from '../services/deploy/EmergencyDeployService';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { DeployEnhancedController } from './controllers/DeployEnhancedController';

/**
 * Options passed to deploy enhanced routes via app.register()
 */
interface DeployEnhancedRoutesOptions {
  database?: DatabasePool;
}

export default async function deployEnhancedRoutes(
  app: FastifyInstance,
  options: DeployEnhancedRoutesOptions
): Promise<void> {
  // ==================== Service Initialization ====================

  let deployWindowService: DeployWindowService | null = null;
  let progressiveDeployService: ProgressiveDeployService | null = null;
  let emergencyDeployService: EmergencyDeployService | null = null;

  if (options.database) {
    const deployWindowRepo = new DeployWindowRepository(options.database);
    deployWindowService = new DeployWindowService(deployWindowRepo);

    const progressiveDeployRepo = new ProgressiveDeployRepository(options.database);
    const deployRepo = new DeployRepository(options.database);
    progressiveDeployService = new ProgressiveDeployService(progressiveDeployRepo, deployRepo);

    const emergencyDeployRepo = new EmergencyDeployRepository(options.database);
    emergencyDeployService = new EmergencyDeployService(emergencyDeployRepo, deployRepo);

    console.log('[DeployEnhancedRoutes] Database-backed enhanced deploy services initialized');
  } else {
    console.warn('[DeployEnhancedRoutes] Database not available, enhanced deploy routes will not be functional');
  }

  const controller = new DeployEnhancedController(
    deployWindowService!,
    progressiveDeployService!,
    emergencyDeployService!
  );

  // ==================== Deploy Window Routes ====================

  // GET /deploy/windows - List deploy windows
  app.get('/windows', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.listWindows(request, reply);
  });

  // POST /deploy/windows - Create a deploy window
  app.post('/windows', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.createWindow(request, reply);
  });

  // GET /deploy/windows/:id - Get window details
  app.get('/windows/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.getWindow(request, reply);
  });

  // PUT /deploy/windows/:id - Update a deploy window
  app.put('/windows/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.updateWindow(request, reply);
  });

  // DELETE /deploy/windows/:id - Delete a deploy window
  app.delete('/windows/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.deleteWindow(request, reply);
  });

  // GET /deploy/windows/:id/check - Check if current time is within window
  app.get('/windows/:id/check', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployWindowService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.checkWindow(request, reply);
  });

  // ==================== Progressive Deploy Routes ====================

  // POST /deploy/:deploymentId/progressive - Create a progressive deployment
  app.post('/:deploymentId/progressive', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!progressiveDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.createProgressiveDeploy(request, reply);
  });

  // GET /deploy/progressive/:deployId - Get progressive deployment progress
  app.get('/progressive/:deployId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!progressiveDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.getProgress(request, reply);
  });

  // POST /deploy/progressive/:deployId/advance - Advance to next stage
  app.post('/progressive/:deployId/advance', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!progressiveDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.advanceStage(request, reply);
  });

  // POST /deploy/progressive/:deployId/rollback - Rollback a stage
  app.post('/progressive/:deployId/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!progressiveDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.rollbackStage(request, reply);
  });

  // ==================== Emergency Deploy Routes ====================

  // POST /deploy/emergencies - Request an emergency deployment
  app.post('/emergencies', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!emergencyDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.requestEmergencyDeploy(request, reply);
  });

  // POST /deploy/emergencies/:id/approve - Approve an emergency deployment
  app.post('/emergencies/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!emergencyDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.approveEmergencyDeploy(request, reply);
  });

  // POST /deploy/emergencies/:id/complete - Complete an emergency deployment
  app.post('/emergencies/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!emergencyDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.completeEmergencyDeploy(request, reply);
  });

  // GET /deploy/emergencies - List emergency deployments
  app.get('/emergencies', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!emergencyDeployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }
    return controller.listEmergencies(request, reply);
  });
}
